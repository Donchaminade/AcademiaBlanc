package tg.academiablanc.api;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.text.Normalizer;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import tg.academiablanc.api.BulletinService.BulletinVue;
import tg.academiablanc.api.BulletinService.LigneBulletin;
import tg.academiablanc.domain.Classe;
import tg.academiablanc.domain.Eleve;
import tg.academiablanc.domain.Etablissement;
import tg.academiablanc.domain.Matiere;
import tg.academiablanc.domain.Note;
import tg.academiablanc.domain.SessionExamen;
import tg.academiablanc.domain.StatutTransfert;
import tg.academiablanc.domain.TransfertExamen;
import tg.academiablanc.domain.TypeExamen;
import tg.academiablanc.domain.Utilisateur;
import tg.academiablanc.repo.AnneeScolaireRepository;
import tg.academiablanc.repo.ClasseRepository;
import tg.academiablanc.repo.EtablissementRepository;
import tg.academiablanc.repo.MatiereRepository;
import tg.academiablanc.repo.NoteRepository;
import tg.academiablanc.repo.SessionExamenRepository;
import tg.academiablanc.repo.TransfertExamenRepository;
import tg.academiablanc.repo.TypeExamenRepository;
import tg.academiablanc.repo.UtilisateurRepository;

/**
 * Transfert des données d'un examen blanc commun : le centre d'une session inter-établissements envoie à
 * chaque établissement d'origine (identifié par son code de transfert) un paquet figé ; le destinataire
 * l'accepte (import dans une session interne verrouillée, voir {@link TransfertImportService}) ou le refuse.
 * Isolation : le centre ne voit que ses envois, le destinataire que les paquets qui lui sont adressés ; le
 * détail n'est lisible que par ces deux parties. Le code utilisé n'est jamais renvoyé.
 */
@Service
public class TransfertExamenService {
  public static final String MESSAGE_SESSION_NON_INTER = "Seule une session inter-établissements peut faire l'objet d'un transfert.";

  private final TransfertExamenRepository transferts;
  private final SessionExamenRepository sessions;
  private final EtablissementRepository etablissements;
  private final UtilisateurRepository utilisateurs;
  private final ClasseRepository classes;
  private final MatiereRepository matieres;
  private final NoteRepository notes;
  private final AnneeScolaireRepository annees;
  private final TypeExamenRepository typesExamen;
  private final BulletinService bulletins;
  private final CodeTransfertService codes;
  private final TransfertImportService imports;
  private final ObjectMapper json;

  public TransfertExamenService(
      TransfertExamenRepository transferts,
      SessionExamenRepository sessions,
      EtablissementRepository etablissements,
      UtilisateurRepository utilisateurs,
      ClasseRepository classes,
      MatiereRepository matieres,
      NoteRepository notes,
      AnneeScolaireRepository annees,
      TypeExamenRepository typesExamen,
      BulletinService bulletins,
      CodeTransfertService codes,
      TransfertImportService imports,
      ObjectMapper json
  ) {
    this.transferts = transferts;
    this.sessions = sessions;
    this.etablissements = etablissements;
    this.utilisateurs = utilisateurs;
    this.classes = classes;
    this.matieres = matieres;
    this.notes = notes;
    this.annees = annees;
    this.typesExamen = typesExamen;
    this.bulletins = bulletins;
    this.codes = codes;
    this.imports = imports;
    this.json = json;
  }

  /* ------------------------------------------------------------------ */
  /* Vues                                                                */
  /* ------------------------------------------------------------------ */

  /** Destinataire résolu par un code : nom et ville seulement. */
  public record DestinataireVue(String nom, String ville) {}

  /** Dernier envoi fait pour un établissement d'origine (null si aucun). */
  public record DernierEnvoi(Long id, StatutTransfert statut, Instant envoyeLe, Instant traiteLe, String destinataireNom, String motifRefus) {}

  /** Établissement d'origine présent dans la session : effectif, notes saisies, dernier envoi. */
  public record OrigineVue(String etablissementOrigine, int effectif, int notesSaisies, DernierEnvoi dernierEnvoi) {}

  /** Un transfert tel que le voient le centre et le destinataire (sans le code utilisé). */
  public record TransfertVue(Long id, StatutTransfert statut, Instant envoyeLe, Instant traiteLe, String motifRefus,
                             String etablissementOrigine, int effectif, String typeExamen, String sessionNom, String anneeLibelle,
                             Long sessionSourceId, Long sessionCreeeId,
                             String sourceNom, String sourceVille, String destinationNom, String destinationVille,
                             String envoyeParNom, String traiteParNom) {}

  /** Détail d'un transfert : fiche et paquet complet. */
  public record DetailVue(TransfertVue transfert, PaquetTransfert paquet) {}

  public record EnvoiRequest(Long sessionId, String etablissementOrigine, String code) {}
  public record RefusRequest(String motif) {}

  /* ------------------------------------------------------------------ */
  /* Côté centre                                                         */
  /* ------------------------------------------------------------------ */

  /** Nom et ville de l'établissement actif portant ce code ; 404 neutre sinon, 400 si c'est son propre code. */
  @Transactional(readOnly = true)
  public DestinataireVue destinataire(Utilisateur courant, String code) {
    Etablissement cible = codes.resoudre(code, courant.getId())
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, CodeTransfertService.MESSAGE_CODE_INCONNU));
    if (cible.getId().equals(courant.getEtablissementId())) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ce code est celui de votre propre établissement.");
    }
    return new DestinataireVue(cible.getNom(), cible.getVille());
  }

  /** Établissements d'origine (hors centre) des candidats de la session, avec effectif, notes et dernier envoi. */
  @Transactional(readOnly = true)
  public List<OrigineVue> origines(Utilisateur courant, Long sessionId) {
    SessionExamen session = sessionInterDuCentre(courant, sessionId);
    Long etab = courant.getEtablissementId();
    Map<String, List<Eleve>> parOrigine = candidatsParOrigine(session, etab);
    Map<Long, Long> notesParEleve = new HashMap<>();
    for (Note note : notes.findByEtablissementIdAndSessionId(etab, sessionId)) {
      if (!note.isAbsent() && note.getValeur() != null) notesParEleve.merge(note.getEleveId(), 1L, Long::sum);
    }
    List<TransfertExamen> envois = transferts.findByEtablissementSourceIdAndSessionSourceIdOrderByEnvoyeLeDesc(etab, sessionId);
    Map<String, Etablissement> cacheEtab = new HashMap<>();
    List<OrigineVue> vues = new ArrayList<>();
    for (Map.Entry<String, List<Eleve>> entry : parOrigine.entrySet()) {
      int saisies = 0;
      for (Eleve eleve : entry.getValue()) saisies += notesParEleve.getOrDefault(eleve.getId(), 0L).intValue();
      DernierEnvoi dernier = envois.stream()
          .filter(t -> cle(t.getEtablissementOrigine()).equals(cle(entry.getKey())))
          .findFirst()
          .map(t -> new DernierEnvoi(t.getId(), t.getStatut(), t.getEnvoyeLe(), t.getTraiteLe(),
              nomEtablissement(t.getEtablissementDestinationId(), cacheEtab), t.getMotifRefus()))
          .orElse(null);
      vues.add(new OrigineVue(entry.getKey(), entry.getValue().size(), saisies, dernier));
    }
    vues.sort((a, b) -> a.etablissementOrigine().compareToIgnoreCase(b.etablissementOrigine()));
    return vues;
  }

  /**
   * Envoie le paquet d'un établissement d'origine au destinataire désigné par son code. Le paquet n'embarque
   * que les élèves de cette origine, avec les statistiques de l'examen commun complet. Un seul envoi en attente
   * par origine ; après refus ou annulation, un nouvel envoi est possible.
   */
  @Transactional
  public TransfertVue envoyer(Utilisateur courant, EnvoiRequest request) {
    if (request == null || request.sessionId() == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Indiquez la session.");
    }
    if (request.etablissementOrigine() == null || request.etablissementOrigine().isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Indiquez l'établissement d'origine.");
    }
    SessionExamen session = sessionInterDuCentre(courant, request.sessionId());
    Long etab = courant.getEtablissementId();
    Etablissement centre = etablissements.findById(etab)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Établissement introuvable."));
    Etablissement destination = codes.resoudre(request.code(), courant.getId())
        .filter(e -> !e.getId().equals(etab))
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, CodeTransfertService.MESSAGE_CODE_INCONNU));

    String origine = espaces(request.etablissementOrigine());
    List<Eleve> elevesOrigine = candidatsParOrigine(session, etab).getOrDefault(origine, List.of());
    if (elevesOrigine.isEmpty()) {
      // La clé exacte peut différer par la casse ou les accents : on retente par clé normalisée.
      for (Map.Entry<String, List<Eleve>> entry : candidatsParOrigine(session, etab).entrySet()) {
        if (cle(entry.getKey()).equals(cle(origine))) {
          origine = entry.getKey();
          elevesOrigine = entry.getValue();
          break;
        }
      }
    }
    if (elevesOrigine.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Aucun candidat de « " + origine + " » dans cette session.");
    }
    boolean dejaEnAttente = transferts.findByEtablissementSourceIdAndSessionSourceIdOrderByEnvoyeLeDesc(etab, session.getId()).stream()
        .anyMatch(t -> t.estEnAttente() && cle(t.getEtablissementOrigine()).equals(cle(request.etablissementOrigine())));
    if (dejaEnAttente) {
      throw new ResponseStatusException(HttpStatus.CONFLICT,
          "Un envoi est déjà en attente pour « " + origine + " » : annulez-le ou attendez son traitement.");
    }

    PaquetTransfert paquet = construirePaquet(session, centre, origine, elevesOrigine, etab);
    TransfertExamen transfert = new TransfertExamen();
    transfert.setEtablissementSourceId(etab);
    transfert.setSessionSourceId(session.getId());
    transfert.setEtablissementOrigine(origine);
    transfert.setEtablissementDestinationId(destination.getId());
    transfert.setCodeUtilise(destination.getCodeTransfert());
    transfert.setStatut(StatutTransfert.EN_ATTENTE);
    transfert.setEnvoyeLe(Instant.now());
    transfert.setEnvoyePar(courant.getId());
    transfert.setEffectif(elevesOrigine.size());
    transfert.setTypeExamen(paquet.typeExamenLibelle());
    transfert.setSessionNom(session.getNom());
    transfert.setAnneeLibelle(paquet.anneeLibelle());
    transfert.setPaquet(serialiser(paquet));
    return vue(transferts.save(transfert), new HashMap<>(), new HashMap<>());
  }

  /** Annule un envoi encore en attente (centre uniquement). */
  @Transactional
  public TransfertVue annuler(Utilisateur courant, Long id) {
    TransfertExamen transfert = transferts.findById(id)
        .filter(t -> t.getEtablissementSourceId().equals(courant.getEtablissementId()))
        .orElseThrow(TransfertExamenService::introuvable);
    if (!transfert.estEnAttente()) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Ce transfert a déjà été traité : il ne s'annule plus.");
    }
    transfert.setStatut(StatutTransfert.ANNULE);
    transfert.setTraiteLe(Instant.now());
    transfert.setTraitePar(courant.getId());
    return vue(transferts.save(transfert), new HashMap<>(), new HashMap<>());
  }

  /** Historique des envois du centre (toute session, ou une seule), conservé après archivage ou suppression de la session. */
  @Transactional(readOnly = true)
  public List<TransfertVue> envois(Utilisateur courant, Long sessionId) {
    Long etab = courant.getEtablissementId();
    List<TransfertExamen> liste = sessionId == null
        ? transferts.findByEtablissementSourceIdOrderByEnvoyeLeDesc(etab)
        : transferts.findByEtablissementSourceIdAndSessionSourceIdOrderByEnvoyeLeDesc(etab, sessionId);
    return vues(liste);
  }

  /* ------------------------------------------------------------------ */
  /* Côté destinataire                                                   */
  /* ------------------------------------------------------------------ */

  @Transactional(readOnly = true)
  public List<TransfertVue> recus(Utilisateur courant) {
    return vues(transferts.findByEtablissementDestinationIdOrderByEnvoyeLeDesc(courant.getEtablissementId()));
  }

  @Transactional(readOnly = true)
  public long recusEnAttente(Utilisateur courant) {
    if (courant.getEtablissementId() == null) return 0;
    return transferts.countByEtablissementDestinationIdAndStatut(courant.getEtablissementId(), StatutTransfert.EN_ATTENTE);
  }

  /** Détail (fiche + paquet) ; 404 pour tout établissement qui n'est ni la source ni la destination. */
  @Transactional(readOnly = true)
  public DetailVue detail(Utilisateur courant, Long id) {
    TransfertExamen transfert = transfertDesParties(courant, id);
    return new DetailVue(vue(transfert, new HashMap<>(), new HashMap<>()), lirePaquet(transfert));
  }

  /**
   * Acceptation : import du paquet dans une session interne verrouillée du destinataire, conservation des
   * statistiques de l'examen commun, puis invalidation du code utilisé (un nouveau code est généré).
   * 409 si le paquet n'est plus en attente (déjà accepté, refusé ou annulé).
   */
  @Transactional
  public TransfertVue accepter(Utilisateur courant, Long id) {
    TransfertExamen transfert = transfertDuDestinataire(courant, id);
    if (!transfert.estEnAttente()) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Ce transfert a déjà été traité (" + libelle(transfert.getStatut()) + ").");
    }
    Etablissement destination = etablissements.findById(courant.getEtablissementId())
        .orElseThrow(TransfertExamenService::introuvable);
    PaquetTransfert paquet = lirePaquet(transfert);
    SessionExamen creee = imports.importer(destination, transfert, paquet);
    transfert.setStatut(StatutTransfert.ACCEPTE);
    transfert.setTraiteLe(Instant.now());
    transfert.setTraitePar(courant.getId());
    transfert.setSessionCreeeId(creee.getId());
    TransfertExamen enregistre = transferts.save(transfert);
    // Le code ayant servi à cet envoi ne doit plus permettre d'en adresser d'autres.
    codes.regenerer(destination);
    return vue(enregistre, new HashMap<>(), new HashMap<>());
  }

  /** Refus avec motif facultatif : le code reste valable, le centre voit le refus et peut renvoyer. */
  @Transactional
  public TransfertVue refuser(Utilisateur courant, Long id, String motif) {
    TransfertExamen transfert = transfertDuDestinataire(courant, id);
    if (!transfert.estEnAttente()) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Ce transfert a déjà été traité (" + libelle(transfert.getStatut()) + ").");
    }
    transfert.setStatut(StatutTransfert.REFUSE);
    transfert.setTraiteLe(Instant.now());
    transfert.setTraitePar(courant.getId());
    String texte = motif == null ? null : motif.trim();
    transfert.setMotifRefus(texte == null || texte.isEmpty() ? null : texte.length() > 500 ? texte.substring(0, 500) : texte);
    return vue(transferts.save(transfert), new HashMap<>(), new HashMap<>());
  }

  /* ------------------------------------------------------------------ */
  /* Construction du paquet                                              */
  /* ------------------------------------------------------------------ */

  private PaquetTransfert construirePaquet(SessionExamen session, Etablissement centre, String origine,
                                           List<Eleve> elevesOrigine, Long etab) {
    List<BulletinVue> tous = bulletins.calculer(session.getId());
    Map<Long, BulletinVue> bulletinParEleve = new HashMap<>();
    for (BulletinVue vue : tous) bulletinParEleve.put(vue.eleveId(), vue);
    Map<Long, Classe> classeParId = new HashMap<>();
    for (Classe classe : classes.findByEtablissementIdOrderByNomAsc(etab)) classeParId.put(classe.getId(), classe);
    Map<Long, Eleve> eleveParId = new HashMap<>();
    for (Eleve eleve : bulletins.candidatsDe(session, etab)) eleveParId.put(eleve.getId(), eleve);
    List<Note> notesSession = notes.findByEtablissementIdAndSessionId(etab, session.getId());
    Map<Long, Map<Long, Note>> notesParEleve = new HashMap<>();
    for (Note note : notesSession) notesParEleve.computeIfAbsent(note.getEleveId(), k -> new HashMap<>()).put(note.getMatiereId(), note);

    // Groupes de classement de la session complète : effectif, extrêmes et statistiques par matière.
    Map<String, List<BulletinVue>> parGroupe = new LinkedHashMap<>();
    Map<String, Classe> classeDuGroupe = new HashMap<>();
    for (BulletinVue vue : tous) {
      Eleve eleve = eleveParId.get(vue.eleveId());
      Classe classe = eleve == null ? null : classeParId.get(eleve.getClasseId());
      String groupe = BulletinService.cleNiveauSerie(classe);
      parGroupe.computeIfAbsent(groupe, k -> new ArrayList<>()).add(vue);
      classeDuGroupe.putIfAbsent(groupe, classe);
    }
    Map<Long, Matiere> matiereParId = new HashMap<>();
    for (Matiere matiere : matieres.findByEtablissementIdOrderByNomAsc(etab)) matiereParId.put(matiere.getId(), matiere);

    List<PaquetTransfert.Groupe> groupes = new ArrayList<>();
    Map<String, Integer> effectifParGroupe = new HashMap<>();
    for (Map.Entry<String, List<BulletinVue>> entry : parGroupe.entrySet()) {
      List<BulletinVue> membres = entry.getValue();
      int notes = (int) membres.stream().filter(v -> v.moyenne() != null).count();
      effectifParGroupe.put(entry.getKey(), notes > 0 ? notes : membres.size());
      BulletinVue temoin = membres.stream().filter(v -> v.moyenne() != null).findFirst().orElse(membres.get(0));
      Map<Long, PaquetTransfert.StatMatiere> statsMatieres = new LinkedHashMap<>();
      for (BulletinVue membre : membres) {
        for (LigneBulletin ligne : membre.lignes()) {
          if (statsMatieres.containsKey(ligne.matiereId())) continue;
          int presentes = (int) membres.stream().flatMap(m -> m.lignes().stream())
              .filter(l -> l.matiereId().equals(ligne.matiereId()) && !l.absent() && l.note() != null).count();
          statsMatieres.put(ligne.matiereId(), new PaquetTransfert.StatMatiere(ligne.matiereId(), ligne.matiere(), presentes,
              ligne.noteMaxClasse(), ligne.noteMinClasse()));
        }
      }
      Classe classe = classeDuGroupe.get(entry.getKey());
      groupes.add(new PaquetTransfert.Groupe(entry.getKey(),
          classe == null ? null : ClasseNiveauUtil.canonique(classe.getNiveau()).orElse(classe.getNiveau()),
          classe == null ? null : serieLycee(classe),
          membres.size(), notes, temoin.moyenneClasse(), temoin.moyenneClasseMax(), temoin.moyenneClasseMin(),
          new ArrayList<>(statsMatieres.values())));
    }

    Map<Long, PaquetTransfert.Matiere> matieresUtilisees = new LinkedHashMap<>();
    List<PaquetTransfert.Eleve> elevesPaquet = new ArrayList<>();
    for (Eleve eleve : elevesOrigine) {
      BulletinVue vue = bulletinParEleve.get(eleve.getId());
      if (vue == null) continue;
      Classe classe = classeParId.get(eleve.getClasseId());
      String groupe = BulletinService.cleNiveauSerie(classe);
      List<PaquetTransfert.Ligne> lignes = new ArrayList<>();
      for (LigneBulletin ligne : vue.lignes()) {
        Matiere matiere = matiereParId.get(ligne.matiereId());
        if (matiere != null) {
          matieresUtilisees.putIfAbsent(matiere.getId(),
              new PaquetTransfert.Matiere(matiere.getId(), matiere.getNom(), matiere.getCode(), matiere.getGroupeCode()));
        }
        Note note = notesParEleve.getOrDefault(eleve.getId(), Map.of()).get(ligne.matiereId());
        boolean absent = note != null && note.isAbsent();
        boolean nonNotee = note == null || (!note.isAbsent() && note.getValeur() == null);
        lignes.add(new PaquetTransfert.Ligne(ligne.matiereId(), ligne.coefficient(), ligne.note(), absent, nonNotee,
            note == null ? null : note.getAppreciation(), ligne.rang(), ligne.noteMaxClasse(), ligne.noteMinClasse()));
      }
      PaquetTransfert.Stat stat = new PaquetTransfert.Stat(vue.moyenne(), vue.rang(), effectifParGroupe.get(groupe),
          vue.moyenneClasse(), vue.moyenneClasseMax(), vue.moyenneClasseMin(), vue.mention(), vue.decision());
      elevesPaquet.add(new PaquetTransfert.Eleve(eleve.getId(), eleve.getNomComplet(), eleve.getGenre(), eleve.getDateNaissance(),
          eleve.getLieuNaissance(),
          classe == null ? null : ClasseNiveauUtil.canonique(classe.getNiveau()).orElse(classe.getNiveau()),
          classe == null ? null : serieLycee(classe),
          classe == null ? null : classe.getNom(),
          eleve.getNumeroTable(), groupe, lignes, stat));
    }

    TypeExamen type = session.getTypeExamenId() == null ? null : typesExamen.findById(session.getTypeExamenId()).orElse(null);
    String anneeLibelle = annees.findById(session.getAnneeScolaireId()).map(a -> a.getLibelle()).orElse(null);
    return new PaquetTransfert(PaquetTransfert.VERSION, Instant.now(), centre.getNom(), centre.getVille(), session.getNom(),
        type == null ? null : type.getCode(),
        type == null ? session.getTypeExamen() : type.getLibelleCourt(),
        type == null ? session.getTypeExamen() : type.getLibelleLong(),
        anneeLibelle, origine, new ArrayList<>(matieresUtilisees.values()), groupes, elevesPaquet);
  }

  /** Série d'une classe de lycée ; null au collège même si une série est saisie. */
  private static String serieLycee(Classe classe) {
    boolean college = ClasseNiveauUtil.cycleDe(classe.getNiveau()).filter(ClasseNiveauUtil.Cycle.COLLEGE::equals).isPresent();
    if (college || classe.getSerie() == null || classe.getSerie().isBlank()) return null;
    return classe.getSerie().trim().toUpperCase(Locale.ROOT);
  }

  /** Candidats de la session groupés par établissement d'origine (libellé tel que saisi), hors centre. */
  private Map<String, List<Eleve>> candidatsParOrigine(SessionExamen session, Long etab) {
    String nomCentre = etablissements.findById(etab).map(Etablissement::getNom).orElse("");
    Map<String, String> libelleParCle = new HashMap<>();
    Map<String, List<Eleve>> parOrigine = new LinkedHashMap<>();
    for (Eleve eleve : bulletins.candidatsDe(session, etab)) {
      String origine = eleve.getEtablissementOrigine();
      if (origine == null || origine.isBlank()) continue;
      String libelle = espaces(origine);
      String cle = cle(libelle);
      if (cle.equals(cle(nomCentre))) continue;
      String retenu = libelleParCle.computeIfAbsent(cle, k -> libelle);
      parOrigine.computeIfAbsent(retenu, k -> new ArrayList<>()).add(eleve);
    }
    return parOrigine;
  }

  /* ------------------------------------------------------------------ */
  /* Outils                                                              */
  /* ------------------------------------------------------------------ */

  private SessionExamen sessionInterDuCentre(Utilisateur courant, Long sessionId) {
    SessionExamen session = sessions.findById(sessionId)
        .filter(s -> s.getEtablissementId().equals(courant.getEtablissementId()))
        .orElseThrow(TransfertExamenService::introuvable);
    if (!session.estInterEtablissements()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, MESSAGE_SESSION_NON_INTER);
    }
    return session;
  }

  private TransfertExamen transfertDuDestinataire(Utilisateur courant, Long id) {
    return transferts.findById(id)
        .filter(t -> t.getEtablissementDestinationId().equals(courant.getEtablissementId()))
        .orElseThrow(TransfertExamenService::introuvable);
  }

  private TransfertExamen transfertDesParties(Utilisateur courant, Long id) {
    Long etab = courant.getEtablissementId();
    return transferts.findById(id)
        .filter(t -> t.getEtablissementDestinationId().equals(etab) || t.getEtablissementSourceId().equals(etab))
        .orElseThrow(TransfertExamenService::introuvable);
  }

  private List<TransfertVue> vues(List<TransfertExamen> liste) {
    Map<String, Etablissement> cacheEtab = new HashMap<>();
    Map<Long, String> cacheUser = new HashMap<>();
    List<TransfertVue> vues = new ArrayList<>();
    for (TransfertExamen t : liste) vues.add(vue(t, cacheEtab, cacheUser));
    return vues;
  }

  private TransfertVue vue(TransfertExamen t, Map<String, Etablissement> cacheEtab, Map<Long, String> cacheUser) {
    Etablissement source = etab(t.getEtablissementSourceId(), cacheEtab);
    Etablissement destination = etab(t.getEtablissementDestinationId(), cacheEtab);
    return new TransfertVue(t.getId(), t.getStatut(), t.getEnvoyeLe(), t.getTraiteLe(), t.getMotifRefus(),
        t.getEtablissementOrigine(), t.getEffectif(), t.getTypeExamen(), t.getSessionNom(), t.getAnneeLibelle(),
        t.getSessionSourceId(), t.getSessionCreeeId(),
        source == null ? null : source.getNom(), source == null ? null : source.getVille(),
        destination == null ? null : destination.getNom(), destination == null ? null : destination.getVille(),
        nomUtilisateur(t.getEnvoyePar(), cacheUser), nomUtilisateur(t.getTraitePar(), cacheUser));
  }

  private Etablissement etab(Long id, Map<String, Etablissement> cache) {
    if (id == null) return null;
    return cache.computeIfAbsent(String.valueOf(id), k -> etablissements.findById(id).orElse(null));
  }

  private String nomEtablissement(Long id, Map<String, Etablissement> cache) {
    Etablissement e = etab(id, cache);
    return e == null ? null : e.getNom();
  }

  private String nomUtilisateur(Long id, Map<Long, String> cache) {
    if (id == null) return null;
    return cache.computeIfAbsent(id, k -> utilisateurs.findById(id).map(Utilisateur::getNom).orElse(null));
  }

  private String serialiser(PaquetTransfert paquet) {
    try {
      return json.writeValueAsString(paquet);
    } catch (JsonProcessingException ex) {
      throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Paquet illisible.", ex);
    }
  }

  PaquetTransfert lirePaquet(TransfertExamen transfert) {
    try {
      return json.readValue(transfert.getPaquet(), PaquetTransfert.class);
    } catch (JsonProcessingException ex) {
      throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Paquet illisible.", ex);
    }
  }

  private static String libelle(StatutTransfert statut) {
    return switch (statut) {
      case EN_ATTENTE -> "en attente";
      case ACCEPTE -> "accepté";
      case REFUSE -> "refusé";
      case ANNULE -> "annulé";
    };
  }

  /** Clé de comparaison d'un libellé : minuscules, sans accents, espaces réduits. */
  static String cle(String valeur) {
    if (valeur == null) return "";
    String sansAccents = Normalizer.normalize(valeur, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
    return sansAccents.toLowerCase(Locale.ROOT).trim().replaceAll("\\s+", " ");
  }

  static String espaces(String valeur) {
    return valeur == null ? null : valeur.trim().replaceAll("\\s+", " ");
  }

  private static ResponseStatusException introuvable() {
    return new ResponseStatusException(HttpStatus.NOT_FOUND, "Transfert introuvable.");
  }
}
