import React, { useEffect, useState } from 'react';
import {
  PrereglageNationalPlateforme,
  SaisiePrereglage,
  activerPrereglage,
  creerPrereglage,
  definirPrereglageParDefaut,
  loadPrereglagesPlateforme,
  modifierPrereglage,
  supprimerPrereglage,
} from '../../api/prereglages';
import { usePermissions } from '../../api/permissions';
import { confirmAction, confirmDelete, showError, toastSuccess } from '../../utils/alerts';
import { drapeau } from '../../utils/prereglages';
import { ministryMark } from '../../utils/bulletinHeader';

/**
 * Onglet « Pays & ministères » de la vue Plateforme : référentiel des préréglages nationaux
 * (république, devise, ministère, sigle) proposés aux établissements dans « Préréglages nationaux en 1 clic ».
 */

type Formulaire = {
  code: string;
  nomPays: string;
  republique: string;
  devise: string;
  ministere: string;
  sigleMinistere: string;
  autoriteRegionale: string;
  piedDePage: string;
  ordre: string;
  parDefaut: boolean;
};

const FORMULAIRE_VIDE: Formulaire = {
  code: '', nomPays: '', republique: '', devise: '', ministere: '', sigleMinistere: '',
  autoriteRegionale: '', piedDePage: '', ordre: '0', parDefaut: false,
};

const field = 'w-full bg-[#f2f3ff] text-[13px] py-2 px-3 rounded border border-[#eaedff] outline-none focus:bg-white focus:border-[#0051d5]';
const primary = 'inline-flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2 rounded bg-[#00236f] text-white text-[12px] font-bold hover:bg-[#1e3a8a] transition-colors shadow-xs disabled:opacity-50';
const ghost = 'inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded bg-[#f2f3ff] text-[#444651] text-[12px] font-semibold hover:bg-[#e2e7ff] transition-colors disabled:opacity-50';

const Field: React.FC<{ label: string; className?: string; hint?: string; children: React.ReactNode }> = ({ label, className = '', hint, children }) => (
  <label className={`flex flex-col gap-1 min-w-0 ${className}`}>
    <span className="text-[11px] font-bold uppercase tracking-wide text-[#444651]">{label}</span>
    {children}
    {hint && <span className="text-[10px] text-[#444651] leading-snug">{hint}</span>}
  </label>
);

const versFormulaire = (item: PrereglageNationalPlateforme): Formulaire => ({
  code: item.code,
  nomPays: item.nomPays,
  republique: item.republique,
  devise: item.devise,
  ministere: item.ministere,
  sigleMinistere: item.sigleMinistere,
  autoriteRegionale: item.autoriteRegionale ?? '',
  piedDePage: item.piedDePage ?? '',
  ordre: String(item.ordre),
  parDefaut: item.parDefaut,
});

const versSaisie = (form: Formulaire): SaisiePrereglage => {
  const vide = (value: string) => (value.trim() === '' ? null : value.trim());
  return {
    code: form.code.trim().toUpperCase(),
    nomPays: form.nomPays.trim(),
    republique: form.republique.trim(),
    devise: form.devise.trim(),
    ministere: form.ministere.trim(),
    sigleMinistere: form.sigleMinistere.trim().toUpperCase(),
    autoriteRegionale: vide(form.autoriteRegionale),
    piedDePage: vide(form.piedDePage),
    ordre: Number.parseInt(form.ordre, 10) || 0,
    parDefaut: form.parDefaut || undefined,
  };
};

/** Aperçu de l'en-tête du bulletin tel qu'il sera imprimé avec ce préréglage. */
const ApercuEnTete: React.FC<{ form: Formulaire }> = ({ form }) => {
  const sigle = ministryMark({ ministryName: form.ministere, ministrySigle: form.sigleMinistere });
  return (
    <div className="rounded border border-[#dce1ff] bg-white p-4 shadow-xs" aria-label="Aperçu de l'en-tête du bulletin">
      <p className="text-[10px] font-bold uppercase tracking-wider text-[#0051d5] mb-3">Aperçu de l'en-tête du bulletin</p>
      <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3 text-center">
        <div className="text-[10px] font-bold uppercase leading-snug text-[#131b2e]">
          <p>{form.ministere.trim() || 'MINISTÈRE DE TUTELLE'}</p>
          {sigle && <p className="font-semibold text-[#444651] mt-0.5">{sigle}</p>}
          {form.autoriteRegionale.trim() && <p className="font-semibold text-[#444651] mt-0.5 normal-case">{form.autoriteRegionale.trim()}</p>}
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="w-14 h-14 rounded-full border border-dashed border-[#b0b7cb] flex items-center justify-center text-2xl" aria-hidden="true">
            {drapeau(form.code) || <span className="material-symbols-outlined text-[#9ca3af]">flag</span>}
          </div>
          <span className="text-[9px] font-bold uppercase text-[#444651]">Établissement</span>
        </div>
        <div className="text-[10px] font-bold uppercase leading-snug text-[#131b2e]">
          <p>{form.republique.trim() || 'RÉPUBLIQUE'}</p>
          <p className="font-semibold italic text-[#444651] normal-case mt-0.5">{form.devise.trim() || 'Devise nationale'}</p>
        </div>
      </div>
      {form.piedDePage.trim() && (
        <p className="mt-3 border-t border-dashed border-[#eaedff] pt-2 text-center text-[9px] text-[#444651]">
          {form.piedDePage.trim()}
        </p>
      )}
    </div>
  );
};

export const PrereglagesNationauxPanel: React.FC = () => {
  const { can, permissions } = usePermissions();
  const canVoir = can('PREREGLAGES', 'VOIR');
  const canCreer = can('PREREGLAGES', 'CREER');
  const canModifier = can('PREREGLAGES', 'MODIFIER');
  const canSupprimer = can('PREREGLAGES', 'SUPPRIMER');

  const [liste, setListe] = useState<PrereglageNationalPlateforme[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState<Formulaire>(FORMULAIRE_VIDE);
  const [edition, setEdition] = useState<PrereglageNationalPlateforme | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    if (!canVoir) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    loadPrereglagesPlateforme()
      .then(setListe)
      .catch((err: Error) => setError(err.message || 'Impossible de charger les préréglages nationaux.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [canVoir, permissions.join(',')]);

  const message = (err: unknown) => (err instanceof Error && err.message ? err.message : 'Une erreur inattendue est survenue.');

  const annulerEdition = () => {
    setEdition(null);
    setForm(FORMULAIRE_VIDE);
  };

  const editer = (item: PrereglageNationalPlateforme) => {
    setEdition(item);
    setForm(versFormulaire(item));
    document.getElementById('prereglage-formulaire')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const enregistrer = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const saisie = versSaisie(form);
      if (edition) {
        const maj = await modifierPrereglage(edition.id, saisie);
        toastSuccess(`Préréglage « ${maj.nomPays} » modifié.`);
      } else {
        const cree = await creerPrereglage(saisie);
        toastSuccess(`Préréglage « ${cree.nomPays} » créé : il est proposé aux établissements.`);
      }
      annulerEdition();
      load();
    } catch (err) {
      await showError(edition ? 'Modification impossible' : 'Création impossible', message(err));
    } finally {
      setSaving(false);
    }
  };

  const basculerActif = async (item: PrereglageNationalPlateforme) => {
    const ok = await confirmAction(item.actif
      ? {
        title: 'Désactiver ce préréglage',
        text: `« ${item.nomPays} » ne sera plus proposé aux établissements. Ceux qui l'ont déjà appliqué conservent leur en-tête.`,
        confirmText: 'Désactiver',
        icon: 'warning',
      }
      : {
        title: 'Réactiver ce préréglage',
        text: `« ${item.nomPays} » sera de nouveau proposé dans « Préréglages nationaux en 1 clic ».`,
        confirmText: 'Réactiver',
      });
    if (!ok) return;
    try {
      await activerPrereglage(item.id, !item.actif);
      toastSuccess(`« ${item.nomPays} » ${item.actif ? 'désactivé' : 'réactivé'}.`);
      load();
    } catch (err) {
      await showError(item.actif ? 'Désactivation impossible' : 'Réactivation impossible', message(err));
    }
  };

  const definirDefaut = async (item: PrereglageNationalPlateforme) => {
    const ok = await confirmAction({
      title: 'Définir comme préréglage par défaut',
      text: `« ${item.nomPays} » sera affiché sur la vitrine et les pages de connexion, et appliqué aux nouveaux établissements.`,
      confirmText: 'Définir par défaut',
    });
    if (!ok) return;
    try {
      await definirPrereglageParDefaut(item.id);
      toastSuccess(`« ${item.nomPays} » est le préréglage par défaut.`);
      load();
    } catch (err) {
      await showError('Action impossible', message(err));
    }
  };

  const supprimer = async (item: PrereglageNationalPlateforme) => {
    const ok = await confirmDelete(`${item.nomPays} (${item.code})`, 'Suppression définitive : préférez la désactivation si un doute subsiste.');
    if (!ok) return;
    try {
      await supprimerPrereglage(item.id);
      toastSuccess(`« ${item.nomPays} » supprimé.`);
      if (edition?.id === item.id) annulerEdition();
      load();
    } catch (err) {
      await showError('Suppression impossible', message(err));
    }
  };

  if (!canVoir) {
    return (
      <div className="bg-white border border-[#eaedff] rounded p-6 text-[13px] text-[#444651]">
        Votre compte ne détient pas le droit de consulter les préréglages nationaux (PREREGLAGES:VOIR).
      </div>
    );
  }

  const actifs = liste.filter((item) => item.actif).length;
  const utilisations = liste.reduce((acc, item) => acc + (item.etablissements ?? 0), 0);

  return (
    <div className="space-y-6" data-testid="prereglages-plateforme">
      <section className="bg-white rounded border border-[#eaedff] shadow-xs p-5 space-y-1">
        <h3 className="text-[15px] font-bold text-[#00236f]">Pays &amp; ministères</h3>
        <p className="text-[12.5px] text-[#444651] max-w-3xl">
          Référentiel des préréglages nationaux proposés aux établissements dans « Préréglages nationaux en 1 clic » :
          république, devise, ministère de tutelle et sigle imprimés en en-tête des bulletins. Le préréglage par défaut sert
          à la vitrine, aux pages de connexion et aux nouveaux établissements.
        </p>
      </section>

      {loading && <div className="bg-white border border-[#eaedff] rounded p-6 text-[13px] text-[#444651]">Chargement des préréglages…</div>}
      {!loading && error && <div className="bg-white border border-[#eaedff] rounded p-6 text-[13px] text-[#ba1a1a]">{error}</div>}

      {!loading && !error && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { label: 'Préréglages', value: liste.length, icon: 'public' },
              { label: 'Actifs', value: actifs, icon: 'check_circle' },
              { label: 'Établissements rattachés', value: utilisations, icon: 'domain' },
            ].map((carte) => (
              <div key={carte.label} className="bg-white border border-[#eaedff] rounded p-4 shadow-xs">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[#444651]">
                  <span className="material-symbols-outlined text-base text-[#0051d5]">{carte.icon}</span>
                  <span>{carte.label}</span>
                </div>
                <p className="mt-2 text-[22px] font-bold text-[#00236f] leading-none">{new Intl.NumberFormat('fr-FR').format(carte.value)}</p>
              </div>
            ))}
          </div>

          {liste.length === 0 ? (
            <div className="bg-white border border-dashed border-[#dce1ff] rounded p-10 text-center space-y-2">
              <span className="material-symbols-outlined text-4xl text-[#0051d5]">flag</span>
              <h3 className="text-[16px] font-bold text-[#00236f]">Aucun préréglage national</h3>
              <p className="text-[13px] text-[#444651]">Créez le premier préréglage ci-dessous : il deviendra celui par défaut.</p>
            </div>
          ) : (
            <div className="bg-white border border-[#eaedff] rounded shadow-xs overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-[13px]">
                <thead className="bg-[#f2f3ff] text-[11px] uppercase tracking-wider text-[#444651]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Pays</th>
                    <th className="px-4 py-3 font-semibold">En-tête du bulletin</th>
                    <th className="px-4 py-3 font-semibold">Ministère</th>
                    <th className="px-4 py-3 font-semibold">État</th>
                    <th className="px-4 py-3 font-semibold text-right">Établissements</th>
                    {(canModifier || canSupprimer) && <th className="px-4 py-3 font-semibold text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {liste.map((item) => (
                    <tr key={item.id} className={`border-t border-[#eaedff] align-top ${item.actif ? '' : 'opacity-60'}`}>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-[#00236f] flex items-center gap-2">
                          <span className="text-xl" aria-hidden="true">{drapeau(item.code)}</span>
                          <span>{item.nomPays}</span>
                        </p>
                        <p className="text-[11px] text-[#444651]">{item.code} · ordre {item.ordre}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-[#131b2e] uppercase text-[12px]">{item.republique}</p>
                        <p className="text-[12px] italic text-[#444651]">{item.devise}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-[12px] text-[#131b2e] uppercase">{item.ministere}</p>
                        <p className="text-[11px] text-[#444651]">({item.sigleMinistere}){item.autoriteRegionale ? ` · ${item.autoriteRegionale}` : ''}</p>
                      </td>
                      <td className="px-4 py-3 space-y-1">
                        <span className={`inline-flex items-center text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${item.actif ? 'bg-[#dcfce7] text-[#166534]' : 'bg-[#ffdad6] text-[#ba1a1a]'}`}>
                          {item.actif ? 'Actif' : 'Désactivé'}
                        </span>
                        {item.parDefaut && (
                          <span className="block w-fit text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-[#eaedff] text-[#00236f]">
                            Par défaut
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-[#131b2e]">{new Intl.NumberFormat('fr-FR').format(item.etablissements ?? 0)}</td>
                      {(canModifier || canSupprimer) && (
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap justify-end gap-1.5">
                            {canModifier && (
                              <button type="button" onClick={() => editer(item)} className={ghost} title="Modifier">
                                <span className="material-symbols-outlined text-base">edit</span>
                                Modifier
                              </button>
                            )}
                            {canModifier && item.actif && !item.parDefaut && (
                              <button type="button" onClick={() => void definirDefaut(item)} className={ghost} title="Définir par défaut">
                                <span className="material-symbols-outlined text-base">star</span>
                                Par défaut
                              </button>
                            )}
                            {item.actif && canSupprimer && !item.parDefaut && (
                              <button type="button" onClick={() => void basculerActif(item)} className={`${ghost} text-[#ba1a1a] hover:bg-[#ffdad6]`} title="Désactiver (n'est plus proposé)">
                                <span className="material-symbols-outlined text-base">block</span>
                                Désactiver
                              </button>
                            )}
                            {!item.actif && canModifier && (
                              <button type="button" onClick={() => void basculerActif(item)} className={`${ghost} text-[#166534] hover:bg-[#dcfce7]`} title="Réactiver">
                                <span className="material-symbols-outlined text-base">check_circle</span>
                                Réactiver
                              </button>
                            )}
                            {canSupprimer && !item.parDefaut && (item.etablissements ?? 0) === 0 && (
                              <button type="button" onClick={() => void supprimer(item)} className={`${ghost} text-[#ba1a1a] hover:bg-[#ffdad6]`} title="Supprimer définitivement (aucun établissement rattaché)">
                                <span className="material-symbols-outlined text-base">delete</span>
                                Supprimer
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
        </>
      )}

      {(canCreer || (canModifier && edition)) && (
        <section id="prereglage-formulaire" className="bg-white p-5 rounded border border-[#eaedff] shadow-xs space-y-4">
          <header className="flex items-start gap-3 border-b border-[#eaedff] pb-3">
            <span className="shrink-0 w-9 h-9 rounded bg-[#eaedff] text-[#0051d5] flex items-center justify-center">
              <span className="material-symbols-outlined text-xl">{edition ? 'edit_location_alt' : 'add_location_alt'}</span>
            </span>
            <div className="min-w-0">
              <h3 className="text-[14px] font-bold text-[#00236f] uppercase tracking-wide">
                {edition ? `Modifier « ${edition.nomPays} »` : 'Ajouter un pays / système éducatif'}
              </h3>
              <p className="text-[12px] text-[#444651] mt-0.5">
                Les libellés sont copiés dans l'en-tête de l'établissement quand il applique le préréglage ; il peut ensuite les ajuster.
                Modifier un préréglage ne change pas les établissements qui l'ont déjà appliqué.
              </p>
            </div>
          </header>
          <form className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-5" onSubmit={(e) => void enregistrer(e)}>
            <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
              <Field label="Code ISO" className="sm:col-span-1" hint="2 lettres">
                <input required maxLength={2} pattern="[A-Za-z]{2}" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} className={`${field} uppercase`} placeholder="TG" />
              </Field>
              <Field label="Pays" className="sm:col-span-3">
                <input required maxLength={120} value={form.nomPays} onChange={(e) => setForm({ ...form, nomPays: e.target.value })} className={field} placeholder="Togo" />
              </Field>
              <Field label="Ordre" className="sm:col-span-2" hint="Position dans la liste">
                <input type="number" min={0} max={9999} value={form.ordre} onChange={(e) => setForm({ ...form, ordre: e.target.value })} className={field} />
              </Field>
              <Field label="Nom officiel de la république" className="sm:col-span-6">
                <input required maxLength={160} value={form.republique} onChange={(e) => setForm({ ...form, republique: e.target.value })} className={field} placeholder="RÉPUBLIQUE TOGOLAISE" />
              </Field>
              <Field label="Devise nationale" className="sm:col-span-6">
                <input required maxLength={160} value={form.devise} onChange={(e) => setForm({ ...form, devise: e.target.value })} className={field} placeholder="Travail – Liberté – Patrie" />
              </Field>
              <Field label="Ministère de tutelle" className="sm:col-span-4">
                <input required maxLength={240} value={form.ministere} onChange={(e) => setForm({ ...form, ministere: e.target.value })} className={field} placeholder="MINISTÈRE DES ENSEIGNEMENTS PRIMAIRE, SECONDAIRE ET TECHNIQUE" />
              </Field>
              <Field label="Sigle" className="sm:col-span-2">
                <input required maxLength={20} value={form.sigleMinistere} onChange={(e) => setForm({ ...form, sigleMinistere: e.target.value.toUpperCase() })} className={`${field} uppercase`} placeholder="MEPST" />
              </Field>
              <Field label="Autorité régionale (facultatif)" className="sm:col-span-6" hint="Ligne ajoutée sous le sigle du ministère.">
                <input maxLength={160} value={form.autoriteRegionale} onChange={(e) => setForm({ ...form, autoriteRegionale: e.target.value })} className={field} placeholder="Direction Régionale de l'Éducation" />
              </Field>
              <Field label="Mention de pied de page (facultatif)" className="sm:col-span-6">
                <input maxLength={240} value={form.piedDePage} onChange={(e) => setForm({ ...form, piedDePage: e.target.value })} className={field} placeholder="Document officiel, toute rature le rend nul." />
              </Field>
              <label className="sm:col-span-6 inline-flex items-center gap-2 text-[12px] text-[#131b2e]">
                <input type="checkbox" checked={form.parDefaut} disabled={edition?.parDefaut} onChange={(e) => setForm({ ...form, parDefaut: e.target.checked })} className="accent-[#0051d5]" />
                <span>Préréglage par défaut (vitrine, pages de connexion, nouveaux établissements)</span>
              </label>
            </div>
            <div className="space-y-3">
              <ApercuEnTete form={form} />
              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                {edition && (
                  <button type="button" onClick={annulerEdition} className={`${ghost} px-4 py-2`}>Annuler</button>
                )}
                <button type="submit" disabled={saving} className={primary}>
                  <span className="material-symbols-outlined text-base">{edition ? 'save' : 'add_location_alt'}</span>
                  {edition ? 'Enregistrer les modifications' : 'Créer le préréglage'}
                </button>
              </div>
            </div>
          </form>
        </section>
      )}
    </div>
  );
};
