import React, { useEffect, useState } from 'react';
import { AppSettings, SchoolAccount } from '../types';
import { getSession, roleLabel } from '../api/client';
import type { MeResponse } from '../api/client';
import { CharteField } from '../api/charte';
import {
  ModificationProfil,
  ProfilEtablissement,
  StatistiquesEtablissement,
  changerMotDePasse,
  loadMonCompte,
  loadProfil,
  loadStatistiques,
  saveProfil,
  versFormulaire,
  versModification,
} from '../api/etablissement';
import { usePermissions } from '../api/permissions';
import { showError, toastSuccess } from '../utils/alerts';
import { enTeteDepuisSettings } from '../utils/prereglages';
import { CharteAssetUpload } from './CharteAssetUpload';

interface EtablissementProfilViewProps {
  /** Session API active : fiche, statistiques et compte viennent du serveur. Sinon, espace de démonstration local. */
  usingApi: boolean;
  settings: AppSettings;
  /** Enregistre les paramètres (cachet et signatures : la charte est propagée à l'API par l'application). */
  /** Enregistre les paramètres ; résout `false` si le serveur a refusé. */
  onUpdateSettings: (settings: AppSettings) => void | boolean | Promise<boolean>;
  /** Établissement de démonstration affiché hors connexion. */
  demoSchool?: SchoolAccount | null;
  /** Compteurs locaux de l'espace de démonstration (étiquetés comme tels). */
  demoStats?: { eleves: number; archives: number };
  /** Fiche enregistrée : l'application met à jour le nom affiché (barre latérale, bulletins). */
  onProfilChanged?: (profil: ProfilEtablissement) => void;
  /** Déconnexion avec confirmation (comportement existant de la barre latérale). */
  onLogout?: () => void;
  /** Hors connexion : mène à la page `/connexion`. */
  onConnexion?: () => void;
}

type Formulaire = Record<keyof ModificationProfil, string>;

const FORMULAIRE_VIDE: Formulaire = {
  nom: '', typeEtablissement: '', ville: '', region: '', adresse: '', telephone: '', email: '', nomResponsable: '', devise: '',
};

const field = 'w-full bg-[#f2f3ff] text-[13px] py-2 px-3 rounded border border-[#eaedff] outline-none focus:bg-white focus:border-[#0051d5] disabled:opacity-60';
const primary = 'inline-flex items-center justify-center gap-2 px-4 py-2 rounded bg-[#00236f] text-white text-[12px] font-bold hover:bg-[#1e3a8a] transition-colors shadow-xs disabled:opacity-50';
const ghost = 'inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded bg-[#f2f3ff] text-[#444651] text-[12px] font-semibold hover:bg-[#e2e7ff] transition-colors disabled:opacity-50';
const danger = 'inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded bg-white text-red-700 text-[12px] font-bold border border-red-200 hover:bg-red-50 hover:border-red-300 transition-colors';

const initiales = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || '?';

const dateLongue = (iso: string | null | undefined): string | null => {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
};

const nombre = (value: number | null | undefined) =>
  (value == null ? '—' : new Intl.NumberFormat('fr-FR').format(value));

const messageErreur = (err: unknown, fallback: string) =>
  (err instanceof Error && err.message.trim() ? err.message : fallback);

const Carte: React.FC<{ titre: string; icon: string; actions?: React.ReactNode; children: React.ReactNode }> = ({
  titre, icon, actions, children,
}) => (
  <section className="bg-white p-5 rounded border border-[#eaedff] shadow-xs space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#eaedff] pb-2">
      <h3 className="text-[14px] font-bold text-[#00236f] uppercase tracking-wide flex items-center gap-2">
        <span className="material-symbols-outlined text-lg text-[#0051d5]">{icon}</span>
        {titre}
      </h3>
      {actions}
    </div>
    {children}
  </section>
);

const Champ: React.FC<{ label: string; aide?: string; className?: string; children: React.ReactNode }> = ({
  label, aide, className = '', children,
}) => (
  <label className={`flex flex-col gap-1 min-w-0 ${className}`}>
    <span className="text-[11px] font-bold uppercase tracking-wide text-[#444651]">{label}</span>
    {children}
    {aide ? <span className="text-[10.5px] text-[#757682] leading-snug">{aide}</span> : null}
  </label>
);

const Ligne: React.FC<{ label: string; value: string | null | undefined; className?: string }> = ({ label, value, className = '' }) => (
  <div className={`min-w-0 ${className}`}>
    <dt className="text-[11px] font-bold uppercase tracking-wide text-[#444651]">{label}</dt>
    <dd className={`text-[13px] mt-0.5 break-words ${value ? 'text-[#131b2e] font-medium' : 'text-[#9ca3af] italic'}`}>
      {value || 'Non renseigné'}
    </dd>
  </div>
);

const BadgeDemo: React.FC = () => (
  <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded">
    Démonstration
  </span>
);

/** Fiche de démonstration construite à partir du compte local, hors connexion. */
function profilDemo(school: SchoolAccount | null | undefined, settings: AppSettings): ProfilEtablissement {
  return {
    id: 0,
    nom: school?.name || settings.institutionName,
    code: school?.code || '—',
    typeEtablissement: school?.type || null,
    ville: school?.city || '—',
    region: school?.region || null,
    adresse: null,
    telephone: school?.phone || null,
    email: school?.email || '—',
    nomResponsable: school?.principalName || settings.jurySignerName,
    devise: settings.institutionMotto || null,
    actif: true,
    creeLe: school?.createdAt || null,
    enTete: enTeteDepuisSettings(settings),
  };
}

export const EtablissementProfilView: React.FC<EtablissementProfilViewProps> = ({
  usingApi,
  settings,
  onUpdateSettings,
  demoSchool,
  demoStats,
  onProfilChanged,
  onLogout,
  onConnexion,
}) => {
  const { can } = usePermissions();
  const peutModifier = usingApi && can('PARAMETRES', 'MODIFIER');

  const [profil, setProfil] = useState<ProfilEtablissement | null>(null);
  const [stats, setStats] = useState<StatistiquesEtablissement | null>(null);
  const [compte, setCompte] = useState<MeResponse | null>(null);
  const [chargement, setChargement] = useState(usingApi);
  const [erreurChargement, setErreurChargement] = useState('');

  const [edition, setEdition] = useState(false);
  const [form, setForm] = useState<Formulaire>(FORMULAIRE_VIDE);
  const [enregistrement, setEnregistrement] = useState(false);

  const [mdpOuvert, setMdpOuvert] = useState(false);
  const [mdp, setMdp] = useState({ ancien: '', nouveau: '', confirmation: '' });
  const [mdpErreur, setMdpErreur] = useState('');
  const [mdpEnCours, setMdpEnCours] = useState(false);

  useEffect(() => {
    if (!usingApi) {
      setProfil(profilDemo(demoSchool, settings));
      setStats(null);
      setCompte(null);
      setChargement(false);
      return;
    }
    let actif = true;
    setChargement(true);
    setErreurChargement('');
    Promise.all([
      loadProfil(),
      loadStatistiques().catch(() => null),
      loadMonCompte().catch(() => null),
    ])
      .then(([fiche, effectifs, moi]) => {
        if (!actif) return;
        setProfil(fiche);
        setStats(effectifs);
        setCompte(moi);
      })
      .catch((err: unknown) => {
        if (actif) setErreurChargement(messageErreur(err, 'Impossible de charger le profil de l’établissement.'));
      })
      .finally(() => {
        if (actif) setChargement(false);
      });
    return () => {
      actif = false;
    };
    // En démonstration, la fiche suit le compte local sélectionné.
  }, [usingApi, demoSchool?.id]);

  const session = getSession();
  const nomCompte = compte?.nomUtilisateur || session?.nomUtilisateur || session?.email || '';
  const emailCompte = compte?.email || session?.email || '';
  const roleCompte = roleLabel(compte?.role || session?.role);

  const commencerEdition = () => {
    if (!profil) return;
    setForm(versFormulaire(profil));
    setEdition(true);
  };

  const annulerEdition = () => {
    setEdition(false);
    setForm(FORMULAIRE_VIDE);
  };

  const enregistrer = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnregistrement(true);
    try {
      const fiche = await saveProfil(versModification(form));
      setProfil(fiche);
      setEdition(false);
      setForm(FORMULAIRE_VIDE);
      onProfilChanged?.(fiche);
      toastSuccess('Informations de l’établissement enregistrées.');
    } catch (err) {
      await showError('Enregistrement impossible', messageErreur(err, 'Une erreur inattendue est survenue.'));
    } finally {
      setEnregistrement(false);
    }
  };

  const fermerMdp = () => {
    setMdpOuvert(false);
    setMdp({ ancien: '', nouveau: '', confirmation: '' });
    setMdpErreur('');
  };

  const soumettreMdp = async (e: React.FormEvent) => {
    e.preventDefault();
    setMdpErreur('');
    if (mdp.nouveau.length < 6) {
      setMdpErreur('Le nouveau mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    if (mdp.nouveau !== mdp.confirmation) {
      setMdpErreur('La confirmation ne correspond pas au nouveau mot de passe.');
      return;
    }
    setMdpEnCours(true);
    try {
      await changerMotDePasse(mdp.ancien, mdp.nouveau);
      fermerMdp();
      toastSuccess('Mot de passe modifié.');
    } catch (err) {
      setMdpErreur(messageErreur(err, 'Changement de mot de passe impossible.'));
    } finally {
      setMdpEnCours(false);
    }
  };

  const applyCharteAsset = async (champ: CharteField, dataUrl: string) => {
    // La confirmation n'apparaît qu'après l'enregistrement (sur le serveur en session connectée).
    const ok = await onUpdateSettings({ ...settings, [champ]: dataUrl });
    if (ok === false) return;
    toastSuccess(dataUrl
      ? 'Image enregistrée : elle apparaît désormais sur le bulletin.'
      : 'Image retirée : l’emplacement reste vide pour une apposition à la main.');
  };

  const nomAffiche = profil?.nom || settings.institutionName;
  const creation = dateLongue(profil?.creeLe);
  const localisation = [profil?.ville, profil?.region].filter((part) => part && part !== '—').join(' · ');

  if (chargement) {
    return (
      <div className="p-8 max-w-5xl mx-auto" aria-busy="true">
        <div className="bg-white rounded p-6 shadow-sm border border-[#eaedff] text-[13px] text-[#444651]">
          Chargement du profil de l’établissement…
        </div>
      </div>
    );
  }

  if (erreurChargement || !profil) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <div className="bg-white rounded p-6 shadow-sm border border-red-200 text-[13px] text-red-800">
          {erreurChargement || 'Profil indisponible.'}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-6">
      {/* En-tête type profil */}
      <header className="bg-white rounded p-6 shadow-sm border border-[#eaedff]">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="w-24 h-24 shrink-0 rounded-full bg-[#f2f3ff] border border-[#eaedff] flex items-center justify-center overflow-hidden p-2">
            {settings.sceauUrl ? (
              <img src={settings.sceauUrl} alt={`Cachet de ${nomAffiche}`} className="max-h-full max-w-full object-contain" />
            ) : (
              <span className="text-[28px] font-bold text-[#00236f] tracking-tight" aria-label="Initiales">
                {initiales(nomAffiche)}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#0051d5] bg-[#eaedff] px-2.5 py-1 rounded">
                Profil de l’établissement
              </span>
              {!usingApi && <BadgeDemo />}
            </div>
            <h2 className="text-[22px] font-bold text-[#00236f] leading-tight break-words">{nomAffiche}</h2>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-[#444651]">
              <span className="inline-flex items-center gap-1.5 font-mono font-semibold text-[#131b2e]">
                <span className="material-symbols-outlined text-base text-[#0051d5]">tag</span>
                {profil.code}
              </span>
              {profil.typeEtablissement && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base text-[#0051d5]">school</span>
                  {profil.typeEtablissement}
                </span>
              )}
              {localisation && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base text-[#0051d5]">location_on</span>
                  {localisation}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                profil.actif
                  ? 'bg-green-50 text-green-800 border-green-200'
                  : 'bg-red-50 text-red-800 border-red-200'
              }`}>
                <span className="material-symbols-outlined text-[13px]">{profil.actif ? 'check_circle' : 'cancel'}</span>
                {profil.actif ? 'Actif' : 'Désactivé'}
              </span>
              <span className="text-[11px] text-[#444651]">
                {creation ? `Compte créé le ${creation}` : 'Date de création non renseignée'}
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-7 space-y-6">
          {/* Informations */}
          <Carte
            titre="Informations"
            icon="apartment"
            actions={peutModifier && !edition ? (
              <button type="button" onClick={commencerEdition} className={ghost}>
                <span className="material-symbols-outlined text-base">edit</span>
                <span>Modifier</span>
              </button>
            ) : undefined}
          >
            {edition ? (
              <form onSubmit={(e) => void enregistrer(e)} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Champ label="Nom de l’établissement" className="sm:col-span-2">
                    <input required maxLength={180} className={field} value={form.nom}
                      onChange={(e) => setForm({ ...form, nom: e.target.value })} />
                  </Champ>
                  <Champ label="Code">
                    <input className={field} value={profil.code} disabled readOnly title="Code attribué par la plateforme" />
                  </Champ>
                  <Champ label="Type">
                    <input maxLength={160} className={field} value={form.typeEtablissement} placeholder="Ex : Lycée public d’enseignement général"
                      onChange={(e) => setForm({ ...form, typeEtablissement: e.target.value })} />
                  </Champ>
                  <Champ label="Ville">
                    <input required maxLength={120} className={field} value={form.ville}
                      onChange={(e) => setForm({ ...form, ville: e.target.value })} />
                  </Champ>
                  <Champ label="Région">
                    <input maxLength={120} className={field} value={form.region}
                      onChange={(e) => setForm({ ...form, region: e.target.value })} />
                  </Champ>
                  <Champ label="Adresse" className="sm:col-span-2">
                    <input maxLength={240} className={field} value={form.adresse} placeholder="Ex : BP 1234, quartier Tokoin"
                      onChange={(e) => setForm({ ...form, adresse: e.target.value })} />
                  </Champ>
                  <Champ label="Téléphone">
                    <input maxLength={40} className={field} value={form.telephone} placeholder="+228"
                      onChange={(e) => setForm({ ...form, telephone: e.target.value })} />
                  </Champ>
                  <Champ label="Email de contact">
                    <input required type="email" maxLength={180} className={field} value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  </Champ>
                  <Champ label="Proviseur / Directeur">
                    <input required maxLength={180} className={field} value={form.nomResponsable}
                      onChange={(e) => setForm({ ...form, nomResponsable: e.target.value })} />
                  </Champ>
                  <Champ label="Devise de l’établissement" aide="Imprimée en pied de page des bulletins après le nom ; facultative.">
                    <input maxLength={160} className={field} value={form.devise} placeholder="Discipline – Excellence – Réussite"
                      onChange={(e) => setForm({ ...form, devise: e.target.value })} />
                  </Champ>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-[#eaedff]">
                  <button type="button" onClick={annulerEdition} disabled={enregistrement} className={ghost}>
                    Annuler
                  </button>
                  <button type="submit" disabled={enregistrement} className={primary}>
                    <span className="material-symbols-outlined text-base">save</span>
                    <span>{enregistrement ? 'Enregistrement…' : 'Enregistrer'}</span>
                  </button>
                </div>
              </form>
            ) : (
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                <Ligne label="Nom de l’établissement" value={profil.nom} className="sm:col-span-2" />
                <Ligne label="Code" value={profil.code} />
                <Ligne label="Type" value={profil.typeEtablissement} />
                <Ligne label="Ville" value={profil.ville} />
                <Ligne label="Région" value={profil.region} />
                <Ligne label="Adresse" value={profil.adresse} className="sm:col-span-2" />
                <Ligne label="Téléphone" value={profil.telephone} />
                <Ligne label="Email de contact" value={profil.email} />
                <Ligne label="Proviseur / Directeur" value={profil.nomResponsable} />
                <Ligne label="Devise de l’établissement" value={profil.devise} />
              </dl>
            )}
            {!usingApi && (
              <p className="text-[11px] text-[#444651] leading-snug pt-2 border-t border-[#eaedff]">
                Fiche de démonstration enregistrée sur ce poste. Connectez l’établissement pour modifier ses informations réelles.
              </p>
            )}
            {usingApi && !peutModifier && (
              <p className="text-[11px] text-[#444651] leading-snug pt-2 border-t border-[#eaedff]">
                Lecture seule : la modification requiert le droit PARAMETRES : MODIFIER.
              </p>
            )}
          </Carte>

          {/* Statistiques */}
          <Carte titre="Statistiques" icon="analytics" actions={!usingApi ? <BadgeDemo /> : undefined}>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: 'Utilisateurs', icon: 'manage_accounts', value: usingApi ? stats?.utilisateurs : null },
                { label: 'Classes', icon: 'meeting_room', value: usingApi ? stats?.classes : null },
                { label: 'Élèves', icon: 'group', value: usingApi ? stats?.eleves : demoStats?.eleves },
                { label: 'Enseignants', icon: 'co_present', value: usingApi ? stats?.professeurs : null },
                { label: 'Sessions', icon: 'event_note', value: usingApi ? stats?.sessions : null },
                { label: 'Archives', icon: 'history_edu', value: usingApi ? stats?.archives : demoStats?.archives },
              ].map((item) => (
                <div key={item.label} className="bg-[#f2f3ff] rounded border border-[#eaedff] p-3 flex items-center gap-3 min-w-0">
                  <span className="material-symbols-outlined text-xl text-[#0051d5] shrink-0">{item.icon}</span>
                  <div className="min-w-0">
                    <p className="text-[18px] font-bold text-[#00236f] leading-tight font-mono">{nombre(item.value)}</p>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[#444651] leading-tight">{item.label}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-[#444651] leading-snug">
              {usingApi
                ? (stats ? 'Effectifs relevés sur la base de l’établissement.' : 'Effectifs indisponibles pour le moment.')
                : 'Compteurs de l’espace de démonstration local ; les autres effectifs n’existent qu’une fois connecté.'}
            </p>
          </Carte>
        </div>

        <div className="xl:col-span-5 space-y-6">
          {/* Mon compte */}
          <Carte titre="Mon compte" icon="account_circle">
            {usingApi ? (
              <>
                <div className="flex items-center gap-3">
                  <span aria-hidden="true" className="w-11 h-11 shrink-0 rounded-full bg-[#00236f] text-white text-[13px] font-bold flex items-center justify-center ring-2 ring-[#0051d5]/20">
                    {initiales(nomCompte)}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[14px] font-bold text-[#131b2e] truncate" title={nomCompte}>{nomCompte}</p>
                    <p className="text-[12px] text-[#444651] truncate" title={emailCompte}>{emailCompte}</p>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[#0051d5] mt-0.5">{roleCompte}</p>
                  </div>
                </div>

                {mdpOuvert ? (
                  <form onSubmit={(e) => void soumettreMdp(e)} className="space-y-3 bg-[#f2f3ff] rounded border border-[#eaedff] p-3">
                    <Champ label="Ancien mot de passe">
                      <input type="password" required autoComplete="current-password" className={`${field} bg-white`} value={mdp.ancien}
                        onChange={(e) => setMdp({ ...mdp, ancien: e.target.value })} />
                    </Champ>
                    <Champ label="Nouveau mot de passe">
                      <input type="password" required minLength={6} maxLength={80} autoComplete="new-password" className={`${field} bg-white`} value={mdp.nouveau}
                        onChange={(e) => setMdp({ ...mdp, nouveau: e.target.value })} />
                    </Champ>
                    <Champ label="Confirmation">
                      <input type="password" required minLength={6} maxLength={80} autoComplete="new-password" className={`${field} bg-white`} value={mdp.confirmation}
                        onChange={(e) => setMdp({ ...mdp, confirmation: e.target.value })} />
                    </Champ>
                    {mdpErreur && (
                      <p role="alert" className="text-[12px] text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{mdpErreur}</p>
                    )}
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <button type="button" onClick={fermerMdp} disabled={mdpEnCours} className={ghost}>Annuler</button>
                      <button type="submit" disabled={mdpEnCours} className={primary}>
                        <span className="material-symbols-outlined text-base">lock_reset</span>
                        <span>{mdpEnCours ? 'Modification…' : 'Valider'}</span>
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex flex-col gap-2 pt-1">
                    <button type="button" onClick={() => setMdpOuvert(true)} className={ghost}>
                      <span className="material-symbols-outlined text-base">lock_reset</span>
                      <span>Changer mon mot de passe</span>
                    </button>
                    {onLogout && (
                      <button type="button" onClick={onLogout} className={danger}>
                        <span className="material-symbols-outlined text-base">logout</span>
                        <span>Se déconnecter</span>
                      </button>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-3">
                <p className="text-[12px] text-[#444651] leading-snug">
                  Aucune session connectée : l’espace affiché est une démonstration locale. Connectez votre établissement
                  pour retrouver votre compte, vos droits et vos données réelles.
                </p>
                {onConnexion && (
                  <button type="button" onClick={onConnexion} className={`${primary} w-full`}>
                    <span className="material-symbols-outlined text-base">login</span>
                    <span>Se connecter</span>
                  </button>
                )}
              </div>
            )}
          </Carte>

          {/* Charte graphique */}
          <Carte titre="Charte graphique" icon="approval">
            <p className="text-[11px] text-[#444651] leading-snug">
              Cachet et signatures affichés dans les cartes « Le Titulaire » et
              « {settings.jurySignerTitle || 'Le Proviseur'} » du bulletin. Sans image, l’emplacement reste vide pour
              le cachet humide et les signatures à la main.
            </p>
            {usingApi && !peutModifier ? (
              <ul className="space-y-2">
                {[
                  { label: 'Sceau / cachet', value: settings.sceauUrl },
                  { label: 'Signature du proviseur', value: settings.signatureProviseurUrl },
                  { label: 'Signature du titulaire', value: settings.signatureTitulaireUrl },
                ].map((item) => (
                  <li key={item.label} className="flex items-center gap-3 text-[12px]">
                    <span className="w-16 h-10 shrink-0 bg-white border border-dashed border-[#a0a5b5] rounded flex items-center justify-center overflow-hidden p-1">
                      {item.value
                        ? <img src={item.value} alt={item.label} className="max-h-full max-w-full object-contain" />
                        : <span className="text-[8.5px] text-[#9ca3af] uppercase font-bold">Vide</span>}
                    </span>
                    <span className="font-semibold text-[#131b2e]">{item.label}</span>
                  </li>
                ))}
                <li className="text-[11px] text-[#444651] pt-1">Lecture seule : la modification requiert le droit PARAMETRES : MODIFIER.</li>
              </ul>
            ) : (
            <div className="space-y-1">
              <CharteAssetUpload
                label="Sceau / cachet de l’établissement"
                hint="Cachet rond ou rectangulaire, idéalement PNG détouré (fond transparent)."
                icon="approval"
                shape="round"
                value={settings.sceauUrl}
                onChange={(dataUrl) => void applyCharteAsset('sceauUrl', dataUrl)}
                onError={(message) => void showError('Image refusée', message)}
              />
              <CharteAssetUpload
                label={`Signature du ${(settings.jurySignerTitle || 'Proviseur').replace(/^le\s+/i, '')}`}
                hint="Signature manuscrite scannée, affichée à côté du cachet."
                icon="draw"
                value={settings.signatureProviseurUrl}
                onChange={(dataUrl) => void applyCharteAsset('signatureProviseurUrl', dataUrl)}
                onError={(message) => void showError('Image refusée', message)}
              />
              <CharteAssetUpload
                label="Signature du Titulaire"
                hint="Optionnelle : signature scannée du titulaire de la classe."
                icon="draw"
                value={settings.signatureTitulaireUrl}
                onChange={(dataUrl) => void applyCharteAsset('signatureTitulaireUrl', dataUrl)}
                onError={(message) => void showError('Image refusée', message)}
              />
            </div>
            )}
          </Carte>
        </div>
      </div>
    </div>
  );
};
