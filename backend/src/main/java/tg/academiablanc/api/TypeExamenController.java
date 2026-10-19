package tg.academiablanc.api;

import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import tg.academiablanc.domain.CycleExamen;
import tg.academiablanc.security.PermissionService;

/**
 * Lecture du référentiel des types d'examen par les établissements : types actifs uniquement,
 * accessible à tout utilisateur connecté (le choix d'un type n'est pas une donnée sensible).
 */
@RestController
@RequestMapping("/api/types-examen")
public class TypeExamenController {
  private final TypeExamenService service;
  private final PermissionService droits;

  public TypeExamenController(TypeExamenService service, PermissionService droits) {
    this.service = service;
    this.droits = droits;
  }

  /** @param cycle COLLEGE ou LYCEE pour ne garder que les types de ce cycle et ceux valables pour tous. */
  @GetMapping
  public List<TypeExamenService.TypeExamenChoix> lister(@RequestParam(required = false) CycleExamen cycle) {
    droits.courant();
    return service.listerActifs(cycle);
  }
}
