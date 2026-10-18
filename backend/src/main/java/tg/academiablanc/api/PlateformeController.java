package tg.academiablanc.api;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import tg.academiablanc.domain.Action;
import tg.academiablanc.domain.Etablissement;
import tg.academiablanc.domain.Ressource;
import tg.academiablanc.domain.Role;
import tg.academiablanc.domain.Utilisateur;
import tg.academiablanc.repo.ClasseRepository;
import tg.academiablanc.repo.EleveRepository;
import tg.academiablanc.repo.EtablissementRepository;
import tg.academiablanc.repo.NoteRepository;
import tg.academiablanc.repo.ProfesseurRepository;
import tg.academiablanc.repo.SessionExamenRepository;
import tg.academiablanc.repo.UtilisateurRepository;
import tg.academiablanc.security.PermissionService;

/**
 * Niveau plateforme : propriétaire du logiciel (SUPER_ADMIN, tous les droits) et gestionnaires
 * (GESTIONNAIRE_PLATEFORME, droits fins sur ETABLISSEMENTS et GESTIONNAIRES).
 * Aucune écriture dans les données pédagogiques d’un établissement, aucune prise de contrôle de compte.
 */
@RestController
@RequestMapping("/api/plateforme")
public class PlateformeController {
  private final EtablissementRepository etablissements;
  private final UtilisateurRepository utilisateurs;
  private final ClasseRepository classes;
  private final EleveRepository eleves;
  private final ProfesseurRepository professeurs;
  private final SessionExamenRepository sessions;
  private final NoteRepository notes;
  private final EtablissementService creation;
  private final UtilisateursService comptes;
  private final PermissionService droits;

  public PlateformeController(
      EtablissementRepository etablissements,
      UtilisateurRepository utilisateurs,
      ClasseRepository classes,
      EleveRepository eleves,
      ProfesseurRepository professeurs,
      SessionExamenRepository sessions,
      NoteRepository notes,
      EtablissementService creation,
      UtilisateursService comptes,
      PermissionService droits
  ) {
    this.etablissements = etablissements;
    this.utilisateurs = utilisateurs;
    this.classes = classes;
    this.eleves = eleves;
    this.professeurs = professeurs;
    this.sessions = sessions;
    this.notes = notes;
    this.creation = creation;
    this.comptes = comptes;
    this.droits = droits;
  }

  /** Les champs de contact et les effectifs sont absents sans ETABLISSEMENTS:DETAILS. */
  @JsonInclude(JsonInclude.Include.NON_NULL)
  public record EtablissementSurveillance(
      Long id,
      String nom,
      String code,
      String ville,
      String region,
      String typeEtablissement,
      boolean actif,
      String email,
      String telephone,
      String nomResponsable,
      Long utilisateurs,
      Long classes,
      Long eleves,
      Long professeurs,
      Long sessions,
      Long notes
  ) {}

  public record CreationEtablissementRequest(
      @NotBlank @Size(max = 180) String nom,
      @NotBlank @Size(max = 120) String ville,
      @NotBlank @Email @Size(max = 180) String email,
      @NotBlank @Size(min = 6, max = 80) String motDePasse,
      @NotBlank @Size(max = 180) String nomResponsable,
      @Size(max = 40) String telephone,
      @Size(max = 120) String region,
      @Size(max = 160) String typeEtablissement
  ) {}

  public record CreationGestionnaireRequest(
      @NotBlank @Size(max = 180) String nom,
      @NotBlank @Email @Size(max = 180) String email,
      @NotBlank @Size(min = 6, max = 80) String motDePasse,
      List<String> permissions
  ) {}

  public record ModificationGestionnaireRequest(
      @Size(max = 180) String nom,
      @Email @Size(max = 180) String email,
      Boolean actif
  ) {}

  public record PermissionsRequest(@NotNull List<String> permissions) {}

  public record MotDePasseRequest(@NotBlank @Size(min = 6, max = 80) String motDePasse) {}

  /* ------------------------------------------------------------------ */
  /* Établissements                                                      */
  /* ------------------------------------------------------------------ */

  @GetMapping("/etablissements")
  public List<EtablissementSurveillance> etablissements() {
    Utilisateur moi = droits.exiger(Ressource.ETABLISSEMENTS, Action.VOIR);
    boolean details = droits.peut(moi, Ressource.ETABLISSEMENTS, Action.DETAILS);
    return etablissements.findAllByOrderByNomAsc().stream().map(school -> surveiller(school, details)).toList();
  }

  @GetMapping("/etablissements/{id}")
  public EtablissementSurveillance etablissement(@PathVariable Long id) {
    droits.exiger(Ressource.ETABLISSEMENTS, Action.DETAILS);
    return surveiller(trouver(id), true);
  }

  @PostMapping("/etablissements")
  @ResponseStatus(HttpStatus.CREATED)
  public EtablissementSurveillance creerEtablissement(@Valid @RequestBody CreationEtablissementRequest request) {
    Utilisateur moi = droits.exiger(Ressource.ETABLISSEMENTS, Action.CREER);
    EtablissementService.Creation created = creation.creer(
        request.nom(), request.ville(), request.email(), request.motDePasse(), request.nomResponsable(),
        request.telephone(), request.region(), request.typeEtablissement(), moi.getId());
    return surveiller(created.etablissement(), true);
  }

  /** Désactivation douce : les données restent, plus aucune connexion n’est possible pour cet établissement. */
  @DeleteMapping("/etablissements/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @Transactional
  public void desactiverEtablissement(@PathVariable Long id) {
    Utilisateur moi = droits.exiger(Ressource.ETABLISSEMENTS, Action.SUPPRIMER);
    Etablissement school = trouver(id);
    if (school.getId().equals(moi.getEtablissementId())) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Vous ne pouvez pas désactiver votre propre établissement.");
    }
    boolean porteSuperAdmin = utilisateurs.findByRole(Role.SUPER_ADMIN).stream()
        .anyMatch(u -> school.getId().equals(u.getEtablissementId()));
    if (porteSuperAdmin) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Cet établissement porte le compte du propriétaire du logiciel.");
    }
    school.setActif(false);
    etablissements.save(school);
  }

  @PutMapping("/etablissements/{id}/reactiver")
  @Transactional
  public EtablissementSurveillance reactiverEtablissement(@PathVariable Long id) {
    droits.exiger(Ressource.ETABLISSEMENTS, Action.MODIFIER);
    Etablissement school = trouver(id);
    school.setActif(true);
    return surveiller(etablissements.save(school), true);
  }

  /* ------------------------------------------------------------------ */
  /* Gestionnaires                                                       */
  /* ------------------------------------------------------------------ */

  @GetMapping("/gestionnaires")
  public List<UtilisateursService.Vue> gestionnaires() {
    Utilisateur moi = droits.exiger(Ressource.GESTIONNAIRES, Action.VOIR);
    boolean details = droits.peut(moi, Ressource.GESTIONNAIRES, Action.DETAILS);
    return utilisateurs.findByRoleInOrderByNomAsc(List.of(Role.SUPER_ADMIN, Role.GESTIONNAIRE_PLATEFORME)).stream()
        .map(u -> comptes.vue(u, details))
        .toList();
  }

  @GetMapping("/gestionnaires/referentiel")
  public UtilisateursService.Referentiel referentiel() {
    droits.exiger(Ressource.GESTIONNAIRES, Action.VOIR);
    return comptes.referentiel(true, List.of(Role.GESTIONNAIRE_PLATEFORME));
  }

  @PostMapping("/gestionnaires")
  @ResponseStatus(HttpStatus.CREATED)
  public UtilisateursService.Vue creerGestionnaire(@Valid @RequestBody CreationGestionnaireRequest request) {
    Utilisateur moi = droits.exiger(Ressource.GESTIONNAIRES, Action.CREER);
    Utilisateur cree = comptes.creer(moi, request.nom(), request.email(), request.motDePasse(),
        Role.GESTIONNAIRE_PLATEFORME, null, request.permissions(), null);
    return comptes.vue(cree, true);
  }

  @GetMapping("/gestionnaires/{id}")
  public UtilisateursService.Vue gestionnaire(@PathVariable Long id) {
    droits.exiger(Ressource.GESTIONNAIRES, Action.DETAILS);
    return comptes.vue(gestionnaireCible(id), true);
  }

  @PutMapping("/gestionnaires/{id}")
  public UtilisateursService.Vue modifierGestionnaire(@PathVariable Long id, @Valid @RequestBody ModificationGestionnaireRequest request) {
    Utilisateur moi = droits.exiger(Ressource.GESTIONNAIRES, Action.MODIFIER);
    Utilisateur maj = comptes.modifier(moi, gestionnaireCible(id), request.nom(), request.email(), null, request.actif(), null);
    return comptes.vue(maj, true);
  }

  @PutMapping("/gestionnaires/{id}/permissions")
  public UtilisateursService.Vue permissionsGestionnaire(@PathVariable Long id, @Valid @RequestBody PermissionsRequest request) {
    Utilisateur moi = droits.exiger(Ressource.GESTIONNAIRES, Action.MODIFIER);
    Utilisateur cible = gestionnaireCible(id);
    comptes.definirPermissions(moi, cible, request.permissions());
    return comptes.vue(cible, true);
  }

  @PostMapping("/gestionnaires/{id}/permissions/prereglage")
  public UtilisateursService.Vue prereglageGestionnaire(@PathVariable Long id) {
    Utilisateur moi = droits.exiger(Ressource.GESTIONNAIRES, Action.MODIFIER);
    Utilisateur cible = gestionnaireCible(id);
    comptes.appliquerPrereglage(moi, cible);
    return comptes.vue(cible, true);
  }

  @PostMapping("/gestionnaires/{id}/reinitialiser-mot-de-passe")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void reinitialiserGestionnaire(@PathVariable Long id, @Valid @RequestBody MotDePasseRequest request) {
    Utilisateur moi = droits.exiger(Ressource.GESTIONNAIRES, Action.MODIFIER);
    comptes.reinitialiserMotDePasse(moi, gestionnaireCible(id), request.motDePasse());
  }

  @DeleteMapping("/gestionnaires/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void supprimerGestionnaire(@PathVariable Long id) {
    Utilisateur moi = droits.exiger(Ressource.GESTIONNAIRES, Action.SUPPRIMER);
    comptes.supprimer(moi, gestionnaireCible(id));
  }

  /* ------------------------------------------------------------------ */

  private Etablissement trouver(Long id) {
    return etablissements.findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Établissement introuvable."));
  }

  /** Seuls les comptes de niveau plateforme sont atteignables ici : jamais un utilisateur d’établissement. */
  private Utilisateur gestionnaireCible(Long id) {
    Utilisateur user = utilisateurs.findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Gestionnaire introuvable."));
    if (!user.getRole().estPlateforme()) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Gestionnaire introuvable.");
    }
    return user;
  }

  private EtablissementSurveillance surveiller(Etablissement school, boolean details) {
    Long id = school.getId();
    if (!details) {
      return new EtablissementSurveillance(id, school.getNom(), school.getCode(), school.getVille(), school.getRegion(),
          school.getTypeEtablissement(), school.isActif(), null, null, null, null, null, null, null, null, null);
    }
    return new EtablissementSurveillance(
        id,
        school.getNom(),
        school.getCode(),
        school.getVille(),
        school.getRegion(),
        school.getTypeEtablissement(),
        school.isActif(),
        school.getEmail(),
        school.getTelephone(),
        school.getNomResponsable(),
        utilisateurs.countByEtablissementId(id),
        classes.countByEtablissementId(id),
        eleves.countByEtablissementId(id),
        professeurs.countByEtablissementId(id),
        sessions.countByEtablissementId(id),
        notes.countByEtablissementId(id)
    );
  }
}
