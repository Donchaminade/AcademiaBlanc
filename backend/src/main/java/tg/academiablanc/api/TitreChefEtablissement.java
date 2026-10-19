package tg.academiablanc.api;

import java.text.Normalizer;
import java.util.Collection;
import java.util.EnumSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;
import tg.academiablanc.api.ClasseNiveauUtil.Cycle;

/**
 * Titre du chef d'établissement porté par le bulletin ({@code BulletinVue.titreResponsable}). Miroir de
 * {@code src/utils/titreChef.ts} côté client.
 *
 * <p>Au collège (6e–3e) on parle de Directeur, au lycée (2nde–Tle) de Proviseur. Le titre se déduit du niveau
 * de la classe de l'élève ; le type porté par la fiche de l'établissement (collège / lycée / complexe scolaire)
 * tranche quand il est connu, et le titre saisi dans le profil ({@code parametres_bulletin.titre_signataire_jury},
 * null = automatique) prime toujours.</p>
 */
public final class TitreChefEtablissement {
  public static final String DIRECTEUR = "Le Directeur";
  public static final String PROVISEUR = "Le Proviseur";
  /** Repli quand ni le niveau ni le type de l'établissement ne permettent de trancher. */
  public static final String NEUTRE = "Le Chef d'établissement";

  /** Catégorie lue dans le type (ou le nom) de l'établissement. */
  public enum Categorie { COLLEGE, LYCEE, MIXTE }

  private static final Pattern COLLEGE = Pattern.compile("\\b(colleges?|ceg|cours secondaires?)\\b");
  private static final Pattern LYCEE = Pattern.compile("\\blycees?\\b");
  private static final Pattern MIXTE = Pattern.compile("\\b(complexes?|groupes? scolaires?)\\b");

  private TitreChefEtablissement() {}

  /** {@code COLLEGE} (collège, CEG), {@code LYCEE}, {@code MIXTE} (complexe scolaire, collège-lycée) ; null si le texte ne dit rien. */
  public static Categorie categorie(String typeOuNom) {
    if (typeOuNom == null || typeOuNom.isBlank()) return null;
    String texte = Normalizer.normalize(typeOuNom.trim(), Normalizer.Form.NFD)
        .replaceAll("\\p{M}", "")
        .toLowerCase(Locale.ROOT);
    boolean college = COLLEGE.matcher(texte).find();
    boolean lycee = LYCEE.matcher(texte).find();
    if (MIXTE.matcher(texte).find() || (college && lycee)) return Categorie.MIXTE;
    if (college) return Categorie.COLLEGE;
    if (lycee) return Categorie.LYCEE;
    return null;
  }

  /** Titre pour la classe d'un élève (bulletin). */
  public static String pour(String niveau, String typeEtablissement, String nomEtablissement, String surcharge) {
    return pour(niveau == null ? List.of() : List.of(niveau), typeEtablissement, nomEtablissement, surcharge);
  }

  /**
   * Titre pour un ensemble de niveaux (PV, session) :
   * <ol>
   *   <li>la surcharge du profil si elle est renseignée ;</li>
   *   <li>un établissement de type collège → « Le Directeur », de type lycée → « Le Proviseur », quel que soit le niveau ;</li>
   *   <li>sinon le cycle des niveaux : collège → « Le Directeur », lycée → « Le Proviseur » (un complexe scolaire suit la classe) ;</li>
   *   <li>niveaux mélangés ou inconnus : le nom de l'établissement s'il tranche, sinon « Le Chef d'établissement ».</li>
   * </ol>
   */
  public static String pour(Collection<String> niveaux, String typeEtablissement, String nomEtablissement, String surcharge) {
    if (surcharge != null && !surcharge.isBlank()) return surcharge.trim();

    Categorie type = categorie(typeEtablissement);
    if (type == Categorie.COLLEGE) return DIRECTEUR;
    if (type == Categorie.LYCEE) return PROVISEUR;

    Set<Cycle> cycles = EnumSet.noneOf(Cycle.class);
    for (String niveau : niveaux) {
      if (niveau == null || niveau.isBlank()) continue;
      // Un niveau non reconnu est traité comme lycée, comme `cycleDeNiveau` côté client.
      cycles.add(ClasseNiveauUtil.cycleDe(niveau).orElse(Cycle.LYCEE));
    }
    if (cycles.size() == 1) return cycles.contains(Cycle.COLLEGE) ? DIRECTEUR : PROVISEUR;

    if (type == null) {
      Categorie nom = categorie(nomEtablissement);
      if (nom == Categorie.COLLEGE) return DIRECTEUR;
      if (nom == Categorie.LYCEE) return PROVISEUR;
    }
    return NEUTRE;
  }
}
