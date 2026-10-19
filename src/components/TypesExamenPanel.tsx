import React, { useEffect, useState } from 'react';
import { apiDelete, apiGet, apiSend } from '../api/client';
import { usePermissions } from '../api/permissions';
import { CYCLES_EXAMEN, CYCLE_EXAMEN_LABELS, CycleExamen, TypeExamen } from '../api/typesExamen';
import { confirmAction, confirmDelete, showError, toastSuccess } from '../utils/alerts';

/**
 * Onglet « Types d'examen » de la Plateforme : référentiel commun (CEPD, BEPC, BAC I, BAC II, composition…)
 * proposé à tous les établissements à la création d'une session. Un type utilisé par des sessions se désactive
 * (il disparaît des formulaires, les sessions existantes le gardent) ; seul un type inutilisé se supprime.
 */

const field = 'w-full bg-[#f2f3ff] text-[13px] py-2 px-3 rounded border border-[#eaedff] outline-none focus:bg-white focus:border-[#0051d5]';
const primary = 'inline-flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2 rounded bg-[#00236f] text-white text-[12px] font-bold hover:bg-[#1e3a8a] transition-colors shadow-xs disabled:opacity-50';
const ghost = 'inline-flex items-center justify-center gap-1 px-2 py-1 rounded bg-[#f2f3ff] text-[#444651] text-[12px] font-semibold hover:bg-[#e2e7ff] transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

const Field: React.FC<{ label: string; className?: string; children: React.ReactNode }> = ({ label, className = '', children }) => (
  <label className={`flex flex-col gap-1 min-w-0 ${className}`}>
    <span className="text-[11px] font-bold uppercase tracking-wide text-[#444651]">{label}</span>
    {children}
  </label>
);

interface Formulaire { code: string; libelleCourt: string; libelleLong: string; cycle: CycleExamen; ordre: string; actif: boolean }

const VIDE: Formulaire = { code: '', libelleCourt: '', libelleLong: '', cycle: 'TOUS', ordre: '', actif: true };

const versFormulaire = (t: TypeExamen): Formulaire => ({
  code: t.code, libelleCourt: t.libelleCourt, libelleLong: t.libelleLong, cycle: t.cycle, ordre: String(t.ordre), actif: t.actif,
});

const versCorps = (t: Formulaire | TypeExamen) => ({
  code: t.code.trim(),
  libelleCourt: t.libelleCourt.trim(),
  libelleLong: t.libelleLong.trim(),
  cycle: t.cycle,
  ordre: typeof t.ordre === 'number' ? t.ordre : (t.ordre.trim() === '' ? null : Number(t.ordre)),
  actif: t.actif,
});

const message = (err: unknown, defaut: string) => (err instanceof Error ? err.message : defaut);

export const TypesExamenPanel: React.FC = () => {
  const { can, permissions } = usePermissions();
  const canVoir = can('TYPES_EXAMEN', 'VOIR');
  const canCreer = can('TYPES_EXAMEN', 'CREER');
  const canModifier = can('TYPES_EXAMEN', 'MODIFIER');
  const canSupprimer = can('TYPES_EXAMEN', 'SUPPRIMER');

  const [types, setTypes] = useState<TypeExamen[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState<Formulaire>(VIDE);
  const [edit, setEdit] = useState<TypeExamen | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    if (!canVoir) { setLoading(false); return; }
    setLoading(true);
    setError('');
    apiGet<TypeExamen[]>('/api/plateforme/types-examen')
      .then(setTypes)
      .catch((err: Error) => setError(err.message || 'Impossible de charger les types d’examen.'))
      .finally(() => setLoading(false));
  };

  // Recharge quand les droits changent (rafraîchissement de session).
  useEffect(load, [canVoir, permissions.join(',')]);

  const reset = () => { setEdit(null); setForm(VIDE); };

  const enregistrer = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (edit) {
        const maj = await apiSend<TypeExamen>(`/api/plateforme/types-examen/${edit.id}`, 'PUT', versCorps(form));
        toastSuccess(`Type « ${maj.libelleCourt} » mis à jour.`);
      } else {
        const cree = await apiSend<TypeExamen>('/api/plateforme/types-examen', 'POST', versCorps(form));
        toastSuccess(`Type « ${cree.libelleCourt} » créé : il est proposé à tous les établissements.`);
      }
      reset();
      load();
    } catch (err) {
      await showError('Enregistrement impossible', message(err, 'Une erreur inattendue est survenue.'));
    } finally {
      setSaving(false);
    }
  };

  const basculerActif = async (t: TypeExamen) => {
    const desactiver = t.actif;
    const ok = await confirmAction({
      title: desactiver ? `Désactiver « ${t.libelleCourt} »` : `Réactiver « ${t.libelleCourt} »`,
      text: desactiver
        ? `Le type ne sera plus proposé aux établissements pour de nouvelles sessions. ${t.sessions > 0 ? `Les ${t.sessions} session${t.sessions > 1 ? 's' : ''} qui l’utilisent le conservent.` : 'Aucune session ne l’utilise actuellement.'}`
        : 'Le type sera de nouveau proposé aux établissements à la création d’une session.',
      confirmText: desactiver ? 'Désactiver' : 'Réactiver',
      icon: desactiver ? 'warning' : 'question',
    });
    if (!ok) return;
    try {
      await apiSend(`/api/plateforme/types-examen/${t.id}`, 'PUT', { ...versCorps(t), actif: !t.actif });
      toastSuccess(`« ${t.libelleCourt} » ${desactiver ? 'désactivé' : 'réactivé'}.`);
      if (edit?.id === t.id) reset();
      load();
    } catch (err) {
      await showError(desactiver ? 'Désactivation impossible' : 'Réactivation impossible', message(err, 'Une erreur inattendue est survenue.'));
    }
  };

  const supprimer = async (t: TypeExamen) => {
    const ok = await confirmDelete(t.libelleCourt, 'Suppression définitive du référentiel ; refusée si une session l’utilise (désactivez-le alors).');
    if (!ok) return;
    try {
      await apiDelete(`/api/plateforme/types-examen/${t.id}`);
      toastSuccess(`« ${t.libelleCourt} » supprimé.`);
      if (edit?.id === t.id) reset();
      load();
    } catch (err) {
      await showError('Suppression impossible', message(err, 'Une erreur inattendue est survenue.'));
    }
  };

  if (!canVoir) {
    return (
      <div className="bg-white border border-[#eaedff] rounded p-6 text-[13px] text-[#444651]">
        Votre compte ne détient pas le droit « Voir » sur les types d’examen. Rapprochez-vous du propriétaire du logiciel.
      </div>
    );
  }

  const hasActions = canModifier || canSupprimer;
  const sessionsTotal = types.reduce((sum, t) => sum + (t.sessions ?? 0), 0);

  return (
    <div className="space-y-5">
      <section className="bg-white p-5 rounded border border-[#eaedff] shadow-xs space-y-4">
        <header className="flex flex-wrap items-start justify-between gap-2 border-b border-[#eaedff] pb-3">
          <div className="flex items-start gap-3 min-w-0">
            <span className="shrink-0 w-9 h-9 rounded bg-[#eaedff] text-[#0051d5] flex items-center justify-center">
              <span className="material-symbols-outlined text-xl">workspace_premium</span>
            </span>
            <div className="min-w-0">
              <h3 className="text-[14px] font-bold text-[#00236f] uppercase tracking-wide">Types d’examen</h3>
              <p className="text-[12px] text-[#444651] mt-0.5">
                Référentiel commun à tous les établissements : chaque session d’examen en choisit un. Le libellé court s’affiche dans les listes,
                le libellé long en tête des bulletins.
              </p>
            </div>
          </div>
          <span className="shrink-0 text-[11px] font-bold text-[#00236f] bg-[#f2f3ff] border border-[#eaedff] px-2.5 py-1 rounded-full">
            {types.length} type{types.length > 1 ? 's' : ''} · {sessionsTotal} session{sessionsTotal > 1 ? 's' : ''}
          </span>
        </header>

        {loading && <p className="text-[13px] text-[#444651]">Chargement des types d’examen…</p>}
        {!loading && error && <p role="alert" className="text-[13px] text-[#ba1a1a]">{error}</p>}

        {!loading && !error && types.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-1 rounded border border-dashed border-[#dce1ff] bg-[#f2f3ff] px-4 py-6 text-center">
            <span className="material-symbols-outlined text-2xl text-[#757682]">workspace_premium</span>
            <p className="text-[13px] font-semibold text-[#444651]">Aucun type d’examen dans le référentiel</p>
          </div>
        )}

        {!loading && !error && types.length > 0 && (
          <div className="overflow-x-auto rounded border border-[#eaedff]">
            <table className="w-full min-w-[720px] text-[13px]">
              <thead>
                <tr className="bg-[#f2f3ff] text-left text-[11px] uppercase tracking-wide text-[#444651]">
                  <th className="px-3 py-2 font-bold">Code</th>
                  <th className="px-3 py-2 font-bold">Libellé court</th>
                  <th className="px-3 py-2 font-bold">Libellé long (bulletin)</th>
                  <th className="px-3 py-2 font-bold">Cycle</th>
                  <th className="px-3 py-2 font-bold text-right">Ordre</th>
                  <th className="px-3 py-2 font-bold">État</th>
                  <th className="px-3 py-2 font-bold text-right">Sessions</th>
                  {hasActions && <th className="px-3 py-2 font-bold text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {types.map((t) => (
                  <tr key={t.id} className={`border-t border-[#eaedff] transition-colors ${edit?.id === t.id ? 'bg-[#eaedff]/60' : 'hover:bg-[#faf8ff]'} ${t.actif ? '' : 'opacity-60'}`}>
                    <td className="px-3 py-2"><span className="inline-flex items-center text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-[#eaedff] text-[#00236f]">{t.code}</span></td>
                    <td className="px-3 py-2 font-semibold text-[#131b2e]">{t.libelleCourt}</td>
                    <td className="px-3 py-2 text-[#131b2e]">{t.libelleLong}</td>
                    <td className="px-3 py-2 text-[#444651]">{CYCLE_EXAMEN_LABELS[t.cycle] ?? t.cycle}</td>
                    <td className="px-3 py-2 text-right font-mono text-[#444651]">{t.ordre}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${t.actif ? 'bg-[#dcfce7] text-[#166534]' : 'bg-[#ffdad6] text-[#ba1a1a]'}`}>
                        {t.actif ? 'Actif' : 'Désactivé'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-[#131b2e]">{new Intl.NumberFormat('fr-FR').format(t.sessions ?? 0)}</td>
                    {hasActions && (
                      <td className="px-3 py-1.5 whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {canModifier && (
                            <button type="button" onClick={() => { setEdit(t); setForm(versFormulaire(t)); }} className={`${ghost} text-[#00236f]`} title="Modifier">
                              <span className="material-symbols-outlined text-base">edit</span>
                              <span className="hidden md:inline">Modifier</span>
                            </button>
                          )}
                          {canModifier && (
                            <button
                              type="button"
                              onClick={() => void basculerActif(t)}
                              className={`${ghost} ${t.actif ? 'text-[#92400e] hover:bg-[#fef3c7]' : 'text-[#166534] hover:bg-[#dcfce7]'}`}
                              title={t.actif ? 'Désactiver (les sessions existantes le conservent)' : 'Réactiver'}
                            >
                              <span className="material-symbols-outlined text-base">{t.actif ? 'block' : 'check_circle'}</span>
                              <span className="hidden md:inline">{t.actif ? 'Désactiver' : 'Réactiver'}</span>
                            </button>
                          )}
                          {canSupprimer && (
                            <button
                              type="button"
                              onClick={() => void supprimer(t)}
                              disabled={t.sessions > 0}
                              className={`${ghost} text-[#ba1a1a] hover:bg-[#ffdad6]`}
                              title={t.sessions > 0 ? `Utilisé par ${t.sessions} session${t.sessions > 1 ? 's' : ''} : désactivez-le plutôt` : 'Supprimer'}
                              aria-label={t.sessions > 0 ? `Supprimer (indisponible : utilisé par ${t.sessions} session${t.sessions > 1 ? 's' : ''})` : 'Supprimer'}
                            >
                              <span className="material-symbols-outlined text-base">delete</span>
                              <span className="hidden md:inline">Supprimer</span>
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {edit && (
          <div className="flex flex-wrap items-center gap-2 rounded border border-[#dce1ff] bg-[#f2f3ff] px-3 py-2 text-[12px] text-[#00236f]">
            <span className="material-symbols-outlined text-base text-[#0051d5]">edit</span>
            <span><strong>Modification de « {edit.libelleCourt} »</strong> <span className="text-[#444651]">— {edit.sessions} session{edit.sessions > 1 ? 's' : ''} rattachée{edit.sessions > 1 ? 's' : ''} ; renommer met à jour leur libellé.</span></span>
          </div>
        )}

        {(canCreer || (edit && canModifier)) && (
          <form className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3" onSubmit={(e) => void enregistrer(e)}>
            <Field label="Code">
              <input required maxLength={20} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} className={`${field} font-mono uppercase`} placeholder="BEPC" />
            </Field>
            <Field label="Libellé court">
              <input required maxLength={60} value={form.libelleCourt} onChange={(e) => setForm({ ...form, libelleCourt: e.target.value })} className={field} placeholder="BEPC" />
            </Field>
            <Field label="Libellé long (bulletin)" className="sm:col-span-2">
              <input required maxLength={160} value={form.libelleLong} onChange={(e) => setForm({ ...form, libelleLong: e.target.value })} className={field} placeholder="Brevet d’Études du Premier Cycle" />
            </Field>
            <Field label="Cycle">
              <select value={form.cycle} onChange={(e) => setForm({ ...form, cycle: e.target.value as CycleExamen })} className={field}>
                {CYCLES_EXAMEN.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
              </select>
            </Field>
            <Field label="Ordre">
              <input type="number" min={0} step={1} value={form.ordre} onChange={(e) => setForm({ ...form, ordre: e.target.value })} className={field} placeholder="20" />
            </Field>
            <label className="col-span-full inline-flex items-center gap-2 text-[12px] text-[#444651]">
              <input type="checkbox" checked={form.actif} onChange={(e) => setForm({ ...form, actif: e.target.checked })} className="accent-[#00236f]" />
              Proposé aux établissements (actif)
            </label>
            <div className="col-span-full flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
              {edit && (
                <button type="button" className={`${ghost} px-4 py-2 w-full sm:w-auto`} onClick={reset}>
                  <span className="material-symbols-outlined text-base">add</span>
                  Nouveau type
                </button>
              )}
              <button type="submit" disabled={saving} className={primary}>
                <span className="material-symbols-outlined text-base">{edit ? 'save' : 'add_circle'}</span>
                {edit ? 'Mettre à jour' : 'Créer le type d’examen'}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
};
