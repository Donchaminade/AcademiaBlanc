package tg.academiablanc.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Type d'examen du référentiel de la plateforme (CEPD, BEPC, BAC I, BAC II, composition…).
 * Commun à tous les établissements : géré par le propriétaire du logiciel et ses gestionnaires,
 * choisi par chaque établissement à la création d'une session.
 */
@Entity
@Table(name = "type_examen")
@Getter
@Setter
@NoArgsConstructor
public class TypeExamen {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  /** Clé fonctionnelle stable, en majuscules (BEPC, BAC2…). */
  @Column(nullable = false)
  private String code;

  /** Libellé affiché dans les listes, la barre latérale, les archives (« BEPC », « BAC II »). */
  @Column(name = "libelle_court", nullable = false)
  private String libelleCourt;

  /** Libellé officiel imprimé sur le bulletin (« Brevet d'Études du Premier Cycle »). */
  @Column(name = "libelle_long", nullable = false)
  private String libelleLong;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private CycleExamen cycle = CycleExamen.TOUS;

  @Column(nullable = false)
  private int ordre;

  @Column(nullable = false)
  private boolean actif = true;
}
