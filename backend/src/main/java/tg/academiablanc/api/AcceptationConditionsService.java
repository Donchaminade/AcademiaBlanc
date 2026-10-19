package tg.academiablanc.api;

import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import tg.academiablanc.domain.AcceptationConditions;
import tg.academiablanc.domain.Role;
import tg.academiablanc.domain.Utilisateur;
import tg.academiablanc.repo.AcceptationConditionsRepository;

/**
 * Preuve d'acceptation des documents légaux (CGU, conditions d'utilisation, politique de confidentialité).
 *
 * <p>Une ligne est écrite à l'inscription — dans la transaction qui crée l'établissement et son OWNER —
 * puis une nouvelle ligne à chaque ré-acceptation lorsque la version des conditions publiée par le front
 * ({@code src/legal/versions.ts}) change. L'horodatage est toujours celui du serveur, en UTC.
 */
@Service
public class AcceptationConditionsService {
  public static final String MESSAGE_ACCEPTATION_REQUISE =
      "Vous devez accepter les Conditions générales d’utilisation, les Conditions d’utilisation et la Politique de confidentialité.";
  public static final String MESSAGE_ROLE_REQUIS =
      "Seul le responsable ou un administrateur de l’établissement peut accepter les conditions.";
  public static final String MESSAGE_LECTURE_RESERVEE =
      "La consultation des acceptations est réservée au responsable et aux administrateurs de l’établissement.";

  private final AcceptationConditionsRepository acceptations;
  /** Version de repli quand le client n'indique pas la version qu'il affiche (voir application.yml). */
  private final String versionParDefaut;

  public AcceptationConditionsService(
      AcceptationConditionsRepository acceptations,
      @Value("${app.conditions.version:2026-10-19}") String versionParDefaut
  ) {
    this.acceptations = acceptations;
    this.versionParDefaut = versionParDefaut;
  }

  /** Vue renvoyée au chef d'établissement : {@code accepteLe} en ISO 8601 UTC. */
  public record Vue(
      Long id,
      Long utilisateurId,
      String email,
      String versionConditions,
      Instant accepteLe,
      String adresseIp,
      String userAgent
  ) {
    static Vue de(AcceptationConditions a) {
      return new Vue(a.getId(), a.getUtilisateurId(), a.getEmail(), a.getVersionConditions(), a.getAccepteLe(),
          a.getAdresseIp(), a.getUserAgent());
    }
  }

  /** Dernière acceptation d'un établissement, ou {@code null} si aucune n'a encore été enregistrée. */
  public record Derniere(String versionConditions, Instant accepteLe, String email) {}

  /** 400 si la case n'a pas été cochée : le serveur ne se fie jamais au seul front. */
  public static void exigerAcceptation(Boolean acceptationConditions) {
    if (!Boolean.TRUE.equals(acceptationConditions)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, MESSAGE_ACCEPTATION_REQUISE);
    }
  }

  /** Rôles autorisés à accepter les conditions au nom de l'établissement et à consulter l'historique. */
  public static boolean peutGerer(Utilisateur user) {
    return user.getEtablissementId() != null && (user.getRole() == Role.OWNER || user.getRole() == Role.ADMIN);
  }

  /**
   * Enregistre une acceptation (participe à la transaction appelante : l'inscription écrit cette ligne
   * dans la même transaction que l'établissement et son OWNER).
   */
  @Transactional
  public AcceptationConditions enregistrer(Utilisateur utilisateur, String versionConditions, HttpServletRequest requete) {
    AcceptationConditions ligne = new AcceptationConditions();
    ligne.setEtablissementId(utilisateur.getEtablissementId());
    ligne.setUtilisateurId(utilisateur.getId());
    ligne.setEmail(utilisateur.getEmail());
    ligne.setVersionConditions(version(versionConditions));
    ligne.setAccepteLe(Instant.now());
    ligne.setAdresseIp(adresseIp(requete));
    ligne.setUserAgent(tronquer(requete == null ? null : requete.getHeader("User-Agent"), AcceptationConditions.USER_AGENT_MAX));
    return acceptations.save(ligne);
  }

  @Transactional(readOnly = true)
  public List<Vue> historique(Long etablissementId) {
    return acceptations.findByEtablissementIdOrderByAccepteLeDescIdDesc(etablissementId).stream().map(Vue::de).toList();
  }

  @Transactional(readOnly = true)
  public Optional<Derniere> derniere(Long etablissementId) {
    return acceptations.findFirstByEtablissementIdOrderByAccepteLeDescIdDesc(etablissementId)
        .map(a -> new Derniere(a.getVersionConditions(), a.getAccepteLe(), a.getEmail()));
  }

  private String version(String demandee) {
    String propre = demandee == null ? "" : demandee.trim();
    return propre.isEmpty() ? versionParDefaut : tronquer(propre, 40);
  }

  /** Première adresse de {@code X-Forwarded-For} (derrière le proxy de l'hébergeur), sinon l'adresse distante. */
  static String adresseIp(HttpServletRequest requete) {
    if (requete == null) return null;
    String transmise = requete.getHeader("X-Forwarded-For");
    if (transmise != null && !transmise.isBlank()) {
      return tronquer(transmise.split(",")[0].trim(), AcceptationConditions.ADRESSE_IP_MAX);
    }
    return tronquer(requete.getRemoteAddr(), AcceptationConditions.ADRESSE_IP_MAX);
  }

  static String tronquer(String valeur, int max) {
    if (valeur == null) return null;
    String propre = valeur.trim();
    if (propre.isEmpty()) return null;
    return propre.length() > max ? propre.substring(0, max) : propre;
  }
}
