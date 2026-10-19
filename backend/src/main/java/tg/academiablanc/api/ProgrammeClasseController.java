package tg.academiablanc.api;

import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import tg.academiablanc.api.ProgrammeClasseService.LigneDemande;
import tg.academiablanc.api.ProgrammeClasseService.LigneProgramme;
import tg.academiablanc.api.ProgrammeClasseService.Suggestion;
import tg.academiablanc.domain.Action;
import tg.academiablanc.domain.Ressource;
import tg.academiablanc.security.PermissionService;

/**
 * Programme des classes : « on choisit la classe, on coche les matières et on valide ».
 * Lecture avec {@code COEFFICIENTS:VOIR}, écriture avec {@code COEFFICIENTS:MODIFIER}.
 */
@RestController
@RequestMapping("/api/classes/{id}/programme")
public class ProgrammeClasseController {
  private final ProgrammeClasseService programmes;
  private final PermissionService droits;

  public ProgrammeClasseController(ProgrammeClasseService programmes, PermissionService droits) {
    this.programmes = programmes;
    this.droits = droits;
  }

  /** Matières au programme de la classe avec leur coefficient ; liste vide si aucun programme n'est défini. */
  @GetMapping
  public List<LigneProgramme> lire(@PathVariable Long id) {
    droits.exiger(Ressource.COEFFICIENTS, Action.VOIR);
    return programmes.lire(id);
  }

  /** Remplace le programme : corps {@code [{"matiereId": 1, "coefficient": 3}, …]} (coefficient 0,5–20, 1 par défaut). */
  @PutMapping
  public List<LigneProgramme> remplacer(@PathVariable Long id, @RequestBody(required = false) List<LigneDemande> lignes) {
    droits.exiger(Ressource.COEFFICIENTS, Action.MODIFIER);
    return programmes.remplacer(id, lignes == null ? List.of() : lignes);
  }

  /** Copie le programme de la classe {@code autreId} sur la classe {@code id}. */
  @PostMapping("/copier-de/{autreId}")
  public List<LigneProgramme> copier(@PathVariable Long id, @PathVariable Long autreId) {
    droits.exiger(Ressource.COEFFICIENTS, Action.MODIFIER);
    return programmes.copier(id, autreId);
  }

  /** Coefficients proposés par le référentiel pour chaque matière du catalogue (rien n'est enregistré). */
  @GetMapping("/suggestions")
  public List<Suggestion> suggestions(@PathVariable Long id) {
    droits.exiger(Ressource.COEFFICIENTS, Action.VOIR);
    return programmes.suggerer(id);
  }
}
