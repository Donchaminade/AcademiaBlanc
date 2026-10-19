package tg.academiablanc.abonnement;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;
import tg.academiablanc.domain.Forfait;

/** Règles de calcul des périodes : mois calendaires, fins de mois, années bissextiles, grâce, prolongation, essai. */
class CalculEcheanceTest {
  private static Instant utc(int annee, int mois, int jour) {
    return LocalDate.of(annee, mois, jour).atStartOfDay(ZoneOffset.UTC).toInstant();
  }

  private static Instant utc(int annee, int mois, int jour, int heure) {
    return LocalDateTime.of(annee, mois, jour, heure, 0).toInstant(ZoneOffset.UTC);
  }

  @Test
  void mensuelActiveLe19DonneUneFinLe19EtUneEcheanceLe22DuMoisSuivant() {
    CalculEcheance.Periode p = CalculEcheance.activer(utc(2026, 10, 19, 15), null, Forfait.MENSUEL, 3);
    assertEquals(utc(2026, 10, 19, 15), p.debut());
    assertEquals(utc(2026, 11, 19, 15), p.fin());
    assertEquals(utc(2026, 11, 22, 15), p.echeance());
  }

  @Test
  void finDeMoisLe31JanvierDonneLe28FevrierPuisTroisJoursDeGrace() {
    CalculEcheance.Periode p = CalculEcheance.activer(utc(2026, 1, 31), null, Forfait.MENSUEL, 3);
    assertEquals(utc(2026, 2, 28), p.fin());
    assertEquals(utc(2026, 3, 3), p.echeance());
  }

  @Test
  void anneeBissextileLe31JanvierDonneLe29Fevrier() {
    CalculEcheance.Periode p = CalculEcheance.activer(utc(2028, 1, 31), null, Forfait.MENSUEL, 3);
    assertEquals(utc(2028, 2, 29), p.fin());
    assertEquals(utc(2028, 3, 3), p.echeance());
  }

  @Test
  void le30AvrilDonneLe30MaiEtLe31MarsLe30Avril() {
    assertEquals(utc(2026, 5, 30), CalculEcheance.finPeriode(utc(2026, 4, 30), Forfait.MENSUEL));
    assertEquals(utc(2026, 4, 30), CalculEcheance.finPeriode(utc(2026, 3, 31), Forfait.MENSUEL));
  }

  @Test
  void annuelDonneDouzeMoisPlusLaGrace() {
    CalculEcheance.Periode p = CalculEcheance.activer(utc(2026, 10, 19), null, Forfait.ANNUEL, 3);
    assertEquals(utc(2027, 10, 19), p.fin());
    assertEquals(utc(2027, 10, 22), p.echeance());
  }

  @Test
  void annuelDepuisLe29FevrierRetombeSurLe28FevrierSuivant() {
    assertEquals(utc(2029, 2, 28), CalculEcheance.finPeriode(utc(2028, 2, 29), Forfait.ANNUEL));
  }

  @Test
  void uneActivationPendantUnePeriodeEnCoursProlongeDepuisSaFin() {
    Instant finCourante = utc(2026, 11, 19);
    CalculEcheance.Periode p = CalculEcheance.activer(utc(2026, 11, 2), finCourante, Forfait.MENSUEL, 3);
    assertEquals(finCourante, p.debut());
    assertEquals(utc(2026, 12, 19), p.fin());
    assertEquals(utc(2026, 12, 22), p.echeance());
  }

  @Test
  void uneActivationApresLaFinDePeriodeRepartDeLaDateDActivation() {
    CalculEcheance.Periode p = CalculEcheance.activer(utc(2026, 12, 5), utc(2026, 11, 19), Forfait.MENSUEL, 3);
    assertEquals(utc(2026, 12, 5), p.debut());
    assertEquals(utc(2027, 1, 5), p.fin());
    assertEquals(utc(2027, 1, 8), p.echeance());
  }

  @Test
  void sansGraceLEcheanceEstLaFin() {
    CalculEcheance.Periode p = CalculEcheance.activer(utc(2026, 10, 19), null, Forfait.MENSUEL, 0);
    assertEquals(p.fin(), p.echeance());
  }

  @Test
  void lEssaiDureLeNombreDeJoursDemandeSansGrace() {
    CalculEcheance.Periode p = CalculEcheance.essai(utc(2026, 10, 19, 9), 14);
    assertEquals(utc(2026, 11, 2, 9), p.fin());
    assertEquals(p.fin(), p.echeance());
  }

  @Test
  void joursRestantsEnJoursCivilsUtc() {
    assertEquals(14, CalculEcheance.joursRestants(utc(2026, 10, 19, 23), utc(2026, 11, 2, 1)));
    assertEquals(0, CalculEcheance.joursRestants(utc(2026, 11, 2, 1), utc(2026, 11, 2, 23)));
    assertEquals(-1, CalculEcheance.joursRestants(utc(2026, 11, 3), utc(2026, 11, 2)));
    assertEquals(34, CalculEcheance.joursRestants(utc(2026, 10, 19), utc(2026, 11, 22)));
  }
}
