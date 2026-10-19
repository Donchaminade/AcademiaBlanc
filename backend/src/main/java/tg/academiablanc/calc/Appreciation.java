package tg.academiablanc.calc;

import java.math.BigDecimal;

/**
 * Appréciation du professeur déduite d'une note sur 20. Barème unique, identique à
 * {@code src/utils/appreciation.ts} côté client : chaque palier est fermé à gauche et ouvert à
 * droite ([12 ; 14[ → « Assez bien »), 20 compris dans « Excellent ».
 */
public final class Appreciation {
  private Appreciation() {}

  public static final String NON_NOTE = "Non noté";
  public static final String ABSENT = "Absent";

  /** Longueur maximale d'une appréciation saisie par l'enseignant (colonne {@code note.appreciation}). */
  public static final int LONGUEUR_MAX = 60;

  private record Palier(BigDecimal min, String libelle) {}

  private static final Palier[] BAREME = {
      new Palier(new BigDecimal("18"), "Excellent"),
      new Palier(new BigDecimal("16"), "Très bien"),
      new Palier(new BigDecimal("14"), "Bien"),
      new Palier(new BigDecimal("12"), "Assez bien"),
      new Palier(new BigDecimal("10"), "Passable"),
      new Palier(new BigDecimal("8"), "Mauvais"),
      new Palier(new BigDecimal("5"), "Insuffisant"),
      new Palier(BigDecimal.ZERO, "Très insuffisant"),
  };

  private static final BigDecimal VINGT = new BigDecimal("20");

  /** Appréciation automatique selon la note ; {@code null} ou hors barème → « Non noté ». */
  public static String selonNote(BigDecimal note) {
    if (note == null || note.signum() < 0 || note.compareTo(VINGT) > 0) return NON_NOTE;
    for (Palier palier : BAREME) {
      if (note.compareTo(palier.min()) >= 0) return palier.libelle();
    }
    return NON_NOTE;
  }

  /** Comme {@link #selonNote(BigDecimal)}, mais une absence signalée donne « Absent ». */
  public static String selonNote(BigDecimal note, boolean absent) {
    return absent ? ABSENT : selonNote(note);
  }

  /** Texte libre de l'enseignant débarrassé des espaces superflus ; {@code null} si vide. */
  public static String normaliserManuelle(String texte) {
    if (texte == null) return null;
    String compacte = texte.trim().replaceAll("\\s+", " ");
    return compacte.isEmpty() ? null : compacte;
  }

  /**
   * Appréciation portée sur la ligne du bulletin : le texte libre de l'enseignant s'il existe,
   * sinon l'appréciation automatique calculée sur la note de la matière.
   */
  public static String pourLigne(BigDecimal note, boolean absent, String manuelle) {
    String texte = normaliserManuelle(manuelle);
    return texte != null ? texte : selonNote(note, absent);
  }
}
