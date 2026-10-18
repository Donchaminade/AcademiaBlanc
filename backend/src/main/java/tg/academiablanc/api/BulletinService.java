package tg.academiablanc.api;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import tg.academiablanc.calc.GradeCalculator;
import tg.academiablanc.calc.GradeCalculator.Ligne;
import tg.academiablanc.domain.Bulletin;
import tg.academiablanc.domain.Coefficient;
import tg.academiablanc.domain.Eleve;
import tg.academiablanc.domain.Matiere;
import tg.academiablanc.domain.Note;
import tg.academiablanc.repo.BulletinRepository;
import tg.academiablanc.repo.CoefficientRepository;
import tg.academiablanc.repo.EleveRepository;
import tg.academiablanc.repo.MatiereRepository;
import tg.academiablanc.repo.NoteRepository;
import tg.academiablanc.repo.SessionExamenRepository;
import tg.academiablanc.security.Tenant;

@Service
public class BulletinService {
  private final SessionExamenRepository sessions;
  private final EleveRepository eleves;
  private final MatiereRepository matieres;
  private final CoefficientRepository coefficients;
  private final NoteRepository notes;
  private final BulletinRepository bulletins;

  public BulletinService(
      SessionExamenRepository sessions,
      EleveRepository eleves,
      MatiereRepository matieres,
      CoefficientRepository coefficients,
      NoteRepository notes,
      BulletinRepository bulletins
  ) {
    this.sessions = sessions;
    this.eleves = eleves;
    this.matieres = matieres;
    this.coefficients = coefficients;
    this.notes = notes;
    this.bulletins = bulletins;
  }

  public record LigneBulletin(Long matiereId, String matiere, BigDecimal note, BigDecimal coefficient,
                              BigDecimal total, Integer rang, boolean absent) {}

  public record BulletinVue(Long eleveId, String nomComplet, String matricule, BigDecimal moyenne,
                            Integer rang, String mention, String appreciation, BigDecimal totalPoints,
                            BigDecimal totalCoef, List<LigneBulletin> lignes) {}

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
    List<Note> sessionNotes = notes.findByEtablissementIdAndSessionId(user.etablissementId(), sessionId);
    List<Coefficient> coefs = coefficients.findByEtablissementId(user.etablissementId());

    Map<Long, Map<Long, Note>> notesByEleve = new HashMap<>();
    for (Note note : sessionNotes) {
      notesByEleve.computeIfAbsent(note.getEleveId(), ignored -> new HashMap<>()).put(note.getMatiereId(), note);
    }

    Map<Long, BigDecimal> moyennes = new HashMap<>();
    Map<Long, List<Ligne>> lignesParEleve = new HashMap<>();
    for (Eleve eleve : roster) {
      List<Ligne> lignes = new ArrayList<>();
      for (Matiere matiere : subjects) {
        Note note = notesByEleve.getOrDefault(eleve.getId(), Map.of()).get(matiere.getId());
        boolean absent = note == null || note.isAbsent() || note.getValeur() == null;
        BigDecimal valeur = absent || note == null ? null : note.getValeur();
        lignes.add(new Ligne(eleve.getId(), matiere.getId(), valeur, coefDe(coefs, matiere.getId(), eleve.getClasseId()), absent));
      }
      lignesParEleve.put(eleve.getId(), lignes);
      moyennes.put(eleve.getId(), GradeCalculator.moyenne(lignes));
    }
    Map<Long, Integer> rangsGeneraux = GradeCalculator.rangsCompetition(moyennes);

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

    List<BulletinVue> vues = new ArrayList<>();
    for (Eleve eleve : roster) {
      List<Ligne> lignes = lignesParEleve.get(eleve.getId());
      BigDecimal moyenne = moyennes.get(eleve.getId());
      List<LigneBulletin> detail = new ArrayList<>();
      for (Ligne ligne : lignes) {
        Matiere matiere = subjects.stream().filter(item -> item.getId().equals(ligne.matiereId())).findFirst().orElseThrow();
        Integer rangMatiere = rangsMatieres.get(matiere.getId()).get(eleve.getId());
        detail.add(new LigneBulletin(
            matiere.getId(),
            matiere.getNom(),
            ligne.note(),
            ligne.coef(),
            GradeCalculator.totalPondere(ligne.note(), ligne.coef()),
            rangMatiere,
            ligne.absent()
        ));
      }
      BulletinVue vue = new BulletinVue(
          eleve.getId(),
          eleve.getNomComplet(),
          eleve.getMatricule(),
          moyenne,
          rangsGeneraux.get(eleve.getId()),
          GradeCalculator.mention(moyenne),
          GradeCalculator.appreciation(moyenne),
          GradeCalculator.sommePoints(lignes),
          GradeCalculator.sommeCoef(lignes),
          detail
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

  private static BigDecimal coefDe(List<Coefficient> coefs, Long matiereId, Long classeId) {
    return coefs.stream()
        .filter(coef -> coef.getMatiereId().equals(matiereId) && classeId.equals(coef.getClasseId()))
        .map(Coefficient::getValeur)
        .findFirst()
        .orElseGet(() -> coefs.stream()
            .filter(coef -> coef.getMatiereId().equals(matiereId) && coef.getClasseId() == null)
            .map(Coefficient::getValeur)
            .findFirst()
            .orElse(BigDecimal.ONE));
  }
}
