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

/**
 * Décision du jury pour un élève dans une session : bonus de repêchage ajouté à la moyenne,
 * observation générale portée sur le bulletin et signature électronique apposée depuis l'application.
 */
@Entity
@Table(name = "deliberation_jury")
@Getter
@Setter
@NoArgsConstructor
public class DeliberationJury implements TenantOwned {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "etablissement_id", nullable = false)
  private Long etablissementId;

  @Column(name = "eleve_id", nullable = false)
  private Long eleveId;

  @Column(name = "session_id", nullable = false)
  private Long sessionId;

  @Column(name = "bonus_jury", nullable = false)
  private BigDecimal bonusJury = BigDecimal.ZERO;

  @Column(columnDefinition = "TEXT")
  private String observation;

  @Column(name = "signe_le")
  private Instant signeLe;

  private String signataire;

  @Column(name = "empreinte_signature")
  private String empreinteSignature;

  @Column(name = "modifie_le", nullable = false)
  private Instant modifieLe;
}
