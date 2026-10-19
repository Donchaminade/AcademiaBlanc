package tg.academiablanc.api;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import tg.academiablanc.domain.Etablissement;
import tg.academiablanc.domain.SessionExamen;
import tg.academiablanc.domain.TransfertExamen;
import tg.academiablanc.domain.TransfertStatEleve;
import tg.academiablanc.repo.EtablissementRepository;
import tg.academiablanc.repo.SessionExamenRepository;
import tg.academiablanc.repo.TransfertExamenRepository;
import tg.academiablanc.repo.TransfertStatEleveRepository;
import tg.academiablanc.security.Tenant;

/**
 * Statistiques de l'examen commun d'une session issue d'un transfert, telles que conservées chez le
 * destinataire ({@code transfert_stat_eleve}). Le bulletin de l'établissement les affiche à la place des
 * valeurs recalculées sur ses seuls élèves : rang et effectif du groupe de classement complet, moyenne et
 * extrêmes du groupe, rang et extrêmes par matière.
 */
@Service
public class ExamenCommunService {
  private final SessionExamenRepository sessions;
  private final TransfertExamenRepository transferts;
  private final TransfertStatEleveRepository stats;
  private final EtablissementRepository etablissements;
  private final ObjectMapper json;

  public ExamenCommunService(SessionExamenRepository sessions, TransfertExamenRepository transferts,
                             TransfertStatEleveRepository stats, EtablissementRepository etablissements, ObjectMapper json) {
    this.sessions = sessions;
    this.transferts = transferts;
    this.stats = stats;
    this.etablissements = etablissements;
    this.json = json;
  }

  /** Statistiques d'une matière pour un élève : rang et extrêmes dans le groupe de l'examen commun. */
  public record StatMatiereVue(Long matiereId, Integer rang, BigDecimal noteMax, BigDecimal noteMin) {}

  /** Statistiques d'un élève à l'examen commun. */
  public record StatEleveVue(Long eleveId, BigDecimal moyenne, Integer rang, Integer effectifGroupe, BigDecimal moyenneGroupe,
                             BigDecimal moyenneMaxGroupe, BigDecimal moyenneMinGroupe, String mention, String decision,
                             List<StatMatiereVue> matieres) {}

  /** Session issue d'un transfert : centre émetteur, intitulé de la session source et statistiques par élève. */
  public record ExamenCommunVue(Long sessionId, Long transfertId, String centre, String centreVille, String sessionSource,
                                String anneeSource, List<StatEleveVue> eleves) {}

  /** Contexte d'une session issue d'un transfert pour le bulletin ; vide pour une session ordinaire. */
  public record Contexte(String centre, String sessionSource, Map<Long, StatEleveVue> parEleve) {}

  @Transactional(readOnly = true)
  public ExamenCommunVue vue(Long sessionId) {
    Long etab = Tenant.current().etablissementId();
    SessionExamen session = sessions.findById(sessionId)
        .filter(s -> s.getEtablissementId().equals(etab))
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Session introuvable."));
    if (!session.estIssueDunTransfert()) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Cette session n'est pas issue d'un transfert.");
    }
    TransfertExamen transfert = transferts.findById(session.getTransfertSourceId()).orElse(null);
    Etablissement centre = transfert == null ? null : etablissements.findById(transfert.getEtablissementSourceId()).orElse(null);
    return new ExamenCommunVue(sessionId, session.getTransfertSourceId(),
        centre == null ? null : centre.getNom(), centre == null ? null : centre.getVille(),
        transfert == null ? null : transfert.getSessionNom(), transfert == null ? null : transfert.getAnneeLibelle(),
        lire(etab, sessionId));
  }

  /** Contexte pour le bulletin ; {@link Optional#empty()} si la session n'est pas issue d'un transfert. */
  @Transactional(readOnly = true)
  public Optional<Contexte> contexte(SessionExamen session) {
    if (session == null || !session.estIssueDunTransfert()) return Optional.empty();
    TransfertExamen transfert = transferts.findById(session.getTransfertSourceId()).orElse(null);
    String centre = transfert == null ? null
        : etablissements.findById(transfert.getEtablissementSourceId()).map(Etablissement::getNom).orElse(null);
    Map<Long, StatEleveVue> parEleve = new HashMap<>();
    for (StatEleveVue stat : lire(session.getEtablissementId(), session.getId())) parEleve.put(stat.eleveId(), stat);
    return Optional.of(new Contexte(centre, transfert == null ? null : transfert.getSessionNom(), parEleve));
  }

  private List<StatEleveVue> lire(Long etab, Long sessionId) {
    List<StatEleveVue> vues = new ArrayList<>();
    for (TransfertStatEleve stat : stats.findByEtablissementIdAndSessionId(etab, sessionId)) {
      List<StatMatiereVue> matieres = new ArrayList<>();
      if (stat.getLignes() != null && !stat.getLignes().isBlank()) {
        try {
          for (TransfertImportService.StatLigne ligne : json.readValue(stat.getLignes(), new TypeReference<List<TransfertImportService.StatLigne>>() {})) {
            matieres.add(new StatMatiereVue(ligne.matiereId(), ligne.rang(), ligne.noteMax(), ligne.noteMin()));
          }
        } catch (Exception ignored) {
          // Lignes illisibles : le bulletin garde les extrêmes recalculés pour les matières.
        }
      }
      vues.add(new StatEleveVue(stat.getEleveId(), stat.getMoyenne(), stat.getRang(), stat.getEffectifGroupe(), stat.getMoyenneGroupe(),
          stat.getMoyenneMaxGroupe(), stat.getMoyenneMinGroupe(), stat.getMention(), stat.getDecision(), matieres));
    }
    return vues;
  }
}
