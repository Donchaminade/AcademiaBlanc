import React from 'react';
import {
  FORFAIT_LABELS,
  TYPE_EVENEMENT_LABELS,
  formatDateFr,
  formatDateHeureFr,
  formatFcfa,
  libelleStatutDeclaration,
} from '../../utils/abonnement';
import type { EvenementAbonnement } from '../../utils/abonnement';

interface HistoriqueAbonnementProps {
  evenements: EvenementAbonnement[];
  /** Colonne « Établissement » (vue plateforme). */
  avecEtablissement?: boolean;
  /** Colonne « Acteur » (vue plateforme : opérateur = super admin). */
  avecActeur?: boolean;
  vide?: string;
  /** Action proposée sur une déclaration « À vérifier » (plateforme : Activer pré-rempli). */
  onTraiter?: (ev: EvenementAbonnement) => void;
}

const ICONES: Record<string, string> = {
  ESSAI: 'hourglass_top',
  ACTIVATION: 'check_circle',
  PROLONGATION: 'update',
  SUSPENSION: 'pause_circle',
  REACTIVATION: 'play_circle',
  DECLARATION_PAIEMENT: 'receipt_long',
  EXPIRATION: 'event_busy',
};

/** Tableau d'historique partagé : page Abonnement de l'établissement et onglet Paiements de la plateforme. */
export const HistoriqueAbonnement: React.FC<HistoriqueAbonnementProps> = ({
  evenements,
  avecEtablissement = false,
  avecActeur = false,
  vide = 'Aucun événement pour le moment.',
  onTraiter,
}) => {
  if (evenements.length === 0) {
    return <p className="text-[13px] text-[#444651] italic px-1 py-2">{vide}</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-[#eaedff]">
      <table className="w-full min-w-[720px] text-left text-[12.5px]" data-testid="historique-abonnement">
        <thead className="bg-[#f2f3ff] text-[11px] uppercase tracking-wider text-[#444651]">
          <tr>
            <th className="px-3 py-2.5 font-semibold">Date</th>
            {avecEtablissement && <th className="px-3 py-2.5 font-semibold">Établissement</th>}
            <th className="px-3 py-2.5 font-semibold">Type</th>
            <th className="px-3 py-2.5 font-semibold">Forfait</th>
            <th className="px-3 py-2.5 font-semibold text-right">Montant</th>
            <th className="px-3 py-2.5 font-semibold">Référence</th>
            <th className="px-3 py-2.5 font-semibold">Période</th>
            {avecActeur && <th className="px-3 py-2.5 font-semibold">Opérateur</th>}
            <th className="px-3 py-2.5 font-semibold">Note</th>
          </tr>
        </thead>
        <tbody>
          {evenements.map((ev) => {
            const declaration = ev.type === 'DECLARATION_PAIEMENT';
            const aVerifier = declaration && ev.statut === 'A_VERIFIER';
            return (
              <tr key={ev.id} className={`border-t border-[#eaedff] align-top ${aVerifier ? 'bg-amber-50/60' : ''}`}>
                <td className="px-3 py-2.5 whitespace-nowrap text-[#131b2e]">{formatDateHeureFr(ev.creeLe)}</td>
                {avecEtablissement && <td className="px-3 py-2.5 font-semibold text-[#00236f]">{ev.etablissementNom ?? '—'}</td>}
                <td className="px-3 py-2.5">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-[#131b2e]">
                    <span className="material-symbols-outlined text-base text-[#0051d5]" aria-hidden="true">{ICONES[ev.type] ?? 'info'}</span>
                    <span>{TYPE_EVENEMENT_LABELS[ev.type] ?? ev.typeLibelle}</span>
                  </span>
                  {declaration && ev.statut && (
                    <span className={`ml-1.5 inline-flex items-center text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full ${aVerifier ? 'bg-amber-100 text-amber-900' : 'bg-[#dcfce7] text-[#166534]'}`}>
                      {libelleStatutDeclaration(ev.statut)}
                    </span>
                  )}
                  {ev.operateurMobile && <p className="text-[11px] text-[#444651] mt-0.5">{ev.operateurMobile}</p>}
                  {onTraiter && aVerifier && (
                    <button
                      type="button"
                      onClick={() => onTraiter(ev)}
                      className="mt-1.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#00236f] text-white text-[12px] font-bold hover:bg-[#1e3a8a] transition-colors"
                      data-testid={`traiter-declaration-${ev.id}`}
                    >
                      <span className="material-symbols-outlined text-base" aria-hidden="true">verified</span>
                      Activer
                    </button>
                  )}
                </td>
                <td className="px-3 py-2.5">{ev.forfait ? FORFAIT_LABELS[ev.forfait] : '—'}</td>
                <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap">{ev.montant != null && ev.montant > 0 ? formatFcfa(ev.montant) : '—'}</td>
                <td className="px-3 py-2.5 font-mono text-[12px] break-all">{ev.reference || '—'}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  {ev.periodeDebut || ev.periodeFin ? `${formatDateFr(ev.periodeDebut)} → ${formatDateFr(ev.periodeFin)}` : '—'}
                </td>
                {avecActeur && <td className="px-3 py-2.5 text-[#444651] break-all">{ev.acteur || '—'}</td>}
                <td className="px-3 py-2.5 text-[#444651] max-w-[260px]">{ev.note || '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
