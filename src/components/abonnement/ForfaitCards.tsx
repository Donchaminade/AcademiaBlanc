import React from 'react';
import { FORFAIT_LABELS, tarifAffiche } from '../../utils/abonnement';
import type { Forfait } from '../../utils/abonnement';

interface ForfaitCardsProps {
  valeur: Forfait | null;
  onChange: (forfait: Forfait) => void;
  tarifMensuel: number;
  tarifAnnuel: number;
  devise?: string;
  /** Durée d'essai annoncée sous les cartes (0 pour ne rien afficher). */
  dureeEssaiJours?: number;
  disabled?: boolean;
}

interface Carte {
  forfait: Forfait;
  titre: string;
  duree: string;
  tarif: number;
  periode: string;
  points: string[];
  recommande: boolean;
}

/**
 * Choix du forfait : Annuel (mis en avant, « recommandé ») et Mensuel. Les tarifs viennent de `/api/public/offre` ;
 * tant qu'ils valent 0, « Tarif à confirmer » est affiché — aucun prix n'est inventé.
 */
export const ForfaitCards: React.FC<ForfaitCardsProps> = ({
  valeur,
  onChange,
  tarifMensuel,
  tarifAnnuel,
  devise = 'FCFA',
  dureeEssaiJours = 0,
  disabled = false,
}) => {
  const cartes: Carte[] = [
    {
      forfait: 'ANNUEL',
      titre: FORFAIT_LABELS.ANNUEL,
      duree: '12 mois d’accès',
      tarif: tarifAnnuel,
      periode: 'par an',
      points: ['Toutes les sessions d’examen blanc de l’année', 'Bulletins, PV et exports illimités', 'Un seul règlement mobile money'],
      recommande: true,
    },
    {
      forfait: 'MENSUEL',
      titre: FORFAIT_LABELS.MENSUEL,
      duree: '1 mois d’accès',
      tarif: tarifMensuel,
      periode: 'par mois',
      points: ['Idéal pour une session ponctuelle', 'Mêmes fonctions que l’annuel', 'Renouvelable à tout moment'],
      recommande: false,
    },
  ];

  return (
    <div className="space-y-3" data-testid="cartes-forfait">
      <div role="radiogroup" aria-label="Forfait" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {cartes.map((carte) => {
          const actif = valeur === carte.forfait;
          return (
            <button
              key={carte.forfait}
              type="button"
              role="radio"
              aria-checked={actif}
              disabled={disabled}
              onClick={() => onChange(carte.forfait)}
              data-testid={`carte-forfait-${carte.forfait.toLowerCase()}`}
              className={`relative text-left rounded-xl border-2 p-4 transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0051d5] disabled:opacity-60 ${
                actif
                  ? 'border-[#0051d5] bg-[#f2f3ff] shadow-md'
                  : carte.recommande
                    ? 'border-[#90a8ff] bg-white hover:border-[#0051d5]'
                    : 'border-[#eaedff] bg-white hover:border-[#90a8ff]'
              }`}
            >
              {carte.recommande && (
                <span className="absolute -top-2.5 left-4 rounded-full bg-[#00236f] text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 shadow-xs">
                  Recommandé
                </span>
              )}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[15px] font-bold text-[#00236f]">{carte.titre}</p>
                  <p className="text-[12px] text-[#444651]">{carte.duree}</p>
                </div>
                <span
                  aria-hidden="true"
                  className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${actif ? 'border-[#0051d5] bg-[#0051d5] text-white' : 'border-[#c5c5d3] bg-white'}`}
                >
                  {actif && <span className="material-symbols-outlined text-[14px]">check</span>}
                </span>
              </div>
              <p className="mt-3 text-[20px] font-bold text-[#131b2e] leading-none">
                {tarifAffiche(carte.tarif, devise)}
                {carte.tarif > 0 && <span className="ml-1 text-[12px] font-medium text-[#444651]">{carte.periode}</span>}
              </p>
              <ul className="mt-3 space-y-1 text-[12px] text-[#444651]">
                {carte.points.map((point) => (
                  <li key={point} className="flex items-start gap-1.5">
                    <span className="material-symbols-outlined text-[15px] text-[#0051d5] shrink-0" aria-hidden="true">check_circle</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>
      <p className="text-[12px] text-[#444651]">
        Paiement par mobile money, confirmé manuellement par la plateforme : votre espace s’ouvre dès validation.
        {dureeEssaiJours > 0 && ` Un essai de ${dureeEssaiJours} jours peut aussi vous être accordé sur demande.`}
      </p>
    </div>
  );
};
