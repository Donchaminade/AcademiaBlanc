package tg.academiablanc.api;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
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
import tg.academiablanc.domain.Ressource;
import tg.academiablanc.domain.Role;
import tg.academiablanc.domain.Utilisateur;
import tg.academiablanc.repo.UtilisateurRepository;
import tg.academiablanc.security.PermissionService;

/**
 * Utilisateurs d’un établissement et leurs droits. Toujours cloisonné sur l’établissement de l’appelant.
 * Par défaut seul OWNER détient UTILISATEURS:CREER / MODIFIER / SUPPRIMER.
 */
@RestController
@RequestMapping("/api/utilisateurs")
public class UtilisateurController {
  private final UtilisateurRepository utilisateurs;
  private final UtilisateursService service;
  private final PermissionService droits;

  public UtilisateurController(UtilisateurRepository utilisateurs, UtilisateursService service, PermissionService droits) {
    this.utilisateurs = utilisateurs;
    this.service = service;
    this.droits = droits;
  }

  public record CreationRequest(
      @NotBlank @Size(max = 180) String nom,
      @NotBlank @Email @Size(max = 180) String email,
      @NotBlank @Size(min = 6, max = 80) String motDePasse,
      @NotNull Role role,
      /** Null = préréglage du rôle ; sinon matrice explicite « RESSOURCE:ACTION ». */
      List<String> permissions,
      /** Fiche enseignant à relier (rôle ENSEIGNANT uniquement). */
      Long professeurId
  ) {}

  public record ModificationRequest(
      @Size(max = 180) String nom,
      @Email @Size(max = 180) String email,
      Role role,
      Boolean actif,
      Long professeurId
  ) {}

  public record PermissionsRequest(@NotNull List<String> permissions) {}

  public record MotDePasseRequest(@NotBlank @Size(min = 6, max = 80) String motDePasse) {}

  @GetMapping
  public List<UtilisateursService.Vue> lister() {
    Utilisateur moi = droits.exiger(Ressource.UTILISATEURS, Action.VOIR);
    boolean details = droits.peut(moi, Ressource.UTILISATEURS, Action.DETAILS);
    return utilisateurs.findByEtablissementIdOrderByNomAsc(moi.getEtablissementId()).stream()
        .map(u -> service.vue(u, details))
        .toList();
  }

  /** Ressources, actions applicables et préréglages des rôles d’établissement, pour l’éditeur de matrice. */
  @GetMapping("/referentiel")
  public UtilisateursService.Referentiel referentiel() {
    droits.exiger(Ressource.UTILISATEURS, Action.VOIR);
    return service.referentiel(false, List.of(Role.ADMIN, Role.SECRETAIRE, Role.ENSEIGNANT));
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public UtilisateursService.Vue creer(@Valid @RequestBody CreationRequest request) {
    Utilisateur moi = droits.exiger(Ressource.UTILISATEURS, Action.CREER);
    if (!request.role().estRoleEtablissement()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Rôle attribuable : ADMIN, SECRETAIRE ou ENSEIGNANT.");
    }
    Utilisateur cree = service.creer(moi, request.nom(), request.email(), request.motDePasse(), request.role(),
        moi.getEtablissementId(), request.permissions(), request.professeurId());
    return service.vue(cree, true);
  }

  @GetMapping("/{id}")
  public UtilisateursService.Vue lire(@PathVariable Long id) {
    Utilisateur moi = droits.exiger(Ressource.UTILISATEURS, Action.DETAILS);
    return service.vue(cible(moi, id), true);
  }

  @PutMapping("/{id}")
  public UtilisateursService.Vue modifier(@PathVariable Long id, @Valid @RequestBody ModificationRequest request) {
    Utilisateur moi = droits.exiger(Ressource.UTILISATEURS, Action.MODIFIER);
    if (request.role() != null && !request.role().estRoleEtablissement()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Rôle attribuable : ADMIN, SECRETAIRE ou ENSEIGNANT.");
    }
    Utilisateur maj = service.modifier(moi, cible(moi, id), request.nom(), request.email(), request.role(), request.actif(), request.professeurId());
    return service.vue(maj, true);
  }

  @PutMapping("/{id}/permissions")
  public UtilisateursService.Vue permissions(@PathVariable Long id, @Valid @RequestBody PermissionsRequest request) {
    Utilisateur moi = droits.exiger(Ressource.UTILISATEURS, Action.MODIFIER);
    Utilisateur cible = cible(moi, id);
    service.definirPermissions(moi, cible, request.permissions());
    return service.vue(cible, true);
  }

  @PostMapping("/{id}/permissions/prereglage")
  public UtilisateursService.Vue prereglage(@PathVariable Long id) {
    Utilisateur moi = droits.exiger(Ressource.UTILISATEURS, Action.MODIFIER);
    Utilisateur cible = cible(moi, id);
    service.appliquerPrereglage(moi, cible);
    return service.vue(cible, true);
  }

  @PostMapping("/{id}/reinitialiser-mot-de-passe")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void reinitialiser(@PathVariable Long id, @Valid @RequestBody MotDePasseRequest request) {
    Utilisateur moi = droits.exiger(Ressource.UTILISATEURS, Action.MODIFIER);
    service.reinitialiserMotDePasse(moi, cible(moi, id), request.motDePasse());
  }

  @DeleteMapping("/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void supprimer(@PathVariable Long id) {
    Utilisateur moi = droits.exiger(Ressource.UTILISATEURS, Action.SUPPRIMER);
    service.supprimer(moi, cible(moi, id));
  }

  /** 404 si l’utilisateur n’existe pas ou appartient à un autre établissement. */
  private Utilisateur cible(Utilisateur moi, Long id) {
    Utilisateur user = utilisateurs.findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Utilisateur introuvable."));
    if (moi.getEtablissementId() == null || !moi.getEtablissementId().equals(user.getEtablissementId())) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Utilisateur introuvable.");
    }
    return user;
  }
}
