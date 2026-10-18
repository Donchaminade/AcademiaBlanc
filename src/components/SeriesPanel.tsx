import React, { useState } from 'react';
import { confirmDelete, showError, toastError, toastSuccess } from '../utils/alerts';
import {
  FAMILLES,
  FamilleSerie,
  Serie,
  SeriePayload,
  chargerSeriesDefaut,
  creerSerie,
  familleLabel,
  grouperSeries,
  modifierSerie,
  supprimerSerie,
} from '../api/series';

const field = 'w-full bg-[#f2f3ff] text-[13px] py-2 px-3 rounded border border-[#eaedff] outline-none focus:bg-white focus:border-[#0051d5] disabled:opacity-60 disabled:cursor-not-allowed';
const primary = 'inline-flex items-center justify-center gap-2 px-3 py-2 rounded bg-[#00236f] text-white text-[12px] font-bold hover:bg-[#1e3a8a] transition-colors shadow-xs disabled:opacity-60';
const ghost = 'inline-flex items-center justify-center gap-2 px-3 py-2 rounded bg-[#f2f3ff] text-[#444651] text-[12px] font-semibold hover:bg-[#e2e7ff] transition-colors disabled:opacity-60';

/** Pastille de famille (Générale / Technique) affichée à côté d’un code de série. */
export const FamilleBadge: React.FC<{ famille?: FamilleSerie }> = ({ famille }) => {
  if (!famille) return null;
  const tone = famille === 'GENERALE' ? 'bg-[#eaedff] text-[#00236f]' : 'bg-[#fff1e0] text-[#8a4b00]';
  return (
    <span className={`inline-flex items-center text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${tone}`}>
      {familleLabel(famille)}
    </span>
  );
};

const EMPTY_SERIE: SeriePayload = { code: '', libelle: '', famille: 'GENERALE' };

interface SerieFormProps {
  /** Série en cours de modification ; `null` pour une création. */
  editing?: Serie | null;
  /** Famille présélectionnée pour une création. */
  defaultFamille?: FamilleSerie;
  compact?: boolean;
  onSaved: (serie: Serie) => void;
  onCancel?: () => void;
}

/**
 * Petit formulaire code / libellé / famille, utilisé dans la carte « Séries »
 * et en ligne dans le formulaire de classe (« + Nouvelle série »).
 */
export const SerieForm: React.FC<SerieFormProps> = ({ editing = null, defaultFamille, compact = false, onSaved, onCancel }) => {
  const [value, setValue] = useState<SeriePayload>(() => editing
    ? { code: editing.code, libelle: editing.libelle, famille: editing.famille, actif: editing.actif, ordre: editing.ordre }
    : { ...EMPTY_SERIE, famille: defaultFamille ?? 'GENERALE' });
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const code = value.code.trim().toUpperCase();
    const libelle = value.libelle.trim();
    if (!code) { toastError('Indiquez le code de la série (ex. F5).'); return; }
    if (!libelle) { toastError('Indiquez le libellé de la série.'); return; }
    setBusy(true);
    try {
      const body: SeriePayload = { ...value, code, libelle };
      const saved = editing ? await modifierSerie(editing.id, body) : await creerSerie(body);
      toastSuccess(editing ? `Série ${saved.code} mise à jour.` : `Série ${saved.code} ajoutée.`);
      if (!editing) setValue({ ...EMPTY_SERIE, famille: value.famille });
      onSaved(saved);
    } catch (err) {
      await showError('Enregistrement de la série impossible', err instanceof Error ? err.message : 'Une erreur inattendue est survenue.');
    } finally {
      setBusy(false);
    }
  };

  // Pas de <form> : le composant peut être inséré dans le formulaire de classe (les formulaires ne s’imbriquent pas).
  const onEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      void submit();
    }
  };

  return (
    <div
      role="group"
      aria-label={editing ? `Modifier la série ${editing.code}` : 'Nouvelle série'}
      className={`grid gap-2 ${compact ? 'grid-cols-1 sm:grid-cols-[6rem_1fr_9rem_auto]' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-[7rem_1fr_11rem_auto]'} items-end rounded border border-dashed border-[#dce1ff] bg-[#faf8ff] p-3`}
    >
      <label className="flex flex-col gap-1 min-w-0">
        <span className="text-[11px] font-bold uppercase tracking-wide text-[#444651]">Code</span>
        <input
          maxLength={20}
          placeholder="F5"
          value={value.code}
          onKeyDown={onEnter}
          onChange={(e) => setValue({ ...value, code: e.target.value.toUpperCase() })}
          className={`${field} font-mono uppercase`}
          autoFocus={!editing}
        />
      </label>
      <label className="flex flex-col gap-1 min-w-0">
        <span className="text-[11px] font-bold uppercase tracking-wide text-[#444651]">Libellé</span>
        <input
          maxLength={120}
          placeholder="Fabrication mécanique"
          value={value.libelle}
          onKeyDown={onEnter}
          onChange={(e) => setValue({ ...value, libelle: e.target.value })}
          className={field}
        />
      </label>
      <label className="flex flex-col gap-1 min-w-0">
        <span className="text-[11px] font-bold uppercase tracking-wide text-[#444651]">Famille</span>
        <select value={value.famille} onChange={(e) => setValue({ ...value, famille: e.target.value as FamilleSerie })} className={field}>
          {FAMILLES.map((f) => <option key={f.value} value={f.value}>{f.short}</option>)}
        </select>
      </label>
      <div className="flex gap-1 sm:justify-end">
        {onCancel && (
          <button type="button" onClick={onCancel} className={ghost} disabled={busy} title="Annuler">
            <span className="material-symbols-outlined text-base">close</span>
            <span className="hidden lg:inline">Annuler</span>
          </button>
        )}
        <button type="button" onClick={() => void submit()} className={primary} disabled={busy}>
          <span className="material-symbols-outlined text-base">{editing ? 'save' : 'add_circle'}</span>
          {editing ? 'Enregistrer' : 'Ajouter'}
        </button>
      </div>
    </div>
  );
};

interface SeriesPanelProps {
  series: Serie[];
  /** Nombre de classes utilisant chaque code de série (pour signaler les séries non supprimables). */
  usage?: Record<string, number>;
  /** Appelé après toute modification réussie afin de recharger les listes. */
  onChanged: () => void | Promise<void>;
  /** Droits CREER / MODIFIER / SUPPRIMER sur les séries : les boutons absents ne sont pas rendus. */
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
}

/** Carte compacte « Séries » : liste par famille, Modifier / Supprimer, chargement des défauts. */
export const SeriesPanel: React.FC<SeriesPanelProps> = ({ series, usage = {}, onChanged, canCreate = true, canEdit = true, canDelete = true }) => {
  const [editing, setEditing] = useState<Serie | null>(null);
  const [adding, setAdding] = useState(false);
  const [loadingDefaults, setLoadingDefaults] = useState(false);
  const groupes = grouperSeries(series);

  const refresh = async () => {
    try {
      await onChanged();
    } catch (err) {
      await showError('Actualisation impossible', err instanceof Error ? err.message : 'La liste des séries n’a pas pu être rechargée.');
    }
  };

  const loadDefaults = async () => {
    setLoadingDefaults(true);
    try {
      const avant = series.length;
      const apres = await chargerSeriesDefaut();
      const ajout = apres.length - avant;
      toastSuccess(ajout > 0 ? `${ajout} série${ajout > 1 ? 's' : ''} par défaut ajoutée${ajout > 1 ? 's' : ''}.` : 'Toutes les séries par défaut sont déjà présentes.');
      await refresh();
    } catch (err) {
      await showError('Chargement des séries par défaut impossible', err instanceof Error ? err.message : 'Une erreur inattendue est survenue.');
    } finally {
      setLoadingDefaults(false);
    }
  };

  const remove = async (serie: Serie) => {
    const n = usage[serie.code.toUpperCase()] ?? 0;
    if (n > 0) {
      toastError(`La série ${serie.code} est utilisée par ${n} classe${n > 1 ? 's' : ''} ; elle ne peut pas être supprimée.`);
      return;
    }
    const ok = await confirmDelete(`${serie.code} — ${serie.libelle}`, 'La série est retirée si aucune classe ne l’utilise.');
    if (!ok) return;
    try {
      await supprimerSerie(serie.id);
      if (editing?.id === serie.id) setEditing(null);
      toastSuccess(`Série ${serie.code} supprimée.`);
      await refresh();
    } catch (err) {
      await showError('Suppression impossible', err instanceof Error ? err.message : 'Une erreur inattendue est survenue.');
    }
  };

  return (
    <section id="admin-section-series" className="bg-white p-5 rounded border border-[#eaedff] shadow-xs space-y-4 scroll-mt-6">
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-[#eaedff] pb-3">
        <div className="flex items-start gap-3 min-w-0">
          <span className="shrink-0 w-9 h-9 rounded bg-[#eaedff] text-[#0051d5] flex items-center justify-center">
            <span className="material-symbols-outlined text-xl">category</span>
          </span>
          <div className="min-w-0">
            <h3 className="text-[14px] font-bold text-[#00236f] uppercase tracking-wide">Séries du lycée</h3>
            <p className="text-[12px] text-[#444651] mt-0.5">
              Séries générales (A4, C, D…) et techniques (G1, F4…) proposées de la 2nde à la Tle. Ajoutez celles de votre établissement.
            </p>
          </div>
        </div>
        <span className="shrink-0 text-[11px] font-bold text-[#00236f] bg-[#f2f3ff] border border-[#eaedff] px-2.5 py-1 rounded-full">
          {series.length} {series.length > 1 ? 'séries' : 'série'}
        </span>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {groupes.map((groupe) => (
          <div key={groupe.famille} className="rounded border border-[#eaedff] overflow-hidden">
            <div className="flex items-center justify-between bg-[#f2f3ff] px-3 py-2">
              <span className="text-[11px] font-bold uppercase tracking-wide text-[#444651]">{groupe.label}</span>
              <FamilleBadge famille={groupe.famille} />
            </div>
            {groupe.items.length === 0 ? (
              <p className="px-3 py-3 text-[12px] text-[#757682]">Aucune série dans cette famille.</p>
            ) : (
              <ul className="divide-y divide-[#eaedff]">
                {groupe.items.map((serie) => {
                  const n = usage[serie.code.toUpperCase()] ?? 0;
                  return (
                    <li key={serie.id} className={`flex items-center justify-between gap-2 px-3 py-1.5 text-[13px] ${editing?.id === serie.id ? 'bg-[#eaedff]/60' : 'hover:bg-[#faf8ff]'} ${serie.actif ? '' : 'opacity-60'}`}>
                      <div className="min-w-0 flex items-center gap-2">
                        <span className="font-mono font-bold text-[#00236f] w-10 shrink-0">{serie.code}</span>
                        <span className="truncate text-[#131b2e]">{serie.libelle}</span>
                        {!serie.actif && <span className="text-[10px] font-bold uppercase text-[#757682]">inactive</span>}
                        {n > 0 && <span className="shrink-0 text-[10px] text-[#757682]">{n} classe{n > 1 ? 's' : ''}</span>}
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        {canEdit && (
                        <button
                          type="button"
                          onClick={() => { setAdding(false); setEditing(serie); }}
                          title="Modifier"
                          aria-label={`Modifier la série ${serie.code}`}
                          className="inline-flex items-center gap-1 px-1.5 py-1 rounded text-[#00236f] hover:bg-[#eaedff] text-[12px] font-semibold transition-colors"
                        >
                          <span className="material-symbols-outlined text-base">edit</span>
                          <span className="hidden xl:inline">Modifier</span>
                        </button>
                        )}
                        {canDelete && (
                        <button
                          type="button"
                          onClick={() => void remove(serie)}
                          title={n > 0 ? 'Série utilisée par des classes' : 'Supprimer'}
                          aria-label={`Supprimer la série ${serie.code}`}
                          disabled={n > 0}
                          className="inline-flex items-center gap-1 px-1.5 py-1 rounded text-[#ba1a1a] hover:bg-[#ffdad6] text-[12px] font-semibold transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
                        >
                          <span className="material-symbols-outlined text-base">delete</span>
                          <span className="hidden xl:inline">Supprimer</span>
                        </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ))}
      </div>

      {editing && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 rounded border border-[#dce1ff] bg-[#f2f3ff] px-3 py-2 text-[12px] text-[#00236f]">
            <span className="material-symbols-outlined text-base text-[#0051d5]">edit</span>
            <span><strong>Modification de la série {editing.code}</strong> <span className="text-[#444651]">— {editing.libelle} · {familleLabel(editing.famille)}</span></span>
          </div>
          <SerieForm
            key={editing.id}
            editing={editing}
            onCancel={() => setEditing(null)}
            onSaved={() => { setEditing(null); void refresh(); }}
          />
        </div>
      )}
      {!editing && adding && (
        <SerieForm onCancel={() => setAdding(false)} onSaved={() => void refresh()} />
      )}

      {canCreate && (
      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
        <button type="button" onClick={() => void loadDefaults()} className={ghost} disabled={loadingDefaults}>
          <span className={`material-symbols-outlined text-base ${loadingDefaults ? 'animate-spin' : ''}`}>{loadingDefaults ? 'progress_activity' : 'library_add'}</span>
          Charger les séries par défaut
        </button>
        {!editing && !adding && (
          <button type="button" onClick={() => setAdding(true)} className={primary}>
            <span className="material-symbols-outlined text-base">add_circle</span>
            Nouvelle série
          </button>
        )}
      </div>
      )}
    </section>
  );
};
