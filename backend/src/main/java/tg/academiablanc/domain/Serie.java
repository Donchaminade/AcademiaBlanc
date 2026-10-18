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
 * Série du lycée propre à un établissement (A4, C, D, G1, F4…).
 * Le code est la clé fonctionnelle référencée par {@link Classe#getSerie()}.
 */
@Entity
@Table(name = "serie")
@Getter
@Setter
@NoArgsConstructor
public class Serie implements TenantOwned {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "etablissement_id", nullable = false)
  private Long etablissementId;

  @Column(nullable = false)
  private String code;

  @Column(nullable = false)
  private String libelle;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private FamilleSerie famille;

  @Column(nullable = false)
  private boolean actif = true;

  @Column(nullable = false)
  private int ordre;
}
