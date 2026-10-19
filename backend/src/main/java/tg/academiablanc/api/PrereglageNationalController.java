package tg.academiablanc.api;

import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import tg.academiablanc.api.PrereglageNationalService.Saisie;
import tg.academiablanc.api.PrereglageNationalService.Vue;
import tg.academiablanc.api.PrereglageNationalService.VueLecture;
import tg.academiablanc.domain.Action;
import tg.academiablanc.domain.Ressource;
import tg.academiablanc.security.PermissionService;

/**
 * Préréglages nationaux : gestion par la plateforme (ressource {@code PREREGLAGES}), lecture des entrées
 * actives par tout utilisateur connecté, et préréglage par défaut sans jeton pour la vitrine.
 */
@RestController
public class PrereglageNationalController {
  private final PrereglageNationalService service;
  private final PermissionService droits;

  public PrereglageNationalController(PrereglageNationalService service, PermissionService droits) {
    this.service = service;
    this.droits = droits;
  }

  public record ActifRequest(boolean actif) {}

  /* ------------------------------------------------------------------ */
  /* Plateforme                                                          */
  /* ------------------------------------------------------------------ */

  @GetMapping("/api/plateforme/prereglages-nationaux")
  public List<Vue> lister() {
    droits.exiger(Ressource.PREREGLAGES, Action.VOIR);
    return service.lister();
  }

  @PostMapping("/api/plateforme/prereglages-nationaux")
  @ResponseStatus(HttpStatus.CREATED)
  public Vue creer(@RequestBody Saisie saisie) {
    droits.exiger(Ressource.PREREGLAGES, Action.CREER);
    return service.creer(saisie);
  }

  @PutMapping("/api/plateforme/prereglages-nationaux/{id}")
  public Vue modifier(@PathVariable Long id, @RequestBody Saisie saisie) {
    droits.exiger(Ressource.PREREGLAGES, Action.MODIFIER);
    return service.modifier(id, saisie);
  }

  /** Désactivation douce (et réactivation) : couverte par SUPPRIMER pour désactiver, MODIFIER pour réactiver. */
  @PutMapping("/api/plateforme/prereglages-nationaux/{id}/actif")
  public Vue activer(@PathVariable Long id, @RequestBody ActifRequest request) {
    droits.exiger(Ressource.PREREGLAGES, request.actif() ? Action.MODIFIER : Action.SUPPRIMER);
    return service.activer(id, request.actif());
  }

  @PutMapping("/api/plateforme/prereglages-nationaux/{id}/defaut")
  public Vue definirParDefaut(@PathVariable Long id) {
    droits.exiger(Ressource.PREREGLAGES, Action.MODIFIER);
    return service.definirParDefaut(id);
  }

  /** Suppression définitive, refusée (409) si un établissement l'applique encore. */
  @DeleteMapping("/api/plateforme/prereglages-nationaux/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void supprimer(@PathVariable Long id) {
    droits.exiger(Ressource.PREREGLAGES, Action.SUPPRIMER);
    service.supprimer(id);
  }

  /* ------------------------------------------------------------------ */
  /* Établissements et public                                            */
  /* ------------------------------------------------------------------ */

  /** Préréglages actifs, triés, pour le bloc « Préréglages nationaux en 1 clic » : tout utilisateur connecté. */
  @GetMapping("/api/prereglages-nationaux")
  public List<VueLecture> actifs() {
    droits.courant();
    return service.listerActifs();
  }

  /** Préréglage par défaut, sans jeton : vitrine et pages d'authentification. 404 si le référentiel est vide. */
  @GetMapping("/api/public/prereglage-defaut")
  public VueLecture parDefaut() {
    return service.lectureParDefaut();
  }
}
