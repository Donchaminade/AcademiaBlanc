package tg.academiablanc.api;

import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import tg.academiablanc.security.Tenant;

/**
 * Archives des sessions d'examen de l'établissement du jeton.
 *
 * <ul>
 *   <li>{@code GET /api/archives} : sessions archivées ou clôturées avec leurs statistiques réelles.</li>
 *   <li>{@code POST /api/archives/{sessionId}} : archive la session (statut ARCHIVEE, date d'archivage).</li>
 *   <li>{@code DELETE /api/archives/{sessionId}} : retire la session des archives (elle redevient ouverte).</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/archives")
public class ArchivesController {
  private final ArchivesService archives;

  public ArchivesController(ArchivesService archives) {
    this.archives = archives;
  }

  @GetMapping
  public List<ArchivesService.ArchiveSession> lister() {
    Tenant.current();
    return archives.lister();
  }

  @PostMapping("/{sessionId}")
  public ArchivesService.ArchiveSession archiver(@PathVariable Long sessionId) {
    Tenant.requireStaff();
    return archives.archiver(sessionId);
  }

  @DeleteMapping("/{sessionId}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void retirer(@PathVariable Long sessionId) {
    Tenant.requireStaff();
    archives.retirer(sessionId);
  }
}
