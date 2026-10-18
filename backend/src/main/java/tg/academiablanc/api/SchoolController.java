package tg.academiablanc.api;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
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
import tg.academiablanc.domain.Affectation;
import tg.academiablanc.domain.AnneeScolaire;
import tg.academiablanc.domain.CentreExamen;
import tg.academiablanc.domain.Classe;
import tg.academiablanc.domain.Coefficient;
import tg.academiablanc.domain.Eleve;
import tg.academiablanc.domain.Matiere;
import tg.academiablanc.domain.Note;
import tg.academiablanc.domain.Professeur;
import tg.academiablanc.domain.Role;
import tg.academiablanc.domain.SessionExamen;
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
  private final MatriculeService matricules;

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
      MatriculeService matricules
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
    this.matricules = matricules;
  }

  public record AnneeRequest(@NotBlank @Size(max = 40) String libelle, LocalDate dateDebut, LocalDate dateFin, boolean courante) {}
  public record CentreRequest(@NotBlank @Size(max = 180) String nom, @Size(max = 120) String ville, @NotBlank @Size(max = 40) String code) {}
  public record SessionRequest(@NotNull Long anneeScolaireId, @NotNull Long centreId, @NotBlank @Size(max = 180) String nom,
                               @NotBlank @Size(max = 120) String typeExamen, @Size(max = 80) String serie, @NotBlank @Size(max = 40) String statut) {}
  public record MatiereRequest(@NotBlank @Size(max = 180) String nom, @NotBlank @Size(max = 40) String code) {}
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
    return annees.findByEtablissementIdOrderByLibelleDesc(Tenant.current().etablissementId());
  }

  @PostMapping("/annees-scolaires")
  public AnneeScolaire creerAnnee(@Valid @RequestBody AnneeRequest request) {
    Tenant.requireStaff();
    AnneeScolaire annee = new AnneeScolaire();
    appliquer(annee, request);
    return annees.save(annee);
  }

  @GetMapping("/annees-scolaires/{id}")
  public AnneeScolaire annee(@PathVariable Long id) {
    return lire(annees, id);
  }

  @PutMapping("/annees-scolaires/{id}")
  public AnneeScolaire majAnnee(@PathVariable Long id, @Valid @RequestBody AnneeRequest request) {
    Tenant.requireStaff();
    AnneeScolaire annee = lire(annees, id);
    appliquer(annee, request);
    return annees.save(annee);
  }

  @DeleteMapping("/annees-scolaires/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @Transactional
  public void supprimerAnnee(@PathVariable Long id) {
    Tenant.requireStaff();
    annees.delete(lire(annees, id));
    flush(annees);
  }

  @GetMapping("/centres")
  public List<CentreExamen> centres() {
    return centres.findByEtablissementIdOrderByNomAsc(Tenant.current().etablissementId());
  }

  @PostMapping("/centres")
  public CentreExamen creerCentre(@Valid @RequestBody CentreRequest request) {
    Tenant.requireStaff();
    CentreExamen centre = new CentreExamen();
    centre.setEtablissementId(Tenant.current().etablissementId());
    centre.setNom(request.nom().trim());
    centre.setVille(request.ville());
    centre.setCode(request.code().trim());
    return centres.save(centre);
  }

  @GetMapping("/centres/{id}")
  public CentreExamen centre(@PathVariable Long id) {
    return lire(centres, id);
  }

  @PutMapping("/centres/{id}")
  public CentreExamen majCentre(@PathVariable Long id, @Valid @RequestBody CentreRequest request) {
    Tenant.requireStaff();
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
    Tenant.requireStaff();
    centres.delete(lire(centres, id));
    flush(centres);
  }

  @GetMapping("/sessions")
  public List<SessionExamen> sessions() {
    return sessions.findByEtablissementIdOrderByNomAsc(Tenant.current().etablissementId());
  }

  @PostMapping("/sessions")
  public SessionExamen creerSession(@Valid @RequestBody SessionRequest request) {
    Tenant.requireStaff();
    verifierAnnee(request.anneeScolaireId());
    verifierCentre(request.centreId());
    SessionExamen session = new SessionExamen();
    session.setEtablissementId(Tenant.current().etablissementId());
    remplir(session, request);
    return sessions.save(session);
  }

  @GetMapping("/sessions/{id}")
  public SessionExamen session(@PathVariable Long id) {
    return lire(sessions, id);
  }

  @PutMapping("/sessions/{id}")
  public SessionExamen majSession(@PathVariable Long id, @Valid @RequestBody SessionRequest request) {
    Tenant.requireStaff();
    SessionExamen session = lire(sessions, id);
    verifierAnnee(request.anneeScolaireId());
    verifierCentre(request.centreId());
    remplir(session, request);
    return sessions.save(session);
  }

  @DeleteMapping("/sessions/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @Transactional
  public void supprimerSession(@PathVariable Long id) {
    Tenant.requireStaff();
    sessions.delete(lire(sessions, id));
    flush(sessions);
  }

  @GetMapping("/matieres")
  public List<Matiere> matieres() {
    return matieres.findByEtablissementIdOrderByNomAsc(Tenant.current().etablissementId());
  }

  @PostMapping("/matieres")
  public Matiere creerMatiere(@Valid @RequestBody MatiereRequest request) {
    Tenant.requireAdmin();
    Matiere matiere = new Matiere();
    matiere.setEtablissementId(Tenant.current().etablissementId());
    matiere.setNom(request.nom().trim());
    matiere.setCode(request.code().trim().toLowerCase());
    return matieres.save(matiere);
  }

  @GetMapping("/matieres/{id}")
  public Matiere matiere(@PathVariable Long id) {
    return lire(matieres, id);
  }

  @PutMapping("/matieres/{id}")
  public Matiere majMatiere(@PathVariable Long id, @Valid @RequestBody MatiereRequest request) {
    Tenant.requireAdmin();
    Matiere matiere = lire(matieres, id);
    matiere.setNom(request.nom().trim());
    matiere.setCode(request.code().trim().toLowerCase());
    return matieres.save(matiere);
  }

  @DeleteMapping("/matieres/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @Transactional
  public void supprimerMatiere(@PathVariable Long id) {
    Tenant.requireAdmin();
    matieres.delete(lire(matieres, id));
    flush(matieres);
  }

  @GetMapping("/coefficients")
  public List<Coefficient> coefficients() {
    return coefficients.findByEtablissementId(Tenant.current().etablissementId());
  }

  @PostMapping("/coefficients")
  public Coefficient creerCoefficient(@Valid @RequestBody CoefficientRequest request) {
    Tenant.requireAdmin();
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
    return lire(coefficients, id);
  }

  @PutMapping("/coefficients/{id}")
  public Coefficient majCoefficient(@PathVariable Long id, @Valid @RequestBody CoefficientRequest request) {
    Tenant.requireAdmin();
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
    Tenant.requireAdmin();
    coefficients.delete(lire(coefficients, id));
    flush(coefficients);
  }

  @GetMapping("/professeurs")
  public List<Professeur> professeurs() {
    return professeurs.findByEtablissementIdOrderByNomAsc(Tenant.current().etablissementId());
  }

  @PostMapping("/professeurs")
  public Professeur creerProfesseur(@Valid @RequestBody ProfesseurRequest request) {
    Tenant.requireAdmin();
    Professeur professeur = new Professeur();
    professeur.setEtablissementId(Tenant.current().etablissementId());
    professeur.setNom(request.nom().trim());
    professeur.setEmail(request.email());
    return professeurs.save(professeur);
  }

  @GetMapping("/professeurs/{id}")
  public Professeur professeur(@PathVariable Long id) {
    return lire(professeurs, id);
  }

  @PutMapping("/professeurs/{id}")
  public Professeur majProfesseur(@PathVariable Long id, @Valid @RequestBody ProfesseurRequest request) {
    Tenant.requireAdmin();
    Professeur professeur = lire(professeurs, id);
    professeur.setNom(request.nom().trim());
    professeur.setEmail(request.email());
    return professeurs.save(professeur);
  }

  @DeleteMapping("/professeurs/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @Transactional
  public void supprimerProfesseur(@PathVariable Long id) {
    Tenant.requireAdmin();
    professeurs.delete(lire(professeurs, id));
    flush(professeurs);
  }

  @GetMapping("/classes")
  public List<Classe> classes() {
    return classes.findByEtablissementIdOrderByNomAsc(Tenant.current().etablissementId());
  }

  @PostMapping("/classes")
  public Classe creerClasse(@Valid @RequestBody ClasseRequest request) {
    Tenant.requireAdmin();
    verifierAnnee(request.anneeScolaireId());
    if (request.titulaireId() != null) verifierProfesseur(request.titulaireId());
    Classe classe = new Classe();
    classe.setEtablissementId(Tenant.current().etablissementId());
    remplir(classe, request);
    return classes.save(classe);
  }

  @GetMapping("/classes/{id}")
  public Classe classe(@PathVariable Long id) {
    return lire(classes, id);
  }

  @PutMapping("/classes/{id}")
  public Classe majClasse(@PathVariable Long id, @Valid @RequestBody ClasseRequest request) {
    Tenant.requireAdmin();
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
    Tenant.requireAdmin();
    classes.delete(lire(classes, id));
    flush(classes);
  }

  @PutMapping("/classes/{id}/titulaire")
  public Classe designerTitulaire(@PathVariable Long id, @Valid @RequestBody TitulaireRequest request) {
    Tenant.requireAdmin();
    Classe classe = classes.findById(id).orElseThrow(SchoolController::absent);
    Tenant.same(classe.getEtablissementId());
    verifierProfesseur(request.professeurId());
    classe.setTitulaireId(request.professeurId());
    return classes.save(classe);
  }

  @GetMapping("/affectations")
  public List<Affectation> affectations() {
    return affectations.findByEtablissementId(Tenant.current().etablissementId());
  }

  @PostMapping("/affectations")
  public Affectation affecter(@Valid @RequestBody AffectationRequest request) {
    Tenant.requireAdmin();
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
    return lire(affectations, id);
  }

  @PutMapping("/affectations/{id}")
  public Affectation majAffectation(@PathVariable Long id, @Valid @RequestBody AffectationRequest request) {
    Tenant.requireAdmin();
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
    Tenant.requireAdmin();
    affectations.delete(lire(affectations, id));
    flush(affectations);
  }

  @GetMapping("/eleves")
  public List<Eleve> eleves() {
    return eleves.findByEtablissementIdOrderByNomCompletAsc(Tenant.current().etablissementId());
  }

  @PostMapping("/eleves")
  public Eleve creerEleve(@Valid @RequestBody EleveRequest request) {
    Tenant.requireStaff();
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
    return lire(eleves, id);
  }

  @PutMapping("/eleves/{id}")
  public Eleve majEleve(@PathVariable Long id, @Valid @RequestBody EleveRequest request) {
    Tenant.requireStaff();
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
    Tenant.requireStaff();
    eleves.delete(lire(eleves, id));
    flush(eleves);
  }

  @GetMapping("/notes")
  public List<Note> notes(@RequestParam Long sessionId) {
    verifierSession(sessionId);
    return notes.findByEtablissementIdAndSessionId(Tenant.current().etablissementId(), sessionId);
  }

  @GetMapping("/notes/{id}")
  public Note note(@PathVariable Long id) {
    return lire(notes, id);
  }

  @PostMapping("/notes")
  @Transactional
  public Note saisirNote(@Valid @RequestBody NoteRequest request) {
    Eleve eleve = controlerNote(request);
    Note note = notes.findByEleveIdAndMatiereIdAndSessionId(request.eleveId(), request.matiereId(), request.sessionId())
        .orElseGet(Note::new);
    appliquer(note, request, eleve);
    return notes.save(note);
  }

  @PutMapping("/notes/{id}")
  @Transactional
  public Note majNote(@PathVariable Long id, @Valid @RequestBody NoteRequest request) {
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
    Tenant.requireStaff();
    if (Tenant.current().role() == Role.ENSEIGNANT) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Droit insuffisant.");
    }
    notes.delete(lire(notes, id));
    flush(notes);
  }

  @GetMapping("/bulletins")
  public List<BulletinService.BulletinVue> bulletins(@RequestParam Long sessionId) {
    return bulletins.generer(sessionId);
  }

  @PostMapping("/bulletins/generer")
  public List<BulletinService.BulletinVue> generer(@RequestParam Long sessionId) {
    Tenant.requireStaff();
    return bulletins.generer(sessionId);
  }

  private void appliquer(AnneeScolaire annee, AnneeRequest request) {
    annee.setEtablissementId(Tenant.current().etablissementId());
    annee.setLibelle(request.libelle().trim());
    annee.setDateDebut(request.dateDebut());
    annee.setDateFin(request.dateFin());
    annee.setCourante(request.courante());
  }

  private void remplir(SessionExamen session, SessionRequest request) {
    session.setAnneeScolaireId(request.anneeScolaireId());
    session.setCentreId(request.centreId());
    session.setNom(request.nom().trim());
    session.setTypeExamen(request.typeExamen().trim());
    session.setSerie(request.serie());
    session.setStatut(request.statut().trim());
  }

  private void remplir(Classe classe, ClasseRequest request) {
    classe.setAnneeScolaireId(request.anneeScolaireId());
    classe.setNom(request.nom().trim());
    classe.setNiveau(request.niveau().trim());
    classe.setSerie(request.serie());
    classe.setTitulaireId(request.titulaireId());
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
    } else {
      Tenant.requireStaff();
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
