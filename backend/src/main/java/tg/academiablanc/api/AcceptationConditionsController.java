package tg.academiablanc.api;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import tg.academiablanc.api.AcceptationConditionsService.Derniere;
import tg.academiablanc.api.AcceptationConditionsService.Vue;
import tg.academiablanc.domain.Utilisateur;
import tg.academiablanc.security.PermissionService;

/**
 * Acceptations des documents légaux de l'établissement du jeton.
 *
 * <ul>
 *   <li>{@code GET /api/etablissement/acceptations} : historique complet — OWNER et ADMIN uniquement (403 sinon).</li>
 *   <li>{@code GET /api/etablissement/acceptations/derniere} : dernière version acceptée, lisible par tout
 *       utilisateur de l'établissement (le front compare à la version courante) ; 204 si aucune.</li>
 *   <li>{@code POST /api/etablissement/acceptations} : ré-acceptation après mise à jour des conditions — OWNER et ADMIN.</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/etablissement/acceptations")
public class AcceptationConditionsController {
  private final AcceptationConditionsService service;
  private final PermissionService droits;

  public AcceptationConditionsController(AcceptationConditionsService service, PermissionService droits) {
    this.service = service;
    this.droits = droits;
  }

  public record ReacceptationRequest(Boolean acceptationConditions, @Size(max = 40) String versionConditions) {}

  @GetMapping
  public List<Vue> historique() {
    Utilisateur moi = droits.courant();
    if (!AcceptationConditionsService.peutGerer(moi)) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, AcceptationConditionsService.MESSAGE_LECTURE_RESERVEE);
    }
    return service.historique(moi.getEtablissementId());
  }

  @GetMapping("/derniere")
  public ResponseEntity<Derniere> derniere() {
    Utilisateur moi = droits.courant();
    if (moi.getEtablissementId() == null) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Aucun établissement rattaché à ce compte.");
    }
    return service.derniere(moi.getEtablissementId())
        .map(ResponseEntity::ok)
        .orElseGet(() -> ResponseEntity.noContent().build());
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public Vue reaccepter(@Valid @RequestBody ReacceptationRequest request, HttpServletRequest requete) {
    Utilisateur moi = droits.courant();
    if (!AcceptationConditionsService.peutGerer(moi)) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, AcceptationConditionsService.MESSAGE_ROLE_REQUIS);
    }
    AcceptationConditionsService.exigerAcceptation(request.acceptationConditions());
    return Vue.de(service.enregistrer(moi, request.versionConditions(), requete));
  }
}
