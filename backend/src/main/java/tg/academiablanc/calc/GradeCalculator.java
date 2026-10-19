package tg.academiablanc.calc;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Calculs purs des bulletins : total = note × coef, moyenne réelle Σ(note × coef) / Σ coef (jamais
 * majorée), rang de compétition, extrêmes d'un groupe. Une note absente ou manquante est exclue du
 * numérateur et du dénominateur : elle ne vaut pas zéro.
 */
public final class GradeCalculator {
  private GradeCalculator() {}

  /** Toutes les notes sont saisies sur 20. */
  public static final BigDecimal NOTE_MAX = new BigDecimal("20");

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

  /** Σ coef de toutes les lignes du programme, notes présentes ou non : base du total maximal du bulletin. */
  public static BigDecimal sommeCoefProgramme(List<Ligne> lignes) {
    BigDecimal coefs = BigDecimal.ZERO;
    for (Ligne ligne : lignes) {
      if (ligne.coef() != null) coefs = coefs.add(ligne.coef());
    }
    return coefs.setScale(2, RoundingMode.HALF_UP);
  }

  /** Total maximal du bulletin : 20 × Σ coef du programme de la classe de l'élève. */
  public static BigDecimal pointsMax(List<Ligne> lignes) {
    return NOTE_MAX.multiply(sommeCoefProgramme(lignes)).setScale(2, RoundingMode.HALF_UP);
  }

  /** Moyenne arithmétique des valeurs non nulles (moyenne de classe) ; null si aucune. */
  public static BigDecimal moyenneDe(Collection<BigDecimal> valeurs) {
    BigDecimal somme = BigDecimal.ZERO;
    int n = 0;
    for (BigDecimal valeur : valeurs) {
      if (valeur == null) continue;
      somme = somme.add(valeur);
      n++;
    }
    return n == 0 ? null : somme.divide(BigDecimal.valueOf(n), 2, RoundingMode.HALF_UP);
  }

  /** Plus grande valeur non nulle ; null si aucune. */
  public static BigDecimal max(Collection<BigDecimal> valeurs) {
    BigDecimal max = null;
    for (BigDecimal valeur : valeurs) {
      if (valeur != null && (max == null || valeur.compareTo(max) > 0)) max = valeur;
    }
    return max;
  }

  /** Plus petite valeur non nulle ; null si aucune. */
  public static BigDecimal min(Collection<BigDecimal> valeurs) {
    BigDecimal min = null;
    for (BigDecimal valeur : valeurs) {
      if (valeur != null && (min == null || valeur.compareTo(min) < 0)) min = valeur;
    }
    return min;
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

  /**
   * Mention portée sur la moyenne affichée (arrondie au centième) : Très bien 16, Bien 14, Assez bien 12,
   * Passable 10 ; en dessous de 10 la mention est {@value #DECISION_AJOURNE}. Sans moyenne : {@code null}.
   */
  public static String mention(BigDecimal moyenne) {
    if (moyenne == null) return null;
    BigDecimal affichee = arrondie(moyenne);
    if (affichee.compareTo(new BigDecimal("16")) >= 0) return "TRÈS BIEN";
    if (affichee.compareTo(new BigDecimal("14")) >= 0) return "BIEN";
    if (affichee.compareTo(new BigDecimal("12")) >= 0) return "ASSEZ BIEN";
    if (affichee.compareTo(SEUIL_ADMISSION) >= 0) return "PASSABLE";
    return DECISION_AJOURNE;
  }

  /** Seuil d'admission : moyenne générale affichée ≥ 10/20. */
  public static final BigDecimal SEUIL_ADMISSION = new BigDecimal("10");
  public static final String DECISION_ADMIS = "ADMIS";
  public static final String DECISION_AJOURNE = "AJOURNÉ";

  /**
   * Décision unique de l'examen blanc : moyenne générale affichée ≥ 10 → {@value #DECISION_ADMIS}, sinon
   * {@value #DECISION_AJOURNE}. La comparaison porte sur la moyenne arrondie au centième, telle qu'imprimée
   * (9,995 s'affiche 10,00 et est admis). Sans aucune note (moyenne nulle) : {@code null}, jamais ajourné
   * par défaut.
   */
  public static String decision(BigDecimal moyenne) {
    if (moyenne == null) return null;
    return arrondie(moyenne).compareTo(SEUIL_ADMISSION) >= 0 ? DECISION_ADMIS : DECISION_AJOURNE;
  }

  /** Moyenne telle qu'affichée sur le bulletin : deux décimales, arrondi commercial. */
  private static BigDecimal arrondie(BigDecimal moyenne) {
    return moyenne.setScale(2, RoundingMode.HALF_UP);
  }
}
