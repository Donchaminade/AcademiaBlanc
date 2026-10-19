package tg.academiablanc.api;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import tg.academiablanc.calc.Appreciation;
import tg.academiablanc.calc.GradeCalculator;
import tg.academiablanc.calc.GradeCalculator.Ligne;
import tg.academiablanc.domain.Bulletin;
import tg.academiablanc.domain.Classe;
import tg.academiablanc.domain.Coefficient;
import tg.academiablanc.domain.Eleve;
import tg.academiablanc.domain.Etablissement;
import tg.academiablanc.domain.Matiere;
import tg.academiablanc.domain.Note;
import tg.academiablanc.domain.Professeur;
import tg.academiablanc.domain.Serie;
import tg.academiablanc.domain.SessionExamen;
import tg.academiablanc.domain.TypeExamen;
import tg.academiablanc.repo.AnneeScolaireRepository;
import tg.academiablanc.repo.BulletinRepository;
import tg.academiablanc.repo.ClasseRepository;
import tg.academiablanc.repo.CoefficientRepository;
import tg.academiablanc.repo.EleveRepository;
import tg.academiablanc.repo.EtablissementRepository;
import tg.academiablanc.repo.MatiereRepository;
import tg.academiablanc.repo.NoteRepository;
import tg.academiablanc.repo.ProfesseurRepository;
import tg.academiablanc.repo.SerieRepository;
import tg.academiablanc.repo.SessionExamenRepository;
import tg.academiablanc.repo.TypeExamenRepository;
import tg.academiablanc.security.Tenant;

@Service
public class BulletinService {
  private final SessionExamenRepository sessions;
  private final EleveRepository eleves;
  private final MatiereRepository matieres;
  private final CoefficientRepository coefficients;
  private final NoteRepository notes;
  private final BulletinRepository bulletins;
  private final ClasseRepository classes;
  private final ProfesseurRepository professeurs;
  private final EtablissementRepository etablissements;
  private final TypeExamenRepository typesExamen;
  private final AnneeScolaireRepository annees;
  private final SerieRepository series;

  public BulletinService(
      SessionExamenRepository sessions,
      EleveRepository eleves,
      MatiereRepository matieres,
      CoefficientRepository coefficients,
      NoteRepository notes,
      BulletinRepository bulletins,
      ClasseRepository classes,
      ProfesseurRepository professeurs,
      EtablissementRepository etablissements,
      TypeExamenRepository typesExamen,
      AnneeScolaireRepository annees,
      SerieRepository series
  ) {
    this.sessions = sessions;
    this.eleves = eleves;
    this.matieres = matieres;
    this.coefficients = coefficients;
    this.notes = notes;
    this.bulletins = bulletins;
    this.classes = classes;
    this.professeurs = professeurs;
    this.etablissements = etablissements;
    this.typesExamen = typesExamen;
    this.annees = annees;
    this.series = series;
  }

  /**
   * Ligne du bulletin. {@code noteMaxClasse} / {@code noteMinClasse} : meilleure et moins bonne note de
   * la matière parmi les élèves de la même classe (même session) qui ont une note présente ; null sans note.
   * {@code appreciation} : texte libre de l'enseignant s'il existe, sinon barème {@link Appreciation} sur la note.
   */
  public record LigneBulletin(Long matiereId, String matiere, BigDecimal note, BigDecimal coefficient,
                              BigDecimal total, Integer rang, boolean absent,
                              BigDecimal noteMaxClasse, BigDecimal noteMinClasse, String appreciation) {}

  /**
   * Bulletin d'un élève. La moyenne est la moyenne réelle Σ(note × coef) / Σ coef : aucun point n'y est
   * ajouté. {@code totalCoef} ne compte que les matières notées (une matière sans note ne vaut pas zéro) ;
   * {@code totalCoefProgramme} et {@code pointsMax} (= 20 × Σ coef) portent sur tout le programme de la
   * classe. {@code moyenneClasse}, {@code moyenneClasseMax} et {@code moyenneClasseMin} sont calculées sur
   * les élèves notés de la même classe dans la session ; null si personne n'est noté.
   * {@code titulaireNom} : nom de l'enseignant affecté comme titulaire à la classe de l'élève
   * ({@code classe.titulaire_id}), tel que saisi dans Administration › Enseignants (civilité comprise) ;
   * null si la classe n'a pas de titulaire — le bulletin laisse alors la ligne du visa à compléter à la main.
   * {@code etablissementNom} et {@code etablissementDevise} alimentent le pied de page du relevé
   * (« NOM DE L'ÉTABLISSEMENT • Devise ») ; la devise est celle propre à l'établissement
   * ({@code etablissement.devise}), pas la devise nationale de l'en-tête, et vaut null si aucune n'est saisie.
   * {@code entete} : données du bandeau de titre du bulletin, toutes lues en base (voir {@link EnteteBulletin}).
   */
  public record BulletinVue(Long eleveId, String nomComplet, String matricule, String titulaireNom, BigDecimal moyenne,
                            Integer rang, String mention, String appreciation, BigDecimal totalPoints,
                            BigDecimal totalCoef, BigDecimal totalCoefProgramme, BigDecimal pointsMax,
                            BigDecimal moyenneClasse, BigDecimal moyenneClasseMax, BigDecimal moyenneClasseMin,
                            List<LigneBulletin> lignes,
                            String etablissementNom, String etablissementDevise,
                            EnteteBulletin entete) {}

  /**
   * Bandeau de titre du bulletin : rien n'y est figé, chaque champ vient de la base et vaut null s'il manque.
   * <ul>
   *   <li>{@code sessionNom} : intitulé saisi de la session ({@code session_examen.nom}) ;</li>
   *   <li>{@code typeExamenLibelle} : libellé long du type rattaché ({@code type_examen.libelle_long}), sinon son
   *       libellé court, sinon le texte conservé sur la session ; null si la session n'a aucun type ;</li>
   *   <li>{@code typeExamenCode} : code du référentiel (BEPC, BAC2…), null hors référentiel ;</li>
   *   <li>{@code anneeScolaire} : libellé de l'année de la session ({@code annee_scolaire.libelle}) ;</li>
   *   <li>{@code classeNom}, {@code classeNiveau} : classe de l'élève ({@code classe.nom}, {@code classe.niveau}) ;</li>
   *   <li>{@code classeSerie}, {@code classeSerieLibelle} : série de la classe au lycée ({@code classe.serie},
   *       {@code serie.libelle}) ; toujours null au collège (6e–3e), même si la session porte une série.</li>
   * </ul>
   */
  public record EnteteBulletin(String sessionNom, String typeExamenLibelle, String typeExamenCode, String anneeScolaire,
                               String classeNom, String classeNiveau, String classeSerie, String classeSerieLibelle) {}

  /** Calcule les bulletins de la session et les enregistre (table {@code bulletin}). */
  @Transactional
  public List<BulletinVue> generer(Long sessionId) {
    List<BulletinVue> vues = calculer(sessionId);
    Long etablissementId = Tenant.current().etablissementId();
    for (BulletinVue vue : vues) {
      upsert(etablissementId, sessionId, vue);
    }
    return vues;
  }

  /**
   * Calcule les bulletins de la session sans rien écrire : mêmes moyennes, rangs et mentions que
   * {@link #generer(Long)}. Sert aux statistiques (archives) pour ne jamais diverger du bulletin.
   */
  @Transactional
  public List<BulletinVue> calculer(Long sessionId) {
    var user = Tenant.current();
    var session = sessions.findById(sessionId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Session introuvable."));
    Tenant.same(session.getEtablissementId());

    List<Eleve> roster = eleves.findByEtablissementIdAndSessionId(user.etablissementId(), sessionId);
    if (roster.isEmpty()) {
      roster = eleves.findByEtablissementIdOrderByNomCompletAsc(user.etablissementId());
    }
    List<Matiere> subjects = new ArrayList<>(matieres.findByEtablissementIdOrderByNomAsc(user.etablissementId()));
    subjects.sort(ReferentielMatieres.ORDRE_BULLETIN);
    Map<Long, Matiere> matiereParId = new HashMap<>();
    for (Matiere matiere : subjects) matiereParId.put(matiere.getId(), matiere);
    List<Note> sessionNotes = notes.findByEtablissementIdAndSessionId(user.etablissementId(), sessionId);
    List<Coefficient> coefs = coefficients.findByEtablissementId(user.etablissementId());
    Map<Long, String> titulaireParClasse = titulairesParClasse(user.etablissementId());

    // Programme de chaque classe (matière → coefficient) ; une classe sans ligne n'a pas de programme défini.
    Map<Long, Map<Long, BigDecimal>> programmes = new HashMap<>();
    for (Coefficient coef : coefs) {
      if (coef.getClasseId() != null) {
        programmes.computeIfAbsent(coef.getClasseId(), ignored -> new HashMap<>()).putIfAbsent(coef.getMatiereId(), coef.getValeur());
      }
    }

    Map<Long, Map<Long, Note>> notesByEleve = new HashMap<>();
    for (Note note : sessionNotes) {
      notesByEleve.computeIfAbsent(note.getEleveId(), ignored -> new HashMap<>()).put(note.getMatiereId(), note);
    }

    Map<Long, BigDecimal> moyennes = new HashMap<>();
    Map<Long, List<Ligne>> lignesParEleve = new HashMap<>();
    for (Eleve eleve : roster) {
      List<Ligne> lignes = new ArrayList<>();
      for (Matiere matiere : matieresDe(eleve, subjects, programmes)) {
        Note note = notesByEleve.getOrDefault(eleve.getId(), Map.of()).get(matiere.getId());
        boolean absent = note == null || note.isAbsent() || note.getValeur() == null;
        BigDecimal valeur = absent || note == null ? null : note.getValeur();
        lignes.add(new Ligne(eleve.getId(), matiere.getId(), valeur, coefDe(coefs, programmes, matiere.getId(), eleve.getClasseId()), absent));
      }
      lignesParEleve.put(eleve.getId(), lignes);
      // Moyenne réelle, jamais majorée : la délibération du jury ne porte que l'observation et la signature.
      moyennes.put(eleve.getId(), GradeCalculator.moyenne(lignes));
    }
    Map<Long, Integer> rangsGeneraux = GradeCalculator.rangsCompetition(moyennes);

    // Extrêmes par classe (même session) : moyenne de classe, moyenne la plus forte et la plus faible,
    // sur les élèves qui ont au moins une note. Les élèves sans classe forment un groupe à part.
    Map<Long, List<BigDecimal>> moyennesParClasse = new HashMap<>();
    for (Eleve eleve : roster) {
      BigDecimal moyenne = moyennes.get(eleve.getId());
      if (moyenne != null) moyennesParClasse.computeIfAbsent(eleve.getClasseId(), ignored -> new ArrayList<>()).add(moyenne);
    }

    // Notes extrêmes par classe et par matière, sur les notes présentes.
    Map<Long, Map<Long, List<BigDecimal>>> notesParClasseEtMatiere = new HashMap<>();
    for (Eleve eleve : roster) {
      for (Ligne ligne : lignesParEleve.get(eleve.getId())) {
        if (ligne.absent() || ligne.note() == null) continue;
        notesParClasseEtMatiere.computeIfAbsent(eleve.getClasseId(), ignored -> new HashMap<>())
            .computeIfAbsent(ligne.matiereId(), ignored -> new ArrayList<>())
            .add(ligne.note());
      }
    }

    // Rang par matière : parmi les élèves qui ont cette matière à leur programme et une note présente.
    Map<Long, Map<Long, Integer>> rangsMatieres = new HashMap<>();
    for (Matiere matiere : subjects) {
      Map<Long, BigDecimal> valeurs = new HashMap<>();
      for (Eleve eleve : roster) {
        Ligne ligne = lignesParEleve.get(eleve.getId()).stream()
            .filter(item -> item.matiereId().equals(matiere.getId()))
            .findFirst()
            .orElse(null);
        if (ligne != null && !ligne.absent() && ligne.note() != null) {
          valeurs.put(eleve.getId(), ligne.note());
        }
      }
      rangsMatieres.put(matiere.getId(), GradeCalculator.rangsCompetition(valeurs));
    }

    Etablissement etablissement = etablissements.findById(user.etablissementId()).orElse(null);
    String etablissementNom = etablissement == null ? null : etablissement.getNom();
    String etablissementDevise = etablissement == null ? null : vide(etablissement.getDevise());
    Map<Long, EnteteBulletin> enteteParClasse = entetesParClasse(session, user.etablissementId());

    List<BulletinVue> vues = new ArrayList<>();
    for (Eleve eleve : roster) {
      List<Ligne> lignes = lignesParEleve.get(eleve.getId());
      BigDecimal moyenne = moyennes.get(eleve.getId());
      List<LigneBulletin> detail = new ArrayList<>();
      Map<Long, List<BigDecimal>> notesDeLaClasse = notesParClasseEtMatiere.getOrDefault(eleve.getClasseId(), Map.of());
      for (Ligne ligne : lignes) {
        Matiere matiere = matiereParId.get(ligne.matiereId());
        Integer rangMatiere = rangsMatieres.get(matiere.getId()).get(eleve.getId());
        Note note = notesByEleve.getOrDefault(eleve.getId(), Map.of()).get(matiere.getId());
        List<BigDecimal> notesMatiere = notesDeLaClasse.getOrDefault(matiere.getId(), List.of());
        detail.add(new LigneBulletin(
            matiere.getId(),
            matiere.getNom(),
            ligne.note(),
            ligne.coef(),
            GradeCalculator.totalPondere(ligne.note(), ligne.coef()),
            rangMatiere,
            ligne.absent(),
            GradeCalculator.max(notesMatiere),
            GradeCalculator.min(notesMatiere),
            Appreciation.pourLigne(ligne.note(), note != null && note.isAbsent(), note == null ? null : note.getAppreciation())
        ));
      }
      List<BigDecimal> moyennesDeLaClasse = moyennesParClasse.getOrDefault(eleve.getClasseId(), List.of());
      BulletinVue vue = new BulletinVue(
          eleve.getId(),
          eleve.getNomComplet(),
          eleve.getMatricule(),
          titulaireParClasse.get(eleve.getClasseId()),
          moyenne,
          rangsGeneraux.get(eleve.getId()),
          GradeCalculator.mention(moyenne),
          GradeCalculator.appreciation(moyenne),
          GradeCalculator.sommePoints(lignes),
          GradeCalculator.sommeCoef(lignes),
          GradeCalculator.sommeCoefProgramme(lignes),
          GradeCalculator.pointsMax(lignes),
          GradeCalculator.moyenneDe(moyennesDeLaClasse),
          GradeCalculator.max(moyennesDeLaClasse),
          GradeCalculator.min(moyennesDeLaClasse),
          detail,
          etablissementNom,
          etablissementDevise,
          enteteParClasse.computeIfAbsent(eleve.getClasseId(), ignored -> enteteSession(session, user.etablissementId()))
      );
      vues.add(vue);
    }
    return vues;
  }

  private void upsert(Long etablissementId, Long sessionId, BulletinVue vue) {
    Bulletin bulletin = bulletins.findByEleveIdAndSessionId(vue.eleveId(), sessionId).orElseGet(Bulletin::new);
    bulletin.setEtablissementId(etablissementId);
    bulletin.setEleveId(vue.eleveId());
    bulletin.setSessionId(sessionId);
    bulletin.setMoyenne(vue.moyenne());
    bulletin.setRang(vue.rang());
    bulletin.setMention(vue.mention());
    bulletin.setAppreciation(vue.appreciation());
    bulletin.setTotalPoints(vue.totalPoints());
    bulletin.setTotalCoef(vue.totalCoef());
    bulletin.setGenereLe(Instant.now());
    bulletins.save(bulletin);
  }

  /** Bandeau du bulletin pour chaque classe de l'établissement : la partie session est commune, la partie classe varie. */
  private Map<Long, EnteteBulletin> entetesParClasse(SessionExamen session, Long etablissementId) {
    EnteteBulletin commun = enteteSession(session, etablissementId);
    Map<String, String> libelleParSerie = new HashMap<>();
    for (Serie serie : series.findByEtablissementIdOrderByFamilleAscOrdreAscCodeAsc(etablissementId)) {
      libelleParSerie.put(serie.getCode().toUpperCase(Locale.ROOT), serie.getLibelle());
    }
    Map<Long, EnteteBulletin> entetes = new HashMap<>();
    for (Classe classe : classes.findByEtablissementIdOrderByNomAsc(etablissementId)) {
      entetes.put(classe.getId(), avecClasse(commun, classe, libelleParSerie));
    }
    return entetes;
  }

  /**
   * Partie « session » du bandeau : libellé long du type d'examen rattaché (sinon libellé court, code, ou le
   * texte conservé sur la session ; null sans type), intitulé de la session et libellé de son année scolaire.
   */
  private EnteteBulletin enteteSession(SessionExamen session, Long etablissementId) {
    TypeExamen type = session.getTypeExamenId() == null ? null : typesExamen.findById(session.getTypeExamenId()).orElse(null);
    String typeLibelle = type != null ? premierNonVide(type.getLibelleLong(), type.getLibelleCourt(), type.getCode()) : vide(session.getTypeExamen());
    String anneeScolaire = annees.findById(session.getAnneeScolaireId())
        .filter(annee -> etablissementId.equals(annee.getEtablissementId()))
        .map(annee -> vide(annee.getLibelle()))
        .orElse(null);
    return new EnteteBulletin(vide(session.getNom()), typeLibelle, type == null ? null : type.getCode(), anneeScolaire, null, null, null, null);
  }

  /**
   * Partie « classe » du bandeau : niveau canonique et nom de la classe, série et libellé de série au lycée.
   * Au collège la série est ignorée ; une série absente du référentiel garde son code sans libellé.
   */
  private static EnteteBulletin avecClasse(EnteteBulletin commun, Classe classe, Map<String, String> libelleParSerie) {
    String niveau = ClasseNiveauUtil.canonique(classe.getNiveau()).orElse(vide(classe.getNiveau()));
    boolean college = ClasseNiveauUtil.cycleDe(classe.getNiveau()).filter(ClasseNiveauUtil.Cycle.COLLEGE::equals).isPresent();
    String serie = college ? null : vide(classe.getSerie());
    String serieLibelle = serie == null ? null : vide(libelleParSerie.get(serie.toUpperCase(Locale.ROOT)));
    return new EnteteBulletin(commun.sessionNom(), commun.typeExamenLibelle(), commun.typeExamenCode(), commun.anneeScolaire(),
        vide(classe.getNom()), niveau, serie, serieLibelle);
  }

  private static String premierNonVide(String... valeurs) {
    for (String valeur : valeurs) {
      String nettoyee = vide(valeur);
      if (nettoyee != null) return nettoyee;
    }
    return null;
  }

  /** Nom du titulaire de chaque classe de l'établissement (classe → professeur affecté) ; les classes sans titulaire sont absentes. */
  private Map<Long, String> titulairesParClasse(Long etablissementId) {
    Map<Long, String> nomParProfesseur = new HashMap<>();
    for (Professeur professeur : professeurs.findByEtablissementIdOrderByNomAsc(etablissementId)) {
      nomParProfesseur.put(professeur.getId(), professeur.getNom());
    }
    Map<Long, String> titulaires = new HashMap<>();
    for (Classe classe : classes.findByEtablissementIdOrderByNomAsc(etablissementId)) {
      String nom = classe.getTitulaireId() == null ? null : nomParProfesseur.get(classe.getTitulaireId());
      if (nom != null && !nom.isBlank()) titulaires.put(classe.getId(), nom.trim());
    }
    return titulaires;
  }

  /**
   * Matières du bulletin d'un élève : celles du programme de sa classe quand il est défini ;
   * sinon (compatibilité) toutes les matières de l'établissement, avec les coefficients globaux.
   */
  private static List<Matiere> matieresDe(Eleve eleve, List<Matiere> toutes, Map<Long, Map<Long, BigDecimal>> programmes) {
    Map<Long, BigDecimal> programme = programmes.get(eleve.getClasseId());
    if (programme == null || programme.isEmpty()) return toutes;
    List<Matiere> retenues = new ArrayList<>();
    for (Matiere matiere : toutes) {
      if (programme.containsKey(matiere.getId())) retenues.add(matiere);
    }
    return retenues;
  }

  /** Devise facultative : une chaîne vide ou faite d'espaces vaut « aucune devise ». */
  private static String vide(String valeur) {
    if (valeur == null) return null;
    String nettoyee = valeur.trim();
    return nettoyee.isEmpty() ? null : nettoyee;
  }

  private static BigDecimal coefDe(List<Coefficient> coefs, Map<Long, Map<Long, BigDecimal>> programmes, Long matiereId, Long classeId) {
    BigDecimal duProgramme = programmes.getOrDefault(classeId, Map.of()).get(matiereId);
    if (duProgramme != null) return duProgramme;
    return coefs.stream()
        .filter(coef -> coef.getMatiereId().equals(matiereId) && coef.getClasseId() == null)
        .map(Coefficient::getValeur)
        .findFirst()
        .orElse(BigDecimal.ONE);
  }
}
