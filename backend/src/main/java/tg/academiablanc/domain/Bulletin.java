package tg.academiablanc.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "bulletin")
@Getter
@Setter
@NoArgsConstructor
public class Bulletin {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "etablissement_id", nullable = false)
  private Long etablissementId;

  @Column(name = "eleve_id", nullable = false)
  private Long eleveId;

  @Column(name = "session_id", nullable = false)
  private Long sessionId;

  private BigDecimal moyenne;
  private Integer rang;
  private String mention;
  private String appreciation;

  @Column(name = "total_points")
  private BigDecimal totalPoints;

  @Column(name = "total_coef")
  private BigDecimal totalCoef;

  @Column(name = "genere_le", nullable = false)
  private Instant genereLe;
}
