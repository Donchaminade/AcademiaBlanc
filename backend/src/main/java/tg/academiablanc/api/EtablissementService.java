package tg.academiablanc.api;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Locale;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import tg.academiablanc.abonnement.AbonnementService;
import tg.academiablanc.domain.AnneeScolaire;
import tg.academiablanc.domain.Etablissement;
import tg.academiablanc.domain.Forfait;
import tg.academiablanc.domain.Role;
import tg.academiablanc.domain.Utilisateur;
import tg.academiablanc.repo.AnneeScolaireRepository;
import tg.academiablanc.repo.EtablissementRepository;
import tg.academiablanc.repo.PrereglageNationalRepository;
import tg.academiablanc.repo.UtilisateurRepository;

/** Création d’un établissement et de son compte OWNER (inscription publique ou ajout par la plateforme). */
@Service
public class EtablissementService {
  private final EtablissementRepository etablissements;
  private final UtilisateurRepository utilisateurs;
  private final AnneeScolaireRepository annees;
  private final PasswordEncoder passwordEncoder;
  private final PrereglageNationalRepository prereglages;
  private final AbonnementService abonnements;
  private final CodeTransfertService codesTransfert;

  public EtablissementService(
      EtablissementRepository etablissements,
      UtilisateurRepository utilisateurs,
      AnneeScolaireRepository annees,
      PasswordEncoder passwordEncoder,
      PrereglageNationalRepository prereglages,
      AbonnementService abonnements,
      CodeTransfertService codesTransfert
  ) {
    this.etablissements = etablissements;
    this.utilisateurs = utilisateurs;
    this.annees = annees;
    this.passwordEncoder = passwordEncoder;
    this.prereglages = prereglages;
    this.abonnements = abonnements;
    this.codesTransfert = codesTransfert;
  }

  public record Creation(Etablissement etablissement, Utilisateur owner) {}

  /** Création par la plateforme (ou sans forfait) : l'établissement démarre en essai. */
  @Transactional
  public Creation creer(String nom, String ville, String email, String motDePasse, String nomResponsable,
                        String telephone, String region, String typeEtablissement, Long creePar) {
    return creer(nom, ville, email, motDePasse, nomResponsable, telephone, region, typeEtablissement, creePar, null);
  }

  /**
   * L’email est partagé par l’établissement et son OWNER ; il doit être libre des deux côtés.
   * {@code forfaitChoisi} : forfait retenu à l'inscription publique (statut initial selon la configuration) ;
   * null quand la plateforme crée l'établissement (essai immédiat).
   */
  @Transactional
  public Creation creer(String nom, String ville, String email, String motDePasse, String nomResponsable,
                        String telephone, String region, String typeEtablissement, Long creePar, Forfait forfaitChoisi) {
    String normalise = normaliser(email);
    if (utilisateurs.findByEmailIgnoreCase(normalise).isPresent() || etablissements.findByEmailIgnoreCase(normalise).isPresent()) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Cet email est déjà utilisé.");
    }
    String code = codeFrom(nom, ville);
    int suffix = 1;
    String unique = code;
    while (etablissements.existsByCode(unique)) {
      suffix++;
      unique = code + "-" + suffix;
    }

    Etablissement school = new Etablissement();
    school.setNom(nom.trim());
    school.setCode(unique);
    school.setVille(ville.trim());
    school.setRegion(blankToNull(region));
    school.setTypeEtablissement(blankToNull(typeEtablissement));
    school.setEmail(normalise);
    school.setTelephone(blankToNull(telephone));
    school.setNomResponsable(nomResponsable.trim());
    school.setActif(true);
    school.setCreeLe(Instant.now());
    // Code de transfert personnel, dès la création : l'établissement peut recevoir des paquets d'examen blanc.
    school.setCodeTransfert(codesTransfert.nouveauCode());
    // Un nouvel établissement part de l'en-tête du préréglage national par défaut (sinon du premier actif).
    prereglages.findByParDefautTrue().stream().filter(p -> p.isActif()).findFirst()
        .or(() -> prereglages.findByActifTrueOrderByOrdreAscNomPaysAsc().stream().findFirst())
        .ifPresent(school::appliquer);
    school = etablissements.save(school);

    Utilisateur owner = new Utilisateur();
    owner.setEtablissementId(school.getId());
    owner.setEmail(normalise);
    owner.setMotDePasseHash(passwordEncoder.encode(motDePasse));
    owner.setNom(nomResponsable.trim());
    // Le créateur du compte d'établissement est son OWNER. SUPER_ADMIN ne s'obtient jamais ici.
    owner.setRole(Role.OWNER);
    owner.setActif(true);
    owner.setCreePar(creePar);
    owner = utilisateurs.save(owner);

    AnneeScolaire annee = new AnneeScolaire();
    annee.setEtablissementId(school.getId());
    annee.setLibelle("2024-2025");
    annee.setDateDebut(LocalDate.of(2024, 9, 1));
    annee.setDateFin(LocalDate.of(2025, 7, 31));
    annee.setCourante(true);
    annees.save(annee);

    abonnements.initialiser(school, forfaitChoisi, creePar != null, normalise);

    return new Creation(school, owner);
  }

  public static String normaliser(String email) {
    return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
  }

  private static String codeFrom(String nom, String ville) {
    String left = nom.replaceAll("[^A-Za-z]", "").toUpperCase(Locale.ROOT);
    String right = ville.replaceAll("[^A-Za-z]", "").toUpperCase(Locale.ROOT);
    left = left.length() > 4 ? left.substring(0, 4) : left;
    right = right.length() > 4 ? right.substring(0, 4) : right;
    if (left.isBlank()) left = "ETAB";
    if (right.isBlank()) right = "VILLE";
    return left + "-" + right + "-01";
  }

  private static String blankToNull(String value) {
    if (value == null || value.isBlank()) return null;
    return value.trim();
  }
}
