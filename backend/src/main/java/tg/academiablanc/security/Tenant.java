package tg.academiablanc.security;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.server.ResponseStatusException;
import tg.academiablanc.domain.Role;

public final class Tenant {
  private Tenant() {}

  public static CurrentUser current() {
    var authentication = SecurityContextHolder.getContext().getAuthentication();
    if (authentication == null || !(authentication.getPrincipal() instanceof CurrentUser user)) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentification requise.");
    }
    return user;
  }

  public static void same(Long etablissementId) {
    if (etablissementId == null || !etablissementId.equals(current().etablissementId())) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Ressource introuvable.");
    }
  }

  public static void requireAdmin() {
    Role role = current().role();
    if (role != Role.OWNER && role != Role.ADMIN) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Réservé au responsable de l'établissement.");
    }
  }

  public static void requireStaff() {
    Role role = current().role();
    if (role != Role.OWNER && role != Role.ADMIN && role != Role.SECRETAIRE) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Droit insuffisant.");
    }
  }
}
