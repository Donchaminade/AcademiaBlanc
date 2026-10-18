package tg.academiablanc.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "affectation")
@Getter
@Setter
@NoArgsConstructor
public class Affectation implements TenantOwned {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "etablissement_id", nullable = false)
  private Long etablissementId;

  @Column(name = "professeur_id", nullable = false)
  private Long professeurId;

  @Column(name = "matiere_id", nullable = false)
  private Long matiereId;

  @Column(name = "classe_id", nullable = false)
  private Long classeId;
}
