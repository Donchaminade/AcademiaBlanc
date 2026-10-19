import React, { useEffect, useState } from 'react';
import { apiDelete, apiGet, apiSend, isPlatformAccount, isPlatformOwner } from '../api/client';
import { usePermissions } from '../api/permissions';
import { confirmAction, showError, toastSuccess } from '../utils/alerts';
import { UtilisateursSection } from './UtilisateursSection';
import { TypesExamenPanel } from './TypesExamenPanel';
import { PrereglagesNationauxPanel } from './plateforme/PrereglagesNationauxPanel';
import { AnalytiquePanel } from './plateforme/AnalytiquePanel';

/** Champs de contact et effectifs absents sans ETABLISSEMENTS:DETAILS. */
interface EtablissementSurveillance {
  id: number;
  nom: string;
  code: string;
  ville: string;
  region?: string | null;
  typeEtablissement?: string | null;
  actif: boolean;
  email?: string;
  telephone?: string | null;
  nomResponsable?: string;
  utilisateurs?: number;
  classes?: number;
  eleves?: number;
  professeurs?: number;
  sessions?: number;
  notes?: number;
}

export type OngletPlateforme = 'analytique' | 'etablissements' | 'gestionnaires' | 'types-examen' | 'prereglages';
type Onglet = OngletPlateforme;

/**
 * Demande d'ouverture d'un onglet depuis l'extérieur (entrée « Analytique » de la barre latérale).
 * Le jeton change à chaque demande pour qu'une même cible puisse être redemandée.
 */
export interface DemandeOnglet {
  onglet: OngletPlateforme;
  jeton: number;
}

interface PlateformeViewProps {
  ongletDemande?: DemandeOnglet | null;
  /** Signale l'onglet affiché (mise en évidence dans la barre latérale). */
  onOngletChange?: (onglet: OngletPlateforme | null) => void;
}

const format = (value: number | undefined) => (value == null ? '—' : new Intl.NumberFormat('fr-FR').format(value));
const field = 'w-full bg-[#f2f3ff] text-[13px] py-2 px-3 rounded border border-[#eaedff] outline-none focus:bg-white focus:border-[#0051d5]';
const primary = 'inline-flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2 rounded bg-[#00236f] text-white text-[12px] font-bold hover:bg-[#1e3a8a] transition-colors shadow-xs disabled:opacity-50';
const ghost = 'inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded bg-[#f2f3ff] text-[#444651] text-[12px] font-semibold hover:bg-[#e2e7ff] transition-colors';

const Field: React.FC<{ label: string; className?: string; children: React.ReactNode }> = ({ label, className = '', children }) => (
  <label className={`flex flex-col gap-1 min-w-0 ${className}`}>
    <span className="text-[11px] font-bold uppercase tracking-wide text-[#444651]">{label}</span>
    {children}
  </label>
);

const EMPTY_FORM = { nom: '', ville: '', email: '', motDePasse: '', nomResponsable: '', telephone: '', region: '', typeEtablissement: '' };

export const PlateformeView: React.FC<PlateformeViewProps> = ({ ongletDemande = null, onOngletChange }) => {
  const { can, permissions } = usePermissions();
  const allowed = isPlatformAccount();
  // L'analytique (revenus, churn, inscriptions) n'est jamais proposée aux gestionnaires : propriétaire seulement.
  const proprietaire = isPlatformOwner();
  const canVoir = can('ETABLISSEMENTS', 'VOIR');
  const canDetails = can('ETABLISSEMENTS', 'DETAILS');
  const canCreer = can('ETABLISSEMENTS', 'CREER');
  const canModifier = can('ETABLISSEMENTS', 'MODIFIER');
  const canSupprimer = can('ETABLISSEMENTS', 'SUPPRIMER');
  const canGestionnaires = can('GESTIONNAIRES', 'VOIR');
  const canTypesExamen = can('TYPES_EXAMEN', 'VOIR');
  const canPrereglages = can('PREREGLAGES', 'VOIR');

  const [onglet, setOnglet] = useState<Onglet>(ongletDemande?.onglet ?? 'etablissements');
  const [etablissements, setEtablissements] = useState<EtablissementSurveillance[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = () => {
    if (!allowed || !canVoir) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    apiGet<EtablissementSurveillance[]>('/api/plateforme/etablissements')
      .then(setEtablissements)
      .catch((err: Error) => setError(err.message || 'Impossible de charger les établissements.'))
      .finally(() => setLoading(false));
  };

  // Recharge quand les droits changent (rafraîchissement de session).
  useEffect(load, [allowed, canVoir, permissions.join(',')]);

  // Ouverture d'un onglet demandée depuis la barre latérale (ex. « Analytique »).
  useEffect(() => {
    if (ongletDemande) setOnglet(ongletDemande.onglet);
  }, [ongletDemande]);

  const onglets: { key: Onglet; label: string; icon: string; visible: boolean }[] = [
    { key: 'analytique', label: 'Analytique', icon: 'monitoring', visible: proprietaire },
    { key: 'etablissements', label: 'Établissements', icon: 'domain', visible: canVoir },
    { key: 'gestionnaires', label: 'Gestionnaires', icon: 'manage_accounts', visible: canGestionnaires },
    { key: 'types-examen', label: 'Types d’examen', icon: 'workspace_premium', visible: canTypesExamen },
    { key: 'prereglages', label: 'Pays & ministères', icon: 'public', visible: canPrereglages },
  ];
  const ongletsVisibles = onglets.filter((o) => o.visible);
  const ongletCourant: Onglet | null = ongletsVisibles.some((o) => o.key === onglet) ? onglet : (ongletsVisibles[0]?.key ?? null);

  useEffect(() => {
    onOngletChange?.(allowed ? ongletCourant : null);
  }, [allowed, ongletCourant, onOngletChange]);

  if (!allowed) {
    return (
      <div className="p-4 md:p-8 max-w-3xl mx-auto">
        <div className="bg-white border border-[#eaedff] rounded p-6 text-[13px] text-[#444651]">
          Cet écran est réservé au propriétaire du logiciel et à ses gestionnaires. Le compte d’un établissement n’y a pas accès.
        </div>
      </div>
    );
  }

  const creer = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const cree = await apiSend<EtablissementSurveillance>('/api/plateforme/etablissements', 'POST', form);
      toastSuccess(`Établissement « ${cree.nom} » créé. Communiquez le mot de passe temporaire à ${form.nomResponsable.trim()}.`);
      setForm(EMPTY_FORM);
      load();
    } catch (err) {
      await showError('Création impossible', err instanceof Error ? err.message : 'Une erreur inattendue est survenue.');
    } finally {
      setSaving(false);
    }
  };

  const desactiver = async (item: EtablissementSurveillance) => {
    const ok = await confirmAction({
      title: 'Désactiver cet établissement',
      text: `Plus aucun utilisateur de « ${item.nom} » ne pourra se connecter. Les données sont conservées et l’établissement peut être réactivé.`,
      confirmText: 'Désactiver',
      icon: 'warning',
    });
    if (!ok) return;
    try {
      await apiDelete(`/api/plateforme/etablissements/${item.id}`);
      toastSuccess(`« ${item.nom} » désactivé.`);
      load();
    } catch (err) {
      await showError('Désactivation impossible', err instanceof Error ? err.message : 'Une erreur inattendue est survenue.');
    }
  };

  const reactiver = async (item: EtablissementSurveillance) => {
    try {
      await apiSend(`/api/plateforme/etablissements/${item.id}/reactiver`, 'PUT', {});
      toastSuccess(`« ${item.nom} » réactivé.`);
      load();
    } catch (err) {
      await showError('Réactivation impossible', err instanceof Error ? err.message : 'Une erreur inattendue est survenue.');
    }
  };

  const totaux = etablissements.reduce(
    (acc, item) => ({
      utilisateurs: acc.utilisateurs + (item.utilisateurs ?? 0),
      classes: acc.classes + (item.classes ?? 0),
      eleves: acc.eleves + (item.eleves ?? 0),
      professeurs: acc.professeurs + (item.professeurs ?? 0),
      sessions: acc.sessions + (item.sessions ?? 0),
      notes: acc.notes + (item.notes ?? 0),
    }),
    { utilisateurs: 0, classes: 0, eleves: 0, professeurs: 0, sessions: 0, notes: 0 },
  );

  const cartes = [
    { label: 'Établissements', value: etablissements.length, icon: 'domain' },
    ...(canDetails ? [
      { label: 'Utilisateurs', value: totaux.utilisateurs, icon: 'badge' },
      { label: 'Classes', value: totaux.classes, icon: 'school' },
      { label: 'Élèves', value: totaux.eleves, icon: 'group' },
      { label: 'Enseignants', value: totaux.professeurs, icon: 'co_present' },
      { label: 'Sessions', value: totaux.sessions, icon: 'event_note' },
      { label: 'Notes', value: totaux.notes, icon: 'edit_note' },
    ] : []),
  ];

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-4 md:space-y-6">
      <div className="bg-white rounded p-4 md:p-6 shadow-sm border border-[#eaedff]">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#0051d5] bg-[#eaedff] px-2.5 py-1 rounded">
          Plateforme
        </span>
        {ongletCourant === 'analytique' ? (
          <>
            <h2 className="text-[22px] font-bold text-[#00236f] mt-1.5">Tableau de bord analytique</h2>
            <p className="text-[13px] text-[#444651] mt-0.5 max-w-3xl">
              Indicateurs de la plateforme réservés au propriétaire du logiciel : établissements inscrits et évolution des inscriptions
              sur 12 mois glissants. Lecture seule, calculée par le serveur en temps universel (UTC).
            </p>
          </>
        ) : (
          <>
            <h2 className="text-[22px] font-bold text-[#00236f] mt-1.5">
              Établissements, gestionnaires &amp; types d’examen
            </h2>
            <p className="text-[13px] text-[#444651] mt-0.5 max-w-3xl">
              Vue de l’ensemble des établissements inscrits, des gestionnaires du logiciel et du référentiel des types d’examen proposé à tous.
              Chaque action (voir, détails, créer, modifier, supprimer) dépend des droits de votre compte. Ce n’est pas l’administration
              d’un établissement : aucune donnée pédagogique n’est modifiée ici.
            </p>
          </>
        )}
      </div>

      <nav aria-label="Sections de la plateforme" className="bg-white rounded border border-[#eaedff] shadow-xs p-1.5 flex gap-1 overflow-x-auto">
        {ongletsVisibles.map((item) => {
          const active = ongletCourant === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setOnglet(item.key)}
              aria-current={active ? 'page' : undefined}
              className={`inline-flex shrink-0 items-center gap-2 px-3.5 py-2 rounded text-[12px] font-bold whitespace-nowrap transition-colors ${
                active ? 'bg-[#00236f] text-white shadow-xs' : 'text-[#444651] hover:bg-[#f2f3ff] hover:text-[#00236f]'
              }`}
            >
              <span className="material-symbols-outlined text-base">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {ongletsVisibles.length === 0 && (
        <div className="bg-white border border-[#eaedff] rounded p-6 text-[13px] text-[#444651]">
          Votre compte ne détient aucun droit de consultation sur la plateforme. Rapprochez-vous du propriétaire du logiciel.
        </div>
      )}

      {ongletCourant === 'analytique' && <AnalytiquePanel />}

      {ongletCourant === 'gestionnaires' && <UtilisateursSection mode="plateforme" />}

      {ongletCourant === 'types-examen' && <TypesExamenPanel />}
      {ongletCourant === 'prereglages' && <PrereglagesNationauxPanel />}

      {ongletCourant === 'etablissements' && (
        <>
          {loading && (
            <div className="bg-white border border-[#eaedff] rounded p-6 text-[13px] text-[#444651]">
              Chargement des établissements…
            </div>
          )}

          {!loading && error && (
            <div className="bg-white border border-[#eaedff] rounded p-6 text-[13px] text-[#ba1a1a]">
              {error}
            </div>
          )}

          {!loading && !error && etablissements.length === 0 && (
            <div className="bg-white border border-dashed border-[#dce1ff] rounded p-10 text-center space-y-2">
              <span className="material-symbols-outlined text-4xl text-[#0051d5]">domain_disabled</span>
              <h3 className="text-[16px] font-bold text-[#00236f]">Aucun établissement enregistré</h3>
              <p className="text-[13px] text-[#444651]">
                Les établissements apparaîtront ici dès qu’un compte aura été créé.
              </p>
            </div>
          )}

          {!loading && !error && etablissements.length > 0 && (
            <>
              <div className={`grid grid-cols-2 md:grid-cols-4 ${canDetails ? 'xl:grid-cols-7' : ''} gap-3`}>
                {cartes.map((carte) => (
                  <div key={carte.label} className="bg-white border border-[#eaedff] rounded p-4 shadow-xs">
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[#444651]">
                      <span className="material-symbols-outlined text-base text-[#0051d5]">{carte.icon}</span>
                      <span>{carte.label}</span>
                    </div>
                    <p className="mt-2 text-[22px] font-bold text-[#00236f] leading-none">{format(carte.value)}</p>
                  </div>
                ))}
              </div>

              <div className="bg-white border border-[#eaedff] rounded shadow-xs overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-[13px]">
                  <thead className="bg-[#f2f3ff] text-[11px] uppercase tracking-wider text-[#444651]">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Établissement</th>
                      <th className="px-4 py-3 font-semibold">État</th>
                      {canDetails && (
                        <>
                          <th className="px-4 py-3 font-semibold">Contact</th>
                          <th className="px-4 py-3 font-semibold text-right">Utilisateurs</th>
                          <th className="px-4 py-3 font-semibold text-right">Classes</th>
                          <th className="px-4 py-3 font-semibold text-right">Élèves</th>
                          <th className="px-4 py-3 font-semibold text-right">Enseignants</th>
                          <th className="px-4 py-3 font-semibold text-right">Sessions</th>
                          <th className="px-4 py-3 font-semibold text-right">Notes</th>
                        </>
                      )}
                      {(canSupprimer || canModifier) && <th className="px-4 py-3 font-semibold text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {etablissements.map((item) => (
                      <tr key={item.id} className={`border-t border-[#eaedff] align-top ${item.actif ? '' : 'opacity-60'}`}>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-[#00236f]">{item.nom}</p>
                          <p className="text-[12px] text-[#444651]">
                            {item.ville}{item.region ? ` · ${item.region}` : ''}
                          </p>
                          <p className="text-[11px] text-[#444651]">{item.code}{item.typeEtablissement ? ` · ${item.typeEtablissement}` : ''}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${item.actif ? 'bg-[#dcfce7] text-[#166534]' : 'bg-[#ffdad6] text-[#ba1a1a]'}`}>
                            {item.actif ? 'Actif' : 'Désactivé'}
                          </span>
                        </td>
                        {canDetails && (
                          <>
                            <td className="px-4 py-3 text-[#131b2e]">
                              <p className="font-medium">{item.nomResponsable}</p>
                              <p className="text-[12px] text-[#444651]">{item.email}</p>
                              <p className="text-[12px] text-[#444651]">{item.telephone || '—'}</p>
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-[#131b2e]">{format(item.utilisateurs)}</td>
                            <td className="px-4 py-3 text-right">{format(item.classes)}</td>
                            <td className="px-4 py-3 text-right">{format(item.eleves)}</td>
                            <td className="px-4 py-3 text-right">{format(item.professeurs)}</td>
                            <td className="px-4 py-3 text-right">{format(item.sessions)}</td>
                            <td className="px-4 py-3 text-right">{format(item.notes)}</td>
                          </>
                        )}
                        {(canSupprimer || canModifier) && (
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            {item.actif && canSupprimer && (
                              <button type="button" onClick={() => void desactiver(item)} className={`${ghost} text-[#ba1a1a] hover:bg-[#ffdad6]`} title="Désactiver (les données sont conservées)">
                                <span className="material-symbols-outlined text-base">block</span>
                                Désactiver
                              </button>
                            )}
                            {!item.actif && canModifier && (
                              <button type="button" onClick={() => void reactiver(item)} className={`${ghost} text-[#166534] hover:bg-[#dcfce7]`} title="Réactiver">
                                <span className="material-symbols-outlined text-base">check_circle</span>
                                Réactiver
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {canCreer && (
            <section className="bg-white p-5 rounded border border-[#eaedff] shadow-xs space-y-4">
              <header className="flex items-start gap-3 border-b border-[#eaedff] pb-3">
                <span className="shrink-0 w-9 h-9 rounded bg-[#eaedff] text-[#0051d5] flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl">add_business</span>
                </span>
                <div>
                  <h3 className="text-[14px] font-bold text-[#00236f] uppercase tracking-wide">Ajouter un établissement</h3>
                  <p className="text-[12px] text-[#444651] mt-0.5">
                    Crée l’établissement et le compte de son responsable (rôle OWNER, tous les droits sur son école) avec un mot de passe temporaire à lui communiquer.
                  </p>
                </div>
              </header>
              <form className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3" onSubmit={(e) => void creer(e)}>
                <Field label="Nom de l’établissement" className="lg:col-span-2">
                  <input required maxLength={180} value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} className={field} placeholder="Lycée Moderne de Tokoin" />
                </Field>
                <Field label="Ville">
                  <input required maxLength={120} value={form.ville} onChange={(e) => setForm({ ...form, ville: e.target.value })} className={field} placeholder="Lomé" />
                </Field>
                <Field label="Région">
                  <input maxLength={120} value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} className={field} placeholder="Maritime" />
                </Field>
                <Field label="Type d’établissement" className="lg:col-span-2">
                  <input maxLength={160} value={form.typeEtablissement} onChange={(e) => setForm({ ...form, typeEtablissement: e.target.value })} className={field} placeholder="Lycée public" />
                </Field>
                <Field label="Téléphone" className="lg:col-span-2">
                  <input maxLength={40} value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} className={field} placeholder="+228 …" />
                </Field>
                <Field label="Nom du responsable" className="lg:col-span-2">
                  <input required maxLength={180} value={form.nomResponsable} onChange={(e) => setForm({ ...form, nomResponsable: e.target.value })} className={field} placeholder="Nom Prénom" />
                </Field>
                <Field label="Email de connexion du responsable">
                  <input required type="email" maxLength={180} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={field} placeholder="direction@ecole.tg" />
                </Field>
                <Field label="Mot de passe temporaire">
                  <input required type="text" minLength={6} maxLength={80} value={form.motDePasse} onChange={(e) => setForm({ ...form, motDePasse: e.target.value })} className={field} placeholder="6 caractères min." autoComplete="off" />
                </Field>
                <div className="col-span-full flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
                  <button type="submit" disabled={saving} className={primary}>
                    <span className="material-symbols-outlined text-base">add_business</span>
                    Créer l’établissement
                  </button>
                </div>
              </form>
            </section>
          )}
        </>
      )}
    </div>
  );
};
