package tg.academiablanc.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Paramètre commercial de la plateforme (clé / valeur) : tarifs, téléphones, instructions, durées. */
@Entity
@Table(name = "parametres_plateforme")
@Getter
@Setter
@NoArgsConstructor
public class ParametrePlateforme {
  @Id
  private String cle;

  @Column(length = 4000)
  private String valeur;

  @Column(name = "modifie_le")
  private Instant modifieLe;

  @Column(name = "modifie_par")
  private String modifiePar;

  public ParametrePlateforme(String cle, String valeur) {
    this.cle = cle;
    this.valeur = valeur;
  }
}
