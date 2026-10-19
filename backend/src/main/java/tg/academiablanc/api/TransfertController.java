package tg.academiablanc.api;

import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import tg.academiablanc.api.TransfertExamenService.DestinataireVue;
import tg.academiablanc.api.TransfertExamenService.DetailVue;
import tg.academiablanc.api.TransfertExamenService.EnvoiRequest;
import tg.academiablanc.api.TransfertExamenService.OrigineVue;
import tg.academiablanc.api.TransfertExamenService.RefusRequest;
import tg.academiablanc.api.TransfertExamenService.TransfertVue;
import tg.academiablanc.domain.Action;
import tg.academiablanc.domain.Ressource;
import tg.academiablanc.security.PermissionService;

/**
 * Transferts d'examen blanc entre établissements. Droits : {@code TRANSFERTS:VOIR} pour consulter,
 * {@code TRANSFERTS:ENVOYER} pour envoyer ou annuler (centre), {@code TRANSFERTS:TRAITER} pour accepter ou refuser
 * (destinataire). Le code de transfert n'apparaît dans aucune réponse.
 */
@RestController
@RequestMapping("/api/transferts")
public class TransfertController {
  private final TransfertExamenService transferts;
  private final ExamenCommunService examenCommun;
  private final PermissionService droits;

  public TransfertController(TransfertExamenService transferts, ExamenCommunService examenCommun, PermissionService droits) {
    this.transferts = transferts;
    this.examenCommun = examenCommun;
    this.droits = droits;
  }

  /** Nom et ville de l'établissement portant ce code, pour confirmation avant envoi. */
  @GetMapping("/destinataire")
  public DestinataireVue destinataire(@RequestParam String code) {
    return transferts.destinataire(droits.exiger(Ressource.TRANSFERTS, Action.ENVOYER), code);
  }

  /** Établissements d'origine des candidats d'une session inter-établissements du centre. */
  @GetMapping("/origines")
  public List<OrigineVue> origines(@RequestParam Long sessionId) {
    return transferts.origines(droits.exiger(Ressource.TRANSFERTS, Action.VOIR), sessionId);
  }

  @PostMapping("/envoyer")
  public TransfertVue envoyer(@RequestBody EnvoiRequest request) {
    return transferts.envoyer(droits.exiger(Ressource.TRANSFERTS, Action.ENVOYER), request);
  }

  /** Historique des envois du centre ; {@code sessionId} facultatif pour une seule session. */
  @GetMapping("/envois")
  public List<TransfertVue> envois(@RequestParam(required = false) Long sessionId) {
    return transferts.envois(droits.exiger(Ressource.TRANSFERTS, Action.VOIR), sessionId);
  }

  @GetMapping("/recus")
  public List<TransfertVue> recus() {
    return transferts.recus(droits.exiger(Ressource.TRANSFERTS, Action.VOIR));
  }

  /** Nombre de paquets reçus en attente (pastille du menu). */
  @GetMapping("/recus/en-attente")
  public Map<String, Long> recusEnAttente() {
    return Map.of("enAttente", transferts.recusEnAttente(droits.exiger(Ressource.TRANSFERTS, Action.VOIR)));
  }

  /**
   * Statistiques de l'examen commun d'une session issue d'un transfert (rang, effectif, extrêmes du groupe complet,
   * par élève et par matière) ; lecture avec le droit des bulletins. 404 si la session n'est pas issue d'un transfert.
   */
  @GetMapping("/examen-commun")
  public ExamenCommunService.ExamenCommunVue examenCommun(@RequestParam Long sessionId) {
    droits.exiger(Ressource.BULLETINS, Action.VOIR);
    return examenCommun.vue(sessionId);
  }

  @GetMapping("/{id}")
  public DetailVue detail(@PathVariable Long id) {
    return transferts.detail(droits.exiger(Ressource.TRANSFERTS, Action.VOIR), id);
  }

  @PostMapping("/{id}/annuler")
  public TransfertVue annuler(@PathVariable Long id) {
    return transferts.annuler(droits.exiger(Ressource.TRANSFERTS, Action.ENVOYER), id);
  }

  @PostMapping("/{id}/accepter")
  public TransfertVue accepter(@PathVariable Long id) {
    return transferts.accepter(droits.exiger(Ressource.TRANSFERTS, Action.TRAITER), id);
  }

  @PostMapping("/{id}/refuser")
  public TransfertVue refuser(@PathVariable Long id, @RequestBody(required = false) RefusRequest request) {
    return transferts.refuser(droits.exiger(Ressource.TRANSFERTS, Action.TRAITER), id, request == null ? null : request.motif());
  }
}
