import React, { useEffect, useMemo, useState } from 'react';
import { ROLE_LABELS, apiDelete, apiGet, apiSend, getSession, roleLabel } from '../api/client';
import { usePermissions, Ressource } from '../api/permissions';
import { confirmAction, confirmDelete, showError, toastSuccess } from '../utils/alerts';
import { PermissionMatrix, RessourceRef } from './PermissionMatrix';

/**
 * Gestion des comptes et de leurs droits.
 * - mode « etablissement » : /api/utilisateurs (onglet « Utilisateurs & droits » de l’Administration).
 * - mode « plateforme » : /api/plateforme/gestionnaires (onglet « Gestionnaires » de la Plateforme).
 */

export interface CompteVue {
  id: number;
  nom: string;
  email: string;
  role: string;
  actif: boolean;
  etablissementId: number | null;
  professeurId?: number | null;
  creePar?: number | null;
  restreignable: boolean;
  permissions: string[] | null;
}

interface Referentiel { ressources: RessourceRef[]; prereglages: Record<string, string[]> }
interface Professeur { id: number; nom: string }

interface UtilisateursSectionProps {
  mode: 'etablissement' | 'plateforme';
  /** Appelé après une création / modification / suppression. */
  onChanged?: () => void;
}

const field = 'w-full bg-[#f2f3ff] text-[13px] py-2 px-3 rounded border border-[#eaedff] outline-none focus:bg-white focus:border-[#0051d5] disabled:opacity-60 disabled:cursor-not-allowed';
const primary = 'inline-flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2 rounded bg-[#00236f] text-white text-[12px] font-bold hover:bg-[#1e3a8a] transition-colors shadow-xs disabled:opacity-50 disabled:cursor-not-allowed';
const ghost = 'inline-flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2 rounded bg-[#f2f3ff] text-[#444651] text-[12px] font-semibold hover:bg-[#e2e7ff] transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
const rowBtn = 'inline-flex items-center gap-1 px-2 py-1 rounded text-[12px] font-semibold transition-colors';

const Field: React.FC<{ label: string; className?: string; children: React.ReactNode }> = ({ label, className = '', children }) => (
  <label className={`flex flex-col gap-1 min-w-0 ${className}`}>
    <span className="text-[11px] font-bold uppercase tracking-wide text-[#444651]">{label}</span>
    {children}
  </label>
);

const Badge: React.FC<{ tone?: 'blue' | 'green' | 'grey' | 'red'; children: React.ReactNode }> = ({ tone = 'grey', children }) => {
  const tones = {
    blue: 'bg-[#eaedff] text-[#00236f]',
    green: 'bg-[#dcfce7] text-[#166534]',
    grey: 'bg-[#f2f3ff] text-[#444651]',
    red: 'bg-[#ffdad6] text-[#ba1a1a]',
  };
  return <span className={`inline-flex items-center text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${tones[tone]}`}>{children}</span>;
};

export const UtilisateursSection: React.FC<UtilisateursSectionProps> = ({ mode, onChanged }) => {
  const plateforme = mode === 'plateforme';
  const base = plateforme ? '/api/plateforme/gestionnaires' : '/api/utilisateurs';
  const ressource: Ressource = plateforme ? 'GESTIONNAIRES' : 'UTILISATEURS';
  const { can, permissions: mesDroits } = usePermissions();
  const moi = getSession();

  const roles = plateforme ? ['GESTIONNAIRE_PLATEFORME'] : ['ADMIN', 'SECRETAIRE', 'ENSEIGNANT'];
  const [comptes, setComptes] = useState<CompteVue[]>([]);
  const [referentiel, setReferentiel] = useState<Referentiel | null>(null);
  const [profs, setProfs] = useState<Professeur[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [form, setForm] = useState({ nom: '', email: '', motDePasse: '', role: roles[0], professeurId: '' });
  const [formMatrix, setFormMatrix] = useState<Set<string> | null>(null);
  const [saving, setSaving] = useState(false);

  const [edit, setEdit] = useState<CompteVue | null>(null);
  const [editMatrix, setEditMatrix] = useState<Set<string>>(new Set());
  const [editInfos, setEditInfos] = useState({ nom: '', email: '', role: '', professeurId: '' });

  const canVoir = can(ressource, 'VOIR');
  const canDetails = can(ressource, 'DETAILS');
  const canCreer = can(ressource, 'CREER');
  const canModifier = can(ressource, 'MODIFIER');
  const canSupprimer = can(ressource, 'SUPPRIMER');

  const load = async () => {
    const [liste, ref] = await Promise.all([
      apiGet<CompteVue[]>(base),
      apiGet<Referentiel>(`${base}/referentiel`),
    ]);
    setComptes(liste);
    setReferentiel(ref);
    if (!plateforme && can('ENSEIGNANTS', 'VOIR')) {
      setProfs(await apiGet<Professeur[]>('/api/professeurs').catch(() => []));
    }
  };

  const reload = () => {
    setLoading(true);
    setLoadError('');
    load().catch((err: Error) => setLoadError(err.message)).finally(() => setLoading(false));
  };

  useEffect(() => {
    if (canVoir) reload();
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canVoir, base]);

  const prereglage = (role: string): Set<string> => new Set((referentiel?.prereglages[role] ?? []).filter((c) => mesDroits.includes(c)));

  const erreur = async (titre: string, err: unknown) => {
    await showError(titre, err instanceof Error ? err.message : 'Une erreur inattendue est survenue.');
  };

  const creer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.motDePasse.length < 6) {
      await showError('Mot de passe trop court', 'Le mot de passe temporaire doit contenir au moins 6 caractères.');
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = { nom: form.nom.trim(), email: form.email.trim(), motDePasse: form.motDePasse };
      if (!plateforme) body.role = form.role;
      if (!plateforme && form.role === 'ENSEIGNANT' && form.professeurId) body.professeurId = Number(form.professeurId);
      if (formMatrix) body.permissions = Array.from(formMatrix);
      await apiSend(base, 'POST', body);
      toastSuccess(`Compte créé pour ${form.nom.trim()}. Communiquez-lui le mot de passe temporaire.`);
      setForm({ nom: '', email: '', motDePasse: '', role: roles[0], professeurId: '' });
      setFormMatrix(null);
      await load();
      onChanged?.();
    } catch (err) {
      await erreur('Création impossible', err);
    } finally {
      setSaving(false);
    }
  };

  const ouvrir = async (compte: CompteVue) => {
    try {
      const detail = canDetails ? await apiGet<CompteVue>(`${base}/${compte.id}`) : compte;
      setEdit(detail);
      setEditMatrix(new Set(detail.permissions ?? []));
      setEditInfos({ nom: detail.nom, email: detail.email, role: detail.role, professeurId: detail.professeurId ? String(detail.professeurId) : '' });
    } catch (err) {
      await erreur('Fiche introuvable', err);
    }
  };

  const fermer = () => setEdit(null);

  const enregistrerDroits = async () => {
    if (!edit) return;
    setSaving(true);
    try {
      const maj = await apiSend<CompteVue>(`${base}/${edit.id}/permissions`, 'PUT', { permissions: Array.from(editMatrix) });
      setEdit(maj);
      setEditMatrix(new Set(maj.permissions ?? []));
      toastSuccess(`Droits de ${maj.nom} enregistrés.`);
      await load();
    } catch (err) {
      await erreur('Enregistrement des droits impossible', err);
    } finally {
      setSaving(false);
    }
  };

  const appliquerPrereglage = async () => {
    if (!edit) return;
    const ok = await confirmAction({
      title: 'Appliquer le préréglage du rôle',
      text: `La matrice de ${edit.nom} sera remplacée par les droits par défaut du rôle « ${roleLabel(edit.role)} » (limités aux vôtres).`,
      confirmText: 'Appliquer',
    });
    if (!ok) return;
    setSaving(true);
    try {
      const maj = await apiSend<CompteVue>(`${base}/${edit.id}/permissions/prereglage`, 'POST', {});
      setEdit(maj);
      setEditMatrix(new Set(maj.permissions ?? []));
      toastSuccess('Préréglage appliqué.');
      await load();
    } catch (err) {
      await erreur('Préréglage impossible', err);
    } finally {
      setSaving(false);
    }
  };

  const enregistrerInfos = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!edit) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = { nom: editInfos.nom.trim(), email: editInfos.email.trim() };
      if (!plateforme) {
        body.role = editInfos.role;
        if (editInfos.role === 'ENSEIGNANT' && editInfos.professeurId) body.professeurId = Number(editInfos.professeurId);
      }
      const maj = await apiSend<CompteVue>(`${base}/${edit.id}`, 'PUT', body);
      setEdit(maj);
      setEditMatrix(new Set(maj.permissions ?? []));
      toastSuccess('Compte mis à jour.');
      await load();
      onChanged?.();
    } catch (err) {
      await erreur('Mise à jour impossible', err);
    } finally {
      setSaving(false);
    }
  };

  const basculerActif = async (compte: CompteVue) => {
    const ok = await confirmAction({
      title: compte.actif ? 'Désactiver ce compte' : 'Réactiver ce compte',
      text: compte.actif
        ? `${compte.nom} ne pourra plus se connecter. Ses données et ses droits sont conservés.`
        : `${compte.nom} pourra de nouveau se connecter avec ses droits actuels.`,
      confirmText: compte.actif ? 'Désactiver' : 'Réactiver',
      icon: compte.actif ? 'warning' : 'question',
    });
    if (!ok) return;
    try {
      const maj = await apiSend<CompteVue>(`${base}/${compte.id}`, 'PUT', { actif: !compte.actif });
      toastSuccess(maj.actif ? `${maj.nom} réactivé.` : `${maj.nom} désactivé.`);
      if (edit?.id === maj.id) setEdit(maj);
      await load();
      onChanged?.();
    } catch (err) {
      await erreur('Changement d’état impossible', err);
    }
  };

  const reinitialiser = async (compte: CompteVue) => {
    const motDePasse = window.prompt(`Nouveau mot de passe temporaire pour ${compte.nom} (6 caractères minimum) :`);
    if (motDePasse == null) return;
    if (motDePasse.length < 6) {
      await showError('Mot de passe trop court', 'Le mot de passe temporaire doit contenir au moins 6 caractères.');
      return;
    }
    try {
      await apiSend(`${base}/${compte.id}/reinitialiser-mot-de-passe`, 'POST', { motDePasse });
      toastSuccess(`Mot de passe de ${compte.nom} réinitialisé. Communiquez-le-lui directement : aucun email n’est envoyé.`);
    } catch (err) {
      await erreur('Réinitialisation impossible', err);
    }
  };

  const supprimer = async (compte: CompteVue) => {
    const ok = await confirmDelete(compte.nom, 'Le compte et sa matrice de droits sont supprimés définitivement. Préférez la désactivation pour conserver l’historique.');
    if (!ok) return;
    try {
      await apiDelete(`${base}/${compte.id}`);
      toastSuccess(`Compte de ${compte.nom} supprimé.`);
      if (edit?.id === compte.id) setEdit(null);
      await load();
      onChanged?.();
    } catch (err) {
      await erreur('Suppression impossible', err);
    }
  };

  const estMoi = (compte: CompteVue) => moi?.utilisateurId != null && compte.id === moi.utilisateurId;
  const ressources = useMemo(() => referentiel?.ressources ?? [], [referentiel]);

  if (!canVoir) {
    return (
      <div className="bg-white border border-[#eaedff] rounded p-6 flex items-start gap-4 shadow-xs">
        <span className="shrink-0 w-10 h-10 rounded bg-[#eaedff] text-[#0051d5] flex items-center justify-center">
          <span className="material-symbols-outlined">lock</span>
        </span>
        <div>
          <h3 className="text-[14px] font-bold text-[#00236f]">Accès réservé</h3>
          <p className="text-[13px] text-[#444651] mt-1">
            Votre compte ne détient pas le droit « Voir » sur {plateforme ? 'les gestionnaires' : 'les utilisateurs'}. Rapprochez-vous {plateforme ? 'du propriétaire du logiciel' : 'du responsable de l’établissement'}.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="bg-white p-5 rounded border border-[#eaedff] shadow-xs space-y-4">
        <header className="flex flex-wrap items-start justify-between gap-2 border-b border-[#eaedff] pb-3">
          <div className="flex items-start gap-3 min-w-0">
            <span className="shrink-0 w-9 h-9 rounded bg-[#eaedff] text-[#0051d5] flex items-center justify-center">
              <span className="material-symbols-outlined text-xl">manage_accounts</span>
            </span>
            <div className="min-w-0">
              <h3 className="text-[14px] font-bold text-[#00236f] uppercase tracking-wide">
                {plateforme ? 'Gestionnaires de la plateforme' : 'Utilisateurs & droits'}
              </h3>
              <p className="text-[12px] text-[#444651] mt-0.5">
                {plateforme
                  ? 'Sous-administrateurs du logiciel. Chaque droit (voir, détails, créer, modifier, supprimer) se règle case par case.'
                  : 'Comptes du personnel (administration, secrétariat, enseignants). Chaque action se règle case par case, partout dans les données de l’établissement.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-[11px] font-bold text-[#00236f] bg-[#f2f3ff] border border-[#eaedff] px-2.5 py-1 rounded-full">
              {comptes.length} {comptes.length > 1 ? 'comptes' : 'compte'}
            </span>
            <button type="button" onClick={reload} disabled={loading} className={ghost}>
              <span className={`material-symbols-outlined text-base ${loading ? 'animate-spin' : ''}`}>refresh</span>
              {loading ? 'Chargement…' : 'Actualiser'}
            </button>
          </div>
        </header>

        {loadError && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded border border-[#ffdad6] bg-[#fff5f4] px-4 py-3 text-[13px] text-[#ba1a1a]">
            <span className="inline-flex items-center gap-2"><span className="material-symbols-outlined text-base">error</span>{loadError}</span>
            <button type="button" onClick={reload} className="font-bold underline">Réessayer</button>
          </div>
        )}

        {comptes.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center gap-1 rounded border border-dashed border-[#dce1ff] bg-[#f2f3ff] px-4 py-6 text-center">
            <span className="material-symbols-outlined text-2xl text-[#757682]">person_off</span>
            <p className="text-[13px] font-semibold text-[#444651]">Aucun compte pour l’instant</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded border border-[#eaedff]">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-[#f2f3ff] text-left text-[11px] uppercase tracking-wide text-[#444651]">
                  <th className="px-3 py-2 font-bold">Nom</th>
                  <th className="px-3 py-2 font-bold">Email</th>
                  <th className="px-3 py-2 font-bold">Rôle</th>
                  <th className="px-3 py-2 font-bold">État</th>
                  {canDetails && <th className="px-3 py-2 font-bold text-right">Droits</th>}
                  <th className="px-3 py-2 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {comptes.map((compte) => {
                  const verrou = !compte.restreignable;
                  const soi = estMoi(compte);
                  return (
                    <tr key={compte.id} className={`border-t border-[#eaedff] transition-colors ${edit?.id === compte.id ? 'bg-[#eaedff]/60' : 'hover:bg-[#faf8ff]'}`}>
                      <td className="px-3 py-2 font-semibold text-[#131b2e]">
                        {compte.nom}
                        {soi && <span className="ml-2 text-[10px] font-bold uppercase text-[#0051d5]">(vous)</span>}
                      </td>
                      <td className="px-3 py-2 text-[#444651]">{compte.email}</td>
                      <td className="px-3 py-2"><Badge tone={verrou ? 'blue' : 'grey'}>{ROLE_LABELS[compte.role] ?? compte.role}</Badge></td>
                      <td className="px-3 py-2">{compte.actif ? <Badge tone="green">Actif</Badge> : <Badge tone="red">Désactivé</Badge>}</td>
                      {canDetails && (
                        <td className="px-3 py-2 text-right text-[12px] text-[#444651]">
                          {verrou ? 'Tous les droits' : `${compte.permissions?.length ?? 0} droit${(compte.permissions?.length ?? 0) > 1 ? 's' : ''}`}
                        </td>
                      )}
                      <td className="px-3 py-1.5 whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {(canDetails || canModifier) && !verrou && !soi && (
                            <button type="button" onClick={() => void ouvrir(compte)} title={canModifier ? 'Modifier les droits' : 'Voir les droits'} className={`${rowBtn} text-[#00236f] hover:bg-[#eaedff]`}>
                              <span className="material-symbols-outlined text-base">{canModifier ? 'tune' : 'visibility'}</span>
                              <span className="hidden md:inline">{canModifier ? 'Droits' : 'Voir'}</span>
                            </button>
                          )}
                          {canModifier && !verrou && !soi && (
                            <>
                              <button type="button" onClick={() => void reinitialiser(compte)} title="Réinitialiser le mot de passe" className={`${rowBtn} text-[#00236f] hover:bg-[#eaedff]`}>
                                <span className="material-symbols-outlined text-base">key</span>
                                <span className="hidden lg:inline">Mot de passe</span>
                              </button>
                              <button type="button" onClick={() => void basculerActif(compte)} title={compte.actif ? 'Désactiver' : 'Réactiver'} className={`${rowBtn} ${compte.actif ? 'text-[#8a5a00] hover:bg-[#fff1d6]' : 'text-[#166534] hover:bg-[#dcfce7]'}`}>
                                <span className="material-symbols-outlined text-base">{compte.actif ? 'person_off' : 'person_check'}</span>
                                <span className="hidden lg:inline">{compte.actif ? 'Désactiver' : 'Réactiver'}</span>
                              </button>
                            </>
                          )}
                          {canSupprimer && !verrou && !soi && (
                            <button type="button" onClick={() => void supprimer(compte)} title="Supprimer" className={`${rowBtn} text-[#ba1a1a] hover:bg-[#ffdad6]`}>
                              <span className="material-symbols-outlined text-base">delete</span>
                              <span className="hidden md:inline">Supprimer</span>
                            </button>
                          )}
                          {(verrou || soi) && <span className="text-[11px] text-[#757682] px-2">{verrou ? 'Droits complets' : 'Votre compte'}</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Édition d’un compte */}
      {edit && (
        <section className="bg-white p-5 rounded border border-[#dce1ff] shadow-xs space-y-4">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[#eaedff] pb-3">
            <div className="flex items-center gap-2 text-[13px] text-[#00236f]">
              <span className="material-symbols-outlined text-base text-[#0051d5]">tune</span>
              <strong>Droits de {edit.nom}</strong>
              <span className="text-[#444651]">— {roleLabel(edit.role)} · {edit.email}</span>
            </div>
            <button type="button" onClick={fermer} className={ghost}>
              <span className="material-symbols-outlined text-base">close</span>
              Fermer
            </button>
          </header>

          {canModifier && (
            <form className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3" onSubmit={enregistrerInfos}>
              <Field label="Nom" className="lg:col-span-2">
                <input required value={editInfos.nom} onChange={(e) => setEditInfos({ ...editInfos, nom: e.target.value })} className={field} />
              </Field>
              <Field label="Email" className="lg:col-span-2">
                <input required type="email" value={editInfos.email} onChange={(e) => setEditInfos({ ...editInfos, email: e.target.value })} className={field} />
              </Field>
              {!plateforme && (
                <Field label="Rôle (préréglage)">
                  <select value={editInfos.role} onChange={(e) => setEditInfos({ ...editInfos, role: e.target.value })} className={field}>
                    {roles.map((r) => <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>)}
                  </select>
                </Field>
              )}
              {!plateforme && editInfos.role === 'ENSEIGNANT' && (
                <Field label="Fiche enseignant reliée" className="lg:col-span-2">
                  <select value={editInfos.professeurId} onChange={(e) => setEditInfos({ ...editInfos, professeurId: e.target.value })} className={field}>
                    <option value="">Aucune</option>
                    {profs.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
                  </select>
                </Field>
              )}
              <div className="col-span-full flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                <button type="submit" disabled={saving} className={primary}>
                  <span className="material-symbols-outlined text-base">save</span>
                  Enregistrer le compte
                </button>
              </div>
            </form>
          )}

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[12px] text-[#444651]">
                Cochez les actions autorisées. Les cases grisées sont des droits que vous ne détenez pas vous-même : impossible de les accorder.
                {!plateforme && edit.role === 'ENSEIGNANT' && ' Un enseignant ne saisit des notes que dans ses propres affectations.'}
              </p>
              {canModifier && (
                <button type="button" onClick={() => void appliquerPrereglage()} disabled={saving} className={ghost}>
                  <span className="material-symbols-outlined text-base">restart_alt</span>
                  Appliquer le préréglage du rôle
                </button>
              )}
            </div>
            <PermissionMatrix
              ressources={ressources}
              value={editMatrix}
              onChange={setEditMatrix}
              editorPermissions={mesDroits}
              disabled={!canModifier || saving}
            />
            {canModifier && (
              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
                <button type="button" onClick={() => setEditMatrix(new Set(edit.permissions ?? []))} disabled={saving} className={ghost}>
                  Annuler les changements
                </button>
                <button type="button" onClick={() => void enregistrerDroits()} disabled={saving} className={primary}>
                  <span className="material-symbols-outlined text-base">verified_user</span>
                  Enregistrer les droits
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Création */}
      {canCreer && (
        <section className="bg-white p-5 rounded border border-[#eaedff] shadow-xs space-y-4">
          <header className="flex items-start gap-3 border-b border-[#eaedff] pb-3">
            <span className="shrink-0 w-9 h-9 rounded bg-[#eaedff] text-[#0051d5] flex items-center justify-center">
              <span className="material-symbols-outlined text-xl">person_add</span>
            </span>
            <div>
              <h3 className="text-[14px] font-bold text-[#00236f] uppercase tracking-wide">
                {plateforme ? 'Ajouter un gestionnaire' : 'Ajouter un utilisateur'}
              </h3>
              <p className="text-[12px] text-[#444651] mt-0.5">
                Un mot de passe temporaire est défini ici et communiqué directement à la personne : aucun email n’est envoyé.
              </p>
            </div>
          </header>
          <form className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3" onSubmit={(e) => void creer(e)}>
            <Field label="Nom complet" className="lg:col-span-2">
              <input required placeholder="Nom Prénom" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} className={field} />
            </Field>
            <Field label="Email de connexion" className="lg:col-span-2">
              <input required type="email" placeholder="prenom@ecole.tg" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={field} />
            </Field>
            <Field label="Mot de passe temporaire">
              <input required type="text" minLength={6} placeholder="6 caractères min." value={form.motDePasse} onChange={(e) => setForm({ ...form, motDePasse: e.target.value })} className={field} autoComplete="off" />
            </Field>
            {!plateforme && (
              <Field label="Rôle (préréglage)">
                <select value={form.role} onChange={(e) => { setForm({ ...form, role: e.target.value }); setFormMatrix(null); }} className={field}>
                  {roles.map((r) => <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>)}
                </select>
              </Field>
            )}
            {!plateforme && form.role === 'ENSEIGNANT' && (
              <Field label="Fiche enseignant à relier" className="lg:col-span-2">
                <select value={form.professeurId} onChange={(e) => setForm({ ...form, professeurId: e.target.value })} className={field}>
                  <option value="">Aucune (à relier plus tard)</option>
                  {profs.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
                </select>
              </Field>
            )}
            <div className="col-span-full space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[12px] text-[#444651]">
                  {formMatrix
                    ? 'Matrice personnalisée : seules les cases cochées seront accordées.'
                    : `Sans personnalisation, le compte reçoit le préréglage « ${ROLE_LABELS[form.role] ?? form.role} » (limité à vos propres droits).`}
                </p>
                <button type="button" className={ghost} onClick={() => setFormMatrix(formMatrix ? null : prereglage(form.role))}>
                  <span className="material-symbols-outlined text-base">{formMatrix ? 'undo' : 'tune'}</span>
                  {formMatrix ? 'Revenir au préréglage' : 'Personnaliser les droits'}
                </button>
              </div>
              {formMatrix && (
                <PermissionMatrix ressources={ressources} value={formMatrix} onChange={setFormMatrix} editorPermissions={mesDroits} />
              )}
            </div>
            <div className="col-span-full flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
              <button type="submit" disabled={saving} className={primary}>
                <span className="material-symbols-outlined text-base">person_add</span>
                {plateforme ? 'Créer le gestionnaire' : 'Créer l’utilisateur'}
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
};
