import React from 'react';
import { ROUTE_PATHS } from '../../utils/router';
import { VERSION_CONDITIONS } from '../../legal/versions';

interface AcceptationConditionsProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Identifiant de la case (plusieurs formulaires peuvent coexister). */
  id?: string;
}

const lien = 'font-bold text-[#0051d5] underline-offset-2 hover:underline';

/**
 * Case obligatoire « J’ai lu et j’accepte… » du formulaire d’inscription (et de la ré-acceptation).
 * Non cochée par défaut ; les trois documents s’ouvrent dans un nouvel onglet pour ne pas perdre la saisie.
 */
export const AcceptationConditions: React.FC<AcceptationConditionsProps> = ({ checked, onChange, disabled = false, id = 'acceptation-conditions' }) => (
  <div className="rounded-lg border border-[#eaedff] bg-[#f2f3ff] px-3 py-2.5">
    <label htmlFor={id} className="flex cursor-pointer items-start gap-2.5">
      <input
        id={id}
        type="checkbox"
        required
        checked={checked}
        disabled={disabled}
        aria-required="true"
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded text-[#0051d5] focus:ring-2 focus:ring-[#0051d5]/30"
      />
      <span className="text-[12px] leading-snug text-[#131b2e]">
        J’ai lu et j’accepte les{' '}
        <a href={ROUTE_PATHS.cgu} target="_blank" rel="noopener noreferrer" className={lien}>Conditions générales d’utilisation</a>,
        les{' '}
        <a href={ROUTE_PATHS.conditions} target="_blank" rel="noopener noreferrer" className={lien}>Conditions d’utilisation</a>
        {' '}et la{' '}
        <a href={ROUTE_PATHS.confidentialite} target="_blank" rel="noopener noreferrer" className={lien}>Politique de confidentialité</a>
        {' '}<span className="text-red-500" aria-hidden="true">*</span>
        <span className="mt-1 block text-[10.5px] text-[#757682]">
          Version {VERSION_CONDITIONS} — acceptée au nom de l’établissement par son responsable ; la date et l’heure sont enregistrées.
        </span>
      </span>
    </label>
  </div>
);

export default AcceptationConditions;
