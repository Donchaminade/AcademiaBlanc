package tg.academiablanc.domain;

/** Statut d'abonnement d'un établissement, tel qu'enregistré ; le statut effectif tient compte des dates. */
public enum StatutAbonnement {
  /** Inscrit, forfait choisi, aucun paiement reçu : aucun accès à l'application tant qu'il n'est pas activé. */
  EN_ATTENTE_PAIEMENT,
  /** Essai gratuit en cours (durée paramétrable, 14 jours par défaut). */
  ESSAI,
  /** Abonnement payé, période en cours (grâce comprise). */
  ACTIF,
  /** Période et grâce dépassées : connexion possible, données en lecture seule. */
  EXPIRE,
  /** Suspendu par la plateforme : lecture seule jusqu'à réactivation. */
  SUSPENDU;

  public String libelle() {
    return switch (this) {
      case EN_ATTENTE_PAIEMENT -> "En attente de paiement";
      case ESSAI -> "Essai";
      case ACTIF -> "Actif";
      case EXPIRE -> "Expiré";
      case SUSPENDU -> "Suspendu";
    };
  }
}
