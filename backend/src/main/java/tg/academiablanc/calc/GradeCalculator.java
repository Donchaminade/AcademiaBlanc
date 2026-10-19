package tg.academiablanc.calc;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Calculs purs des bulletins : total = note × coef, moyenne et rang de compétition. */
public final class GradeCalculator {
  private GradeCalculator() {}

  public record Ligne(Long eleveId, Long matiereId, BigDecimal note, BigDecimal coef, boolean absent) {}

  public static BigDecimal totalPondere(BigDecimal note, BigDecimal coef) {
    if (note == null || coef == null) return null;
    return note.multiply(coef).setScale(2, RoundingMode.HALF_UP);
  }

  /** Les notes absentes ou manquantes sont exclues du numérateur et du dénominateur. */
  public static BigDecimal moyenne(List<Ligne> lignes) {
    BigDecimal points = BigDecimal.ZERO;
    BigDecimal coefs = BigDecimal.ZERO;
    for (Ligne ligne : lignes) {
      if (ligne.absent() || ligne.note() == null || ligne.coef() == null) continue;
      points = points.add(ligne.note().multiply(ligne.coef()));
      coefs = coefs.add(ligne.coef());
    }
    if (coefs.signum() == 0) return null;
    return points.divide(coefs, 2, RoundingMode.HALF_UP);
  }

  public static BigDecimal sommePoints(List<Ligne> lignes) {
    BigDecimal points = BigDecimal.ZERO;
    for (Ligne ligne : lignes) {
      if (ligne.absent() || ligne.note() == null || ligne.coef() == null) continue;
      points = points.add(ligne.note().multiply(ligne.coef()));
    }
    return points.setScale(2, RoundingMode.HALF_UP);
  }

  public static BigDecimal sommeCoef(List<Ligne> lignes) {
    BigDecimal coefs = BigDecimal.ZERO;
    for (Ligne ligne : lignes) {
      if (ligne.absent() || ligne.note() == null || ligne.coef() == null) continue;
      coefs = coefs.add(ligne.coef());
    }
    return coefs.setScale(2, RoundingMode.HALF_UP);
  }

  /**
   * Classement compétition : tri décroissant, ex æquo au même rang, le suivant saute
   * (1, 2, 2, 4). Les valeurs nulles sont ignorées.
   */
  public static Map<Long, Integer> rangsCompetition(Map<Long, BigDecimal> valeurs) {
    List<Map.Entry<Long, BigDecimal>> tries = new ArrayList<>();
    for (Map.Entry<Long, BigDecimal> entry : valeurs.entrySet()) {
      if (entry.getValue() != null) tries.add(entry);
    }
    tries.sort(Comparator.comparing(Map.Entry<Long, BigDecimal>::getValue).reversed()
        .thenComparing(Map.Entry::getKey));
    Map<Long, Integer> rangs = new LinkedHashMap<>();
    int index = 0;
    while (index < tries.size()) {
      int rang = index + 1;
      BigDecimal score = tries.get(index).getValue();
      int curseur = index;
      while (curseur < tries.size() && tries.get(curseur).getValue().compareTo(score) == 0) {
        rangs.put(tries.get(curseur).getKey(), rang);
        curseur++;
      }
      index = curseur;
    }
    return rangs;
  }

  /**
   * Appréciation générale portée sur la moyenne : même barème que les matières
   * ({@link Appreciation#selonNote}), cohérent avec {@link #mention} (Passable 10, Assez bien 12,
   * Bien 14, Très bien 16). Sans moyenne : {@code null}.
   */
  public static String appreciation(BigDecimal moyenne) {
    if (moyenne == null) return null;
    return Appreciation.selonNote(moyenne);
  }

  public static String mention(BigDecimal moyenne) {
    if (moyenne == null) return null;
    if (moyenne.compareTo(new BigDecimal("16")) >= 0) return "TRÈS BIEN";
    if (moyenne.compareTo(new BigDecimal("14")) >= 0) return "BIEN";
    if (moyenne.compareTo(new BigDecimal("12")) >= 0) return "ASSEZ BIEN";
    if (moyenne.compareTo(new BigDecimal("10")) >= 0) return "PASSABLE";
    if (moyenne.compareTo(new BigDecimal("8")) >= 0) return "RATTRAPAGE";
    return "AJOURNÉ";
  }
}
