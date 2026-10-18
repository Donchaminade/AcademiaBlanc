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

@Entity
@Table(name = "note")
@Getter
@Setter
@NoArgsConstructor
public class Note implements TenantOwned {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "etablissement_id", nullable = false)
  private Long etablissementId;

  @Column(name = "eleve_id", nullable = false)
  private Long eleveId;

  @Column(name = "matiere_id", nullable = false)
  private Long matiereId;

  @Column(name = "session_id", nullable = false)
  private Long sessionId;

  private BigDecimal valeur;

  @Column(nullable = false)
  private boolean absent;
}
