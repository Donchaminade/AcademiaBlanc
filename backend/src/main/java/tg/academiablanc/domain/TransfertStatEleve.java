package tg.academiablanc.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Statistiques de l'examen commun conservées chez le destinataire pour un élève importé par transfert :
 * rang, effectif et extrêmes du groupe de classement complet de la session du centre (tous établissements
 * confondus), que le bulletin affiche à la place des valeurs recalculées sur les seuls élèves de
 * l'établissement. {@link #lignes} : JSON {@code [{matiereId, rang, noteMax, noteMin, effectif}]} avec les
 * identifiants de matière de l'établissement destinataire.
 */
@Entity
@Table(name = "transfert_stat_eleve")
@Getter
@Setter
@NoArgsConstructor
public class TransfertStatEleve implements TenantOwned {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "etablissement_id", nullable = false)
  private Long etablissementId;

  @Column(name = "transfert_id", nullable = false)
  private Long transfertId;

  @Column(name = "session_id", nullable = false)
  private Long sessionId;

  @Column(name = "eleve_id", nullable = false)
  private Long eleveId;

  private BigDecimal moyenne;

  private Integer rang;

  @Column(name = "effectif_groupe")
  private Integer effectifGroupe;

  @Column(name = "moyenne_groupe")
  private BigDecimal moyenneGroupe;

  @Column(name = "moyenne_max_groupe")
  private BigDecimal moyenneMaxGroupe;

  @Column(name = "moyenne_min_groupe")
  private BigDecimal moyenneMinGroupe;

  private String mention;

  private String decision;

  @Column(columnDefinition = "TEXT")
  private String lignes;
}
