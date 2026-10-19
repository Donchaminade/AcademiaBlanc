package tg.academiablanc.api;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import tg.academiablanc.domain.DeliberationJury;
import tg.academiablanc.domain.Eleve;
import tg.academiablanc.domain.SessionExamen;
import tg.academiablanc.repo.DeliberationJuryRepository;
import tg.academiablanc.repo.EleveRepository;
import tg.academiablanc.repo.SessionExamenRepository;
import tg.academiablanc.security.Tenant;

/**
 * Délibération du jury (observation portée sur le bulletin, signature électronique) par élève et par session.
 * Une seule ligne par couple élève × session : l'enregistrement remplace la décision précédente. Elle ne
 * modifie jamais la moyenne : le bulletin affiche la moyenne réelle Σ(note × coef) / Σ coef.
 */
@Service
public class DeliberationService {
  private final DeliberationJuryRepository deliberations;
  private final EleveRepository eleves;
  private final SessionExamenRepository sessions;

  public DeliberationService(DeliberationJuryRepository deliberations, EleveRepository eleves, SessionExamenRepository sessions) {
    this.deliberations = deliberations;
    this.eleves = eleves;
    this.sessions = sessions;
  }

  /** Signature électronique apposée depuis l'application ; absente tant que le bulletin n'est pas signé. */
  public record Signature(@NotNull Instant signeLe, @Size(max = 180) String signataire, @Size(max = 128) String empreinte) {}

  public record Demande(@NotNull Long eleveId, @NotNull Long sessionId,
                        @Size(max = 2000) String observation,
                        Signature signature) {}

  public record Vue(Long id, Long eleveId, Long sessionId, String observation,
                    Signature signature, Instant modifieLe) {
    static Vue of(DeliberationJury item) {
      Signature signature = item.getSigneLe() == null ? null
          : new Signature(item.getSigneLe(), item.getSignataire(), item.getEmpreinteSignature());
      return new Vue(item.getId(), item.getEleveId(), item.getSessionId(),
          item.getObservation(), signature, item.getModifieLe());
    }
  }

  @Transactional(readOnly = true)
  public List<Vue> lister(Long sessionId) {
    verifierSession(sessionId);
    return deliberations.findByEtablissementIdAndSessionId(Tenant.current().etablissementId(), sessionId)
        .stream().map(Vue::of).toList();
  }

  @Transactional
  public Vue enregistrer(Demande demande) {
    Eleve eleve = eleves.findById(demande.eleveId())
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Élève introuvable."));
    Tenant.same(eleve.getEtablissementId());
    verifierSession(demande.sessionId());

    DeliberationJury item = deliberations.findByEleveIdAndSessionId(demande.eleveId(), demande.sessionId())
        .orElseGet(DeliberationJury::new);
    item.setEtablissementId(eleve.getEtablissementId());
    item.setEleveId(demande.eleveId());
    item.setSessionId(demande.sessionId());
    item.setObservation(demande.observation() == null || demande.observation().isBlank() ? null : demande.observation().trim());
    Signature signature = demande.signature();
    item.setSigneLe(signature == null ? null : signature.signeLe());
    item.setSignataire(signature == null ? null : signature.signataire());
    item.setEmpreinteSignature(signature == null ? null : signature.empreinte());
    item.setModifieLe(Instant.now());
    return Vue.of(deliberations.save(item));
  }

  private void verifierSession(Long id) {
    SessionExamen session = sessions.findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Session introuvable."));
    Tenant.same(session.getEtablissementId());
  }
}
