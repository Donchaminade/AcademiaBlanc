package tg.academiablanc.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Ligne de l'historique d'abonnement d'un établissement (essai, activation, prolongation, suspension,
 * réactivation, déclaration de paiement, expiration). Toutes les dates sont en UTC.
 */
@Entity
@Table(name = "evenement_abonnement")
@Getter
@Setter
@NoArgsConstructor
public class EvenementAbonnement {
  /** Déclaration de paiement reçue de l'établissement, pas encore traitée par le super admin. */
  public static final String STATUT_A_VERIFIER = "A_VERIFIER";
  /** Déclaration rapprochée d'une activation. */
  public static final String STATUT_TRAITEE = "TRAITEE";

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "etablissement_id", nullable = false)
  private Long etablissementId;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private TypeEvenementAbonnement type;

  @Enumerated(EnumType.STRING)
  private Forfait forfait;

  /** Montant en FCFA (entier) ; null quand l'événement n'est pas un paiement. */
  private Long montant;

  /** Référence de la transaction mobile money. */
  private String reference;

  /** Flooz, T-Money, Mixx by Yas, Orange Money, MTN MoMo, Wave, Autre. */
  @Column(name = "operateur_mobile")
  private String operateurMobile;

  @Column(name = "periode_debut")
  private Instant periodeDebut;

  @Column(name = "periode_fin")
  private Instant periodeFin;

  /** Email du compte à l'origine de l'action (super admin, responsable de l'établissement) ou « système ». */
  private String acteur;

  private String note;

  /** Pour une déclaration de paiement : A_VERIFIER puis TRAITEE. */
  private String statut;

  /** Date du paiement déclarée par l'établissement. */
  @Column(name = "date_paiement")
  private Instant datePaiement;

  @Column(name = "cree_le", nullable = false)
  private Instant creeLe;
}
