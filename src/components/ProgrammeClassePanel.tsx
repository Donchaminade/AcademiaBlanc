import React, { useEffect, useMemo, useRef, useState } from 'react';
import { apiGet, apiSend } from '../api/client';
import { confirmAction, showError, toastSuccess } from '../utils/alerts';
import { cycleDeNiveau, niveauCanonique } from '../utils/niveaux';

export interface ProgrammeClasse { id: number; nom: string; niveau: string; serie?: string; }
export interface ProgrammeMatiere { id: number; nom: string; code: string; groupeCode?: string | null; groupeLibelle?: string | null; }
/** Ligne de la table coefficient : une ligne (matière, classe) = la matière est au programme de la classe. */
export interface ProgrammeCoefficient { matiereId: number; classeId?: number | null; valeur: number; }

/** Réponse de GET /api/classes/{id}/programme. */
interface LigneProgramme { matiereId: number; code: string; nom: string; groupe?: string | null; groupeLibelle?: string | null; coefficient: number; }
/** Réponse de GET /api/classes/{id}/programme/suggestions. */
interface Suggestion { matiereId: number; code: string; coefficient: number; }

/** Codes des matières de base du référentiel : cochées par « Suggestions par défaut ». */
const CODES_REFERENTIEL = new Set(['fr', 'ang', 'hg', 'ecm', 'pc', 'mat', 'svt']);

const GROUPES: { code: string; libelle: string; tone: string }[] = [
  { code: 'LT', libelle: 'Enseignements Littératures', tone: 'bg-[#eaedff] text-[#00236f]' },
  { code: 'SC', libelle: 'Enseignements Scientifiques', tone: 'bg-[#dcfce7] text-[#166534]' },
  { code: '', libelle: 'Hors groupe', tone: 'bg-[#f2f3ff] text-[#444651]' },
];

type Ligne = { coche: boolean; coef: string };

/** Classes Tailwind explicites (les noms construits dynamiquement ne seraient pas générés). */
const COLONNES: Record<number, string> = { 1: 'xl:grid-cols-1', 2: 'xl:grid-cols-2', 3: 'xl:grid-cols-3' };

const primary = 'inline-flex items-center justify-center gap-2 px-4 py-2 rounded bg-[#00236f] text-white text-[12px] font-bold hover:bg-[#1e3a8a] transition-colors shadow-xs disabled:opacity-60 disabled:cursor-not-allowed';
const ghost = 'inline-flex items-center justify-center gap-2 px-3 py-2 rounded bg-[#f2f3ff] text-[#444651] text-[12px] font-semibold hover:bg-[#e2e7ff] transition-colors disabled:opacity-60 disabled:cursor-not-allowed';
const field = 'bg-[#f2f3ff] text-[13px] py-2 px-3 rounded border border-[#eaedff] outline-none focus:bg-white focus:border-[#0051d5] disabled:opacity-60 disabled:cursor-not-allowed';

const formatCoef = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ','));

/** Pastille de valeur : coefficient lisible d’un coup d’œil. */
export const CoefPill: React.FC<{ value: number; muted?: boolean }> = ({ value, muted = false }) => (
  <span className={`inline-flex items-center justify-center min-w-[2rem] px-1.5 py-0.5 rounded-full font-mono text-[11px] font-bold ${muted ? 'bg-[#f2f3ff] text-[#757682]' : 'bg-[#00236f] text-white'}`}>
    {formatCoef(value)}
  </span>
);

/** Nombre de matières au programme de chaque classe (0 = aucun programme défini). */
export const matieresParClasse = (coefficients: ProgrammeCoefficient[]): Record<number, number> =>
  coefficients.reduce<Record<number, number>>((acc, c) => {
    if (c.classeId != null) acc[c.classeId] = (acc[c.classeId] ?? 0) + 1;
    return acc;
  }, {});

interface ProgrammeClassePanelProps {
  classes: ProgrammeClasse[];
  matieres: ProgrammeMatiere[];
  coefficients: ProgrammeCoefficient[];
  /** Classe affichée ; pilotée par le parent pour permettre « voir le programme » depuis le tableau des classes. */
  classeId: string;
  onSelectClasse: (classeId: string) => void;
  /** Appelé après chaque enregistrement réussi (rechargement des listes). */
  onChanged: () => void | Promise<void>;
  canEdit: boolean;
}

export const ProgrammeClassePanel: React.FC<ProgrammeClassePanelProps> = ({ classes, matieres, coefficients, classeId, onSelectClasse, onChanged, canEdit }) => {
  const [lignes, setLignes] = useState<Record<number, Ligne>>({});
  const [enregistre, setEnregistre] = useState<Record<number, Ligne>>({});
  const [chargement, setChargement] = useState(false);
  const [enregistrement, setEnregistrement] = useState(false);
  const [sourceCopie, setSourceCopie] = useState('');
  const derniereClasse = useRef('');

  const classe = classes.find((c) => String(c.id) === classeId);
  const compteurs = useMemo(() => matieresParClasse(coefficients), [coefficients]);
  const college = classes.filter((c) => cycleDeNiveau(c.niveau) === 'COLLEGE');
  const lycee = classes.filter((c) => cycleDeNiveau(c.niveau) === 'LYCEE');
  const libelleClasse = (c: ProgrammeClasse) => `${c.nom}${compteurs[c.id] ? ` · ${compteurs[c.id]} mat.` : ''}`;

  const vierge = (): Record<number, Ligne> => Object.fromEntries(matieres.map((m) => [m.id, { coche: false, coef: '1' }]));

  const charger = async (id: string) => {
    if (!id) { setLignes({}); setEnregistre({}); return; }
    setChargement(true);
    try {
      const programme = await apiGet<LigneProgramme[]>(`/api/classes/${id}/programme`);
      const etat = vierge();
      programme.forEach((l) => { etat[l.matiereId] = { coche: true, coef: formatCoef(l.coefficient) }; });
      setLignes(etat);
      setEnregistre(etat);
    } catch (err) {
      await showError('Programme indisponible', err instanceof Error ? err.message : 'Impossible de charger le programme de la classe.');
    } finally {
      setChargement(false);
    }
  };

  // Première classe par défaut ; rechargement quand la classe change ou quand les listes sont actualisées.
  useEffect(() => {
    if (!classeId && classes[0]) { onSelectClasse(String(classes[0].id)); return; }
    if (classeId && !classes.some((c) => String(c.id) === classeId)) { onSelectClasse(classes[0] ? String(classes[0].id) : ''); return; }
    derniereClasse.current = classeId;
    void charger(classeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classeId, classes, matieres, coefficients]);

  const modifie = useMemo(() => matieres.some((m) => {
    const a = lignes[m.id] ?? { coche: false, coef: '1' };
    const b = enregistre[m.id] ?? { coche: false, coef: '1' };
    return a.coche !== b.coche || (a.coche && Number(a.coef.replace(',', '.')) !== Number(b.coef.replace(',', '.')));
  }), [lignes, enregistre, matieres]);

  const cochees = matieres.filter((m) => lignes[m.id]?.coche);
  const coefDe = (m: ProgrammeMatiere) => Number((lignes[m.id]?.coef ?? '1').replace(',', '.'));
  const sommeCoef = cochees.reduce((acc, m) => acc + (Number.isFinite(coefDe(m)) ? coefDe(m) : 0), 0);
  const invalides = cochees.filter((m) => !Number.isFinite(coefDe(m)) || coefDe(m) < 0.5 || coefDe(m) > 20);
  const programmeDefini = (compteurs[Number(classeId)] ?? 0) > 0;

  const changerClasse = async (id: string) => {
    if (modifie) {
      const ok = await confirmAction({
        title: 'Abandonner les modifications ?',
        text: 'Le programme affiché a été modifié sans être validé. Changer de classe perdra ces modifications.',
        confirmText: 'Changer de classe',
        cancelText: 'Rester',
        icon: 'warning',
      });
      if (!ok) return;
    }
    onSelectClasse(id);
  };

  const cocher = (id: number, coche: boolean) => setLignes((etat) => ({ ...etat, [id]: { coche, coef: etat[id]?.coef ?? '1' } }));
  const saisirCoef = (id: number, coef: string) => setLignes((etat) => ({ ...etat, [id]: { coche: true, coef } }));
  const toutCocher = (coche: boolean) => setLignes((etat) => Object.fromEntries(matieres.map((m) => [m.id, { coche, coef: etat[m.id]?.coef ?? '1' }])));

  const suggestions = async () => {
    if (!classeId) return;
    try {
      const liste = await apiGet<Suggestion[]>(`/api/classes/${classeId}/programme/suggestions`);
      setLignes((etat) => {
        const suivant = { ...etat };
        liste.forEach((s) => {
          const code = (s.code || '').toLowerCase();
          suivant[s.matiereId] = { coche: (etat[s.matiereId]?.coche ?? false) || CODES_REFERENTIEL.has(code), coef: formatCoef(s.coefficient) };
        });
        return suivant;
      });
      toastSuccess(`Suggestions appliquées pour ${classe?.nom ?? 'la classe'} : vérifiez puis validez.`);
    } catch (err) {
      await showError('Suggestions indisponibles', err instanceof Error ? err.message : 'Une erreur inattendue est survenue.');
    }
  };

  const copier = async () => {
    const source = classes.find((c) => String(c.id) === sourceCopie);
    if (!classe || !source) return;
    const ok = await confirmAction({
      title: `Copier le programme de ${source.nom} ?`,
      text: `Le programme actuel de ${classe.nom} sera remplacé par les ${compteurs[source.id] ?? 0} matières de ${source.nom} et leurs coefficients.`,
      confirmText: 'Copier',
      icon: 'question',
    });
    if (!ok) return;
    setEnregistrement(true);
    try {
      await apiSend(`/api/classes/${classe.id}/programme/copier-de/${source.id}`, 'POST', {});
      setSourceCopie('');
      toastSuccess(`Programme de ${source.nom} copié sur ${classe.nom}.`);
      await onChanged();
    } catch (err) {
      await showError('Copie impossible', err instanceof Error ? err.message : 'Une erreur inattendue est survenue.');
    } finally {
      setEnregistrement(false);
    }
  };

  const valider = async () => {
    if (!classe) return;
    if (invalides.length) {
      await showError('Coefficients à corriger', `Chaque coefficient doit être compris entre 0,5 et 20 (${invalides.map((m) => m.nom).join(', ')}).`);
      return;
    }
    const ok = await confirmAction({
      title: `Valider le programme de ${classe.nom} ?`,
      text: cochees.length
        ? `${cochees.length} matière${cochees.length > 1 ? 's' : ''}, Σ coefficients = ${formatCoef(sommeCoef)} (total maximal ${formatCoef(20 * sommeCoef)} pts). Le bulletin et la saisie des notes de cette classe ne porteront que sur ces matières.`
        : 'Aucune matière cochée : le programme sera retiré et la classe reviendra aux coefficients globaux (toutes les matières).',
      confirmText: 'Valider le programme',
      icon: cochees.length ? 'question' : 'warning',
    });
    if (!ok) return;
    setEnregistrement(true);
    try {
      await apiSend(`/api/classes/${classe.id}/programme`, 'PUT', cochees.map((m) => ({ matiereId: m.id, coefficient: coefDe(m) })));
      setEnregistre(lignes);
      toastSuccess(cochees.length ? `Programme de ${classe.nom} enregistré (${cochees.length} matière${cochees.length > 1 ? 's' : ''}).` : `Programme de ${classe.nom} retiré.`);
      await onChanged();
    } catch (err) {
      await showError('Enregistrement impossible', err instanceof Error ? err.message : 'Une erreur inattendue est survenue.');
    } finally {
      setEnregistrement(false);
    }
  };

  if (classes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-1 rounded border border-dashed border-[#dce1ff] bg-[#f2f3ff] px-4 py-6 text-center">
        <span className="material-symbols-outlined text-2xl text-[#757682]">no_meeting_room</span>
        <p className="text-[13px] font-semibold text-[#444651]">Aucune classe pour l’instant</p>
        <p className="text-[11px] text-[#757682]">Créez vos classes dans « Enseignants &amp; Classes », puis revenez affecter leurs matières.</p>
      </div>
    );
  }

  const groupes = GROUPES
    .map((g) => ({ ...g, items: matieres.filter((m) => (m.groupeCode || '') === g.code) }))
    .filter((g) => g.items.length > 0);
  const autresClasses = classes.filter((c) => String(c.id) !== classeId && (compteurs[c.id] ?? 0) > 0);

  return (
    <div className="space-y-4" data-testid="programme-classe">
      {/* Sélecteur de classe */}
      <div className="flex flex-col lg:flex-row lg:items-end gap-3 rounded border border-[#eaedff] bg-[#faf8ff] p-3">
        <label className="flex flex-col gap-1 min-w-0 lg:w-80">
          <span className="text-[11px] font-bold uppercase tracking-wide text-[#444651]">Classe</span>
          <select value={classeId} onChange={(e) => void changerClasse(e.target.value)} className={`${field} w-full`} aria-label="Classe dont on définit le programme">
            {college.length > 0 && (
              <optgroup label="Collège (6e à 3e)">
                {college.map((c) => <option key={c.id} value={c.id}>{libelleClasse(c)}</option>)}
              </optgroup>
            )}
            {lycee.length > 0 && (
              <optgroup label="Lycée (2nde à Tle)">
                {lycee.map((c) => <option key={c.id} value={c.id}>{libelleClasse(c)}</option>)}
              </optgroup>
            )}
          </select>
        </label>
        {classe && (
          <div className="flex flex-wrap items-center gap-2 text-[12px] text-[#444651] lg:pb-2">
            <span className={`inline-flex items-center text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${cycleDeNiveau(classe.niveau) === 'LYCEE' ? 'bg-[#eaedff] text-[#00236f]' : 'bg-[#f2f3ff] text-[#444651]'}`}>
              {cycleDeNiveau(classe.niveau) === 'LYCEE' ? 'Lycée' : 'Collège'}
            </span>
            <span>Niveau <strong>{niveauCanonique(classe.niveau)}</strong></span>
            {classe.serie && cycleDeNiveau(classe.niveau) === 'LYCEE' && <span>· Série <strong className="font-mono">{classe.serie}</strong></span>}
            {modifie && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#fff4e5] text-[#9a3412] border border-[#fed7aa] px-2 py-0.5 text-[11px] font-bold">
                <span className="material-symbols-outlined text-sm">edit_note</span>
                Modifications non enregistrées
              </span>
            )}
          </div>
        )}
      </div>

      {classe && !programmeDefini && !chargement && (
        <div role="status" className="flex items-start gap-2 rounded border border-[#fed7aa] bg-[#fff7ed] px-3 py-2 text-[12px] text-[#9a3412]">
          <span className="material-symbols-outlined text-base">warning</span>
          <span>
            <strong>Aucun programme défini pour {classe.nom}.</strong> Tant qu’aucune matière n’est validée, son bulletin et la saisie des notes
            portent sur <em>toutes</em> les matières de l’établissement avec les coefficients globaux. Cochez les matières ci-dessous puis validez.
          </span>
        </div>
      )}

      {matieres.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-1 rounded border border-dashed border-[#dce1ff] bg-[#f2f3ff] px-4 py-6 text-center">
          <span className="material-symbols-outlined text-2xl text-[#757682]">book_off</span>
          <p className="text-[13px] font-semibold text-[#444651]">Aucune matière dans le catalogue</p>
          <p className="text-[11px] text-[#757682]">Ajoutez vos matières dans l’onglet « Matières » (ou chargez les matières de base) avant de composer un programme.</p>
        </div>
      ) : (
        <>
          {/* Barre d’outils */}
          {canEdit && (
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => toutCocher(true)} disabled={chargement} className={ghost}>
                <span className="material-symbols-outlined text-base">select_check_box</span>
                Tout cocher
              </button>
              <button type="button" onClick={() => toutCocher(false)} disabled={chargement} className={ghost}>
                <span className="material-symbols-outlined text-base">check_box_outline_blank</span>
                Tout décocher
              </button>
              <button type="button" onClick={() => void suggestions()} disabled={chargement || !classeId} className={ghost} title="Coche les matières de base et pré-remplit les coefficients proposés pour le niveau et la série de la classe">
                <span className="material-symbols-outlined text-base">auto_awesome</span>
                Suggestions par défaut
              </button>
              <div className="flex items-center gap-1 ml-auto">
                <select value={sourceCopie} onChange={(e) => setSourceCopie(e.target.value)} className={field} aria-label="Classe modèle à copier" disabled={autresClasses.length === 0}>
                  <option value="">{autresClasses.length ? 'Copier depuis une classe…' : 'Aucune autre classe avec programme'}</option>
                  {autresClasses.map((c) => <option key={c.id} value={c.id}>{libelleClasse(c)}</option>)}
                </select>
                <button type="button" onClick={() => void copier()} disabled={!sourceCopie || enregistrement} className={ghost}>
                  <span className="material-symbols-outlined text-base">content_copy</span>
                  Copier
                </button>
              </div>
            </div>
          )}

          {/* Matières par groupe */}
          <div className={`grid grid-cols-1 ${COLONNES[Math.min(groupes.length, 3)]} gap-3 ${chargement ? 'opacity-60 pointer-events-none' : ''}`}>
            {groupes.map((g) => (
              <fieldset key={g.code || 'autres'} className="rounded border border-[#eaedff] bg-white">
                <legend className="sr-only">{g.libelle}</legend>
                <div className="flex items-center justify-between gap-2 border-b border-[#eaedff] bg-[#f8f9ff] px-3 py-2">
                  <span className={`inline-flex items-center text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${g.tone}`}>{g.libelle}</span>
                  <span className="text-[11px] text-[#757682]">{g.items.filter((m) => lignes[m.id]?.coche).length}/{g.items.length}</span>
                </div>
                <ul className="divide-y divide-[#eaedff]">
                  {g.items.map((m) => {
                    const ligne = lignes[m.id] ?? { coche: false, coef: '1' };
                    const coef = Number(ligne.coef.replace(',', '.'));
                    const invalide = ligne.coche && (!Number.isFinite(coef) || coef < 0.5 || coef > 20);
                    return (
                      <li key={m.id} className={`flex items-center gap-3 px-3 py-2 ${ligne.coche ? 'bg-white' : 'bg-[#fafafe]'}`}>
                        <label className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            className="w-4 h-4 accent-[#00236f]"
                            checked={ligne.coche}
                            disabled={!canEdit}
                            onChange={(e) => cocher(m.id, e.target.checked)}
                            aria-label={`${m.nom} au programme`}
                          />
                          <span className="min-w-0">
                            <span className={`block text-[13px] font-semibold truncate ${ligne.coche ? 'text-[#131b2e]' : 'text-[#757682]'}`}>{m.nom}</span>
                            <span className="block text-[10px] font-mono uppercase text-[#757682]">{m.code}</span>
                          </span>
                        </label>
                        <label className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] font-bold uppercase tracking-wide text-[#757682]">Coef</span>
                          <input
                            inputMode="decimal"
                            value={ligne.coef}
                            disabled={!ligne.coche || !canEdit}
                            onChange={(e) => saisirCoef(m.id, e.target.value)}
                            aria-label={`Coefficient de ${m.nom}`}
                            aria-invalid={invalide || undefined}
                            className={`${field} w-16 text-center font-mono font-bold ${invalide ? 'border-[#ba1a1a] bg-[#fff5f4] text-[#ba1a1a]' : ''}`}
                          />
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </fieldset>
            ))}
          </div>

          {/* Récapitulatif + validation */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded border border-[#dce1ff] bg-[#f2f3ff] px-4 py-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-[#00236f]">
              <span><strong>{cochees.length}</strong> matière{cochees.length > 1 ? 's' : ''}</span>
              <span className="inline-flex items-center gap-1.5">Σ coefficients = <CoefPill value={sommeCoef} /></span>
              <span>total max = <strong className="font-mono">{formatCoef(20 * sommeCoef)}</strong> pts</span>
              {cochees.length > 0 && (
                <span className="flex flex-wrap items-center gap-1 text-[11px] text-[#444651]">
                  {cochees.map((m) => (
                    <span key={m.id} className="inline-flex items-center gap-1 rounded-full bg-white border border-[#dce1ff] pl-2 pr-0.5 py-0.5">
                      <span className="font-mono uppercase">{m.code}</span>
                      <CoefPill value={Number.isFinite(coefDe(m)) ? coefDe(m) : 0} />
                    </span>
                  ))}
                </span>
              )}
            </div>
            {canEdit && (
              <button type="button" onClick={() => void valider()} disabled={enregistrement || chargement || !classeId || (!modifie && programmeDefini)} className={`${primary} shrink-0`} data-testid="valider-programme">
                <span className={`material-symbols-outlined text-base ${enregistrement ? 'animate-spin' : ''}`}>{enregistrement ? 'progress_activity' : 'task_alt'}</span>
                {enregistrement ? 'Enregistrement…' : 'Valider le programme'}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};
