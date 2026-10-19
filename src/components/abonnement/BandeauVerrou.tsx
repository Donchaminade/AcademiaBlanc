import React from 'react';
import { messageVerrou, tarifDuForfait } from '../../utils/abonnement';
import type { EtatAbonnement } from '../../utils/abonnement';
import { ContactsPaiement } from './ContactsPaiement';

interface BandeauVerrouProps {
  etat: EtatAbonnement | null;
  nomEtablissement: string;
  /** Ouvre la page Abonnement (déclaration de paiement, historique). */
  onOuvrirAbonnement: () => void;
}

/**
 * Bandeau rouge persistant quand l'espace est en lecture seule (abonnement expiré après la période de grâce,
 * ou suspendu) : « Abonnement expiré — réglez pour réactiver », avec les contacts WhatsApp / appel et l'accès
 * à la page Abonnement. Rien n'est affiché pour un compte plateforme ou un abonnement en règle.
 */
export const BandeauVerrou: React.FC<BandeauVerrouProps> = ({ etat, nomEtablissement, onOuvrirAbonnement }) => {
  const message = messageVerrou(etat);
  if (!etat || !message) return null;
  const forfait = etat.forfait ?? etat.forfaitChoisi ?? 'ANNUEL';
  return (
    <div
      role="alert"
      data-testid="bandeau-verrou"
      className="no-print bg-[#b3261e] text-white border-b border-[#8c1d17] px-3 py-2.5 md:px-6 flex flex-col md:flex-row md:items-center md:justify-between gap-2.5"
    >
      <div className="flex items-start gap-2.5 min-w-0">
        <span className="material-symbols-outlined text-xl shrink-0 mt-0.5" aria-hidden="true">lock</span>
        <div className="min-w-0">
          <p className="text-[13px] font-bold leading-tight">{message}</p>
          <p className="text-[11.5px] text-white/85 leading-tight mt-0.5">
            Vos données restent consultables ; la saisie, l’impression et les téléchargements sont désactivés jusqu’à réactivation.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 md:justify-end shrink-0">
        <ContactsPaiement
          compact
          surFondSombre
          telWhatsapp={etat.contacts.telWhatsapp}
          telAppel={etat.contacts.telAppel}
          nomEtablissement={nomEtablissement}
          forfait={forfait}
          montant={tarifDuForfait(forfait, etat.contacts)}
          devise={etat.contacts.devise}
        />
        <button
          type="button"
          onClick={onOuvrirAbonnement}
          className="inline-flex items-center gap-1.5 rounded-lg bg-white text-[#b3261e] px-3 py-1.5 text-[12px] font-bold hover:bg-red-50 transition-colors"
          data-testid="bandeau-ouvrir-abonnement"
        >
          <span className="material-symbols-outlined text-base" aria-hidden="true">credit_card</span>
          <span>Régler / déclarer un paiement</span>
        </button>
      </div>
    </div>
  );
};
