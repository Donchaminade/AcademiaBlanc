package tg.academiablanc.api;

import java.time.Instant;
import java.util.Locale;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import tg.academiablanc.domain.Etablissement;
import tg.academiablanc.domain.PrereglageNational;
import tg.academiablanc.domain.SessionStatut;
import tg.academiablanc.domain.Utilisateur;
import tg.academiablanc.repo.ClasseRepository;
import tg.academiablanc.repo.EleveRepository;
import tg.academiablanc.repo.EtablissementRepository;
import tg.academiablanc.repo.ProfesseurRepository;
import tg.academiablanc.repo.SessionExamenRepository;
import tg.academiablanc.repo.UtilisateurRepository;

/**
 * Profil de l'établissement porté par le jeton : fiche d'identité modifiable et effectifs réels.
 * Un compte de la plateforme sans établissement n'a aucun profil (404).
 */
@Service
public class ProfilEtablissementService {
  public static final String MESSAGE_SANS_ETABLISSEMENT = "Aucun établissement n’est rattaché à ce compte.";

  private final EtablissementRepository etablissements;
  private final UtilisateurRepository utilisateurs;
  private final ClasseRepository classes;
  private final EleveRepository eleves;
  private final ProfesseurRepository professeurs;
  private final SessionExamenRepository sessions;
  private final PrereglageNationalService prereglages;

  public ProfilEtablissementService(
      EtablissementRepository etablissements,
      UtilisateurRepository utilisateurs,
      ClasseRepository classes,
      EleveRepository eleves,
      ProfesseurRepository professeurs,
      SessionExamenRepository sessions,
      PrereglageNationalService prereglages
  ) {
    this.etablissements = etablissements;
    this.utilisateurs = utilisateurs;
    this.classes = classes;
    this.eleves = eleves;
    this.professeurs = professeurs;
    this.sessions = sessions;
    this.prereglages = prereglages;
  }

  /** Fiche renvoyée par {@code GET /api/etablissement}. */
  public record Profil(
      Long id,
      String nom,
      String code,
      String typeEtablissement,
      String ville,
      String region,
      String adresse,
      String telephone,
      String email,
      String nomResponsable,
      String devise,
      boolean actif,
      Instant creeLe,
      /** Logo conservé en base (data URL) ; null = aucun logo, le client affiche les initiales. Modifié via la charte. */
      String logoUrl,
      /** Dernière modification du logo, du cachet ou des signatures ; null si aucune image n'a été enregistrée. */
      Instant charteModifieeLe,
      EnTete enTete
  ) {
    static Profil of(Etablissement school) {
      return new Profil(
          school.getId(), school.getNom(), school.getCode(), school.getTypeEtablissement(), school.getVille(),
          school.getRegion(), school.getAdresse(), school.getTelephone(), school.getEmail(), school.getNomResponsable(),
          school.getDevise(), school.isActif(), school.getCreeLe(), school.getLogoUrl(), school.getCharteModifieeLe(),
          EnTete.of(school));
    }
  }

  /**
   * En-tête officiel du bulletin (république, devise nationale, ministère, sigle…), copié depuis le préréglage
   * national appliqué puis librement modifiable. {@code prereglageNationalId} rappelle le dernier préréglage appliqué.
   */
  public record EnTete(
      Long prereglageNationalId,
      String republique,
      String deviseNationale,
      String ministere,
      String sigleMinistere,
      String autoriteRegionale,
      String piedDePage
  ) {
    static EnTete of(Etablissement school) {
      return new EnTete(school.getPrereglageNationalId(), school.getRepublique(), school.getDeviseNationale(),
          school.getMinistere(), school.getSigleMinistere(), school.getAutoriteRegionale(), school.getPiedDePage());
    }
  }

  /**
   * Champs modifiables par {@code PUT /api/etablissement}. Le code, l'état actif et la date ne sont pas éditables ici.
   * {@code enTete} est facultatif : absent, l'en-tête du bulletin reste inchangé.
   */
  public record Modification(
      String nom,
      String typeEtablissement,
      String ville,
      String region,
      String adresse,
      String telephone,
      String email,
      String nomResponsable,
      String devise,
      EnTete enTete
  ) {}

  /** Effectifs réels de l'établissement ({@code GET /api/etablissement/statistiques}). */
  public record Statistiques(
      long utilisateurs,
      long classes,
      long eleves,
      long professeurs,
      long sessions,
      long archives
  ) {}

  @Transactional(readOnly = true)
  public Profil profil(Utilisateur courant) {
    return Profil.of(school(courant));
  }

  @Transactional(readOnly = true)
  public Statistiques statistiques(Utilisateur courant) {
    Long id = school(courant).getId();
    long archives = sessions.findByEtablissementIdOrderByNomAsc(id).stream()
        .filter(session -> SessionStatut.estArchivee(session.getStatut()))
        .count();
    return new Statistiques(
        utilisateurs.countByEtablissementId(id),
        classes.countByEtablissementId(id),
        eleves.countByEtablissementId(id),
        professeurs.countByEtablissementId(id),
        sessions.countByEtablissementId(id),
        archives);
  }

  @Transactional
  public Profil modifier(Utilisateur courant, Modification request) {
    Etablissement school = school(courant);
    String nom = obligatoire(request.nom(), "Le nom de l’établissement est obligatoire.", 180);
    String ville = obligatoire(request.ville(), "La ville est obligatoire.", 120);
    String responsable = obligatoire(request.nomResponsable(), "Le nom du responsable est obligatoire.", 180);
    String email = EtablissementService.normaliser(request.email());
    if (email.isBlank() || !email.contains("@") || email.length() > 180) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "L’email de contact est invalide.");
    }
    Optional<Etablissement> homonyme = etablissements.findByEmailIgnoreCase(email);
    if (homonyme.isPresent() && !homonyme.get().getId().equals(school.getId())) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Cet email est déjà utilisé par un autre établissement.");
    }
    school.setNom(nom);
    school.setVille(ville);
    school.setNomResponsable(responsable);
    school.setEmail(email);
    school.setTypeEtablissement(facultatif(request.typeEtablissement(), 160));
    school.setRegion(facultatif(request.region(), 120));
    school.setAdresse(facultatif(request.adresse(), 240));
    school.setTelephone(facultatif(request.telephone(), 40));
    school.setDevise(facultatif(request.devise(), 160));
    if (request.enTete() != null) appliquerEnTete(school, request.enTete());
    return Profil.of(etablissements.save(school));
  }

  /** {@code PUT /api/etablissement/en-tete} : modifie seulement l'en-tête du bulletin. */
  @Transactional
  public Profil modifierEnTete(Utilisateur courant, EnTete enTete) {
    Etablissement school = school(courant);
    appliquerEnTete(school, enTete);
    return Profil.of(etablissements.save(school));
  }

  /** {@code POST /api/etablissement/prereglage-national/{id}} : copie le préréglage dans l'en-tête et mémorise son identifiant. */
  @Transactional
  public Profil appliquerPrereglage(Utilisateur courant, Long prereglageId) {
    Etablissement school = school(courant);
    PrereglageNational prereglage = prereglages.applicable(prereglageId);
    school.appliquer(prereglage);
    return Profil.of(etablissements.save(school));
  }

  private void appliquerEnTete(Etablissement school, EnTete enTete) {
    school.setRepublique(facultatif(enTete.republique(), 160));
    school.setDeviseNationale(facultatif(enTete.deviseNationale(), 160));
    school.setMinistere(facultatif(enTete.ministere(), 240));
    school.setSigleMinistere(facultatif(enTete.sigleMinistere(), 20));
    school.setAutoriteRegionale(facultatif(enTete.autoriteRegionale(), 160));
    school.setPiedDePage(facultatif(enTete.piedDePage(), 240));
    // L'identifiant n'est conservé que s'il désigne un préréglage existant (un préréglage inactif reste référencé).
    Long id = enTete.prereglageNationalId();
    school.setPrereglageNationalId(id != null && prereglages.existe(id) ? id : null);
  }

  private Etablissement school(Utilisateur courant) {
    if (courant.getEtablissementId() == null) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, MESSAGE_SANS_ETABLISSEMENT);
    }
    return etablissements.findById(courant.getEtablissementId())
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Établissement introuvable."));
  }

  private static String obligatoire(String value, String message, int max) {
    if (value == null || value.isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    return borner(value.trim(), max);
  }

  private static String facultatif(String value, int max) {
    if (value == null || value.isBlank()) return null;
    return borner(value.trim(), max);
  }

  private static String borner(String value, int max) {
    if (value.length() > max) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
          String.format(Locale.ROOT, "Valeur trop longue (%d caractères maximum).", max));
    }
    return value;
  }
}
