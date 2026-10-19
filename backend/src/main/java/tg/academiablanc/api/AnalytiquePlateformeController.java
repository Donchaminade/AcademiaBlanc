package tg.academiablanc.api;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import tg.academiablanc.domain.Role;
import tg.academiablanc.domain.Utilisateur;
import tg.academiablanc.security.PermissionService;

/**
 * Tableau de bord analytique de la plateforme, réservé au propriétaire du logiciel ({@code SUPER_ADMIN}).
 * Les gestionnaires de la plateforme et les comptes d'établissement reçoivent 403.
 */
@RestController
@RequestMapping("/api/plateforme/analytique")
public class AnalytiquePlateformeController {
  public static final String MESSAGE_RESERVE = "Le tableau de bord analytique est réservé au propriétaire de la plateforme.";

  private final AnalytiquePlateformeService analytique;
  private final PermissionService droits;

  public AnalytiquePlateformeController(AnalytiquePlateformeService analytique, PermissionService droits) {
    this.analytique = analytique;
    this.droits = droits;
  }

  @GetMapping
  public AnalytiquePlateformeService.AnalytiqueVue analytique() {
    Utilisateur moi = droits.courant();
    if (moi.getRole() != Role.SUPER_ADMIN) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, MESSAGE_RESERVE);
    }
    return analytique.calculer();
  }
}
