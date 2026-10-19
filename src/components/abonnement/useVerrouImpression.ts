import { useSyncExternalStore } from 'react';
import { instantaneVerrouImpression, onVerrouImpressionChange } from '../../utils/verrouImpression';

export interface VerrouImpression {
  /** Vrai quand l'impression et les téléchargements sont désactivés (abonnement expiré ou suspendu). */
  verrouille: boolean;
  /** Explication affichée en infobulle sur les boutons grisés. */
  motif: string;
}

/**
 * Suit la garde d'impression posée par l'état d'abonnement reçu du serveur. Les boutons Imprimer / PDF / CSV
 * l'utilisent pour se griser avec une explication plutôt que de disparaître.
 */
export function useVerrouImpression(): VerrouImpression {
  const instantane = useSyncExternalStore(onVerrouImpressionChange, instantaneVerrouImpression, instantaneVerrouImpression);
  const [actif, ...reste] = instantane.split('|');
  return { verrouille: actif === '1', motif: reste.join('|') };
}

/** Classes et attributs à poser sur un bouton d'impression / export quand la garde est active. */
export function attributsBoutonVerrouille(verrou: VerrouImpression, titreNormal: string) {
  return {
    disabled: verrou.verrouille,
    'aria-disabled': verrou.verrouille || undefined,
    title: verrou.verrouille ? verrou.motif : titreNormal,
    'data-verrouille': verrou.verrouille ? 'true' : undefined,
  } as const;
}

/** Classe ajoutée aux boutons grisés par la garde (cohérente sur toutes les pages). */
export const CLASSE_BOUTON_VERROUILLE = 'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-inherit disabled:active:scale-100';
