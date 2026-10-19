package tg.academiablanc.abonnement;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;
import tg.academiablanc.domain.Role;
import tg.academiablanc.security.CurrentUser;

/**
 * Verrou « lecture seule » des établissements dont l'abonnement est expiré, suspendu ou en attente de paiement :
 * toute méthode d'écriture (POST, PUT, PATCH, DELETE) sur une API métier est refusée avec <strong>423 Locked</strong>
 * et un corps JSON explicite. Les lectures restent possibles.
 *
 * <p>Hors verrou : l'authentification ({@code /api/auth/**}, dont le changement de mot de passe), l'abonnement
 * lui-même ({@code /api/abonnement/**} : déclaration de paiement), les pages publiques ({@code /api/public/**}),
 * la plateforme ({@code /api/plateforme/**}) et le propriétaire du logiciel (SUPER_ADMIN), jamais verrouillé.
 * S'exécute après le filtre JWT : sans utilisateur authentifié, la requête passe (Spring Security tranchera).
 */
public class VerrouAbonnementFilter extends OncePerRequestFilter {
  private static final Set<String> METHODES_ECRITURE = Set.of("POST", "PUT", "PATCH", "DELETE");
  private static final List<String> PREFIXES_LIBRES = List.of("/api/auth/", "/api/abonnement/", "/api/public/", "/api/plateforme/");
  public static final String CODE = "ABONNEMENT_VERROUILLE";

  private final AbonnementService abonnements;

  public VerrouAbonnementFilter(AbonnementService abonnements) {
    this.abonnements = abonnements;
  }

  @Override
  protected boolean shouldNotFilter(HttpServletRequest request) {
    if (!METHODES_ECRITURE.contains(request.getMethod())) return true;
    String chemin = request.getRequestURI();
    if (chemin == null || !chemin.startsWith("/api/")) return true;
    return PREFIXES_LIBRES.stream().anyMatch(chemin::startsWith);
  }

  @Override
  protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
      throws ServletException, IOException {
    var authentication = SecurityContextHolder.getContext().getAuthentication();
    if (authentication != null && authentication.getPrincipal() instanceof CurrentUser user
        && user.etablissementId() != null && user.role() != Role.SUPER_ADMIN) {
      AbonnementService.EtatAbonnement etat = abonnements.etat(user.etablissementId());
      if (etat.lectureSeule()) {
        refuser(response, etat);
        return;
      }
    }
    chain.doFilter(request, response);
  }

  private static void refuser(HttpServletResponse response, AbonnementService.EtatAbonnement etat) throws IOException {
    response.setStatus(HttpStatus.LOCKED.value());
    response.setContentType(MediaType.APPLICATION_JSON_VALUE);
    response.setCharacterEncoding(StandardCharsets.UTF_8.name());
    String message = etat.message() == null ? AbonnementService.MESSAGE_VERROUILLE_EXPIRE : etat.message();
    response.getWriter().write("{\"message\":\"" + echapper(message) + "\",\"code\":\"" + CODE + "\",\"statut\":\""
        + etat.statut().name() + "\",\"lectureSeule\":true,\"acces\":" + etat.acces() + "}");
  }

  private static String echapper(String texte) {
    return texte.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", " ");
  }
}
