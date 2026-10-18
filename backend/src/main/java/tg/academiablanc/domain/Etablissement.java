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
@Table(name = "etablissement")
@Getter
@Setter
@NoArgsConstructor
public class Etablissement {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(nullable = false)
  private String nom;

  @Column(nullable = false)
  private String code;

  @Column(nullable = false)
  private String ville;

  private String region;

  @Column(name = "type_etablissement")
  private String typeEtablissement;

  @Column(nullable = false)
  private String email;

  private String telephone;

  @Column(name = "nom_responsable", nullable = false)
  private String nomResponsable;

  /** Faux quand la plateforme a désactivé l’établissement : plus aucune connexion possible. */
  @Column(nullable = false)
  private boolean actif = true;

  /** Cachet affiché dans la carte « Le Proviseur » du bulletin ; null = cachet physique. */
  @Column(name = "sceau_url", columnDefinition = "TEXT")
  private String sceauUrl;

  @Column(name = "signature_proviseur_url", columnDefinition = "TEXT")
  private String signatureProviseurUrl;

  @Column(name = "signature_titulaire_url", columnDefinition = "TEXT")
  private String signatureTitulaireUrl;
}
