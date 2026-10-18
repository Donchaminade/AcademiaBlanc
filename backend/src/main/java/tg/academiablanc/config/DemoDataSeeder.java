package tg.academiablanc.config;

import java.math.BigDecimal;
import java.time.LocalDate;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tg.academiablanc.domain.AnneeScolaire;
import tg.academiablanc.domain.CentreExamen;
import tg.academiablanc.domain.Classe;
import tg.academiablanc.domain.Coefficient;
import tg.academiablanc.domain.Eleve;
import tg.academiablanc.domain.Etablissement;
import tg.academiablanc.domain.Matiere;
import tg.academiablanc.domain.Note;
import tg.academiablanc.domain.Professeur;
import tg.academiablanc.domain.Role;
import tg.academiablanc.domain.SessionExamen;
import tg.academiablanc.domain.Utilisateur;
import tg.academiablanc.repo.AnneeScolaireRepository;
import tg.academiablanc.repo.CentreExamenRepository;
import tg.academiablanc.repo.ClasseRepository;
import tg.academiablanc.repo.CoefficientRepository;
import tg.academiablanc.repo.EleveRepository;
import tg.academiablanc.repo.EtablissementRepository;
import tg.academiablanc.repo.MatiereRepository;
import tg.academiablanc.repo.NoteRepository;
import tg.academiablanc.repo.ProfesseurRepository;
import tg.academiablanc.repo.SessionExamenRepository;
import tg.academiablanc.repo.UtilisateurRepository;

/** Jeu de démonstration repris des fiches statiques Tokoin / Collège Protestant. */
@Component
@ConditionalOnProperty(name = "app.seed.enabled", havingValue = "true")
public class DemoDataSeeder implements CommandLineRunner {
  private final EtablissementRepository etablissements;
  private final UtilisateurRepository utilisateurs;
  private final AnneeScolaireRepository annees;
  private final CentreExamenRepository centres;
  private final SessionExamenRepository sessions;
  private final ClasseRepository classes;
  private final MatiereRepository matieres;
  private final CoefficientRepository coefficients;
  private final ProfesseurRepository professeurs;
  private final EleveRepository eleves;
  private final NoteRepository notes;
  private final PasswordEncoder passwordEncoder;

  public DemoDataSeeder(
      EtablissementRepository etablissements,
      UtilisateurRepository utilisateurs,
      AnneeScolaireRepository annees,
      CentreExamenRepository centres,
      SessionExamenRepository sessions,
      ClasseRepository classes,
      MatiereRepository matieres,
      CoefficientRepository coefficients,
      ProfesseurRepository professeurs,
      EleveRepository eleves,
      NoteRepository notes,
      PasswordEncoder passwordEncoder
  ) {
    this.etablissements = etablissements;
    this.utilisateurs = utilisateurs;
    this.annees = annees;
    this.centres = centres;
    this.sessions = sessions;
    this.classes = classes;
    this.matieres = matieres;
    this.coefficients = coefficients;
    this.professeurs = professeurs;
    this.eleves = eleves;
    this.notes = notes;
    this.passwordEncoder = passwordEncoder;
  }

  @Override
  @Transactional
  public void run(String... args) {
    if (etablissements.count() > 0) return;
    long schoolId = school(
        "Lycée Moderne de Tokoin",
        "LMT-LOME-01",
        "Lomé",
        "direction@lycee-tokoin.tg",
        "Mme le Proviseur Dr. A. KOUAME"
    );
    long yearId = year(schoolId);
    long centreId = centre(schoolId, "Lycée Moderne de Tokoin (Centre 01)", "C01");
    long sessionId = session(schoolId, yearId, centreId, "BAC II Blanc 2025 - Série D");
    long classeId = classe(schoolId, yearId, "Terminale D", "Terminale", "Série D");
    long[] subjectIds = subjects(schoolId, classeId);
    eleve(schoolId, classeId, sessionId, subjectIds, "CISSE Fatoumata", "24-BACD-09414", "F", 138,
        new String[]{"14.0", "13.5", "14.0", "12.5", "11.5", "14.0", "13.0", "15.0"});
    eleve(schoolId, classeId, sessionId, subjectIds, "KOFFI Aya Marie-Madeleine", "24-BACD-09417", "F", 141,
        new String[]{"18.0", "17.5", "16.5", "14.5", "14.0", "17.0", "15.5", "16.0"});
    eleve(schoolId, classeId, sessionId, subjectIds, "DIOMANDE Alassane", "24-BACD-09415", "M", 139,
        new String[]{"6.5", "7.0", "7.5", "8.0", "6.0", "8.0", "7.5", "11.0"});

    long protestant = school(
        "Collège Protestant de Lomé",
        "CPL-LOME-02",
        "Lomé",
        "administration@collegeprotestant-lome.tg",
        "M. le Directeur Général Pasteur E. ADJOLOU"
    );
    long year2 = year(protestant);
    long centre2 = centre(protestant, "Collège Protestant Lomé (Centre 02)", "C02");
    long session2 = session(protestant, year2, centre2, "Session Régionale du Baccalauréat Blanc");
    long classe2 = classe(protestant, year2, "Terminale D", "Terminale", "Série D");
    long[] subjects2 = subjects(protestant, classe2);
    eleve(protestant, classe2, session2, subjects2, "ADJOLOU Kokouvi Chaminade", "24-BACD-08101", "M", 101,
        new String[]{"18.5", "17.0", "16.5", "15.0", "14.0", "17.5", "15.5", "16.0"});
  }

  private long school(String nom, String code, String ville, String email, String responsable) {
    Etablissement school = new Etablissement();
    school.setNom(nom);
    school.setCode(code);
    school.setVille(ville);
    school.setRegion("Maritime (Grand Lomé)");
    school.setTypeEtablissement("Enseignement général");
    school.setEmail(email);
    school.setNomResponsable(responsable);
    school = etablissements.save(school);
    Utilisateur user = new Utilisateur();
    user.setEtablissementId(school.getId());
    user.setEmail(email);
    user.setNom(responsable);
    user.setRole(Role.OWNER);
    user.setMotDePasseHash(passwordEncoder.encode("password123"));
    utilisateurs.save(user);
    return school.getId();
  }

  private long year(long schoolId) {
    AnneeScolaire annee = new AnneeScolaire();
    annee.setEtablissementId(schoolId);
    annee.setLibelle("2024-2025");
    annee.setDateDebut(LocalDate.of(2024, 9, 1));
    annee.setDateFin(LocalDate.of(2025, 7, 31));
    annee.setCourante(true);
    return annees.save(annee).getId();
  }

  private long centre(long schoolId, String nom, String code) {
    CentreExamen centre = new CentreExamen();
    centre.setEtablissementId(schoolId);
    centre.setNom(nom);
    centre.setVille("Lomé");
    centre.setCode(code);
    return centres.save(centre).getId();
  }

  private long session(long schoolId, long yearId, long centreId, String nom) {
    SessionExamen session = new SessionExamen();
    session.setEtablissementId(schoolId);
    session.setAnneeScolaireId(yearId);
    session.setCentreId(centreId);
    session.setNom(nom);
    session.setTypeExamen("BACCALAURÉAT II");
    session.setSerie("Série D");
    session.setStatut("OUVERTE");
    return sessions.save(session).getId();
  }

  private long classe(long schoolId, long yearId, String nom, String niveau, String serie) {
    Professeur titulaire = new Professeur();
    titulaire.setEtablissementId(schoolId);
    titulaire.setNom("M. Konan Germain");
    titulaire.setEmail("titulaire@" + schoolId + ".local");
    titulaire = professeurs.save(titulaire);
    Classe classe = new Classe();
    classe.setEtablissementId(schoolId);
    classe.setAnneeScolaireId(yearId);
    classe.setNom(nom);
    classe.setNiveau(niveau);
    classe.setSerie(serie);
    classe.setTitulaireId(titulaire.getId());
    return classes.save(classe).getId();
  }

  private long[] subjects(long schoolId, long classeId) {
    String[][] defs = {
        {"math", "Mathématiques", "4"},
        {"pc", "Sciences Physiques & Chimie", "4"},
        {"svt", "Sciences de la Vie et de la Terre (SVT)", "4"},
        {"fr", "Français & Littérature", "2"},
        {"philo", "Philosophie", "2"},
        {"ang", "Anglais LV1", "2"},
        {"hg", "Histoire-Géographie", "2"},
        {"eps", "Éducation Physique (EPS)", "1"}
    };
    long[] ids = new long[defs.length];
    for (int i = 0; i < defs.length; i++) {
      Matiere matiere = new Matiere();
      matiere.setEtablissementId(schoolId);
      matiere.setCode(defs[i][0]);
      matiere.setNom(defs[i][1]);
      matiere = matieres.save(matiere);
      ids[i] = matiere.getId();
      Coefficient coefficient = new Coefficient();
      coefficient.setEtablissementId(schoolId);
      coefficient.setMatiereId(matiere.getId());
      coefficient.setClasseId(classeId);
      coefficient.setSerie("Série D");
      coefficient.setValeur(new BigDecimal(defs[i][2]));
      coefficients.save(coefficient);
    }
    return ids;
  }

  private void eleve(long schoolId, long classeId, long sessionId, long[] subjectIds, String nom, String matricule,
                     String genre, int table, String[] scores) {
    Eleve eleve = new Eleve();
    eleve.setEtablissementId(schoolId);
    eleve.setClasseId(classeId);
    eleve.setSessionId(sessionId);
    eleve.setNomComplet(nom);
    eleve.setMatricule(matricule);
    eleve.setGenre(genre);
    eleve.setNumeroTable(table);
    eleve.setEtablissementOrigine("Donnée statique du projet");
    eleve = eleves.save(eleve);
    for (int i = 0; i < subjectIds.length; i++) {
      Note note = new Note();
      note.setEtablissementId(schoolId);
      note.setEleveId(eleve.getId());
      note.setMatiereId(subjectIds[i]);
      note.setSessionId(sessionId);
      note.setAbsent(false);
      note.setValeur(new BigDecimal(scores[i]));
      notes.save(note);
    }
  }
}
