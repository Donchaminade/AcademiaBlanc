package tg.academiablanc.api;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import tg.academiablanc.domain.Action;
import tg.academiablanc.domain.FamilleSerie;
import tg.academiablanc.domain.Ressource;
import tg.academiablanc.domain.Serie;
import tg.academiablanc.repo.SerieRepository;
import tg.academiablanc.security.PermissionService;
import tg.academiablanc.security.Tenant;

/** Référentiel des séries du lycée (générales et techniques), géré par l'établissement. */
@RestController
@RequestMapping("/api/series")
public class SerieController {
  private final SerieService service;
  private final SerieRepository series;
  private final PermissionService droits;

  public SerieController(SerieService service, SerieRepository series, PermissionService droits) {
    this.service = service;
    this.series = series;
    this.droits = droits;
  }

  public record SerieRequest(
      @NotBlank @Size(max = 20) String code,
      @NotBlank @Size(max = 120) String libelle,
      @NotNull FamilleSerie famille,
      Boolean actif,
      Integer ordre
  ) {}

  @GetMapping
  public List<Serie> lister() {
    droits.exiger(Ressource.SERIES, Action.VOIR);
    return service.lister(Tenant.current().etablissementId());
  }

  @GetMapping("/{id}")
  public Serie lire(@PathVariable Long id) {
    droits.exiger(Ressource.SERIES, Action.DETAILS);
    return charger(id);
  }

  @PostMapping
  public Serie creer(@Valid @RequestBody SerieRequest request) {
    droits.exiger(Ressource.SERIES, Action.CREER);
    return service.creer(Tenant.current().etablissementId(), request.code(), request.libelle(), request.famille(), request.actif(), request.ordre());
  }

  @PutMapping("/{id}")
  public Serie modifier(@PathVariable Long id, @Valid @RequestBody SerieRequest request) {
    droits.exiger(Ressource.SERIES, Action.MODIFIER);
    return service.modifier(charger(id), request.code(), request.libelle(), request.famille(), request.actif(), request.ordre());
  }

  @DeleteMapping("/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void supprimer(@PathVariable Long id) {
    droits.exiger(Ressource.SERIES, Action.SUPPRIMER);
    service.supprimer(charger(id));
  }

  /** (Re)charge les séries par défaut manquantes ; les séries déjà présentes ne sont pas modifiées. */
  @PostMapping("/defauts")
  public List<Serie> chargerDefauts() {
    droits.exiger(Ressource.SERIES, Action.CREER);
    return service.chargerDefauts(Tenant.current().etablissementId());
  }

  private Serie charger(Long id) {
    Serie serie = series.findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Ressource introuvable."));
    Tenant.same(serie.getEtablissementId());
    return serie;
  }
}
