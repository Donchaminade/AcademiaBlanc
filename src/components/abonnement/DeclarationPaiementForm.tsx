import React, { useState } from 'react';
import { declarerPaiement } from '../../api/abonnement';
import { FORFAIT_LABELS, OPERATEURS_MOBILE, tarifDuForfait } from '../../utils/abonnement';
import type { ContactsAbonnement, EvenementAbonnement, Forfait } from '../../utils/abonnement';
import { showError, toastSuccess } from '../../utils/alerts';

interface DeclarationPaiementFormProps {
  forfaitParDefaut: Forfait | null;
  offre: Pick<ContactsAbonnement, 'tarifMensuel' | 'tarifAnnuel' | 'devise'>;
  onDeclare?: (evenement: EvenementAbonnement) => void;
  onAnnuler?: () => void;
}

const field = 'w-full bg-[#f2f3ff] text-[13px] py-2 px-3 rounded-lg border border-[#eaedff] outline-none focus:bg-white focus:border-[#0051d5]';
const label = 'block text-[11px] font-bold uppercase tracking-wide text-[#444651] mb-1';

const aujourdhuiIso = (): string => new Date().toISOString().slice(0, 10);

/**
 * « J'ai effectué le paiement » : l'établissement déclare son versement mobile money (forfait, montant, référence,
 * opérateur, date). La déclaration apparaît côté super admin avec le statut « À vérifier » et pré-remplit son
 * bouton Activer. Toujours autorisée, même en lecture seule.
 */
export const DeclarationPaiementForm: React.FC<DeclarationPaiementFormProps> = ({ forfaitParDefaut, offre, onDeclare, onAnnuler }) => {
  const [forfait, setForfait] = useState<Forfait>(forfaitParDefaut ?? 'ANNUEL');
  const [montant, setMontant] = useState<string>(() => {
    const tarif = tarifDuForfait(forfaitParDefaut ?? 'ANNUEL', offre);
    return tarif > 0 ? String(tarif) : '';
  });
  const [reference, setReference] = useState('');
  const [operateur, setOperateur] = useState<string>(OPERATEURS_MOBILE[0]);
  const [datePaiement, setDatePaiement] = useState(aujourdhuiIso);
  const [note, setNote] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');

  const changerForfait = (next: Forfait) => {
    setForfait(next);
    const tarif = tarifDuForfait(next, offre);
    if (tarif > 0) setMontant(String(tarif));
  };

  const soumettre = async (e: React.FormEvent) => {
    e.preventDefault();
    if (envoi) return;
    setErreur('');
    const valeur = Number(montant);
    if (!Number.isFinite(valeur) || valeur <= 0) {
      setErreur('Indiquez le montant versé (en FCFA, supérieur à 0).');
      return;
    }
    setEnvoi(true);
    try {
      const evenement = await declarerPaiement({
        forfait,
        montant: Math.round(valeur),
        reference: reference.trim() || undefined,
        operateur,
        datePaiement: datePaiement ? new Date(`${datePaiement}T00:00:00Z`).toISOString() : undefined,
        note: note.trim() || undefined,
      });
      toastSuccess('Paiement déclaré : la plateforme va le vérifier et activer votre abonnement.');
      onDeclare?.(evenement);
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : 'Déclaration impossible pour le moment.';
      setErreur(message);
      await showError('Déclaration non enregistrée', message);
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <form onSubmit={(e) => void soumettre(e)} className="space-y-3" aria-busy={envoi} data-testid="formulaire-declaration">
      {erreur && (
        <p role="alert" className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-[12px] font-semibold px-3 py-2">{erreur}</p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={label} htmlFor="declaration-forfait">Forfait réglé</label>
          <select id="declaration-forfait" value={forfait} onChange={(e) => changerForfait(e.target.value as Forfait)} className={field}>
            <option value="ANNUEL">{FORFAIT_LABELS.ANNUEL}</option>
            <option value="MENSUEL">{FORFAIT_LABELS.MENSUEL}</option>
          </select>
        </div>
        <div>
          <label className={label} htmlFor="declaration-montant">Montant versé ({offre.devise || 'FCFA'})</label>
          <input
            id="declaration-montant"
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            required
            value={montant}
            onChange={(e) => setMontant(e.target.value)}
            className={`${field} font-mono`}
            placeholder="Ex : 15000"
          />
        </div>
        <div>
          <label className={label} htmlFor="declaration-operateur">Opérateur mobile money</label>
          <select id="declaration-operateur" value={operateur} onChange={(e) => setOperateur(e.target.value)} className={field}>
            {OPERATEURS_MOBILE.map((op) => <option key={op} value={op}>{op}</option>)}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="declaration-date">Date du paiement</label>
          <input id="declaration-date" type="date" value={datePaiement} onChange={(e) => setDatePaiement(e.target.value)} className={field} />
        </div>
        <div className="sm:col-span-2">
          <label className={label} htmlFor="declaration-reference">Référence de la transaction</label>
          <input
            id="declaration-reference"
            type="text"
            maxLength={120}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            className={`${field} font-mono`}
            placeholder="Identifiant reçu par SMS après le transfert"
          />
        </div>
        <div className="sm:col-span-2">
          <label className={label} htmlFor="declaration-note">Note (facultatif)</label>
          <textarea id="declaration-note" maxLength={1000} rows={2} value={note} onChange={(e) => setNote(e.target.value)} className={field} placeholder="Numéro émetteur, précision utile…" />
        </div>
      </div>
      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
        {onAnnuler && (
          <button type="button" onClick={onAnnuler} className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#f2f3ff] text-[#444651] text-[12px] font-semibold hover:bg-[#e2e7ff] transition-colors">
            Annuler
          </button>
        )}
        <button
          type="submit"
          disabled={envoi}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#00236f] text-white text-[12px] font-bold hover:bg-[#1e3a8a] transition-colors shadow-xs disabled:opacity-60 disabled:cursor-wait"
          data-testid="bouton-declarer-paiement"
        >
          <span className={`material-symbols-outlined text-base ${envoi ? 'animate-spin' : ''}`} aria-hidden="true">{envoi ? 'progress_activity' : 'task_alt'}</span>
          <span>{envoi ? 'Envoi…' : 'J’ai effectué le paiement'}</span>
        </button>
      </div>
    </form>
  );
};
