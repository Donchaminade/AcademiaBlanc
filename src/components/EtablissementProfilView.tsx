import React, { useEffect, useState } from 'react';
import { LiquidButton } from './motion/LiquidButton';
import { AppSettings, SchoolAccount } from '../types';
import { getSession, roleLabel } from '../api/client';
import type { MeResponse } from '../api/client';
import {
  ModificationProfil,
  ProfilEtablissement,
  StatistiquesEtablissement,
  changerMotDePasse,
  loadMonCompte,
  loadProfil,
  loadStatistiques,
  regenererCodeTransfert,
  saveProfil,
  versFormulaire,
  versModification,
} from '../api/etablissement';
import { masquerCode } from '../api/transferts';
import { usePermissions } from '../api/permissions';
import { loadAcceptations } from '../api/acceptations';
import type { AcceptationConditions } from '../api/acceptations';
import { phraseAcceptation } from '../legal/versions';
import { peutAccepterConditions } from './legal/ReacceptationConditions';
import { confirmAction, showError, showInfo, toastSuccess } from '../utils/alerts';
import { enTeteDepuisSettings } from '../utils/prereglages';
import { LIBELLE_TITRE_AUTOMATIQUE, TITRES_CHEF_PROPOSES, titreChefEtablissement } from '../utils/titreChef';
import { CharteImagesPanel, ImageCharte } from './CharteImagesPanel';
import { LogoEtablissement } from './LogoEtablissement';

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
  /** Dernière modification du logo, du cachet ou des signatures sur le serveur (ISO 8601). */
  charteModifieeLe?: string | null;
  /** Hors connexion : réactive le sceau de démonstration du logiciel. */
  onRetablirSceauDemo?: () => void;
}

type Formulaire = Record<keyof ModificationProfil, string>;

const FORMULAIRE_VIDE: Formulaire = {
  nom: '', typeEtablissement: '', ville: '', region: '', adresse: '', telephone: '', email: '', nomResponsable: '', devise: '',
};

/** Valeur du menu « Titre du chef d'établissement » pour un titre libre (hors liste proposée). */
const TITRE_AUTRE = '__autre__';

/** Choix du menu correspondant à un titre enregistré : automatique (vide), un titre proposé ou « Autre ». */
const choixTitre = (titre: string): string => {
  const propre = titre.trim();
  if (!propre) return '';
  return (TITRES_CHEF_PROPOSES as readonly string[]).includes(propre) ? propre : TITRE_AUTRE;
};

/**
 * Titre du chef d'établissement de la fiche : la surcharge saisie, sinon le titre automatique déduit du type de
 * l'établissement (sur le bulletin, le niveau de la classe de chaque élève tranche quand le type ne dit rien).
 */
const titreChefDeLaFiche = (surcharge: string | undefined, profil: Pick<ProfilEtablissement, 'typeEtablissement' | 'nom'>) => {
  const propre = (surcharge ?? '').trim();
  return {
    titre: propre || titreChefEtablissement({ typeEtablissement: profil.typeEtablissement, nomEtablissement: profil.nom }),
    automatique: !propre,
  };
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
  charteModifieeLe = null,
  onRetablirSceauDemo,
}) => {
  const { can } = usePermissions();
  const peutModifier = usingApi && can('PARAMETRES', 'MODIFIER');

  const [profil, setProfil] = useState<ProfilEtablissement | null>(null);
  const [stats, setStats] = useState<StatistiquesEtablissement | null>(null);
  const [compte, setCompte] = useState<MeResponse | null>(null);
  // Historique des acceptations des conditions (OWNER / ADMIN uniquement ; null si non autorisé ou indisponible).
  const [acceptations, setAcceptations] = useState<AcceptationConditions[] | null>(null);
  const [chargement, setChargement] = useState(usingApi);
  const [erreurChargement, setErreurChargement] = useState('');

  const [edition, setEdition] = useState(false);
  const [form, setForm] = useState<Formulaire>(FORMULAIRE_VIDE);
  // Titre du chef d'établissement : surcharge facultative de la charte (vide = automatique), enregistrée avec la fiche.
  const [titreChoix, setTitreChoix] = useState('');
  const [titreLibre, setTitreLibre] = useState('');
  const [enregistrement, setEnregistrement] = useState(false);
  const [echecEnregistrement, setEchecEnregistrement] = useState(false);

  const [mdpOuvert, setMdpOuvert] = useState(false);
  const [mdp, setMdp] = useState({ ancien: '', nouveau: '', confirmation: '' });
  const [mdpErreur, setMdpErreur] = useState('');
  const [mdpEnCours, setMdpEnCours] = useState(false);

  useEffect(() => {
    if (!usingApi) {
      setProfil(profilDemo(demoSchool, settings));
      setStats(null);
      setCompte(null);
      setAcceptations(null);
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
      loadAcceptations().catch(() => null),
    ])
      .then(([fiche, effectifs, moi, preuves]) => {
        if (!actif) return;
        setProfil(fiche);
        setStats(effectifs);
        setCompte(moi);
        setAcceptations(preuves);
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
    const titreActuel = (settings.jurySignerTitle ?? '').trim();
    setTitreChoix(choixTitre(titreActuel));
    setTitreLibre(choixTitre(titreActuel) === TITRE_AUTRE ? titreActuel : '');
    setEdition(true);
  };

  const annulerEdition = () => {
    setEdition(false);
    setForm(FORMULAIRE_VIDE);
  };

  /** Titre saisi dans le formulaire : vide = automatique. */
  const titreSaisi = (): string => (titreChoix === TITRE_AUTRE ? titreLibre.trim() : titreChoix);

  const enregistrer = async (e: React.FormEvent) => {
    e.preventDefault();
    setEchecEnregistrement(false);
    setEnregistrement(true);
    try {
      const enregistree = await saveProfil(versModification(form));
      // Les écritures de la fiche ne renvoient pas le code de transfert (réservé à la lecture par le chef) : on le garde.
      const fiche: ProfilEtablissement = { ...enregistree, codeTransfert: enregistree.codeTransfert ?? profil?.codeTransfert ?? null };
      const titre = titreSaisi();
      if (titre !== (settings.jurySignerTitle ?? '').trim()) {
        const ok = await onUpdateSettings({ ...settings, jurySignerTitle: titre });
        if (ok === false) { setEchecEnregistrement(true); return; }
      }
      setProfil(fiche);
      setEdition(false);
      setForm(FORMULAIRE_VIDE);
      onProfilChanged?.(fiche);
      toastSuccess('Informations de l’établissement enregistrées.');
    } catch (err) {
      setEchecEnregistrement(true);
      await showError('Enregistrement impossible', messageErreur(err, 'Une erreur inattendue est survenue.'));
    } finally {
      setEnregistrement(false);
    }
  };

  // Code de transfert : masqué par défaut, copie dans le presse-papiers, régénération confirmée.
  const [codeVisible, setCodeVisible] = useState(false);
  const [regeneration, setRegeneration] = useState(false);

  const copierCode = async () => {
    const code = profil?.codeTransfert;
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      toastSuccess('Code de transfert copié.');
    } catch {
      setCodeVisible(true);
      await showInfo('Copie impossible', `Copiez le code affiché : ${code}`);
    }
  };

  const regenererCode = async () => {
    if (!profil?.codeTransfert) return;
    const confirme = await confirmAction({
      title: 'Régénérer le code de transfert ?',
      text: 'L’ancien code devient immédiatement invalide : un centre d’examen qui le détient ne pourra plus vous envoyer de données. Communiquez le nouveau code aux centres concernés.',
      confirmText: 'Régénérer',
      icon: 'warning',
    });
    if (!confirme) return;
    setRegeneration(true);
    try {
      const fiche = await regenererCodeTransfert();
      setProfil((actuel) => (actuel ? { ...actuel, ...fiche, codeTransfert: fiche.codeTransfert ?? null } : fiche));
      setCodeVisible(true);
      toastSuccess('Nouveau code de transfert généré.');
    } catch (err) {
      await showError('Régénération impossible', messageErreur(err, 'Une erreur inattendue est survenue.'));
    } finally {
      setRegeneration(false);
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

  const applyCharteAsset = async (champ: ImageCharte, dataUrl: string): Promise<boolean> => {
    // La confirmation n'apparaît qu'après l'enregistrement (sur le serveur en session connectée).
    const ok = await onUpdateSettings({ ...settings, [champ]: dataUrl });
    if (ok === false) return false;
    if (champ === 'logoUrl') {
      toastSuccess(dataUrl
        ? (usingApi ? 'Logo enregistré dans la base de l’établissement : il sera retrouvé à chaque connexion.' : 'Logo enregistré.')
        : 'Logo retiré : les initiales de l’établissement sont affichées.');
    } else {
      toastSuccess(dataUrl
        ? 'Image enregistrée : elle apparaît désormais sur le bulletin.'
        : 'Image retirée : l’emplacement reste vide pour une apposition à la main.');
    }
    return true;
  };

  const nomAffiche = profil?.nom || settings.institutionName;
  const titreChef = profil ? titreChefDeLaFiche(settings.jurySignerTitle, profil) : null;
  const creation = dateLongue(profil?.creeLe);
  const localisation = [profil?.ville, profil?.region].filter((part) => part && part !== '—').join(' · ');

  if (chargement) {
    return (
      <div className="p-4 md:p-8 max-w-5xl mx-auto" aria-busy="true">
        <div className="bg-white rounded p-6 shadow-sm border border-[#eaedff] text-[13px] text-[#444651]">
          Chargement du profil de l’établissement…
        </div>
      </div>
    );
  }

  if (erreurChargement || !profil) {
    return (
      <div className="p-4 md:p-8 max-w-5xl mx-auto">
        <div className="bg-white rounded p-6 shadow-sm border border-red-200 text-[13px] text-red-800">
          {erreurChargement || 'Profil indisponible.'}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-6">
      {/* En-tête type profil */}
      <header className="bg-white rounded p-4 md:p-6 shadow-sm border border-[#eaedff]">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="w-24 h-24 shrink-0 rounded-full bg-[#f2f3ff] border border-[#eaedff] flex items-center justify-center overflow-hidden p-2">
            <LogoEtablissement
              src={settings.logoUrl || settings.sceauUrl}
              nom={nomAffiche}
              alt={settings.logoUrl ? `Logo de ${nomAffiche}` : settings.sceauUrl ? `Cachet de ${nomAffiche}` : 'Initiales'}
              className="w-full h-full rounded-full"
              initialesClassName="text-[28px] bg-transparent text-[#00236f]"
            />
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
                  <Champ label="Chef d’établissement (nom)" aide="Signe les bulletins et le PV ; son titre suit la ligne ci-dessous.">
                    <input required maxLength={180} className={field} value={form.nomResponsable}
                      onChange={(e) => setForm({ ...form, nomResponsable: e.target.value })} />
                  </Champ>
                  <Champ
                    label="Titre du chef d’établissement"
                    aide="Automatique : « Le Directeur » pour une classe de collège (6e–3e), « Le Proviseur » au lycée (2nde–Tle). Choisissez un titre pour la féminisation ou un cas particulier."
                  >
                    <select className={field} value={titreChoix} onChange={(e) => setTitreChoix(e.target.value)} data-testid="profil-titre-chef">
                      <option value="">{LIBELLE_TITRE_AUTOMATIQUE}</option>
                      {TITRES_CHEF_PROPOSES.map((titre) => (
                        <option key={titre} value={titre}>{titre}</option>
                      ))}
                      <option value={TITRE_AUTRE}>Autre titre…</option>
                    </select>
                    {titreChoix === TITRE_AUTRE && (
                      <input required maxLength={120} className={field} value={titreLibre} placeholder="Ex : Le Principal, La Fondatrice"
                        onChange={(e) => setTitreLibre(e.target.value)} aria-label="Titre libre du chef d’établissement" />
                    )}
                  </Champ>
                  <Champ label="Devise de l’établissement" aide="Imprimée en pied de page des bulletins après le nom ; facultative." className="sm:col-span-2">
                    <input maxLength={160} className={field} value={form.devise} placeholder="Discipline – Excellence – Réussite"
                      onChange={(e) => setForm({ ...form, devise: e.target.value })} />
                  </Champ>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-[#eaedff]">
                  <button type="button" onClick={annulerEdition} disabled={enregistrement} className={ghost}>
                    Annuler
                  </button>
                  <LiquidButton type="submit" disabled={enregistrement} className={primary}
                    enCours={enregistrement} echec={echecEnregistrement} icone="save"
                    libelle="Enregistrer" libelleChargement="Enregistrement…" libelleSucces="Enregistré" />
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
                <Ligne label="Chef d’établissement (nom)" value={profil.nomResponsable} />
                <Ligne label="Titre du chef d’établissement" value={titreChef ? `${titreChef.titre}${titreChef.automatique ? ' (automatique)' : ''}` : null} />
                <Ligne label="Devise de l’établissement" value={profil.devise} className="sm:col-span-2" />
              </dl>
            )}
            {usingApi && peutAccepterConditions(compte?.role || session?.role) && (
              <p className="text-[11px] text-[#444651] leading-snug pt-2 border-t border-[#eaedff] flex items-start gap-1.5" data-testid="profil-acceptation-conditions">
                <span className="material-symbols-outlined text-[15px] text-[#0051d5] shrink-0" aria-hidden="true">verified</span>
                <span>
                  {phraseAcceptation(acceptations?.[0]) ?? 'Aucune acceptation des conditions enregistrée pour cet établissement.'}
                  {acceptations && acceptations.length > 1 && ` (${acceptations.length} acceptations enregistrées)`}
                  {acceptations?.[0]?.email && ` — par ${acceptations[0].email}`}
                </span>
              </p>
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
          {/* Code de transfert : visible uniquement du chef d'établissement (le serveur ne le renvoie qu'à lui) */}
          {usingApi && profil.codeTransfert && (
            <Carte
              titre="Code de transfert"
              icon="key"
              actions={(
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#fff3e0] text-[#8a4b00]">
                  Chef d’établissement
                </span>
              )}
            >
              <p className="text-[11px] text-[#444651] leading-snug">
                Communiquez ce code au centre d’examen qui accueille vos élèves pour un examen blanc inter-établissements :
                il lui permet de vous envoyer leurs notes et leur classement. Le code change automatiquement après chaque
                transfert accepté ; vous pouvez aussi le régénérer à tout moment.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <code
                  className="font-mono text-[20px] tracking-[0.2em] font-bold text-[#00236f] bg-[#f2f3ff] border border-[#eaedff] rounded px-3 py-1.5 select-all"
                  data-testid="code-transfert"
                  aria-label={codeVisible ? `Code de transfert ${profil.codeTransfert}` : 'Code de transfert masqué'}
                >
                  {codeVisible ? profil.codeTransfert : masquerCode(profil.codeTransfert)}
                </code>
                <button type="button" onClick={() => setCodeVisible((v) => !v)} className={ghost} data-testid="code-transfert-afficher">
                  <span className="material-symbols-outlined text-base">{codeVisible ? 'visibility_off' : 'visibility'}</span>
                  <span>{codeVisible ? 'Masquer' : 'Afficher'}</span>
                </button>
                <button type="button" onClick={() => void copierCode()} className={ghost}>
                  <span className="material-symbols-outlined text-base">content_copy</span>
                  <span>Copier</span>
                </button>
                <button type="button" onClick={() => void regenererCode()} disabled={regeneration} className={danger} data-testid="code-transfert-regenerer">
                  <span className="material-symbols-outlined text-base">autorenew</span>
                  <span>{regeneration ? 'Régénération…' : 'Régénérer'}</span>
                </button>
              </div>
              <p className="text-[10.5px] text-[#757682] leading-snug">
                Ne partagez ce code qu’avec un centre d’examen de confiance : un transfert reçu doit toujours être accepté
                explicitement dans « Transferts » avant toute création de données.
              </p>
            </Carte>
          )}

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

          {/* Charte graphique : point unique de gestion des images de l'établissement */}
          <Carte
            titre="Charte graphique"
            icon="approval"
            actions={usingApi ? (
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#dcfce7] text-[#166534]">
                Base de l’établissement
              </span>
            ) : <BadgeDemo />}
          >
            <p className="text-[11px] text-[#444651] leading-snug">
              Logo de l’établissement (barre latérale), sceau officiel du bulletin, puis cachet et signatures des cartes
              « Le Titulaire » et « {titreChef?.titre} ».
              {titreChef?.automatique && ' Le titre du chef d’établissement suit le niveau de la classe de chaque élève (Directeur au collège, Proviseur au lycée).'}
              {usingApi
                ? ' Enregistrées dans la base de l’établissement, ces images sont relues à chaque connexion depuis tout poste.'
                : ' Sans image, l’emplacement reste vide pour le cachet humide et les signatures à la main.'}
            </p>
            <CharteImagesPanel
              settings={settings}
              usingApi={usingApi}
              modifieLe={charteModifieeLe}
              readOnly={usingApi && !peutModifier}
              onChange={applyCharteAsset}
              onError={(message) => void showError('Image refusée', message)}
              onRetablirSceauDemo={onRetablirSceauDemo}
            />
            {usingApi && !peutModifier && (
              <p className="text-[11px] text-[#444651]">Lecture seule : la modification requiert le droit PARAMETRES : MODIFIER.</p>
            )}
          </Carte>
        </div>
      </div>
    </div>
  );
};
