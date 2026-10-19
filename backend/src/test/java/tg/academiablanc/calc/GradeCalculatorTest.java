package tg.academiablanc.calc;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import tg.academiablanc.calc.GradeCalculator.Ligne;

class GradeCalculatorTest {
  @Test
  void totalEstNoteFoisCoefficient() {
    assertEquals(new BigDecimal("24.00"), GradeCalculator.totalPondere(new BigDecimal("12"), new BigDecimal("2")));
  }

  @Test
  void moyenneIgnoreLesAbsents() {
    List<Ligne> lignes = List.of(
        new Ligne(1L, 1L, new BigDecimal("12"), new BigDecimal("2"), false),
        new Ligne(1L, 2L, new BigDecimal("18"), new BigDecimal("4"), false),
        new Ligne(1L, 3L, null, new BigDecimal("1"), true)
    );
    // (12*2 + 18*4) / (2+4) = 96/6 = 16.00
    assertEquals(new BigDecimal("16.00"), GradeCalculator.moyenne(lignes));
    assertEquals(new BigDecimal("96.00"), GradeCalculator.sommePoints(lignes));
    assertEquals(new BigDecimal("6.00"), GradeCalculator.sommeCoef(lignes));
  }

  @Test
  void moyenneNulleSiToutEstAbsent() {
    assertNull(GradeCalculator.moyenne(List.of(new Ligne(1L, 1L, null, new BigDecimal("2"), true))));
  }

  @Test
  void rangsDeCompetitionAvecExAequo() {
    Map<Long, Integer> rangs = GradeCalculator.rangsCompetition(Map.of(
        1L, new BigDecimal("18"),
        2L, new BigDecimal("16"),
        3L, new BigDecimal("16"),
        4L, new BigDecimal("10")
    ));
    assertEquals(1, rangs.get(1L));
    assertEquals(2, rangs.get(2L));
    assertEquals(2, rangs.get(3L));
    assertEquals(4, rangs.get(4L));
  }

  @Test
  void totalMaximalPorteSurToutLeProgrammeMemeSansNote() {
    List<Ligne> lignes = List.of(
        new Ligne(1L, 1L, new BigDecimal("12"), new BigDecimal("2"), false),
        new Ligne(1L, 2L, new BigDecimal("18"), new BigDecimal("4"), false),
        new Ligne(1L, 3L, null, new BigDecimal("1"), true)
    );
    // Σ coef notés = 6 (dénominateur de la moyenne) mais le programme compte 7 : 20 × 7 = 140 points max.
    assertEquals(new BigDecimal("7.00"), GradeCalculator.sommeCoefProgramme(lignes));
    assertEquals(new BigDecimal("140.00"), GradeCalculator.pointsMax(lignes));
  }

  @Test
  void extremesEtMoyenneDunGroupeIgnorentLesValeursNulles() {
    List<BigDecimal> moyennes = java.util.Arrays.asList(new BigDecimal("10.40"), null, new BigDecimal("14.60"), new BigDecimal("12.55"));
    assertEquals(new BigDecimal("14.60"), GradeCalculator.max(moyennes));
    assertEquals(new BigDecimal("10.40"), GradeCalculator.min(moyennes));
    // (10,40 + 14,60 + 12,55) / 3 = 12,516… → 12,52
    assertEquals(new BigDecimal("12.52"), GradeCalculator.moyenneDe(moyennes));
    assertNull(GradeCalculator.max(List.of()));
    assertNull(GradeCalculator.min(List.of()));
    assertNull(GradeCalculator.moyenneDe(List.of()));
  }

  @Test
  void appreciationSelonLesSeuils() {
    // Même barème que les matières, aligné sur les seuils de la mention (10, 12, 14, 16).
    assertEquals("Excellent", GradeCalculator.appreciation(new BigDecimal("18")));
    assertEquals("Très bien", GradeCalculator.appreciation(new BigDecimal("16")));
    assertEquals("Bien", GradeCalculator.appreciation(new BigDecimal("14")));
    assertEquals("Assez bien", GradeCalculator.appreciation(new BigDecimal("12")));
    assertEquals("Passable", GradeCalculator.appreciation(new BigDecimal("10")));
    assertEquals("Médiocre", GradeCalculator.appreciation(new BigDecimal("9.99")));
    assertEquals("Insuffisant", GradeCalculator.appreciation(new BigDecimal("7")));
    assertEquals("Très insuffisant", GradeCalculator.appreciation(new BigDecimal("4")));
    assertEquals("TRÈS BIEN", GradeCalculator.mention(new BigDecimal("16")));
    assertEquals("BIEN", GradeCalculator.mention(new BigDecimal("14")));
    assertEquals("ASSEZ BIEN", GradeCalculator.mention(new BigDecimal("12")));
    assertEquals("PASSABLE", GradeCalculator.mention(new BigDecimal("10")));
    assertEquals("RATTRAPAGE", GradeCalculator.mention(new BigDecimal("8")));
    assertEquals("AJOURNÉ", GradeCalculator.mention(new BigDecimal("7.99")));
    assertNull(GradeCalculator.appreciation(null));
  }
}
