package tg.academiablanc.api;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import tg.academiablanc.domain.Action;
import tg.academiablanc.domain.Affectation;
import tg.academiablanc.domain.AnneeScolaire;
import tg.academiablanc.domain.CentreExamen;
import tg.academiablanc.domain.Classe;
import tg.academiablanc.domain.Coefficient;
import tg.academiablanc.domain.Eleve;
import tg.academiablanc.domain.Matiere;
import tg.academiablanc.domain.Note;
import tg.academiablanc.domain.Professeur;
import tg.academiablanc.domain.Ressource;
import tg.academiablanc.domain.Role;
import tg.academiablanc.domain.SessionExamen;
import tg.academiablanc.domain.SessionStatut;
import tg.academiablanc.repo.AffectationRepository;
import tg.academiablanc.repo.AnneeScolaireRepository;
import tg.academiablanc.repo.CentreExamenRepository;
import tg.academiablanc.repo.ClasseRepository;
import tg.academiablanc.repo.CoefficientRepository;
import tg.academiablanc.repo.EleveRepository;
import tg.academiablanc.repo.MatiereRepository;
import tg.academiablanc.repo.NoteRepository;
import tg.academiablanc.repo.ProfesseurRepository;
import tg.academiablanc.repo.SessionExamenRepository;
import tg.academiablanc.security.PermissionService;
import tg.academiablanc.security.Tenant;

@RestController
@RequestMapping("/api")
public class SchoolController {
  private final AnneeScolaireRepository annees;
  private final CentreExamenRepository centres;
  private final SessionExamenRepository sessions;
  private final MatiereRepository matieres;
  private final CoefficientRepository coefficients;
  private final ProfesseurRepository professeurs;
  private final ClasseRepository classes;
  private final AffectationRepository affectations;
  private final EleveRepository eleves;
  private final NoteRepository notes;
  private final BulletinService bulletins;
  private final EleveImportService importEleves;
  private final PermissionService droits;
  private final SerieService series;
  private final AnneeDependances dependancesAnnee;
  private final MatriculeService matricules;
  private final ReferentielMatieresService referentielMatieres;
  private final TypeExamenService typesExamen;

  public SchoolController(
      AnneeScolaireRepository annees,
      CentreExamenRepository centres,
      SessionExamenRepository sessions,
      MatiereRepository matieres,
      CoefficientRepository coefficients,
      ProfesseurRepository professeurs,
      ClasseRepository classes,
      AffectationRepository affectations,
      EleveRepository eleves,
      NoteRepository notes,
      BulletinService bulletins,
      EleveImportService importEleves,
      SerieService series,
      AnneeDependances dependancesAnnee,
      MatriculeService matricules,
      ReferentielMatieresService referentielMatieres,
      TypeExamenService typesExamen,
      PermissionService droits
  ) {
    this.annees = annees;
    this.centres = centres;
    this.sessions = sessions;
    this.matieres = matieres;
    this.coefficients = coefficients;
    this.professeurs = professeurs;
    this.classes = classes;
    this.affectations = affectations;
    this.eleves = eleves;
    this.notes = notes;
    this.bulletins = bulletins;
    this.importEleves = importEleves;
    this.droits = droits;
    this.series = series;
    this.dependancesAnnee = dependancesAnnee;
    this.matricules = matricules;
    this.referentielMatieres = referentielMatieres;
    this.typesExamen = typesExamen;
  }

  public record AnneeRequest(@NotBlank @Size(max = 40) String libelle, LocalDate dateDebut, LocalDate dateFin, boolean courante) {}
  public record CentreRequest(@NotBlank @Size(max = 180) String nom, @Size(max = 120) String ville, @NotBlank @Size(max = 40) String code) {}
  /**
   * {@code typeExamenId} désigne un type actif du référentiel de la plateforme ; {@code typeExamen} (texte) n'est
   * accepté qu'en repli pour les clients antérieurs et est reconnu quand c'est possible (« BAC II » → BAC2).
   */
  public record SessionRequest(@NotNull Long anneeScolaireId, @NotNull Long centreId, @NotBlank @Size(max = 180) String nom,
                               Long typeExamenId, @Size(max = 120) String typeExamen, @Size(max = 80) String serie,
                               @NotBlank @Size(max = 40) String statut) {}
  public record MatiereRequest(@NotBlank @Size(max = 180) String nom, @NotBlank @Size(max = 40) String code, @Size(max = 10) String groupeCode) {}
  public record CoefficientRequest(@NotNull Long matiereId, Long classeId, @Size(max = 80) String serie, @NotNull @DecimalMin("0.5") @DecimalMax("20") BigDecimal valeur) {}
  public record ProfesseurRequest(@NotBlank @Size(max = 180) String nom, @Size(max = 180) String email) {}
  public record ClasseRequest(@NotNull Long anneeScolaireId, @NotBlank @Size(max = 120) String nom, @NotBlank @Size(max = 80) String niveau, @Size(max = 80) String serie, Long titulaireId) {}
  public record TitulaireRequest(@NotNull Long professeurId) {}
  public record AffectationRequest(@NotNull Long professeurId, @NotNull Long matiereId, @NotNull Long classeId) {}
  /** Le matricule n'est jamais fourni par le client : attribué par {@link MatriculeService} à la création, figé ensuite. */
  public record EleveRequest(@NotNull Long classeId, Long sessionId, @NotBlank @Size(max = 180) String nomComplet,
                             @Size(max = 20) String dateNaissance, @Size(max = 120) String lieuNaissance, @NotBlank @Size(min = 1, max = 1) String genre,
                             Integer numeroTable, @Size(max = 180) String etablissementOrigine) {}
  public record NoteRequest(@NotNull Long eleveId, @NotNull Long matiereId, @NotNull Long sessionId,
                            @DecimalMin("0") @DecimalMax("20") BigDecimal valeur, boolean absent) {}

  @GetMapping("/annees-scolaires")
  public List<AnneeScolaire> annees() {
    droits.exiger(Ressource.ANNEES, Action.VOIR);
    return annees.findByEtablissementIdOrderByLibelleDesc(Tenant.current().etablissementId());
  }

  @PostMapping("/annees-scolaires")
  public AnneeScolaire creerAnnee(@Valid @RequestBody AnneeRequest request) {
    droits.exiger(Ressource.ANNEES, Action.CREER);
    AnneeScolaire annee = new AnneeScolaire();
    appliquer(annee, request);
    return annees.save(annee);
  }

  @GetMapping("/annees-scolaires/{id}")
  public AnneeScolaire annee(@PathVariable Long id) {
    droits.exiger(Ressource.ANNEES, Action.DETAILS);
    return lire(annees, id);
  }

  @PutMapping("/annees-scolaires/{id}")
  public AnneeScolaire majAnnee(@PathVariable Long id, @Valid @RequestBody AnneeRequest request) {
    droits.exiger(Ressource.ANNEES, Action.MODIFIER);
    AnneeScolaire annee = lire(annees, id);
    appliquer(annee, request);
    return annees.save(annee);
  }

  @DeleteMapping("/annees-scolaires/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @Transactional
  public void supprimerAnnee(@PathVariable Long id) {
    droits.exiger(Ressource.ANNEES, Action.SUPPRIMER);
    AnneeScolaire annee = lire(annees, id);
    dependancesAnnee.verifierSupprimable(annee);
    annees.delete(annee);
    flush(annees);
  }

  /** Désigne l'année courante de l'établissement ; les autres années repassent en « archivée ». */
  @PutMapping("/annees-scolaires/{id}/courante")
  @Transactional
  public AnneeScolaire definirAnneeCourante(@PathVariable Long id) {
    droits.exiger(Ressource.ANNEES, Action.MODIFIER);
    AnneeScolaire annee = lire(annees, id);
    retirerAnneeCourante(annee.getId());
    annee.setCourante(true);
    return annees.save(annee);
  }

  @GetMapping("/centres")
  public List<CentreExamen> centres() {
    droits.exiger(Ressource.CENTRES, Action.VOIR);
    return centres.findByEtablissementIdOrderByNomAsc(Tenant.current().etablissementId());
  }

  @PostMapping("/centres")
  public CentreExamen creerCentre(@Valid @RequestBody CentreRequest request) {
    droits.exiger(Ressource.CENTRES, Action.CREER);
    CentreExamen centre = new CentreExamen();
    centre.setEtablissementId(Tenant.current().etablissementId());
    centre.setNom(request.nom().trim());
    centre.setVille(request.ville());
    centre.setCode(request.code().trim());
    return centres.save(centre);
  }

  @GetMapping("/centres/{id}")
  public CentreExamen centre(@PathVariable Long id) {
    droits.exiger(Ressource.CENTRES, Action.DETAILS);
    return lire(centres, id);
  }

  @PutMapping("/centres/{id}")
  public CentreExamen majCentre(@PathVariable Long id, @Valid @RequestBody CentreRequest request) {
    droits.exiger(Ressource.CENTRES, Action.MODIFIER);
    CentreExamen centre = lire(centres, id);
    centre.setNom(request.nom().trim());
    centre.setVille(request.ville());
    centre.setCode(request.code().trim());
    return centres.save(centre);
  }

  @DeleteMapping("/centres/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @Transactional
  public void supprimerCentre(@PathVariable Long id) {
    droits.exiger(Ressource.CENTRES, Action.SUPPRIMER);
    centres.delete(lire(centres, id));
    flush(centres);
  }

  @GetMapping("/sessions")
  public List<TypeExamenService.SessionVue> sessions() {
    droits.exiger(Ressource.SESSIONS, Action.VOIR);
    return sessions.findByEtablissementIdOrderByNomAsc(Tenant.current().etablissementId()).stream().map(typesExamen::vue).toList();
  }

  @PostMapping("/sessions")
  public TypeExamenService.SessionVue creerSession(@Valid @RequestBody SessionRequest request) {
    droits.exiger(Ressource.SESSIONS, Action.CREER);
    verifierAnnee(request.anneeScolaireId());
    verifierCentre(request.centreId());
    SessionExamen session = new SessionExamen();
    session.setEtablissementId(Tenant.current().etablissementId());
    remplir(session, request);
    return typesExamen.vue(sessions.save(session));
  }

  @GetMapping("/sessions/{id}")
  public TypeExamenService.SessionVue session(@PathVariable Long id) {
    droits.exiger(Ressource.SESSIONS, Action.DETAILS);
    return typesExamen.vue(lire(sessions, id));
  }

  @PutMapping("/sessions/{id}")
  public TypeExamenService.SessionVue majSession(@PathVariable Long id, @Valid @RequestBody SessionRequest request) {
    droits.exiger(Ressource.SESSIONS, Action.MODIFIER);
    SessionExamen session = lire(sessions, id);
    verifierAnnee(request.anneeScolaireId());
    verifierCentre(request.centreId());
    remplir(session, request);
    return typesExamen.vue(sessions.save(session));
  }

  @DeleteMapping("/sessions/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @Transactional
  public void supprimerSession(@PathVariable Long id) {
    droits.exiger(Ressource.SESSIONS, Action.SUPPRIMER);
    sessions.delete(lire(sessions, id));
    flush(sessions);
  }

  @GetMapping("/matieres")
  public List<Matiere> matieres() {
    droits.exiger(Ressource.MATIERES, Action.VOIR);
    return matieres.findByEtablissementIdOrderByNomAsc(Tenant.current().etablissementId());
  }

  @PostMapping("/matieres")
  public Matiere creerMatiere(@Valid @RequestBody MatiereRequest request) {
    droits.exiger(Ressource.MATIERES, Action.CREER);
    Matiere matiere = new Matiere();
    matiere.setEtablissementId(Tenant.current().etablissementId());
    matiere.setNom(request.nom().trim());
    matiere.setCode(request.code().trim().toLowerCase());
    matiere.setGroupeCode(ReferentielMatieres.codeGroupe(request.groupeCode()));
    matiere.setGroupeLibelle(ReferentielMatieres.libelleGroupe(request.groupeCode()));
    return matieres.save(matiere);
  }

  /** Charge les matières principales (FR, ANG, HG, ECM, PC, MAT, SVT) et leurs coefficients par défaut pour chaque classe. */
  @PostMapping("/matieres/referentiel")
  public ReferentielMatieresService.Resultat chargerReferentielMatieres(@RequestBody(required = false) ReferentielMatieresService.Demande request) {
    droits.exiger(Ressource.MATIERES, Action.CREER);
    return referentielMatieres.charger(request);
  }

  @GetMapping("/matieres/{id}")
  public Matiere matiere(@PathVariable Long id) {
    droits.exiger(Ressource.MATIERES, Action.DETAILS);
    return lire(matieres, id);
  }

  @PutMapping("/matieres/{id}")
  public Matiere majMatiere(@PathVariable Long id, @Valid @RequestBody MatiereRequest request) {
    droits.exiger(Ressource.MATIERES, Action.MODIFIER);
    Matiere matiere = lire(matieres, id);
    matiere.setNom(request.nom().trim());
    matiere.setCode(request.code().trim().toLowerCase());
    matiere.setGroupeCode(ReferentielMatieres.codeGroupe(request.groupeCode()));
    matiere.setGroupeLibelle(ReferentielMatieres.libelleGroupe(request.groupeCode()));
    return matieres.save(matiere);
  }

  @DeleteMapping("/matieres/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @Transactional
  public void supprimerMatiere(@PathVariable Long id) {
    droits.exiger(Ressource.MATIERES, Action.SUPPRIMER);
    matieres.delete(lire(matieres, id));
    flush(matieres);
  }

  @GetMapping("/coefficients")
  public List<Coefficient> coefficients() {
    droits.exiger(Ressource.COEFFICIENTS, Action.VOIR);
    return coefficients.findByEtablissementId(Tenant.current().etablissementId());
  }

  @PostMapping("/coefficients")
  public Coefficient creerCoefficient(@Valid @RequestBody CoefficientRequest request) {
    droits.exiger(Ressource.COEFFICIENTS, Action.CREER);
    Matiere matiere = matieres.findById(request.matiereId()).orElseThrow(SchoolController::absent);
    Tenant.same(matiere.getEtablissementId());
    if (request.classeId() != null) verifierClasse(request.classeId());
    Coefficient coefficient = new Coefficient();
    coefficient.setEtablissementId(Tenant.current().etablissementId());
    coefficient.setMatiereId(request.matiereId());
    coefficient.setClasseId(request.classeId());
    coefficient.setSerie(request.serie());
    coefficient.setValeur(request.valeur());
    return coefficients.save(coefficient);
  }

  @GetMapping("/coefficients/{id}")
  public Coefficient coefficient(@PathVariable Long id) {
    droits.exiger(Ressource.COEFFICIENTS, Action.DETAILS);
    return lire(coefficients, id);
  }

  @PutMapping("/coefficients/{id}")
  public Coefficient majCoefficient(@PathVariable Long id, @Valid @RequestBody CoefficientRequest request) {
    droits.exiger(Ressource.COEFFICIENTS, Action.MODIFIER);
    Coefficient coefficient = lire(coefficients, id);
    Matiere matiere = matieres.findById(request.matiereId()).orElseThrow(SchoolController::absent);
    Tenant.same(matiere.getEtablissementId());
    if (request.classeId() != null) verifierClasse(request.classeId());
    coefficient.setMatiereId(request.matiereId());
    coefficient.setClasseId(request.classeId());
    coefficient.setSerie(request.serie());
    coefficient.setValeur(request.valeur());
    return coefficients.save(coefficient);
  }

  @DeleteMapping("/coefficients/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @Transactional
  public void supprimerCoefficient(@PathVariable Long id) {
    droits.exiger(Ressource.COEFFICIENTS, Action.SUPPRIMER);
    coefficients.delete(lire(coefficients, id));
    flush(coefficients);
  }

  @GetMapping("/professeurs")
  public List<Professeur> professeurs() {
    droits.exiger(Ressource.ENSEIGNANTS, Action.VOIR);
    return professeurs.findByEtablissementIdOrderByNomAsc(Tenant.current().etablissementId());
  }

  @PostMapping("/professeurs")
  public Professeur creerProfesseur(@Valid @RequestBody ProfesseurRequest request) {
    droits.exiger(Ressource.ENSEIGNANTS, Action.CREER);
    Professeur professeur = new Professeur();
    professeur.setEtablissementId(Tenant.current().etablissementId());
    professeur.setNom(request.nom().trim());
    professeur.setEmail(request.email());
    return professeurs.save(professeur);
  }

  @GetMapping("/professeurs/{id}")
  public Professeur professeur(@PathVariable Long id) {
    droits.exiger(Ressource.ENSEIGNANTS, Action.DETAILS);
    return lire(professeurs, id);
  }

  @PutMapping("/professeurs/{id}")
  public Professeur majProfesseur(@PathVariable Long id, @Valid @RequestBody ProfesseurRequest request) {
    droits.exiger(Ressource.ENSEIGNANTS, Action.MODIFIER);
    Professeur professeur = lire(professeurs, id);
    professeur.setNom(request.nom().trim());
    professeur.setEmail(request.email());
    return professeurs.save(professeur);
  }

  @DeleteMapping("/professeurs/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @Transactional
  public void supprimerProfesseur(@PathVariable Long id) {
    droits.exiger(Ressource.ENSEIGNANTS, Action.SUPPRIMER);
    professeurs.delete(lire(professeurs, id));
    flush(professeurs);
  }

  @GetMapping("/classes")
  public List<Classe> classes() {
    droits.exiger(Ressource.CLASSES, Action.VOIR);
    return classes.findByEtablissementIdOrderByNomAsc(Tenant.current().etablissementId());
  }

  @PostMapping("/classes")
  public Classe creerClasse(@Valid @RequestBody ClasseRequest request) {
    droits.exiger(Ressource.CLASSES, Action.CREER);
    verifierAnnee(request.anneeScolaireId());
    if (request.titulaireId() != null) verifierProfesseur(request.titulaireId());
    Classe classe = new Classe();
    classe.setEtablissementId(Tenant.current().etablissementId());
    remplir(classe, request);
    return classes.save(classe);
  }

  @GetMapping("/classes/{id}")
  public Classe classe(@PathVariable Long id) {
    droits.exiger(Ressource.CLASSES, Action.DETAILS);
    return lire(classes, id);
  }

  @PutMapping("/classes/{id}")
  public Classe majClasse(@PathVariable Long id, @Valid @RequestBody ClasseRequest request) {
    droits.exiger(Ressource.CLASSES, Action.MODIFIER);
    Classe classe = lire(classes, id);
    verifierAnnee(request.anneeScolaireId());
    if (request.titulaireId() != null) verifierProfesseur(request.titulaireId());
    remplir(classe, request);
    return classes.save(classe);
  }

  @DeleteMapping("/classes/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @Transactional
  public void supprimerClasse(@PathVariable Long id) {
    droits.exiger(Ressource.CLASSES, Action.SUPPRIMER);
    classes.delete(lire(classes, id));
    flush(classes);
  }

  @PutMapping("/classes/{id}/titulaire")
  public Classe designerTitulaire(@PathVariable Long id, @Valid @RequestBody TitulaireRequest request) {
    droits.exiger(Ressource.CLASSES, Action.MODIFIER);
    Classe classe = classes.findById(id).orElseThrow(SchoolController::absent);
    Tenant.same(classe.getEtablissementId());
    verifierProfesseur(request.professeurId());
    classe.setTitulaireId(request.professeurId());
    return classes.save(classe);
  }

  @GetMapping("/affectations")
  public List<Affectation> affectations() {
    droits.exiger(Ressource.AFFECTATIONS, Action.VOIR);
    return affectations.findByEtablissementId(Tenant.current().etablissementId());
  }

  @PostMapping("/affectations")
  public Affectation affecter(@Valid @RequestBody AffectationRequest request) {
    droits.exiger(Ressource.AFFECTATIONS, Action.CREER);
    verifierProfesseur(request.professeurId());
    Matiere matiere = matieres.findById(request.matiereId()).orElseThrow(SchoolController::absent);
    Tenant.same(matiere.getEtablissementId());
    verifierClasse(request.classeId());
    Long etab = Tenant.current().etablissementId();
    if (affectations.existsByEtablissementIdAndProfesseurIdAndMatiereIdAndClasseId(etab, request.professeurId(), request.matiereId(), request.classeId())) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Cette affectation existe déjà.");
    }
    Affectation affectation = new Affectation();
    affectation.setEtablissementId(etab);
    affectation.setProfesseurId(request.professeurId());
    affectation.setMatiereId(request.matiereId());
    affectation.setClasseId(request.classeId());
    return affectations.save(affectation);
  }

  @GetMapping("/affectations/{id}")
  public Affectation affectation(@PathVariable Long id) {
    droits.exiger(Ressource.AFFECTATIONS, Action.DETAILS);
    return lire(affectations, id);
  }

  @PutMapping("/affectations/{id}")
  public Affectation majAffectation(@PathVariable Long id, @Valid @RequestBody AffectationRequest request) {
    droits.exiger(Ressource.AFFECTATIONS, Action.MODIFIER);
    Affectation affectation = lire(affectations, id);
    verifierProfesseur(request.professeurId());
    Matiere matiere = matieres.findById(request.matiereId()).orElseThrow(SchoolController::absent);
    Tenant.same(matiere.getEtablissementId());
    verifierClasse(request.classeId());
    boolean doublon = affectations.findByEtablissementId(Tenant.current().etablissementId()).stream().anyMatch(item ->
        !item.getId().equals(id)
            && item.getProfesseurId().equals(request.professeurId())
            && item.getMatiereId().equals(request.matiereId())
            && item.getClasseId().equals(request.classeId()));
    if (doublon) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Cette affectation existe déjà.");
    }
    affectation.setProfesseurId(request.professeurId());
    affectation.setMatiereId(request.matiereId());
    affectation.setClasseId(request.classeId());
    return affectations.save(affectation);
  }

  @DeleteMapping("/affectations/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @Transactional
  public void supprimerAffectation(@PathVariable Long id) {
    droits.exiger(Ressource.AFFECTATIONS, Action.SUPPRIMER);
    affectations.delete(lire(affectations, id));
    flush(affectations);
  }

  @GetMapping("/eleves")
  public List<Eleve> eleves() {
    droits.exiger(Ressource.ELEVES, Action.VOIR);
    return eleves.findByEtablissementIdOrderByNomCompletAsc(Tenant.current().etablissementId());
  }

  @PostMapping("/eleves")
  public Eleve creerEleve(@Valid @RequestBody EleveRequest request) {
    droits.exiger(Ressource.ELEVES, Action.CREER);
    verifierClasse(request.classeId());
    if (request.sessionId() != null) verifierSession(request.sessionId());
    Eleve eleve = new Eleve();
    eleve.setEtablissementId(Tenant.current().etablissementId());
    remplir(eleve, request);
    return matricules.enregistrerNouveau(eleve);
  }

  /** Import d'une liste d'élèves (classe créée au besoin, matricules générés, doublons ignorés). */
  @PostMapping("/eleves/import")
  public EleveImportService.Resultat importerEleves(@Valid @RequestBody EleveImportService.Demande request) {
    droits.exiger(Ressource.ELEVES, Action.CREER);
    try {
      return importEleves.importer(request);
    } catch (DataIntegrityViolationException ex) {
      // Collision de matricule avec une inscription concurrente : la transaction a été annulée,
      // on recalcule la séquence et on rejoue l'import une fois (les doublons restent ignorés).
      return importEleves.importer(request);
    }
  }

  @GetMapping("/eleves/{id}")
  public Eleve eleve(@PathVariable Long id) {
    droits.exiger(Ressource.ELEVES, Action.DETAILS);
    return lire(eleves, id);
  }

  @PutMapping("/eleves/{id}")
  public Eleve majEleve(@PathVariable Long id, @Valid @RequestBody EleveRequest request) {
    droits.exiger(Ressource.ELEVES, Action.MODIFIER);
    Eleve eleve = lire(eleves, id);
    verifierClasse(request.classeId());
    if (request.sessionId() != null) verifierSession(request.sessionId());
    remplir(eleve, request);
    return eleves.save(eleve);
  }

  @DeleteMapping("/eleves/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @Transactional
  public void supprimerEleve(@PathVariable Long id) {
    droits.exiger(Ressource.ELEVES, Action.SUPPRIMER);
    eleves.delete(lire(eleves, id));
    flush(eleves);
  }

  @GetMapping("/notes")
  public List<Note> notes(@RequestParam Long sessionId) {
    droits.exiger(Ressource.NOTES, Action.VOIR);
    verifierSession(sessionId);
    return notes.findByEtablissementIdAndSessionId(Tenant.current().etablissementId(), sessionId);
  }

  @GetMapping("/notes/{id}")
  public Note note(@PathVariable Long id) {
    droits.exiger(Ressource.NOTES, Action.DETAILS);
    return lire(notes, id);
  }

  @PostMapping("/notes")
  @Transactional
  public Note saisirNote(@Valid @RequestBody NoteRequest request) {
    droits.exiger(Ressource.NOTES, Action.CREER);
    Eleve eleve = controlerNote(request);
    Note note = notes.findByEleveIdAndMatiereIdAndSessionId(request.eleveId(), request.matiereId(), request.sessionId())
        .orElseGet(Note::new);
    appliquer(note, request, eleve);
    return notes.save(note);
  }

  @PutMapping("/notes/{id}")
  @Transactional
  public Note majNote(@PathVariable Long id, @Valid @RequestBody NoteRequest request) {
    droits.exiger(Ressource.NOTES, Action.MODIFIER);
    Note note = lire(notes, id);
    Eleve eleve = controlerNote(request);
    notes.findByEleveIdAndMatiereIdAndSessionId(request.eleveId(), request.matiereId(), request.sessionId())
        .filter(other -> !other.getId().equals(id))
        .ifPresent(other -> {
          throw new ResponseStatusException(HttpStatus.CONFLICT, "Une note existe déjà pour cet élève, cette matière et cette session.");
        });
    appliquer(note, request, eleve);
    return notes.save(note);
  }

  @DeleteMapping("/notes/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @Transactional
  public void supprimerNote(@PathVariable Long id) {
    droits.exiger(Ressource.NOTES, Action.SUPPRIMER);
    notes.delete(lire(notes, id));
    flush(notes);
  }

  @GetMapping("/bulletins")
  public List<BulletinService.BulletinVue> bulletins(@RequestParam Long sessionId) {
    droits.exiger(Ressource.BULLETINS, Action.VOIR);
    return bulletins.generer(sessionId);
  }

  @PostMapping("/bulletins/generer")
  public List<BulletinService.BulletinVue> generer(@RequestParam Long sessionId) {
    droits.exiger(Ressource.BULLETINS, Action.CREER);
    return bulletins.generer(sessionId);
  }

  private void appliquer(AnneeScolaire annee, AnneeRequest request) {
    annee.setEtablissementId(Tenant.current().etablissementId());
    annee.setLibelle(request.libelle().trim());
    annee.setDateDebut(request.dateDebut());
    annee.setDateFin(request.dateFin());
    if (request.courante()) retirerAnneeCourante(annee.getId());
    annee.setCourante(request.courante());
  }

  /** Une seule année courante par établissement : retire le drapeau aux autres années. */
  private void retirerAnneeCourante(Long saufId) {
    for (AnneeScolaire autre : annees.findByEtablissementIdOrderByLibelleDesc(Tenant.current().etablissementId())) {
      if (autre.isCourante() && !autre.getId().equals(saufId)) {
        autre.setCourante(false);
        annees.save(autre);
      }
    }
  }

  private void remplir(SessionExamen session, SessionRequest request) {
    session.setAnneeScolaireId(request.anneeScolaireId());
    session.setCentreId(request.centreId());
    session.setNom(request.nom().trim());
    typesExamen.rattacher(session, request.typeExamenId(), request.typeExamen());
    session.setSerie(request.serie());
    session.setStatut(request.statut().trim());
    // La date d'archivage suit le statut : posée à la clôture, effacée à la réouverture.
    if (!SessionStatut.estArchivee(session.getStatut())) {
      session.setArchiveeLe(null);
    } else if (session.getArchiveeLe() == null) {
      session.setArchiveeLe(Instant.now());
    }
  }

  private void remplir(Classe classe, ClasseRequest request) {
    classe.setAnneeScolaireId(request.anneeScolaireId());
    classe.setNom(request.nom().trim());
    classe.setNiveau(request.niveau().trim());
    classe.setSerie(controlerSerie(request.niveau(), request.serie()));
    classe.setTitulaireId(request.titulaireId());
  }

  /**
   * Collège (6e–3e) : aucune série. Lycée (2nde–Tle) : série obligatoire et présente dans le
   * référentiel de l'établissement. Niveau non reconnu : série facultative mais, si fournie,
   * elle doit exister. Retourne le code normalisé (« f5 » → « F5 ») ou {@code null}.
   */
  private String controlerSerie(String niveau, String serie) {
    boolean vide = serie == null || serie.isBlank();
    var cycle = ClasseNiveauUtil.cycleDe(niveau).orElse(null);
    if (cycle == ClasseNiveauUtil.Cycle.COLLEGE) {
      if (!vide) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Une classe du collège (6e à 3e) n'a pas de série.");
      }
      return null;
    }
    if (cycle == null && vide) return null;
    return series.exiger(Tenant.current().etablissementId(), serie).getCode();
  }

  private void remplir(Eleve eleve, EleveRequest request) {
    String genre = request.genre().trim().toUpperCase();
    if (!genre.equals("M") && !genre.equals("F")) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le genre doit être M ou F.");
    }
    eleve.setClasseId(request.classeId());
    eleve.setSessionId(request.sessionId());
    eleve.setNomComplet(request.nomComplet().trim());
    eleve.setDateNaissance(request.dateNaissance());
    eleve.setLieuNaissance(request.lieuNaissance());
    eleve.setGenre(genre);
    eleve.setNumeroTable(request.numeroTable());
    eleve.setEtablissementOrigine(request.etablissementOrigine());
  }

  private void verifierAnnee(Long id) {
    AnneeScolaire annee = annees.findById(id).orElseThrow(SchoolController::absent);
    Tenant.same(annee.getEtablissementId());
  }

  private void verifierCentre(Long id) {
    CentreExamen centre = centres.findById(id).orElseThrow(SchoolController::absent);
    Tenant.same(centre.getEtablissementId());
  }

  private void verifierSession(Long id) {
    SessionExamen session = sessions.findById(id).orElseThrow(SchoolController::absent);
    Tenant.same(session.getEtablissementId());
  }

  private void verifierClasse(Long id) {
    Classe classe = classes.findById(id).orElseThrow(SchoolController::absent);
    Tenant.same(classe.getEtablissementId());
  }

  private void verifierProfesseur(Long id) {
    Professeur professeur = professeurs.findById(id).orElseThrow(SchoolController::absent);
    Tenant.same(professeur.getEtablissementId());
  }

  private <T extends tg.academiablanc.domain.TenantOwned> T lire(JpaRepository<T, Long> repo, Long id) {
    T value = repo.findById(id).orElseThrow(SchoolController::absent);
    Tenant.same(value.getEtablissementId());
    return value;
  }

  private void flush(JpaRepository<?, ?> repo) {
    try {
      repo.flush();
    } catch (DataIntegrityViolationException ex) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Suppression impossible : des éléments liés existent encore.");
    }
  }

  private Eleve controlerNote(NoteRequest request) {
    if (request.absent() && request.valeur() != null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Une absence n'a pas de note.");
    }
    if (!request.absent() && request.valeur() == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Indiquez une note sur 20 ou cochez absent.");
    }
    Eleve eleve = eleves.findById(request.eleveId()).orElseThrow(SchoolController::absent);
    Tenant.same(eleve.getEtablissementId());
    Matiere matiere = matieres.findById(request.matiereId()).orElseThrow(SchoolController::absent);
    Tenant.same(matiere.getEtablissementId());
    verifierSession(request.sessionId());
    // Le droit NOTES:CREER / MODIFIER est déjà vérifié ; un enseignant reste limité à ses propres affectations.
    var user = Tenant.current();
    if (user.role() == Role.ENSEIGNANT) {
      boolean autorise = affectations.findByEtablissementId(user.etablissementId()).stream().anyMatch(item ->
          item.getMatiereId().equals(request.matiereId())
              && item.getClasseId().equals(eleve.getClasseId())
              && professeurs.findById(item.getProfesseurId())
                  .map(prof -> user.userId().equals(prof.getUtilisateurId()))
                  .orElse(false));
      if (!autorise) {
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Matière non affectée à cet enseignant.");
      }
    }
    return eleve;
  }

  private void appliquer(Note note, NoteRequest request, Eleve eleve) {
    note.setEtablissementId(eleve.getEtablissementId());
    note.setEleveId(request.eleveId());
    note.setMatiereId(request.matiereId());
    note.setSessionId(request.sessionId());
    note.setAbsent(request.absent());
    note.setValeur(request.absent() ? null : request.valeur());
  }

  private static ResponseStatusException absent() {
    return new ResponseStatusException(HttpStatus.NOT_FOUND, "Ressource introuvable.");
  }
}
