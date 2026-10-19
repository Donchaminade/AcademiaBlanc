package tg.academiablanc.api;

import java.time.Clock;
import java.time.Instant;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tg.academiablanc.repo.EtablissementRepository;

/**
 * Tableau de bord analytique du propriétaire du logiciel : agrégats calculés en UTC à partir de la
 * table {@code etablissement}. Aucune valeur n'est estimée : une série vide reste vide.
 *
 * <p>Toutes les bornes de période sont des mois civils UTC ; l'horloge est injectée pour les tests.
 */
@Service
public class AnalytiquePlateformeService {
  /** Nombre de mois de la série d'inscriptions (mois courant inclus). */
  public static final int MOIS_INSCRIPTIONS = 12;

  private final EtablissementRepository etablissements;
  private final Clock horloge;

  public AnalytiquePlateformeService(EtablissementRepository etablissements, Clock horloge) {
    this.etablissements = etablissements;
    this.horloge = horloge;
  }

  /* ------------------------------------------------------------------ */
  /* DTO                                                                 */
  /* ------------------------------------------------------------------ */

  /** Un mois de la série d'inscriptions : {@code mois} au format {@code AAAA-MM} (UTC). */
  public record PointInscription(String mois, long inscriptions, long cumul) {}

  /**
   * Vue complète du tableau de bord.
   *
   * @param calculeLe instant UTC du calcul
   * @param totalEtablissements toutes les lignes de {@code etablissement}, quel que soit leur état
   * @param sansDateInscription établissements dont {@code cree_le} est NULL (antérieurs à V12) : absents des barres
   *     mensuelles, comptés dans le cumul initial
   * @param inscriptions 12 mois glissants, du plus ancien au mois courant
   */
  public record AnalytiqueVue(
      Instant calculeLe,
      long totalEtablissements,
      long sansDateInscription,
      List<PointInscription> inscriptions
  ) {}

  /* ------------------------------------------------------------------ */
  /* Calcul                                                              */
  /* ------------------------------------------------------------------ */

  @Transactional(readOnly = true)
  public AnalytiqueVue calculer() {
    Instant maintenant = horloge.instant();
    return new AnalytiqueVue(
        maintenant,
        etablissements.count(),
        etablissements.countByCreeLeIsNull(),
        inscriptions(maintenant)
    );
  }

  /**
   * Série des 12 derniers mois civils UTC (mois courant inclus). Le cumul part des établissements
   * inscrits avant la fenêtre, auxquels s'ajoutent ceux sans date connue.
   */
  List<PointInscription> inscriptions(Instant maintenant) {
    YearMonth moisCourant = YearMonth.from(maintenant.atOffset(ZoneOffset.UTC));
    YearMonth premier = moisCourant.minusMonths(MOIS_INSCRIPTIONS - 1L);
    Instant debut = debutDuMois(premier);
    Instant fin = debutDuMois(moisCourant.plusMonths(1));

    Map<YearMonth, Long> parMois = new LinkedHashMap<>();
    for (Object[] ligne : etablissements.compterInscriptionsParMois(debut, fin)) {
      int annee = ((Number) ligne[0]).intValue();
      int mois = ((Number) ligne[1]).intValue();
      parMois.put(YearMonth.of(annee, mois), ((Number) ligne[2]).longValue());
    }

    long cumul = etablissements.countByCreeLeBefore(debut) + etablissements.countByCreeLeIsNull();
    List<PointInscription> serie = new ArrayList<>(MOIS_INSCRIPTIONS);
    for (YearMonth m = premier; !m.isAfter(moisCourant); m = m.plusMonths(1)) {
      long n = parMois.getOrDefault(m, 0L);
      cumul += n;
      serie.add(new PointInscription(m.toString(), n, cumul));
    }
    return serie;
  }

  static Instant debutDuMois(YearMonth mois) {
    return mois.atDay(1).atStartOfDay(ZoneOffset.UTC).toInstant();
  }
}
