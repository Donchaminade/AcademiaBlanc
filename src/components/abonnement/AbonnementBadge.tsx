import React from 'react';
import { badgeAbonnement } from '../../utils/abonnement';
import type { EtatAbonnement, TonBadge } from '../../utils/abonnement';

interface AbonnementBadgeProps {
  etat: EtatAbonnement | null;
  /** Ouvre la page Abonnement de l'établissement. */
  onClick?: () => void;
  /** En-tête mobile : texte court, hauteur réduite. */
  compact?: boolean;
}

const TONS: Record<TonBadge, string> = {
  vert: 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100',
  orange: 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100',
  rouge: 'bg-red-50 text-red-800 border-red-300 hover:bg-red-100',
  neutre: 'bg-[#f2f3ff] text-[#00236f] border-[#dce1ff] hover:bg-[#eaedff]',
};

const ICONES: Record<TonBadge, string> = {
  vert: 'hourglass_top',
  orange: 'schedule',
  rouge: 'lock_clock',
  neutre: 'verified',
};

/**
 * Pastille d'abonnement affichée en haut de chaque page connectée : « Essai — J-12 » (vert, rouge les 3 derniers
 * jours) ou « Abonnement jusqu'au 22/11/2026 » (discret, orange à J-7, rouge à J-3). Les couleurs ne dépendent que
 * des jours restants calculés par le serveur. Un clic ouvre la page Abonnement.
 */
export const AbonnementBadge: React.FC<AbonnementBadgeProps> = ({ etat, onClick, compact = false }) => {
  const badge = badgeAbonnement(etat);
  if (!badge) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      title={badge.titre}
      aria-label={`${badge.libelle}. Ouvrir la page Abonnement`}
      data-testid="badge-abonnement"
      data-ton={badge.ton}
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full border font-semibold transition-colors ${TONS[badge.ton]} ${
        compact ? 'h-8 px-2.5 text-[11px]' : 'px-3 py-1.5 text-[12px]'
      }`}
    >
      <span className="material-symbols-outlined text-base shrink-0" aria-hidden="true">{ICONES[badge.ton]}</span>
      <span className="truncate">{compact ? badge.court : badge.libelle}</span>
    </button>
  );
};
