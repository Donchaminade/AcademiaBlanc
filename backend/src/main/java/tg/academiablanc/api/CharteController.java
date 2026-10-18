package tg.academiablanc.api;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import tg.academiablanc.api.CharteService.Charte;
import tg.academiablanc.domain.Action;
import tg.academiablanc.domain.Ressource;
import tg.academiablanc.security.PermissionService;

/**
 * Cachet et signatures du bulletin de l'établissement porté par le jeton.
 * Lecture possible avec BULLETINS:VOIR ou PARAMETRES:VOIR (affichage des bulletins), écriture avec PARAMETRES:MODIFIER.
 */
@RestController
@RequestMapping("/api/etablissement/charte")
public class CharteController {
  private final CharteService charte;
  private final PermissionService droits;

  public CharteController(CharteService charte, PermissionService droits) {
    this.charte = charte;
    this.droits = droits;
  }

  @GetMapping
  public Charte lire() {
    if (!droits.peut(droits.courant(), Ressource.BULLETINS, Action.VOIR)) droits.exiger(Ressource.PARAMETRES, Action.VOIR);
    return charte.current();
  }

  @PutMapping
  public Charte modifier(@RequestBody Charte request) {
    droits.exiger(Ressource.PARAMETRES, Action.MODIFIER);
    return charte.update(request);
  }
}
