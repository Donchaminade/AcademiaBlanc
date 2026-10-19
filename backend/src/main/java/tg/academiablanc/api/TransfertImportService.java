package tg.academiablanc.api;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import tg.academiablanc.domain.AnneeScolaire;
import tg.academiablanc.domain.CentreExamen;
import tg.academiablanc.domain.Classe;
import tg.academiablanc.domain.Coefficient;
import tg.academiablanc.domain.Eleve;
import tg.academiablanc.domain.Etablissement;
import tg.academiablanc.domain.Matiere;
import tg.academiablanc.domain.ModeSession;
import tg.academiablanc.domain.Note;
import tg.academiablanc.domain.SessionExamen;
import tg.academiablanc.domain.SessionStatut;
import tg.academiablanc.domain.TransfertExamen;
import tg.academiablanc.domain.TransfertStatEleve;
import tg.academiablanc.domain.TypeExamen;
import tg.academiablanc.repo.AnneeScolaireRepository;
import tg.academiablanc.repo.CentreExamenRepository;
import tg.academiablanc.repo.ClasseRepository;
import tg.academiablanc.repo.CoefficientRepository;
import tg.academiablanc.repo.EleveRepository;
import tg.academiablanc.repo.MatiereRepository;
import tg.academiablanc.repo.NoteRepository;
import tg.academiablanc.repo.SessionExamenRepository;
import tg.academiablanc.repo.TransfertStatEleveRepository;
import tg.academiablanc.repo.TypeExamenRepository;

/**
 * Import d'un paquet accepté chez l'établissement destinataire, dans sa propre base :
 * <ol>
 *   <li>année scolaire réutilisée si le libellé existe, créée sinon ;</li>
 *   <li>session <b>interne</b> nommée d'après la source (« BEPC Blanc 2026 — Centre CS Harmonia »), rattachée au
 *       transfert ({@code transfert_source_id}) : ses notes ne se modifient plus et ses candidats sont strictement
 *       les élèves importés (jamais de session sœur) ;</li>
 *   <li>classes réutilisées par niveau + série (créées sinon), matières rapprochées par nom normalisé (créées
 *       sinon), programme de chaque classe aligné sur les coefficients du paquet ;</li>
 *   <li>élèves créés avec un matricule de l'établissement (un élève sans session portant les mêmes nom, prénoms et
 *       date de naissance est rattaché plutôt que dupliqué), numéro de table de l'examen commun conservé ;</li>
 *   <li>notes, absences et appréciations importées ; statistiques de l'examen commun conservées dans
 *       {@code transfert_stat_eleve} pour que le bulletin affiche le rang et les extrêmes du groupe complet.</li>
 * </ol>
 * Tout s'exécute dans la transaction de l'acceptation : la moindre erreur annule l'ensemble.
 */
@Service
public class TransfertImportService {
  private final AnneeScolaireRepository annees;
  private final CentreExamenRepository centres;
  private final SessionExamenRepository sessions;
  private final TypeExamenRepository typesExamen;
  private final ClasseRepository classes;
  private final MatiereRepository matieres;
  private final CoefficientRepository coefficients;
  private final EleveRepository eleves;
  private final NoteRepository notes;
  private final TransfertStatEleveRepository stats;
  private final MatriculeService matricules;
  private final ObjectMapper json;

  public TransfertImportService(
      AnneeScolaireRepository annees,
      CentreExamenRepository centres,
      SessionExamenRepository sessions,
      TypeExamenRepository typesExamen,
      ClasseRepository classes,
      MatiereRepository matieres,
      CoefficientRepository coefficients,
      EleveRepository eleves,
      NoteRepository notes,
      TransfertStatEleveRepository stats,
      MatriculeService matricules,
      ObjectMapper json
  ) {
    this.annees = annees;
    this.centres = centres;
    this.sessions = sessions;
    this.typesExamen = typesExamen;
    this.classes = classes;
    this.matieres = matieres;
    this.coefficients = coefficients;
    this.eleves = eleves;
    this.notes = notes;
    this.stats = stats;
    this.matricules = matricules;
    this.json = json;
  }

  /** Statistique d'une matière conservée pour un élève (JSON dans {@code transfert_stat_eleve.lignes}). */
  public record StatLigne(Long matiereId, Integer rang, BigDecimal noteMax, BigDecimal noteMin) {}

  @Transactional(propagation = Propagation.MANDATORY)
  public SessionExamen importer(Etablissement destination, TransfertExamen transfert, PaquetTransfert paquet) {
    Long etab = destination.getId();
    if (paquet.eleves() == null || paquet.eleves().isEmpty()) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Le paquet ne contient aucun élève.");
    }
    AnneeScolaire annee = anneeScolaire(etab, paquet.anneeLibelle());
    CentreExamen centre = centreExamen(etab, paquet.centreNom(), paquet.centreVille());
    SessionExamen session = creerSession(etab, annee, centre, transfert, paquet);

    Map<Long, Matiere> matiereParIdSource = matieresDuPaquet(etab, paquet);
    Map<String, Classe> classeParGroupe = new HashMap<>();
    Map<String, Map<Long, BigDecimal>> programmeParGroupe = new LinkedHashMap<>();
    for (PaquetTransfert.Eleve eleve : paquet.eleves()) {
      Map<Long, BigDecimal> programme = programmeParGroupe.computeIfAbsent(eleve.groupe(), k -> new LinkedHashMap<>());
      for (PaquetTransfert.Ligne ligne : eleve.lignes()) {
        Matiere matiere = matiereParIdSource.get(ligne.matiereId());
        if (matiere != null && ligne.coefficient() != null) programme.putIfAbsent(matiere.getId(), ligne.coefficient());
      }
    }
    for (PaquetTransfert.Eleve eleve : paquet.eleves()) {
      classeParGroupe.computeIfAbsent(eleve.groupe(), k -> classePour(etab, annee, eleve));
    }
    for (Map.Entry<String, Classe> entry : classeParGroupe.entrySet()) {
      alignerProgramme(etab, entry.getValue(), programmeParGroupe.getOrDefault(entry.getKey(), Map.of()));
    }

    MatriculeService.Sequence sequence = matricules.sequence(etab);
    List<Eleve> existantsSansSession = eleves.findByEtablissementIdOrderByNomCompletAsc(etab).stream()
        .filter(e -> e.getSessionId() == null).toList();
    for (PaquetTransfert.Eleve source : paquet.eleves()) {
      Classe classe = classeParGroupe.get(source.groupe());
      Eleve eleve = retrouverSansSession(existantsSansSession, source).orElseGet(() -> {
        Eleve nouveau = new Eleve();
        nouveau.setEtablissementId(etab);
        nouveau.setMatricule(sequence.suivant());
        return nouveau;
      });
      eleve.setClasseId(classe.getId());
      eleve.setSessionId(session.getId());
      eleve.setNomComplet(TransfertExamenService.espaces(source.nomComplet()));
      eleve.setGenre("M".equalsIgnoreCase(source.genre()) ? "M" : "F");
      eleve.setDateNaissance(vide(source.dateNaissance()) ? null : source.dateNaissance().trim());
      eleve.setLieuNaissance(vide(source.lieuNaissance()) ? null : source.lieuNaissance().trim());
      eleve.setNumeroTable(source.numeroTable());
      // Élève de l'établissement désormais : aucun établissement d'origine.
      eleve.setEtablissementOrigine(null);
      Eleve enregistre = eleves.save(eleve);

      List<StatLigne> lignesStat = new ArrayList<>();
      for (PaquetTransfert.Ligne ligne : source.lignes()) {
        Matiere matiere = matiereParIdSource.get(ligne.matiereId());
        if (matiere == null) continue;
        lignesStat.add(new StatLigne(matiere.getId(), ligne.rang(), ligne.noteMax(), ligne.noteMin()));
        if (ligne.nonNotee()) continue;
        Note note = notes.findByEleveIdAndMatiereIdAndSessionId(enregistre.getId(), matiere.getId(), session.getId()).orElseGet(Note::new);
        note.setEtablissementId(etab);
        note.setEleveId(enregistre.getId());
        note.setMatiereId(matiere.getId());
        note.setSessionId(session.getId());
        note.setAbsent(ligne.absent());
        note.setValeur(ligne.absent() ? null : ligne.note());
        note.setAppreciation(vide(ligne.appreciation()) ? null : ligne.appreciation());
        notes.save(note);
      }
      enregistrerStat(etab, transfert, session, enregistre, source.stat(), lignesStat);
    }
    return session;
  }

  /* ------------------------------------------------------------------ */
  /* Année, centre, session                                              */
  /* ------------------------------------------------------------------ */

  private AnneeScolaire anneeScolaire(Long etab, String libelle) {
    List<AnneeScolaire> liste = annees.findByEtablissementIdOrderByLibelleDesc(etab);
    if (!vide(libelle)) {
      for (AnneeScolaire annee : liste) {
        if (cle(annee.getLibelle()).equals(cle(libelle))) return annee;
      }
      AnneeScolaire annee = new AnneeScolaire();
      annee.setEtablissementId(etab);
      annee.setLibelle(libelle.trim());
      annee.setCourante(liste.isEmpty());
      return annees.save(annee);
    }
    return liste.stream().filter(AnneeScolaire::isCourante).findFirst().orElse(liste.isEmpty() ? null : liste.get(0));
  }

  private CentreExamen centreExamen(Long etab, String nomCentre, String ville) {
    String nom = vide(nomCentre) ? "Centre d'examen" : TransfertExamenService.espaces(nomCentre);
    for (CentreExamen centre : centres.findByEtablissementIdOrderByNomAsc(etab)) {
      if (cle(centre.getNom()).equals(cle(nom))) return centre;
    }
    CentreExamen centre = new CentreExamen();
    centre.setEtablissementId(etab);
    centre.setNom(nom);
    centre.setVille(vide(ville) ? null : ville.trim());
    centre.setCode(codeCentre(nom, centres.findByEtablissementIdOrderByNomAsc(etab)));
    return centres.save(centre);
  }

  private static String codeCentre(String nom, List<CentreExamen> existants) {
    String base = Normalizer.normalize(nom, Normalizer.Form.NFD).replaceAll("\\p{M}", "")
        .toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]", "");
    if (base.length() > 6) base = base.substring(0, 6);
    if (base.isBlank()) base = "CENTRE";
    String code = "TR-" + base;
    int suffixe = 1;
    String candidat = code;
    while (true) {
      String essai = candidat;
      boolean pris = existants.stream().anyMatch(c -> essai.equalsIgnoreCase(c.getCode()));
      if (!pris) return candidat;
      suffixe++;
      candidat = code + "-" + suffixe;
    }
  }

  private SessionExamen creerSession(Long etab, AnneeScolaire annee, CentreExamen centre, TransfertExamen transfert, PaquetTransfert paquet) {
    if (annee == null) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Créez d'abord une année scolaire avant d'accepter un transfert.");
    }
    String base = TransfertExamenService.espaces(paquet.sessionNom()) + " — Centre " + TransfertExamenService.espaces(paquet.centreNom());
    List<SessionExamen> existantes = sessions.findByEtablissementIdOrderByNomAsc(etab);
    String nom = base;
    int suffixe = 1;
    while (nomPris(existantes, nom)) {
      suffixe++;
      nom = base + " (" + suffixe + ")";
    }
    SessionExamen session = new SessionExamen();
    session.setEtablissementId(etab);
    session.setAnneeScolaireId(annee.getId());
    session.setCentreId(centre.getId());
    session.setNom(nom);
    session.setMode(ModeSession.INTERNE);
    session.setStatut(SessionStatut.OUVERTE);
    session.setTransfertSourceId(transfert.getId());
    Optional<TypeExamen> type = vide(paquet.typeExamenCode()) ? Optional.empty() : typesExamen.findByCodeIgnoreCase(paquet.typeExamenCode());
    session.setTypeExamenId(type.map(TypeExamen::getId).orElse(null));
    session.setTypeExamen(type.map(TypeExamen::getLibelleCourt)
        .orElse(vide(paquet.typeExamenLibelle()) ? "Examen blanc" : paquet.typeExamenLibelle()));
    return sessions.save(session);
  }

  private static boolean nomPris(List<SessionExamen> existantes, String nom) {
    return existantes.stream().anyMatch(s -> s.getNom().trim().equalsIgnoreCase(nom.trim()));
  }

  /* ------------------------------------------------------------------ */
  /* Matières, classes, programme                                        */
  /* ------------------------------------------------------------------ */

  /** Matières du paquet rapprochées de celles de l'établissement par nom normalisé ; créées sinon (identifiant du centre → matière locale). */
  private Map<Long, Matiere> matieresDuPaquet(Long etab, PaquetTransfert paquet) {
    List<Matiere> locales = new ArrayList<>(matieres.findByEtablissementIdOrderByNomAsc(etab));
    Map<Long, Matiere> correspondance = new HashMap<>();
    if (paquet.matieres() == null) return correspondance;
    for (PaquetTransfert.Matiere source : paquet.matieres()) {
      Matiere trouvee = null;
      for (Matiere locale : locales) {
        if (cle(locale.getNom()).equals(cle(source.nom()))) {
          trouvee = locale;
          break;
        }
      }
      if (trouvee == null) {
        Matiere nouvelle = new Matiere();
        nouvelle.setEtablissementId(etab);
        nouvelle.setNom(TransfertExamenService.espaces(source.nom()));
        nouvelle.setCode(codeMatiereLibre(source, locales));
        nouvelle.setGroupeCode(ReferentielMatieres.codeGroupe(source.groupeCode()));
        nouvelle.setGroupeLibelle(ReferentielMatieres.libelleGroupe(source.groupeCode()));
        trouvee = matieres.save(nouvelle);
        locales.add(trouvee);
      }
      correspondance.put(source.id(), trouvee);
    }
    return correspondance;
  }

  private static String codeMatiereLibre(PaquetTransfert.Matiere source, List<Matiere> locales) {
    String base = vide(source.code()) ? cle(source.nom()).replaceAll("[^a-z0-9]", "") : source.code().trim().toLowerCase(Locale.ROOT);
    if (base.isBlank()) base = "mat";
    if (base.length() > 30) base = base.substring(0, 30);
    String code = base;
    int suffixe = 1;
    while (true) {
      String essai = code;
      if (locales.stream().noneMatch(m -> essai.equalsIgnoreCase(m.getCode()))) return code;
      suffixe++;
      code = base + suffixe;
    }
  }

  /** Classe de l'établissement de même niveau et même série (de l'année de la session de préférence) ; créée sinon. */
  private Classe classePour(Long etab, AnneeScolaire annee, PaquetTransfert.Eleve eleve) {
    String niveau = vide(eleve.niveau()) ? "Niveau inconnu" : eleve.niveau().trim();
    String serie = vide(eleve.serie()) ? null : eleve.serie().trim().toUpperCase(Locale.ROOT);
    String niveauCanonique = ClasseNiveauUtil.canonique(niveau).orElse(niveau).toUpperCase(Locale.ROOT);
    List<Classe> candidates = new ArrayList<>();
    for (Classe classe : classes.findByEtablissementIdOrderByNomAsc(etab)) {
      String niveauClasse = ClasseNiveauUtil.canonique(classe.getNiveau()).orElse(classe.getNiveau() == null ? "" : classe.getNiveau()).toUpperCase(Locale.ROOT);
      String serieClasse = vide(classe.getSerie()) ? null : classe.getSerie().trim().toUpperCase(Locale.ROOT);
      boolean college = ClasseNiveauUtil.cycleDe(classe.getNiveau()).filter(ClasseNiveauUtil.Cycle.COLLEGE::equals).isPresent();
      if (college) serieClasse = null;
      if (niveauClasse.equals(niveauCanonique) && java.util.Objects.equals(serieClasse, serie)) candidates.add(classe);
    }
    Optional<Classe> memeAnnee = candidates.stream().filter(c -> annee != null && annee.getId().equals(c.getAnneeScolaireId())).findFirst();
    if (memeAnnee.isPresent()) return memeAnnee.get();
    if (!candidates.isEmpty()) return candidates.get(0);
    Classe classe = new Classe();
    classe.setEtablissementId(etab);
    classe.setAnneeScolaireId(annee.getId());
    classe.setNom(serie == null ? niveau : niveau + " " + serie);
    classe.setNiveau(niveau);
    classe.setSerie(serie);
    return classes.save(classe);
  }

  /** Programme de la classe aligné sur le paquet : coefficients du paquet imposés aux matières qu'il contient. */
  private void alignerProgramme(Long etab, Classe classe, Map<Long, BigDecimal> programme) {
    if (programme.isEmpty()) return;
    Map<Long, Coefficient> existants = new HashMap<>();
    for (Coefficient c : coefficients.findByEtablissementIdAndClasseId(etab, classe.getId())) existants.put(c.getMatiereId(), c);
    for (Map.Entry<Long, BigDecimal> entry : programme.entrySet()) {
      Coefficient c = existants.get(entry.getKey());
      if (c == null) {
        c = new Coefficient();
        c.setEtablissementId(etab);
        c.setMatiereId(entry.getKey());
        c.setClasseId(classe.getId());
        c.setSerie(classe.getSerie());
      }
      c.setValeur(entry.getValue());
      coefficients.save(c);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Élèves et statistiques                                              */
  /* ------------------------------------------------------------------ */

  /** Élève de l'établissement sans session portant les mêmes nom, prénoms et date de naissance ; réutilisé une seule fois. */
  private static Optional<Eleve> retrouverSansSession(List<Eleve> existants, PaquetTransfert.Eleve source) {
    String nom = cle(source.nomComplet());
    String naissance = cle(source.dateNaissance());
    for (Eleve eleve : existants) {
      if (eleve.getSessionId() != null) continue;
      if (cle(eleve.getNomComplet()).equals(nom) && cle(eleve.getDateNaissance()).equals(naissance)) {
        return Optional.of(eleve);
      }
    }
    return Optional.empty();
  }

  private void enregistrerStat(Long etab, TransfertExamen transfert, SessionExamen session, Eleve eleve,
                               PaquetTransfert.Stat stat, List<StatLigne> lignes) {
    TransfertStatEleve ligne = new TransfertStatEleve();
    ligne.setEtablissementId(etab);
    ligne.setTransfertId(transfert.getId());
    ligne.setSessionId(session.getId());
    ligne.setEleveId(eleve.getId());
    if (stat != null) {
      ligne.setMoyenne(stat.moyenne());
      ligne.setRang(stat.rang());
      ligne.setEffectifGroupe(stat.effectifGroupe());
      ligne.setMoyenneGroupe(stat.moyenneGroupe());
      ligne.setMoyenneMaxGroupe(stat.moyenneMax());
      ligne.setMoyenneMinGroupe(stat.moyenneMin());
      ligne.setMention(stat.mention());
      ligne.setDecision(stat.decision());
    }
    try {
      ligne.setLignes(json.writeValueAsString(lignes));
    } catch (JsonProcessingException ex) {
      ligne.setLignes("[]");
    }
    stats.save(ligne);
  }

  private static boolean vide(String valeur) {
    return valeur == null || valeur.isBlank();
  }

  private static String cle(String valeur) {
    return TransfertExamenService.cle(valeur);
  }
}
