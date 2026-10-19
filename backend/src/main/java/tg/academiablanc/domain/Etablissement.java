package tg.academiablanc.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
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

  /** Adresse postale affichée sur le profil ; null si non renseignée. */
  private String adresse;

  /** Devise propre à l'établissement (distincte de la devise nationale du bulletin) ; null si aucune. */
  private String devise;

  /** Date de création du compte ; null pour les établissements antérieurs à la migration V12. */
  @Column(name = "cree_le")
  private Instant creeLe;

  /** Faux quand la plateforme a désactivé l’établissement : plus aucune connexion possible. */
  @Column(nullable = false)
  private boolean actif = true;

  /**
   * Logo de l'établissement (barre latérale, profil), conservé en base sous forme de data URL ;
   * null = aucun logo, le client affiche les initiales de l'établissement.
   */
  @Column(name = "logo_url", columnDefinition = "TEXT")
  private String logoUrl;

  /** Dernière modification du logo, du cachet ou des signatures. */
  @Column(name = "charte_modifiee_le")
  private Instant charteModifieeLe;

  /** Cachet affiché dans la carte du chef d'établissement (Directeur / Proviseur) du bulletin ; null = cachet physique. */
  @Column(name = "sceau_url", columnDefinition = "TEXT")
  private String sceauUrl;

  @Column(name = "signature_proviseur_url", columnDefinition = "TEXT")
  private String signatureProviseurUrl;

  @Column(name = "signature_titulaire_url", columnDefinition = "TEXT")
  private String signatureTitulaireUrl;

  /** Préréglage national appliqué en dernier ; null si l'en-tête a été saisi sans préréglage. */
  @Column(name = "prereglage_national_id")
  private Long prereglageNationalId;

  /** En-tête officiel du bulletin : république, devise nationale, ministère de tutelle et sigle. */
  private String republique;

  @Column(name = "devise_nationale")
  private String deviseNationale;

  private String ministere;

  @Column(name = "sigle_ministere")
  private String sigleMinistere;

  @Column(name = "autorite_regionale")
  private String autoriteRegionale;

  @Column(name = "pied_de_page")
  private String piedDePage;

  /** Copie les libellés d'un préréglage dans l'en-tête de l'établissement et mémorise son identifiant. */
  public void appliquer(PrereglageNational prereglage) {
    this.prereglageNationalId = prereglage.getId();
    this.republique = prereglage.getRepublique();
    this.deviseNationale = prereglage.getDevise();
    this.ministere = prereglage.getMinistere();
    this.sigleMinistere = prereglage.getSigleMinistere();
    this.autoriteRegionale = prereglage.getAutoriteRegionale();
    this.piedDePage = prereglage.getPiedDePage();
  }
}
