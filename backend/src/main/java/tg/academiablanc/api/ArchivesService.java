package tg.academiablanc.api;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import tg.academiablanc.api.BulletinService.BulletinVue;
import tg.academiablanc.domain.AnneeScolaire;
import tg.academiablanc.domain.SessionExamen;
import tg.academiablanc.domain.SessionStatut;
import tg.academiablanc.repo.AnneeScolaireRepository;
import tg.academiablanc.repo.SessionExamenRepository;
import tg.academiablanc.security.Tenant;

/**
 * Registre des sessions archivées d'un établissement.
 *
 * <p>Les statistiques (effectif, admis, second tour, ajournés, moyenne, major, mentions) sont
 * recalculées à la demande à partir des notes, via {@link BulletinService#calculer(Long)} : elles
 * sont donc toujours identiques à celles des bulletins. Une session entre dans les archives quand
 * son statut passe à {@link SessionStatut#ARCHIVEE} (ou clôturée) ; la retirer la rouvre, sans
 * toucher aux notes.
 */
@Service
public class ArchivesService {
  private static final BigDecimal CENT = new BigDecimal("100");

  private final SessionExamenRepository sessions;
  private final AnneeScolaireRepository annees;
  private final BulletinService bulletins;

  public ArchivesService(SessionExamenRepository sessions, AnneeScolaireRepository annees, BulletinService bulletins) {
    this.sessions = sessions;
    this.annees = annees;
    this.bulletins = bulletins;
  }

  public record Mentions(int tresBien, int bien, int assezBien, int passable) {}

  public record ArchiveSession(
      Long sessionId,
      Long anneeScolaireId,
      String anneeScolaire,
      String sessionNom,
      String typeExamen,
      String serie,
      String statut,
      Instant archiveeLe,
      int effectif,
      int admis,
      BigDecimal tauxReussite,
      int secondTour,
      BigDecimal tauxSecondTour,
      int ajournes,
      BigDecimal tauxAjournes,
      BigDecimal moyennePromo,
      BigDecimal noteMax,
      BigDecimal noteMin,
      Mentions mentions
  ) {}

  /** Sessions archivées de l'établissement courant, de la plus ancienne à la plus récente. */
  @Transactional
  public List<ArchiveSession> lister() {
    Long etablissementId = Tenant.current().etablissementId();
    Map<Long, AnneeScolaire> anneesParId = annees.findByEtablissementIdOrderByLibelleDesc(etablissementId).stream()
        .collect(Collectors.toMap(AnneeScolaire::getId, Function.identity()));
    List<ArchiveSession> archives = new ArrayList<>();
    for (SessionExamen session : sessions.findByEtablissementIdOrderByNomAsc(etablissementId)) {
      if (!SessionStatut.estArchivee(session.getStatut())) continue;
      archives.add(decrire(session, anneesParId.get(session.getAnneeScolaireId())));
    }
    archives.sort(Comparator.comparing((ArchiveSession item) -> item.anneeScolaire() == null ? "" : item.anneeScolaire())
        .thenComparing(ArchiveSession::sessionNom, String.CASE_INSENSITIVE_ORDER));
    return archives;
  }

  /** Archive la session : statut {@code ARCHIVEE} et date d'archivage. Idempotent sur une session déjà archivée. */
  @Transactional
  public ArchiveSession archiver(Long sessionId) {
    SessionExamen session = charger(sessionId);
    if (!SessionStatut.estArchivee(session.getStatut())) {
      session.setStatut(SessionStatut.ARCHIVEE);
      session.setArchiveeLe(Instant.now());
      sessions.save(session);
    }
    return decrire(session, annees.findById(session.getAnneeScolaireId()).orElse(null));
  }

  /** Retire la session des archives : elle redevient ouverte ; notes et bulletins sont conservés. */
  @Transactional
  public void retirer(Long sessionId) {
    SessionExamen session = charger(sessionId);
    if (!SessionStatut.estArchivee(session.getStatut())) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Cette session n'est pas archivée.");
    }
    session.setStatut(SessionStatut.OUVERTE);
    session.setArchiveeLe(null);
    sessions.save(session);
  }

  private SessionExamen charger(Long sessionId) {
    SessionExamen session = sessions.findById(sessionId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Session introuvable."));
    Tenant.same(session.getEtablissementId());
    return session;
  }

  private ArchiveSession decrire(SessionExamen session, AnneeScolaire annee) {
    List<BulletinVue> vues = bulletins.calculer(session.getId());
    int effectif = vues.size();
    int admis = 0;
    int secondTour = 0;
    int ajournes = 0;
    int tresBien = 0;
    int bien = 0;
    int assezBien = 0;
    int passable = 0;
    BigDecimal somme = BigDecimal.ZERO;
    int evalues = 0;
    BigDecimal max = null;
    BigDecimal min = null;

    for (BulletinVue vue : vues) {
      BigDecimal moyenne = vue.moyenne();
      String mention = vue.mention();
      // Même règle que le bulletin : un élève sans aucune note (moyenne nulle) est ajourné.
      if (mention == null || "AJOURNÉ".equals(mention)) {
        ajournes++;
      } else if ("RATTRAPAGE".equals(mention)) {
        secondTour++;
      } else {
        admis++;
      }
      if ("TRÈS BIEN".equals(mention)) tresBien++;
      else if ("BIEN".equals(mention)) bien++;
      else if ("ASSEZ BIEN".equals(mention)) assezBien++;
      else if ("PASSABLE".equals(mention)) passable++;

      if (moyenne != null) {
        somme = somme.add(moyenne);
        evalues++;
        if (max == null || moyenne.compareTo(max) > 0) max = moyenne;
        if (min == null || moyenne.compareTo(min) < 0) min = moyenne;
      }
    }

    BigDecimal moyennePromo = evalues == 0
        ? null
        : somme.divide(BigDecimal.valueOf(evalues), 2, RoundingMode.HALF_UP);

    return new ArchiveSession(
        session.getId(),
        session.getAnneeScolaireId(),
        annee == null ? null : annee.getLibelle(),
        session.getNom(),
        session.getTypeExamen(),
        session.getSerie(),
        session.getStatut(),
        session.getArchiveeLe(),
        effectif,
        admis,
        taux(admis, effectif),
        secondTour,
        taux(secondTour, effectif),
        ajournes,
        taux(ajournes, effectif),
        moyennePromo,
        max,
        min,
        new Mentions(tresBien, bien, assezBien, passable)
    );
  }

  private static BigDecimal taux(int part, int total) {
    if (total == 0) return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
    return BigDecimal.valueOf(part).multiply(CENT).divide(BigDecimal.valueOf(total), 2, RoundingMode.HALF_UP);
  }
}
