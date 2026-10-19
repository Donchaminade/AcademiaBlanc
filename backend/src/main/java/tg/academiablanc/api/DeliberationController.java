package tg.academiablanc.api;

import jakarta.validation.Valid;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import tg.academiablanc.domain.Action;
import tg.academiablanc.domain.Ressource;
import tg.academiablanc.security.PermissionService;

/**
 * Décisions du jury par élève et par session (repêchage, observation, signature du bulletin).
 * Lecture avec BULLETINS:VOIR (affichage du bulletin) ; écriture avec BULLETINS:CREER, le droit
 * qui autorise déjà à générer ou recalculer les bulletins que la délibération modifie.
 */
@RestController
@RequestMapping("/api/deliberations")
public class DeliberationController {
  private final DeliberationService deliberations;
  private final PermissionService droits;

  public DeliberationController(DeliberationService deliberations, PermissionService droits) {
    this.deliberations = deliberations;
    this.droits = droits;
  }

  @GetMapping
  public List<DeliberationService.Vue> lister(@RequestParam Long sessionId) {
    droits.exiger(Ressource.BULLETINS, Action.VOIR);
    return deliberations.lister(sessionId);
  }

  @PutMapping
  public DeliberationService.Vue enregistrer(@Valid @RequestBody DeliberationService.Demande demande) {
    droits.exiger(Ressource.BULLETINS, Action.CREER);
    return deliberations.enregistrer(demande);
  }
}
