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
@Table(name = "classe")
@Getter
@Setter
@NoArgsConstructor
public class Classe implements TenantOwned {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "etablissement_id", nullable = false)
  private Long etablissementId;

  @Column(name = "annee_scolaire_id", nullable = false)
  private Long anneeScolaireId;

  @Column(nullable = false)
  private String nom;

  @Column(nullable = false)
  private String niveau;

  private String serie;

  @Column(name = "titulaire_id")
  private Long titulaireId;
}
