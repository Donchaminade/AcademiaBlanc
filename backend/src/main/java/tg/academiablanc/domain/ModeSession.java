package tg.academiablanc.domain;

/**
 * Mode d'organisation d'une session d'examen blanc.
 * <ul>
 *   <li>{@link #INTERNE} : les candidats sont les élèves de l'établissement ; les relevés portent le
 *       logo, le cachet et le pied de page de l'établissement.</li>
 *   <li>{@link #INTER_ETABLISSEMENTS} : plusieurs établissements organisent l'examen ensemble et
 *       confondent leurs élèves. L'établissement qui crée la session est le <b>centre d'examen</b> ;
 *       les candidats gardent un établissement d'origine en texte libre, les relevés n'affichent ni
 *       logo ni cachet d'établissement, le rang est calculé sur tous les candidats du même
 *       niveau / de la même série de la session.</li>
 * </ul>
 */
public enum ModeSession {
  INTERNE,
  INTER_ETABLISSEMENTS;

  /** Valeur par défaut : une session sans mode précisé (données antérieures, client ancien) est interne. */
  public static ModeSession ouDefaut(ModeSession mode) {
    return mode == null ? INTERNE : mode;
  }
}
