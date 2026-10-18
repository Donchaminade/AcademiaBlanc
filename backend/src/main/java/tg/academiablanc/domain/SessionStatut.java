package tg.academiablanc.domain;

import java.text.Normalizer;
import java.util.Locale;

/** Statuts d'une session d'examen. Le statut est stocké en texte libre : la comparaison ignore casse et accents. */
public final class SessionStatut {
  private SessionStatut() {}

  public static final String OUVERTE = "OUVERTE";
  public static final String CLOTUREE = "CLOTUREE";
  public static final String ARCHIVEE = "ARCHIVEE";

  /** Une session archivée ou clôturée alimente le registre des archives ; une session ouverte, non. */
  public static boolean estArchivee(String statut) {
    String normalise = normaliser(statut);
    return normalise.startsWith("ARCHIV") || normalise.startsWith("CLOTUR")
        || normalise.startsWith("FERME") || normalise.startsWith("TERMIN");
  }

  private static String normaliser(String statut) {
    if (statut == null) return "";
    String sansAccents = Normalizer.normalize(statut.trim(), Normalizer.Form.NFD).replaceAll("\\p{M}", "");
    return sansAccents.toUpperCase(Locale.ROOT);
  }
}
