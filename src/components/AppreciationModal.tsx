import React, { useState } from 'react';
import { Candidate, Subject } from '../types';
import {
  APPRECIATION_LONGUEUR_MAX,
  appreciationManuelleValide,
  appreciationSelonNote,
  normaliserAppreciationManuelle,
} from '../utils/appreciation';

interface AppreciationModalProps {
  candidate: Candidate;
  subject: Subject;
  /** Enregistre le texte libre ; chaîne vide = retour à l'appréciation automatique. Résout `false` en cas de refus. */
  onSave: (appreciation: string) => Promise<boolean>;
  onClose: () => void;
  usingApi?: boolean;
}

/**
 * Saisie de l'appréciation du professeur pour une matière d'un élève : texte libre (≤ 60 caractères)
 * qui remplace sur le bulletin l'appréciation automatique calculée sur la note, ou retour à celle-ci.
 */
export const AppreciationModal: React.FC<AppreciationModalProps> = ({ candidate, subject, onSave, onClose, usingApi = false }) => {
  const grade = candidate.grades[subject.id];
  const manuelleActuelle = normaliserAppreciationManuelle(grade?.appreciation);
  const [texte, setTexte] = useState(manuelleActuelle);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const automatique = appreciationSelonNote(grade?.score);
  const normalise = normaliserAppreciationManuelle(texte);
  const longueur = normalise.length;
  const valide = appreciationManuelleValide(normalise);
  const inchange = normalise === manuelleActuelle;

  const enregistrer = async (valeur: string) => {
    setErreur(null);
    setEnvoi(true);
    const ok = await onSave(valeur);
    setEnvoi(false);
    if (ok) {
      onClose();
    } else {
      setErreur(usingApi ? 'Le serveur a refusé l’enregistrement : appréciation non modifiée.' : 'Appréciation non enregistrée.');
    }
  };

  return (
    <div className="modal-overlay fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50" role="dialog" aria-modal="true" aria-labelledby="appreciation-titre">
      <form
        className="modal-panel bg-white rounded-lg shadow-xl max-w-md w-full p-6 border border-[#eaedff] space-y-4"
        onSubmit={(e) => { e.preventDefault(); if (valide && !envoi) void enregistrer(normalise); }}
      >
        <div className="flex items-center justify-between pb-2 border-b border-[#eaedff]">
          <div className="flex items-center gap-2 text-[#00236f]">
            <span className="material-symbols-outlined text-xl">rate_review</span>
            <span id="appreciation-titre" className="font-bold text-[15px]">Appréciation du professeur</span>
          </div>
          <button type="button" onClick={onClose} className="text-[#444651] hover:text-[#131b2e]" aria-label="Fermer">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div>
          <p className="text-[13px] text-[#131b2e] font-semibold">
            {candidate.fullName} (Table {candidate.tableNumber})
          </p>
          <p className="text-[12px] text-[#444651] mt-0.5">
            {subject.name} — note :{' '}
            <span className="font-mono font-bold text-[#00236f]">{grade ? `${grade.score.toFixed(2)}/20` : '—'}</span>
            {' · '}appréciation automatique :{' '}
            <span className="italic font-semibold text-[#131b2e]" data-testid="appreciation-automatique">{automatique}</span>
          </p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="appreciation-texte" className="block text-[11px] font-bold text-[#444651] uppercase">
            Texte libre porté sur le bulletin (facultatif)
          </label>
          <input
            id="appreciation-texte"
            type="text"
            autoFocus
            value={texte}
            maxLength={APPRECIATION_LONGUEUR_MAX + 20}
            disabled={envoi}
            placeholder={automatique}
            onChange={(e) => setTexte(e.target.value)}
            className={`w-full px-3 py-2 rounded border text-[13px] outline-none focus:border-[#0051d5] ${
              valide ? 'border-[#eaedff] bg-white' : 'border-[#ba1a1a] bg-[#ffdad6]/40'
            }`}
          />
          <div className="flex items-center justify-between text-[11px]">
            <span className={valide ? 'text-[#444651]' : 'text-[#ba1a1a] font-semibold'}>
              {longueur}/{APPRECIATION_LONGUEUR_MAX} caractères
            </span>
            <span className="text-[#444651] italic">
              {manuelleActuelle ? 'Texte libre en place' : 'Appréciation automatique en place'}
            </span>
          </div>
          {erreur && <p className="text-[12px] text-[#ba1a1a] font-semibold">{erreur}</p>}
        </div>

        <p className="text-[11px] text-[#444651] italic leading-snug">
          Vide, l’appréciation suit la note : [0;5[ Très insuffisant · [5;8[ Insuffisant · [8;10[ Mauvais · [10;12[ Passable ·
          [12;14[ Assez bien · [14;16[ Bien · [16;18[ Très bien · [18;20] Excellent.
        </p>

        <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#eaedff]">
          <button
            type="button"
            disabled={envoi || !manuelleActuelle}
            onClick={() => void enregistrer('')}
            className="px-3 py-1.5 rounded text-[12px] font-semibold text-[#00236f] hover:bg-[#eaedff] disabled:opacity-40 disabled:hover:bg-transparent flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[16px]">restart_alt</span>
            Rétablir l’automatique
          </button>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="px-3 py-1.5 rounded text-[12px] text-[#444651] hover:bg-[#f2f3ff]">
              Annuler
            </button>
            <button
              type="submit"
              disabled={envoi || !valide || inchange}
              className="px-4 py-1.5 rounded bg-[#00236f] text-white text-[12px] font-bold hover:bg-[#0051d5] disabled:opacity-40 flex items-center gap-1"
            >
              {envoi && <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>}
              Enregistrer
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
