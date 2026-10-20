/**
 * Machine à états des boutons « remplissage liquide » (référence @code.xr, reel Dc7xjbKTa7h).
 * repos → chargement → succès | erreur → repos (après DELAI_RETOUR_REPOS_MS).
 */
export type EtatLiquide = 'repos' | 'chargement' | 'succes' | 'erreur';
export type EvenementLiquide = 'cliquer' | 'resoudre' | 'rejeter' | 'reinitialiser';

/** Retour automatique au repos après succès ou erreur. */
export const DELAI_RETOUR_REPOS_MS = 2_500;
/** Laisse le temps d'afficher l'état de chargement avant une action synchrone (impression, CSV). */
export const DELAI_AVANT_ACTION_MS = 350;
/** Durée minimale de chargement pour que le remplissage soit perceptible. */
export const DUREE_MIN_CHARGEMENT_MS = 700;

export function transition(etat: EtatLiquide, evenement: EvenementLiquide): EtatLiquide {
  switch (evenement) {
    case 'cliquer':
      return etat === 'repos' ? 'chargement' : etat;
    case 'resoudre':
      return etat === 'chargement' ? 'succes' : etat;
    case 'rejeter':
      return etat === 'chargement' ? 'erreur' : etat;
    case 'reinitialiser':
      return etat === 'succes' || etat === 'erreur' ? 'repos' : etat;
  }
}

/** Le bouton n'accepte un clic qu'au repos (pas de double envoi). */
export function peutDeclencher(etat: EtatLiquide): boolean {
  return etat === 'repos';
}

/**
 * Progression simulée (0 → 0,9) quand la progression réelle est inconnue : approche asymptotique,
 * le remplissage ne se termine qu'à la résolution de la promesse.
 */
export function progressionSimulee(msEcoulees: number): number {
  if (msEcoulees <= 0) return 0;
  return Math.min(0.9, 0.9 * (1 - Math.exp(-msEcoulees / 900)));
}

/** Hauteur du remplissage (0 → 1) pour un état et une progression donnés. */
export function niveauRemplissage(etat: EtatLiquide, progression: number): number {
  if (etat === 'succes') return 1;
  if (etat === 'chargement') return Math.max(0, Math.min(1, progression));
  return 0;
}

/**
 * Exécute l'action et traduit son issue : promesse résolue / valeur quelconque → succès ;
 * promesse rejetée, exception ou `false` explicite (ex. impression bloquée) → erreur.
 */
export async function executerAction(action: () => unknown): Promise<'resoudre' | 'rejeter'> {
  try {
    const resultat = await action();
    return resultat === false ? 'rejeter' : 'resoudre';
  } catch {
    return 'rejeter';
  }
}
