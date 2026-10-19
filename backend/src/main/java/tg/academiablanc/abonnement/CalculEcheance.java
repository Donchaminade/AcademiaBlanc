package tg.academiablanc.abonnement;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import tg.academiablanc.domain.Forfait;

/**
 * Règles de calcul des périodes d'abonnement, en UTC et sans état.
 *
 * <ul>
 *   <li>Mensuel = un mois calendaire ({@code plusMonths(1)} : le 31 janvier donne le 28 ou 29 février),
 *       annuel = douze mois ; la fin de période est suivie des jours de grâce, qui donnent l'échéance d'accès.
 *       Activation le 19 avec 3 jours de grâce : fin de période le 19 du mois suivant, échéance le 22.</li>
 *   <li>Une activation pendant une période encore en cours prolonge à partir de la fin de cette période
 *       (aucun jour perdu) ; après la fin de période — grâce comprise ou non — elle repart de la date d'activation.</li>
 *   <li>L'essai dure un nombre de jours paramétrable, sans grâce : son échéance est sa fin.</li>
 * </ul>
 */
public final class CalculEcheance {
  private CalculEcheance() {}

  /** Résultat d'un calcul de période : début, fin de période payée, échéance d'accès (fin + grâce). */
  public record Periode(Instant debut, Instant fin, Instant echeance) {}

  /** Fin de période payée : début + 1 ou 12 mois calendaires, en UTC. */
  public static Instant finPeriode(Instant debut, Forfait forfait) {
    return utc(debut).plusMonths(forfait.mois()).toInstant();
  }

  /** Échéance d'accès : fin de période + jours de grâce (jours civils UTC). */
  public static Instant echeance(Instant fin, int joursGrace) {
    return utc(fin).plusDays(Math.max(0, joursGrace)).toInstant();
  }

  /**
   * Période d'une activation. {@code finCourante} = fin de la période payée en cours (null si aucune) :
   * si elle est encore à venir, la nouvelle période la prolonge ; sinon elle démarre à {@code activation}.
   */
  public static Periode activer(Instant activation, Instant finCourante, Forfait forfait, int joursGrace) {
    Instant debut = finCourante != null && finCourante.isAfter(activation) ? finCourante : activation;
    Instant fin = finPeriode(debut, forfait);
    return new Periode(debut, fin, echeance(fin, joursGrace));
  }

  /** Période d'essai : {@code dureeJours} jours civils à partir de {@code debut}, sans grâce. */
  public static Periode essai(Instant debut, int dureeJours) {
    Instant fin = utc(debut).plusDays(Math.max(1, dureeJours)).toInstant();
    return new Periode(debut, fin, fin);
  }

  /**
   * Jours restants avant {@code cible}, en jours civils UTC (différence de dates, pas de durée) :
   * le jour même donne 0, hier −1. « J-12 » = 12.
   */
  public static long joursRestants(Instant maintenant, Instant cible) {
    LocalDate aujourdHui = utc(maintenant).toLocalDate();
    LocalDate jour = utc(cible).toLocalDate();
    return ChronoUnit.DAYS.between(aujourdHui, jour);
  }

  private static ZonedDateTime utc(Instant instant) {
    return instant.atZone(ZoneOffset.UTC);
  }
}
