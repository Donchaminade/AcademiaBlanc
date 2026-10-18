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
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
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
      BulletinService bulletins
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
  public record EleveRequest(@NotNull Long classeId, Long sessionId, @NotBlank @Size(max = 180) String nomComplet, @NotBlank @Size(max = 60) String matricule,
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

  @PutMapping("/annees-scolaires/{id}")
  public AnneeScolaire majAnnee(@PathVariable Long id, @Valid @RequestBody AnneeRequest request) {
    Tenant.requireStaff();
    AnneeScolaire annee = annees.findById(id).orElseThrow(SchoolController::absent);
    Tenant.same(annee.getEtablissementId());
    appliquer(annee, request);
    return annees.save(annee);
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

  @PutMapping("/centres/{id}")
  public CentreExamen majCentre(@PathVariable Long id, @Valid @RequestBody CentreRequest request) {
    Tenant.requireStaff();
    CentreExamen centre = centres.findById(id).orElseThrow(SchoolController::absent);
    Tenant.same(centre.getEtablissementId());
    centre.setNom(request.nom().trim());
    centre.setVille(request.ville());
    centre.setCode(request.code().trim());
    return centres.save(centre);
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

  @PutMapping("/sessions/{id}")
  public SessionExamen majSession(@PathVariable Long id, @Valid @RequestBody SessionRequest request) {
    Tenant.requireStaff();
    SessionExamen session = sessions.findById(id).orElseThrow(SchoolController::absent);
    Tenant.same(session.getEtablissementId());
    verifierAnnee(request.anneeScolaireId());
    verifierCentre(request.centreId());
    remplir(session, request);
    return sessions.save(session);
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

  @PutMapping("/matieres/{id}")
  public Matiere majMatiere(@PathVariable Long id, @Valid @RequestBody MatiereRequest request) {
    Tenant.requireAdmin();
    Matiere matiere = matieres.findById(id).orElseThrow(SchoolController::absent);
    Tenant.same(matiere.getEtablissementId());
    matiere.setNom(request.nom().trim());
    matiere.setCode(request.code().trim().toLowerCase());
    return matieres.save(matiere);
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

  @PutMapping("/professeurs/{id}")
  public Professeur majProfesseur(@PathVariable Long id, @Valid @RequestBody ProfesseurRequest request) {
    Tenant.requireAdmin();
    Professeur professeur = professeurs.findById(id).orElseThrow(SchoolController::absent);
    Tenant.same(professeur.getEtablissementId());
    professeur.setNom(request.nom().trim());
    professeur.setEmail(request.email());
    return professeurs.save(professeur);
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

  @PutMapping("/classes/{id}")
  public Classe majClasse(@PathVariable Long id, @Valid @RequestBody ClasseRequest request) {
    Tenant.requireAdmin();
    Classe classe = classes.findById(id).orElseThrow(SchoolController::absent);
    Tenant.same(classe.getEtablissementId());
    verifierAnnee(request.anneeScolaireId());
    if (request.titulaireId() != null) verifierProfesseur(request.titulaireId());
    remplir(classe, request);
    return classes.save(classe);
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
    return eleves.save(eleve);
  }

  @PutMapping("/eleves/{id}")
  public Eleve majEleve(@PathVariable Long id, @Valid @RequestBody EleveRequest request) {
    Tenant.requireStaff();
    Eleve eleve = eleves.findById(id).orElseThrow(SchoolController::absent);
    Tenant.same(eleve.getEtablissementId());
    verifierClasse(request.classeId());
    if (request.sessionId() != null) verifierSession(request.sessionId());
    remplir(eleve, request);
    return eleves.save(eleve);
  }

  @GetMapping("/notes")
  public List<Note> notes(@RequestParam Long sessionId) {
    verifierSession(sessionId);
    return notes.findByEtablissementIdAndSessionId(Tenant.current().etablissementId(), sessionId);
  }

  @PostMapping("/notes")
  @Transactional
  public Note saisirNote(@Valid @RequestBody NoteRequest request) {
    var user = Tenant.current();
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
    Note note = notes.findByEleveIdAndMatiereIdAndSessionId(request.eleveId(), request.matiereId(), request.sessionId())
        .orElseGet(Note::new);
    note.setEtablissementId(user.etablissementId());
    note.setEleveId(request.eleveId());
    note.setMatiereId(request.matiereId());
    note.setSessionId(request.sessionId());
    note.setAbsent(request.absent());
    note.setValeur(request.absent() ? null : request.valeur());
    return notes.save(note);
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
    eleve.setMatricule(request.matricule().trim());
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

  private static ResponseStatusException absent() {
    return new ResponseStatusException(HttpStatus.NOT_FOUND, "Ressource introuvable.");
  }
}
