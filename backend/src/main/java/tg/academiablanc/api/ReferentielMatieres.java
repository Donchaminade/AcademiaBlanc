package tg.academiablanc.api;

import java.math.BigDecimal;
import java.text.Normalizer;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import tg.academiablanc.domain.Classe;
import tg.academiablanc.domain.Matiere;

/**
 * Référentiel des matières principales (collège / lycée) et de leurs coefficients par défaut.
 *
 * <p>C'est le seul endroit à modifier pour changer la liste des matières, leur groupe (UE)
 * ou les coefficients proposés. Les valeurs chargées restent ensuite modifiables par chaque
 * établissement dans « Matières &amp; Coefficients » : ce sont des valeurs de départ, pas une règle.
 */
public final class ReferentielMatieres {
  private ReferentielMatieres() {}

  public static final String GROUPE_LITTERAIRE = "LT";
  public static final String GROUPE_SCIENTIFIQUE = "SC";

  /** Libellés des groupes de matières (UE). */
  public static final Map<String, String> GROUPES = Map.of(
      GROUPE_LITTERAIRE, "Enseignements Littératures",
      GROUPE_SCIENTIFIQUE, "Enseignements Scientifiques");

  /** Une matière du référentiel : le code est stocké en minuscules, comme les matières saisies à la main. */
  public record MatiereRef(String code, String nom, String groupeCode) {
    public String groupeLibelle() {
      return GROUPES.get(groupeCode);
    }
  }

  /** Les 7 matières principales, dans l'ordre d'affichage (LT puis SC). */
  public static final List<MatiereRef> MATIERES = List.of(
      new MatiereRef("fr", "Français", GROUPE_LITTERAIRE),
      new MatiereRef("ang", "Anglais", GROUPE_LITTERAIRE),
      new MatiereRef("hg", "Histoire - Géographie", GROUPE_LITTERAIRE),
      new MatiereRef("ecm", "Education Civique et Morale", GROUPE_LITTERAIRE),
      new MatiereRef("pc", "Sciences Physiques", GROUPE_SCIENTIFIQUE),
      new MatiereRef("mat", "Mathématiques", GROUPE_SCIENTIFIQUE),
      new MatiereRef("svt", "Science de la Vie et de la Terre", GROUPE_SCIENTIFIQUE));

  /** Profils de classes auxquels s'appliquent des coefficients différents. */
  public enum Profil { COLLEGE, LYCEE_A, LYCEE_C, LYCEE_D, DEFAUT }

  /**
   * Coefficients par défaut, par profil puis par code de matière (ordre : fr, ang, hg, ecm, pc, mat, svt).
   *
   * <ul>
   *   <li>COLLEGE (6e, 5e, 4e, 3e) : usage BEPC.</li>
   *   <li>LYCEE_A (2nde A, 1ère A, Tle A) : séries littéraires.</li>
   *   <li>LYCEE_C / LYCEE_D : séries scientifiques.</li>
   *   <li>DEFAUT : niveau non reconnu.</li>
   * </ul>
   */
  public static final Map<Profil, Map<String, BigDecimal>> COEFFICIENTS = Map.of(
      Profil.COLLEGE, coefs(3, 2, 2, 1, 2, 3, 2),
      Profil.LYCEE_A, coefs(4, 3, 3, 1, 1, 2, 1),
      Profil.LYCEE_C, coefs(2, 2, 2, 1, 4, 5, 2),
      Profil.LYCEE_D, coefs(2, 2, 2, 1, 3, 4, 4),
      Profil.DEFAUT, coefs(2, 2, 2, 1, 2, 3, 2));

  private static Map<String, BigDecimal> coefs(int fr, int ang, int hg, int ecm, int pc, int mat, int svt) {
    return Map.of(
        "fr", BigDecimal.valueOf(fr),
        "ang", BigDecimal.valueOf(ang),
        "hg", BigDecimal.valueOf(hg),
        "ecm", BigDecimal.valueOf(ecm),
        "pc", BigDecimal.valueOf(pc),
        "mat", BigDecimal.valueOf(mat),
        "svt", BigDecimal.valueOf(svt));
  }

  private static final Pattern COLLEGE = Pattern.compile("^(6|5|4|3|SIX|CINQ|QUATR|TROIS)");
  private static final Pattern LYCEE = Pattern.compile("^(2|1|SECONDE|PREMIERE|TLE|TERMINALE)");
  private static final Pattern SERIE = Pattern.compile("(?:^|[^A-Z])([ACD])\\d*(?:$|[^A-Z])");

  /** Coefficient par défaut d'une matière du référentiel pour une classe donnée. */
  public static BigDecimal coefficientParDefaut(String code, Classe classe) {
    Map<String, BigDecimal> table = COEFFICIENTS.get(profilDe(classe));
    BigDecimal valeur = table.get(code.toLowerCase(Locale.ROOT));
    return valeur != null ? valeur : COEFFICIENTS.get(Profil.DEFAUT).getOrDefault(code.toLowerCase(Locale.ROOT), BigDecimal.ONE);
  }

  /** Déduit le profil d'une classe à partir de son niveau, de son nom et de sa série. */
  public static Profil profilDe(Classe classe) {
    String niveau = normaliser(classe.getNiveau());
    String nom = normaliser(classe.getNom());
    if (COLLEGE.matcher(niveau).find() || COLLEGE.matcher(nom).find()) return Profil.COLLEGE;
    if (!LYCEE.matcher(niveau).find() && !LYCEE.matcher(nom).find()) return Profil.DEFAUT;
    String serie = serieDe(classe.getSerie(), nom);
    return switch (serie) {
      case "A" -> Profil.LYCEE_A;
      case "C" -> Profil.LYCEE_C;
      case "D" -> Profil.LYCEE_D;
      default -> Profil.DEFAUT;
    };
  }

  /** Lettre de série (A, C, D) lue dans le champ série puis dans le nom de la classe ; vide sinon. */
  static String serieDe(String serie, String nomNormalise) {
    if (serie != null && !serie.isBlank()) {
      Matcher m = SERIE.matcher(" " + normaliser(serie).replace("SERIE", "").trim() + " ");
      if (m.find()) return m.group(1);
    }
    Matcher m = SERIE.matcher(" " + nomNormalise + " ");
    if (m.find()) return m.group(1);
    return "";
  }

  /** Ordre des matières sur le bulletin : groupe LT, puis SC, puis sans groupe ; dans chaque groupe l'ordre du référentiel puis le nom. */
  public static final Comparator<Matiere> ORDRE_BULLETIN = Comparator
      .comparingInt((Matiere m) -> rangGroupe(m.getGroupeCode()))
      .thenComparingInt(m -> rangCode(m.getCode()))
      .thenComparing(Matiere::getNom, String.CASE_INSENSITIVE_ORDER);

  private static int rangGroupe(String groupe) {
    if (GROUPE_LITTERAIRE.equalsIgnoreCase(groupe)) return 0;
    if (GROUPE_SCIENTIFIQUE.equalsIgnoreCase(groupe)) return 1;
    return 2;
  }

  private static int rangCode(String code) {
    if (code == null) return MATIERES.size();
    for (int i = 0; i < MATIERES.size(); i++) {
      if (MATIERES.get(i).code().equalsIgnoreCase(code)) return i;
    }
    return MATIERES.size();
  }

  /** Libellé d'un code de groupe, ou nul si le code est vide ou inconnu. */
  public static String libelleGroupe(String groupeCode) {
    if (groupeCode == null || groupeCode.isBlank()) return null;
    return GROUPES.get(groupeCode.trim().toUpperCase(Locale.ROOT));
  }

  /** Code de groupe normalisé (LT / SC), ou nul si vide ou inconnu. */
  public static String codeGroupe(String groupeCode) {
    if (groupeCode == null || groupeCode.isBlank()) return null;
    String code = groupeCode.trim().toUpperCase(Locale.ROOT);
    return GROUPES.containsKey(code) ? code : null;
  }

  private static String normaliser(String valeur) {
    if (valeur == null) return "";
    return Normalizer.normalize(valeur, Normalizer.Form.NFD)
        .replaceAll("\\p{M}", "")
        .toUpperCase(Locale.ROOT)
        .trim();
  }
}
