package tg.academiablanc.security;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.server.ResponseStatusException;

/**
 * Cloisonnement par établissement à partir du jeton.
 * Les droits par action sont vérifiés par {@link PermissionService}.
 */
public final class Tenant {
  private Tenant() {}

  public static CurrentUser current() {
    var authentication = SecurityContextHolder.getContext().getAuthentication();
    if (authentication == null || !(authentication.getPrincipal() instanceof CurrentUser user)) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentification requise.");
    }
    return user;
  }

  /** 404 si la ressource n’appartient pas à l’établissement du jeton (un gestionnaire plateforme n’en a aucun). */
  public static void same(Long etablissementId) {
    if (etablissementId == null || !etablissementId.equals(current().etablissementId())) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Ressource introuvable.");
    }
  }
}
