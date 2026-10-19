/** Règles pures de la case « J'ai lu et j'accepte… » (testables sans DOM). */

export interface EtatSoumissionInscription {
  /** Case d'acceptation cochée. */
  accepte: boolean;
  /** Appel au serveur en cours. */
  enCours: boolean;
}

/** Le bouton « Créer le compte » est désactivé tant que la case n'est pas cochée, et pendant l'appel. */
export function boutonInscriptionDesactive({ accepte, enCours }: EtatSoumissionInscription): boolean {
  return !accepte || enCours;
}

export const MESSAGE_ACCEPTATION_REQUISE =
  'Vous devez accepter les Conditions générales d’utilisation, les Conditions d’utilisation et la Politique de confidentialité.';

/** Libellé exact de la case, pour les tests et les captures. */
export const LIBELLE_ACCEPTATION =
  'J’ai lu et j’accepte les Conditions générales d’utilisation, les Conditions d’utilisation et la Politique de confidentialité';
