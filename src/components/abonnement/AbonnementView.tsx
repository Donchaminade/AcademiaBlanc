import React, { useEffect, useState } from 'react';
import { chargerHistoriqueAbonnement, rafraichirAbonnement } from '../../api/abonnement';
import {
  FORFAIT_LABELS,
  STATUT_LABELS,
  badgeAbonnement,
  formatDateFr,
  tarifAffiche,
  tarifDuForfait,
} from '../../utils/abonnement';
import type { EtatAbonnement, EvenementAbonnement } from '../../utils/abonnement';
import { ContactsPaiement } from './ContactsPaiement';
import { DeclarationPaiementForm } from './DeclarationPaiementForm';
import { HistoriqueAbonnement } from './HistoriqueAbonnement';

interface AbonnementViewProps {
  etat: EtatAbonnement | null;
  nomEtablissement: string;
  /** Le compte peut déclarer un paiement (OWNER / ADMIN). */
  peutDeclarer: boolean;
}

const TON_CARTE: Record<string, string> = {
  vert: 'border-emerald-200 bg-emerald-50',
  orange: 'border-amber-300 bg-amber-50',
  rouge: 'border-red-300 bg-red-50',
  neutre: 'border-[#dce1ff] bg-[#f2f3ff]',
};

/**
 * Page « Abonnement » de l'établissement : statut, forfait, échéance et jours restants (calculés par le serveur),
 * contacts WhatsApp / appel, déclaration de paiement et historique propre à l'établissement.
 */
export const AbonnementView: React.FC<AbonnementViewProps> = ({ etat, nomEtablissement, peutDeclarer }) => {
  const [historique, setHistorique] = useState<EvenementAbonnement[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [declarer, setDeclarer] = useState(false);
  const [rafraichissement, setRafraichissement] = useState(false);

  const charger = () => {
    setChargement(true);
    setErreur('');
    chargerHistoriqueAbonnement()
      .then(setHistorique)
      .catch((err: Error) => setErreur(err.message || 'Historique indisponible.'))
      .finally(() => setChargement(false));
  };

  useEffect(charger, []);

  const verifier = async () => {
    setRafraichissement(true);
    try {
      await rafraichirAbonnement();
      charger();
    } finally {
      setRafraichissement(false);
    }
  };

  if (!etat || etat.plateforme) {
    return (
      <div className="p-4 md:p-8 max-w-3xl mx-auto">
        <div className="bg-white border border-[#eaedff] rounded p-6 text-[13px] text-[#444651]">
          Aucun abonnement à afficher pour ce compte.
        </div>
      </div>
    );
  }

  const badge = badgeAbonnement(etat);
  const forfait = etat.forfait ?? etat.forfaitChoisi ?? 'ANNUEL';
  const montant = tarifDuForfait(forfait, etat.contacts);
  const jours = etat.joursRestants ?? 0;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-4 md:space-y-6" data-testid="page-abonnement">
      <div className="bg-white rounded p-4 md:p-6 shadow-sm border border-[#eaedff] flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#0051d5] bg-[#eaedff] px-2.5 py-1 rounded">Abonnement</span>
          <h2 className="text-[18px] md:text-[22px] font-bold text-[#00236f] mt-1.5">Mon abonnement AcademiaBlanc</h2>
          <p className="text-[13px] text-[#444651] mt-0.5">{nomEtablissement}</p>
        </div>
        <button
          type="button"
          onClick={() => void verifier()}
          disabled={rafraichissement}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded bg-[#f2f3ff] text-[#00236f] text-[12px] font-semibold hover:bg-[#e2e7ff] transition-colors disabled:opacity-60"
          data-testid="bouton-verifier-activation"
        >
          <span className={`material-symbols-outlined text-base ${rafraichissement ? 'animate-spin' : ''}`} aria-hidden="true">{rafraichissement ? 'progress_activity' : 'refresh'}</span>
          <span>Vérifier mon activation</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className={`rounded-lg border p-4 ${TON_CARTE[badge?.ton ?? 'neutre']}`} data-testid="carte-statut">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#444651]">Statut</p>
          <p className="mt-1 text-[18px] font-bold text-[#131b2e]">{STATUT_LABELS[etat.statut]}</p>
          {badge && <p className="text-[12px] text-[#444651] mt-0.5">{badge.libelle}</p>}
          {etat.enGrace && <p className="text-[11px] font-semibold text-amber-900 mt-1">Période de grâce en cours</p>}
        </div>
        <div className="rounded-lg border border-[#eaedff] bg-white p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#444651]">Forfait</p>
          <p className="mt-1 text-[18px] font-bold text-[#131b2e]">{FORFAIT_LABELS[forfait]}{etat.forfait ? '' : ' (choisi)'}</p>
          <p className="text-[12px] text-[#444651] mt-0.5">{tarifAffiche(montant, etat.contacts.devise)}</p>
        </div>
        <div className="rounded-lg border border-[#eaedff] bg-white p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#444651]">Échéance</p>
          <p className="mt-1 text-[18px] font-bold text-[#131b2e]">{formatDateFr(etat.echeance) || '—'}</p>
          <p className="text-[12px] text-[#444651] mt-0.5">
            {etat.echeance ? (jours > 0 ? `${jours} jour${jours > 1 ? 's' : ''} restant${jours > 1 ? 's' : ''}` : 'Échue') : 'Aucune période en cours'}
            {etat.fin && etat.echeance && etat.fin !== etat.echeance ? ` · fin de période le ${formatDateFr(etat.fin)}` : ''}
          </p>
        </div>
      </div>

      {etat.message && (
        <p className={`rounded-lg border px-4 py-3 text-[13px] font-semibold ${etat.lectureSeule ? 'bg-red-50 border-red-200 text-red-800' : 'bg-[#f2f3ff] border-[#dce1ff] text-[#00236f]'}`}>
          {etat.message}
        </p>
      )}

      <section className="bg-white rounded border border-[#eaedff] shadow-xs p-4 md:p-5 space-y-3">
        <header className="flex items-start gap-3">
          <span className="shrink-0 w-9 h-9 rounded bg-[#eaedff] text-[#0051d5] flex items-center justify-center">
            <span className="material-symbols-outlined text-xl" aria-hidden="true">payments</span>
          </span>
          <div>
            <h3 className="text-[14px] font-bold text-[#00236f] uppercase tracking-wide">Régler ou renouveler</h3>
            <p className="text-[12px] text-[#444651] mt-0.5">
              Réglez le forfait par mobile money puis déclarez votre paiement : la plateforme vérifie et active votre espace.
              Un règlement pendant un abonnement actif prolonge la période à partir de l’échéance en cours.
            </p>
          </div>
        </header>
        <ContactsPaiement
          telWhatsapp={etat.contacts.telWhatsapp}
          telAppel={etat.contacts.telAppel}
          beneficiaire={etat.contacts.beneficiaire}
          instructions={etat.contacts.instructions}
          nomEtablissement={nomEtablissement}
          forfait={forfait}
          montant={montant}
          devise={etat.contacts.devise}
        />
        {peutDeclarer && !declarer && (
          <button
            type="button"
            onClick={() => setDeclarer(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#00236f] text-white text-[13px] font-bold hover:bg-[#1e3a8a] transition-colors shadow-xs"
            data-testid="bouton-ouvrir-declaration"
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">task_alt</span>
            <span>J’ai effectué le paiement</span>
          </button>
        )}
        {peutDeclarer && declarer && (
          <div className="rounded-lg border border-[#eaedff] bg-[#faf8ff] p-4">
            <DeclarationPaiementForm
              forfaitParDefaut={forfait}
              offre={etat.contacts}
              onAnnuler={() => setDeclarer(false)}
              onDeclare={() => {
                setDeclarer(false);
                charger();
              }}
            />
          </div>
        )}
        {!peutDeclarer && (
          <p className="text-[12px] text-[#444651]">Seul le responsable de l’établissement (ou un administrateur) peut déclarer un paiement.</p>
        )}
      </section>

      <section className="bg-white rounded border border-[#eaedff] shadow-xs p-4 md:p-5 space-y-3">
        <h3 className="text-[14px] font-bold text-[#00236f] uppercase tracking-wide">Historique</h3>
        {chargement && <p className="text-[13px] text-[#444651]">Chargement…</p>}
        {!chargement && erreur && <p className="text-[13px] text-[#ba1a1a]">{erreur}</p>}
        {!chargement && !erreur && <HistoriqueAbonnement evenements={historique} />}
      </section>
    </div>
  );
};
