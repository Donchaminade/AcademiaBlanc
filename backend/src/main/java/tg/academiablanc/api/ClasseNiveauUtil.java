package tg.academiablanc.api;

import java.text.Normalizer;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import tg.academiablanc.domain.FamilleSerie;

/**
 * Lecture du niveau d'une classe : cycle (collège / lycée), code canonique et famille de série.
 *
 * <p>Collège : 6e, 5e, 4e, 3e — sans série. Lycée : 2nde, 1ère, Tle — avec une série du
 * référentiel de l'établissement (générale A4, C, D… ou technique G1, F4…).</p>
 *
 * <p>Les coefficients par défaut sont indexés par niveau et par série : une série technique
 * sans ligne spécifique retombe sur les valeurs « scientifiques » (série D), voir
 * {@link #serieDeReference(String, FamilleSerie)}.</p>
 */
public final class ClasseNiveauUtil {
  public enum Cycle { COLLEGE, LYCEE }

  /**
   * Résultat de la lecture d'un niveau.
   *
   * @param cycle   collège ou lycée ; {@code null} si le niveau n'est pas reconnu
   * @param niveau  code canonique (6e… 3e, 2nde, 1ère, Tle) ou libellé d'origine si inconnu
   * @param serie   code de la série (lycée) ou {@code null}
   * @param famille famille de la série (lycée) ou {@code null}
   */
  public record Resolution(Cycle cycle, String niveau, String serie, FamilleSerie famille) {
    public boolean college() { return cycle == Cycle.COLLEGE; }
    public boolean lycee() { return cycle == Cycle.LYCEE; }
  }

  private static final Map<String, String> CODES = Map.ofEntries(
      Map.entry("6E", "6e"), Map.entry("6EME", "6e"), Map.entry("SIXIEME", "6e"),
      Map.entry("5E", "5e"), Map.entry("5EME", "5e"), Map.entry("CINQUIEME", "5e"),
      Map.entry("4E", "4e"), Map.entry("4EME", "4e"), Map.entry("QUATRIEME", "4e"),
      Map.entry("3E", "3e"), Map.entry("3EME", "3e"), Map.entry("TROISIEME", "3e"),
      Map.entry("2NDE", "2nde"), Map.entry("2DE", "2nde"), Map.entry("SECONDE", "2nde"),
      Map.entry("1ERE", "1ère"), Map.entry("1RE", "1ère"), Map.entry("PREMIERE", "1ère"),
      Map.entry("TLE", "Tle"), Map.entry("TERMINALE", "Tle"));

  private ClasseNiveauUtil() {}

  /** Code canonique du niveau (« Troisième » → « 3e », « Terminale » → « Tle »), vide si inconnu. */
  public static Optional<String> canonique(String niveau) {
    if (niveau == null || niveau.isBlank()) return Optional.empty();
    String compact = Normalizer.normalize(niveau, Normalizer.Form.NFD)
        .replaceAll("\\p{M}", "")
        .toUpperCase(Locale.ROOT)
        .replaceAll("[^A-Z0-9]", "");
    return Optional.ofNullable(CODES.get(compact));
  }

  /** Cycle déduit du niveau ; vide si le niveau n'est pas reconnu. */
  public static Optional<Cycle> cycleDe(String niveau) {
    return canonique(niveau).map(code -> switch (code) {
      case "6e", "5e", "4e", "3e" -> Cycle.COLLEGE;
      default -> Cycle.LYCEE;
    });
  }

  /** Résout niveau, série et famille sans valider l'existence de la série (voir {@link SerieService#exiger}). */
  public static Resolution resolve(String niveau, String serie, FamilleSerie famille) {
    Cycle cycle = cycleDe(niveau).orElse(null);
    String code = canonique(niveau).orElse(niveau == null ? null : niveau.trim());
    String serieCode = serie == null || serie.isBlank() ? null : SerieService.normaliserCode(serie);
    return new Resolution(cycle, code, serieCode, serieCode == null ? null : famille);
  }

  /** Nom de classe généré : « 3e », « Tle D », « 1ère G2 ». */
  public static String nomClasse(String niveau, String serie) {
    String code = canonique(niveau).orElse(niveau == null ? "" : niveau.trim());
    return serie == null || serie.isBlank() ? code : code + " " + SerieService.normaliserCode(serie);
  }

  /**
   * Série dont les coefficients par défaut s'appliquent : la série elle-même pour une série
   * générale, « D » (profil scientifique) pour une série technique sans grille spécifique.
   */
  public static String serieDeReference(String serie, FamilleSerie famille) {
    if (serie == null || serie.isBlank()) return null;
    return famille == FamilleSerie.TECHNIQUE ? "D" : SerieService.normaliserCode(serie);
  }
}
