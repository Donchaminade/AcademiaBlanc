package tg.academiablanc.api;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * Instantané JSON d'un transfert d'examen blanc ({@code transfert_examen.paquet}), figé au moment de l'envoi.
 * Il ne contient que les élèves d'un seul établissement d'origine, mais leurs statistiques (rang, effectif,
 * extrêmes) sont celles du groupe de classement complet de la session du centre (tous établissements
 * confondus, même niveau / même série), telles que le bulletin du centre les affiche.
 * Les identifiants ({@code id}, {@code matiereId}) sont ceux du centre : ils ne servent qu'à relier les
 * lignes entre elles dans le paquet.
 */
public record PaquetTransfert(
    int version,
    Instant genereLe,
    String centreNom,
    String centreVille,
    String sessionNom,
    String typeExamenCode,
    String typeExamenLibelle,
    String typeExamenLibelleLong,
    String anneeLibelle,
    String etablissementOrigine,
    List<Matiere> matieres,
    List<Groupe> groupes,
    List<Eleve> eleves
) {
  public static final int VERSION = 1;

  /** Matière du programme du centre (identifiant du centre, nom, code, groupe LT / SC). */
  public record Matiere(Long id, String nom, String code, String groupeCode) {}

  /** Groupe de classement de la session complète (niveau / série) : effectif, extrêmes et statistiques par matière. */
  public record Groupe(String cle, String niveau, String serie, int effectif, int effectifNotes,
                       BigDecimal moyenneGroupe, BigDecimal moyenneMax, BigDecimal moyenneMin,
                       List<StatMatiere> matieres) {}

  /** Statistiques d'une matière dans un groupe : notes présentes, note la plus forte et la plus faible. */
  public record StatMatiere(Long matiereId, String nom, int effectif, BigDecimal noteMax, BigDecimal noteMin) {}

  /** Élève transféré : état civil, classe du centre (niveau / série / nom), numéro de table, notes et statistiques. */
  public record Eleve(Long id, String nomComplet, String genre, String dateNaissance, String lieuNaissance,
                      String niveau, String serie, String classeNom, Integer numeroTable, String groupe,
                      List<Ligne> lignes, Stat stat) {}

  /**
   * Ligne du programme de l'élève : coefficient appliqué, note sur 20 (null si absent ou non notée), absence,
   * appréciation libre de l'enseignant, rang dans la matière et extrêmes de la matière dans le groupe.
   */
  public record Ligne(Long matiereId, BigDecimal coefficient, BigDecimal note, boolean absent, boolean nonNotee,
                      String appreciation, Integer rang, BigDecimal noteMax, BigDecimal noteMin) {}

  /** Statistiques de l'examen commun pour l'élève : moyenne, rang et effectif du groupe, extrêmes, mention, décision. */
  public record Stat(BigDecimal moyenne, Integer rang, Integer effectifGroupe, BigDecimal moyenneGroupe,
                     BigDecimal moyenneMax, BigDecimal moyenneMin, String mention, String decision) {}
}
