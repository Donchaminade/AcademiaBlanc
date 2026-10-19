package tg.academiablanc.domain;

/** Nature d'une ligne de l'historique d'abonnement. */
public enum TypeEvenementAbonnement {
  ESSAI,
  ACTIVATION,
  PROLONGATION,
  SUSPENSION,
  REACTIVATION,
  DECLARATION_PAIEMENT,
  EXPIRATION;

  public String libelle() {
    return switch (this) {
      case ESSAI -> "Mode essai";
      case ACTIVATION -> "Activation";
      case PROLONGATION -> "Prolongation";
      case SUSPENSION -> "Suspension";
      case REACTIVATION -> "Réactivation";
      case DECLARATION_PAIEMENT -> "Déclaration de paiement";
      case EXPIRATION -> "Expiration";
    };
  }
}
