package tg.academiablanc.api;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
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
import tg.academiablanc.domain.ModeSession;
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
import tg.academiablanc.repo.ParametresBulletinRepository;
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
  private final ParametresBulletinRepository parametres;

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
      SerieRepository series,
      ParametresBulletinRepository parametres
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
    this.parametres = parametres;
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
   * {@code decision} : {@code ADMIS} si la moyenne affichée est ≥ 10/20, {@code AJOURNÉ} sinon, null sans aucune note
   * (voir {@link GradeCalculator#decision}).
   * {@code modeSession} : INTERNE ou INTER_ETABLISSEMENTS. En session inter-établissements :
   * {@code centreExamen} est le nom de l'établissement hôte (celui qui a créé la session), {@code responsableCentre}
   * le nom de son responsable (signe comme chef du centre à la place du titulaire), {@code etablissementOrigine}
   * l'établissement d'origine du candidat ({@code eleve.etablissement_origine}, l'hôte si vide), et le rang comme
   * les extrêmes « de classe » sont calculés sur tous les candidats de la session du même niveau et de la même
   * série, toutes classes confondues. En mode interne ces trois champs valent null (sauf l'origine saisie) et le
   * calcul est inchangé : rang sur toute la session, extrêmes par classe.
   * {@code titreResponsable} : titre du chef d'établissement qui signe le bulletin en mode interne — « Le Directeur »
   * pour une classe de collège, « Le Proviseur » au lycée, le type de la fiche de l'établissement tranchant quand il
   * est connu, sauf titre saisi dans le profil ({@code parametres_bulletin.titre_signataire_jury}) ; voir
   * {@link TitreChefEtablissement}. Son nom est {@code etablissement.nom_responsable}.
   */
  public record BulletinVue(Long eleveId, String nomComplet, String matricule, String titulaireNom, BigDecimal moyenne,
                            Integer rang, String mention, String decision, String appreciation, BigDecimal totalPoints,
                            BigDecimal totalCoef, BigDecimal totalCoefProgramme, BigDecimal pointsMax,
                            BigDecimal moyenneClasse, BigDecimal moyenneClasseMax, BigDecimal moyenneClasseMin,
                            List<LigneBulletin> lignes,
                            String etablissementNom, String etablissementDevise,
                            EnteteBulletin entete,
                            ModeSession modeSession, String centreExamen, String etablissementOrigine,
                            String responsableCentre, String titreResponsable) {}

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

    List<Eleve> roster = candidatsDe(session, user.etablissementId());
    List<Matiere> subjects = new ArrayList<>(matieres.findByEtablissementIdOrderByNomAsc(user.etablissementId()));
    subjects.sort(ReferentielMatieres.ORDRE_BULLETIN);
    Map<Long, Matiere> matiereParId = new HashMap<>();
    for (Matiere matiere : subjects) matiereParId.put(matiere.getId(), matiere);
    List<Note> sessionNotes = notes.findByEtablissementIdAndSessionId(user.etablissementId(), sessionId);
    List<Coefficient> coefs = coefficients.findByEtablissementId(user.etablissementId());
    Map<Long, String> titulaireParClasse = titulairesParClasse(user.etablissementId());
    boolean inter = session.estInterEtablissements();
    // Groupe de comparaison d'un élève : sa classe en mode interne ; en inter-établissements, tous les
    // candidats de la session du même niveau et de la même série (les classes du centre sont confondues).
    Map<Long, Classe> classeParId = new HashMap<>();
    for (Classe classe : classes.findByEtablissementIdOrderByNomAsc(user.etablissementId())) classeParId.put(classe.getId(), classe);
    Map<Long, String> groupeParEleve = new HashMap<>();
    for (Eleve eleve : roster) {
      groupeParEleve.put(eleve.getId(), inter ? cleNiveauSerie(classeParId.get(eleve.getClasseId())) : "classe:" + eleve.getClasseId());
    }

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
    // Rang général : sur toute la session en mode interne ; par niveau / série en inter-établissements
    // (un candidat de Tle D n'est classé qu'avec les candidats de Tle D, de tous les établissements).
    Map<Long, Integer> rangsGeneraux = inter ? rangsParGroupe(moyennes, groupeParEleve) : GradeCalculator.rangsCompetition(moyennes);

    // Extrêmes par groupe (même session) : moyenne de classe, moyenne la plus forte et la plus faible,
    // sur les élèves qui ont au moins une note. Les élèves sans classe forment un groupe à part.
    Map<String, List<BigDecimal>> moyennesParClasse = new HashMap<>();
    for (Eleve eleve : roster) {
      BigDecimal moyenne = moyennes.get(eleve.getId());
      if (moyenne != null) moyennesParClasse.computeIfAbsent(groupeParEleve.get(eleve.getId()), ignored -> new ArrayList<>()).add(moyenne);
    }

    // Notes extrêmes par groupe et par matière, sur les notes présentes.
    Map<String, Map<Long, List<BigDecimal>>> notesParClasseEtMatiere = new HashMap<>();
    for (Eleve eleve : roster) {
      for (Ligne ligne : lignesParEleve.get(eleve.getId())) {
        if (ligne.absent() || ligne.note() == null) continue;
        notesParClasseEtMatiere.computeIfAbsent(groupeParEleve.get(eleve.getId()), ignored -> new HashMap<>())
            .computeIfAbsent(ligne.matiereId(), ignored -> new ArrayList<>())
            .add(ligne.note());
      }
    }

    // Rang par matière : parmi les élèves qui ont cette matière à leur programme et une note présente
    // (toute la session en interne, le niveau / la série en inter-établissements).
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
      rangsMatieres.put(matiere.getId(), inter ? rangsParGroupe(valeurs, groupeParEleve) : GradeCalculator.rangsCompetition(valeurs));
    }

    Etablissement etablissement = etablissements.findById(user.etablissementId()).orElse(null);
    String etablissementNom = etablissement == null ? null : etablissement.getNom();
    String etablissementDevise = etablissement == null ? null : vide(etablissement.getDevise());
    String centreExamen = inter ? etablissementNom : null;
    String responsableCentre = inter && etablissement != null ? vide(etablissement.getNomResponsable()) : null;
    String typeEtablissement = etablissement == null ? null : etablissement.getTypeEtablissement();
    String titreSurcharge = parametres.findById(user.etablissementId()).map(p -> p.getTitreSignataireJury()).orElse(null);
    Map<Long, EnteteBulletin> enteteParClasse = entetesParClasse(session, user.etablissementId());

    List<BulletinVue> vues = new ArrayList<>();
    for (Eleve eleve : roster) {
      List<Ligne> lignes = lignesParEleve.get(eleve.getId());
      BigDecimal moyenne = moyennes.get(eleve.getId());
      List<LigneBulletin> detail = new ArrayList<>();
      Map<Long, List<BigDecimal>> notesDeLaClasse = notesParClasseEtMatiere.getOrDefault(groupeParEleve.get(eleve.getId()), Map.of());
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
      List<BigDecimal> moyennesDeLaClasse = moyennesParClasse.getOrDefault(groupeParEleve.get(eleve.getId()), List.of());
      BulletinVue vue = new BulletinVue(
          eleve.getId(),
          eleve.getNomComplet(),
          eleve.getMatricule(),
          titulaireParClasse.get(eleve.getClasseId()),
          moyenne,
          rangsGeneraux.get(eleve.getId()),
          GradeCalculator.mention(moyenne),
          GradeCalculator.decision(moyenne),
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
          enteteParClasse.computeIfAbsent(eleve.getClasseId(), ignored -> enteteSession(session, user.etablissementId())),
          ModeSession.ouDefaut(session.getMode()),
          centreExamen,
          premierNonVide(eleve.getEtablissementOrigine(), inter ? etablissementNom : null),
          responsableCentre,
          TitreChefEtablissement.pour(niveauDe(classeParId.get(eleve.getClasseId())), typeEtablissement, etablissementNom, titreSurcharge)
      );
      vues.add(vue);
    }
    return vues;
  }

  /** Niveau d'une classe (« 3e », « Tle ») ; null sans classe ou sans niveau. */
  private static String niveauDe(Classe classe) {
    return classe == null ? null : vide(classe.getNiveau());
  }

  /** Clé du groupe niveau / série d'une classe (« 3e », « Tle|D ») ; une classe inconnue forme son propre groupe. */
  static String cleNiveauSerie(Classe classe) {
    if (classe == null) return "classe:?";
    String niveau = ClasseNiveauUtil.canonique(classe.getNiveau()).orElse(vide(classe.getNiveau()));
    boolean college = ClasseNiveauUtil.cycleDe(classe.getNiveau()).filter(ClasseNiveauUtil.Cycle.COLLEGE::equals).isPresent();
    String serie = college ? null : vide(classe.getSerie());
    return (niveau == null ? "" : niveau.toUpperCase(Locale.ROOT)) + "|" + (serie == null ? "" : serie.toUpperCase(Locale.ROOT));
  }

  /** Classement compétition calculé séparément dans chaque groupe (clé du groupe par élève). */
  static Map<Long, Integer> rangsParGroupe(Map<Long, BigDecimal> valeurs, Map<Long, String> groupeParEleve) {
    Map<String, Map<Long, BigDecimal>> parGroupe = new HashMap<>();
    for (Map.Entry<Long, BigDecimal> entry : valeurs.entrySet()) {
      parGroupe.computeIfAbsent(groupeParEleve.getOrDefault(entry.getKey(), "?"), ignored -> new HashMap<>()).put(entry.getKey(), entry.getValue());
    }
    Map<Long, Integer> rangs = new HashMap<>();
    for (Map<Long, BigDecimal> groupe : parGroupe.values()) rangs.putAll(GradeCalculator.rangsCompetition(groupe));
    return rangs;
  }

  /**
   * Candidats d'une session : les élèves rattachés à cette session, ceux rattachés à une session
   * sœur (même examen, même année scolaire : le « BEPC blanc n°2 » reprend les élèves du n°1 sans
   * réimport) et ceux sans session. Tant qu'aucun élève n'est rattaché à la session ni à une sœur,
   * tous les élèves de l'établissement sont candidats (données antérieures au rattachement).
   */
  private List<Eleve> candidatsDe(SessionExamen session, Long etablissementId) {
    Set<Long> famille = new HashSet<>();
    famille.add(session.getId());
    for (SessionExamen autre : sessions.findByEtablissementIdOrderByNomAsc(etablissementId)) {
      if (session.memeExamenMemeAnnee(autre)) famille.add(autre.getId());
    }
    List<Eleve> tous = eleves.findByEtablissementIdOrderByNomCompletAsc(etablissementId);
    List<Eleve> roster = tous.stream()
        .filter(eleve -> eleve.getSessionId() == null || famille.contains(eleve.getSessionId()))
        .toList();
    boolean rattaches = roster.stream().anyMatch(eleve -> eleve.getSessionId() != null);
    return rattaches ? roster : tous;
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
