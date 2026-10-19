package tg.academiablanc.api;

import java.security.SecureRandom;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import tg.academiablanc.domain.Etablissement;
import tg.academiablanc.repo.EtablissementRepository;

/**
 * Code de transfert personnel d'un établissement : huit caractères pris dans un alphabet sans ambiguïté
 * (ni 0/O, ni 1/I/L), présentés par groupes de quatre (« K7F3-9QZT »). Le code identifie l'établissement
 * comme destinataire d'un transfert d'examen blanc ; il est :
 * <ul>
 *   <li>généré à la création du compte et, au démarrage, pour tout établissement qui n'en a pas encore ;</li>
 *   <li>visible du seul chef d'établissement (OWNER / ADMIN), jamais journalisé ;</li>
 *   <li>régénéré à la demande du chef (l'ancien code devient aussitôt invalide) et automatiquement à chaque
 *       acceptation d'un transfert.</li>
 * </ul>
 * La résolution d'un code ({@link #resoudre}) est bornée par utilisateur pour décourager l'énumération, et
 * répond de la même manière qu'il soit inconnu ou inactif.
 */
@Service
public class CodeTransfertService implements ApplicationRunner {
  static final String ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  static final int LONGUEUR = 8;
  /** Tentatives de résolution infructueuses tolérées par utilisateur dans la fenêtre. */
  static final int TENTATIVES_MAX = 20;
  static final long FENETRE_MS = 10 * 60 * 1000L;
  public static final String MESSAGE_CODE_INCONNU = "Aucun établissement actif ne correspond à ce code.";

  private final EtablissementRepository etablissements;
  private final SecureRandom alea = new SecureRandom();
  private final ConcurrentMap<Long, Compteur> tentatives = new ConcurrentHashMap<>();

  public CodeTransfertService(EtablissementRepository etablissements) {
    this.etablissements = etablissements;
  }

  /** Au démarrage : tout établissement sans code en reçoit un (comptes antérieurs à la migration V24). */
  @Override
  @Transactional
  public void run(ApplicationArguments args) {
    List<Etablissement> sansCode = etablissements.findByCodeTransfertIsNull();
    for (Etablissement etablissement : sansCode) {
      etablissement.setCodeTransfert(genererUnique());
      etablissements.save(etablissement);
    }
  }

  /** Code courant de l'établissement, généré à la volée s'il manque encore. */
  @Transactional
  public String codeDe(Etablissement etablissement) {
    if (etablissement.getCodeTransfert() == null || etablissement.getCodeTransfert().isBlank()) {
      etablissement.setCodeTransfert(genererUnique());
      etablissements.save(etablissement);
    }
    return etablissement.getCodeTransfert();
  }

  /** Remplace le code de l'établissement : l'ancien n'est plus reconnu dès l'enregistrement. */
  @Transactional
  public String regenerer(Etablissement etablissement) {
    String precedent = etablissement.getCodeTransfert();
    String nouveau;
    do {
      nouveau = genererUnique();
    } while (nouveau.equals(precedent));
    etablissement.setCodeTransfert(nouveau);
    etablissements.save(etablissement);
    return nouveau;
  }

  /**
   * Établissement actif portant ce code. Réponse identique (vide) pour un code inconnu, mal formé ou porté par
   * un établissement désactivé ; au-delà de {@link #TENTATIVES_MAX} échecs en dix minutes, 429.
   */
  @Transactional(readOnly = true)
  public Optional<Etablissement> resoudre(String code, Long utilisateurId) {
    verifierQuota(utilisateurId);
    String normalise = normaliser(code);
    Optional<Etablissement> trouve = normalise == null ? Optional.empty()
        : etablissements.findByCodeTransfert(normalise).filter(Etablissement::isActif);
    if (trouve.isEmpty()) compterEchec(utilisateurId);
    else tentatives.remove(utilisateurId);
    return trouve;
  }

  /** « k7f39qzt », « K7F3 9QZT » → « K7F3-9QZT » ; null si la saisie n'a pas huit caractères de l'alphabet. */
  public static String normaliser(String saisie) {
    if (saisie == null) return null;
    String brut = saisie.toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]", "");
    if (brut.length() != LONGUEUR) return null;
    for (char c : brut.toCharArray()) {
      if (ALPHABET.indexOf(c) < 0) return null;
    }
    return brut.substring(0, 4) + "-" + brut.substring(4);
  }

  /** Code neuf, libre, pour un établissement en cours de création. */
  public String nouveauCode() {
    return genererUnique();
  }

  private String genererUnique() {
    for (int essai = 0; essai < 50; essai++) {
      String code = generer();
      if (!etablissements.existsByCodeTransfert(code)) return code;
    }
    throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Génération du code de transfert impossible, réessayez.");
  }

  String generer() {
    StringBuilder sb = new StringBuilder(LONGUEUR + 1);
    for (int i = 0; i < LONGUEUR; i++) {
      if (i == 4) sb.append('-');
      sb.append(ALPHABET.charAt(alea.nextInt(ALPHABET.length())));
    }
    return sb.toString();
  }

  private void verifierQuota(Long utilisateurId) {
    if (utilisateurId == null) return;
    Compteur compteur = tentatives.get(utilisateurId);
    if (compteur == null) return;
    long maintenant = System.currentTimeMillis();
    if (maintenant - compteur.debut > FENETRE_MS) {
      tentatives.remove(utilisateurId);
      return;
    }
    if (compteur.echecs >= TENTATIVES_MAX) {
      throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
          "Trop de codes incorrects : réessayez dans quelques minutes.");
    }
  }

  private void compterEchec(Long utilisateurId) {
    if (utilisateurId == null) return;
    long maintenant = System.currentTimeMillis();
    tentatives.compute(utilisateurId, (id, courant) -> {
      if (courant == null || maintenant - courant.debut > FENETRE_MS) return new Compteur(maintenant, 1);
      return new Compteur(courant.debut, courant.echecs + 1);
    });
  }

  private record Compteur(long debut, int echecs) {}
}
