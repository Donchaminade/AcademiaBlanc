import React from 'react';
import { ACTIONS, ACTION_HINTS, ACTION_LABELS, Action, RESSOURCE_LABELS, Ressource, code } from '../api/permissions';

export interface RessourceRef { code: string; actions: string[] }

interface PermissionMatrixProps {
  ressources: RessourceRef[];
  /** Codes accordés à l’utilisateur édité. */
  value: Set<string>;
  onChange: (next: Set<string>) => void;
  /** Codes détenus par l’éditeur : une case qu’il ne détient pas est verrouillée (on ne donne pas ce qu’on n’a pas). */
  editorPermissions: readonly string[];
  disabled?: boolean;
}

/** Tableau ressources × actions avec cases à cocher. */
export const PermissionMatrix: React.FC<PermissionMatrixProps> = ({ ressources, value, onChange, editorPermissions, disabled = false }) => {
  const colonnes = ACTIONS.filter((a) => ressources.some((r) => r.actions.includes(a)));
  const editorHas = (c: string) => editorPermissions.includes(c);

  const toggle = (c: string) => {
    const next = new Set(value);
    if (next.has(c)) next.delete(c);
    else next.add(c);
    onChange(next);
  };

  const toggleRow = (r: RessourceRef) => {
    const codes = r.actions.map((a) => code(r.code as Ressource, a as Action)).filter(editorHas);
    const allOn = codes.every((c) => value.has(c));
    const next = new Set(value);
    codes.forEach((c) => (allOn ? next.delete(c) : next.add(c)));
    onChange(next);
  };

  const toggleColumn = (a: Action) => {
    const codes = ressources.filter((r) => r.actions.includes(a)).map((r) => code(r.code as Ressource, a)).filter(editorHas);
    const allOn = codes.every((c) => value.has(c));
    const next = new Set(value);
    codes.forEach((c) => (allOn ? next.delete(c) : next.add(c)));
    onChange(next);
  };

  return (
    <div className="overflow-x-auto rounded border border-[#eaedff]">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="bg-[#f2f3ff] text-left text-[11px] uppercase tracking-wide text-[#444651]">
            <th className="px-3 py-2 font-bold">Ressource</th>
            {colonnes.map((a) => (
              <th key={a} className="px-2 py-2 font-bold text-center whitespace-nowrap">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => toggleColumn(a)}
                  title={`${ACTION_HINTS[a]} — cliquer pour tout cocher / décocher la colonne`}
                  className="hover:text-[#0051d5] disabled:cursor-not-allowed"
                >
                  {ACTION_LABELS[a]}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ressources.map((r) => (
            <tr key={r.code} className="border-t border-[#eaedff] hover:bg-[#faf8ff]">
              <td className="px-3 py-1.5">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => toggleRow(r)}
                  title="Cliquer pour tout cocher / décocher la ligne"
                  className="font-semibold text-[#131b2e] hover:text-[#0051d5] text-left disabled:cursor-not-allowed"
                >
                  {RESSOURCE_LABELS[r.code as Ressource] ?? r.code}
                </button>
              </td>
              {colonnes.map((a) => {
                const applicable = r.actions.includes(a);
                const c = code(r.code as Ressource, a);
                const locked = applicable && !editorHas(c);
                return (
                  <td key={a} className="px-2 py-1.5 text-center">
                    {applicable ? (
                      <input
                        type="checkbox"
                        aria-label={`${RESSOURCE_LABELS[r.code as Ressource] ?? r.code} — ${ACTION_LABELS[a]}`}
                        className="w-4 h-4 accent-[#00236f] disabled:opacity-40"
                        checked={value.has(c)}
                        disabled={disabled || locked}
                        title={locked ? 'Vous ne détenez pas ce droit : impossible de l’accorder.' : ACTION_HINTS[a]}
                        onChange={() => toggle(c)}
                      />
                    ) : (
                      <span className="text-[#c5c6d0]" aria-hidden="true">—</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
