import React, { useEffect, useState } from 'react';
import { AppSettings, Candidate, CandidateComputedStats, AdminSection } from '../types';
import { DEFAULT_SETTINGS, TOGO_SETTINGS } from '../data/mockData';
import { PREREGLAGES_DEMONSTRATION } from '../data/prereglagesDemo';
import { appliquerPrereglageNational, loadPrereglagesNationaux } from '../api/prereglages';
import {
  PrereglageNational,
  appliquerEnTeteAuxSettings,
  appliquerPrereglageAuxSettings,
  drapeau,
  prereglageCourant,
} from '../utils/prereglages';
import { ArchivedSessionsSection } from './ArchivedSessionsSection';
import { AdminParametres } from './AdminParametres';
import { CharteImagesPanel, ImageCharte } from './CharteImagesPanel';
import { parametresSansDemonstration } from '../api/charte';
import { confirmAction } from '../utils/alerts';

interface SettingsViewProps {
  settings: AppSettings;
  /**
   * Enregistre les paramètres ; résout `false` si le serveur a refusé (aucune confirmation affichée).
   * `enTeteDejaEnregistre` : l'API a déjà copié l'en-tête (application d'un préréglage), inutile de le renvoyer.
   */
  onUpdateSettings: (
    newSettings: AppSettings,
    options?: { enTeteDejaEnregistre?: boolean },
  ) => void | boolean | Promise<boolean>;
  onNavigate: (view: 'dashboard' | 'students' | 'grading' | 'bulletin' | 'records' | 'settings') => void;
  /** Ouvre la page « Profil de l’établissement » (fiche officielle, charte, compte). */
  onOpenProfil?: () => void;
  candidates?: Candidate[];
  allStats?: Record<string, CandidateComputedStats>;
  /** Recharge l'espace de travail (matières, élèves…) après une saisie dans l'onglet Administration (API). */
  onAdminDataChanged?: () => void;
  /** Session API active : l'onglet Archives n'affiche alors que les archives réelles de l'établissement. */
  usingApi?: boolean;
  /** Session d'examen actuellement chargée depuis l'API. */
  activeSessionId?: number | null;
  /** Ouvre une session archivée dans l'application (bouton « Consulter » des archives). */
  onOpenSession?: (sessionId: number) => void;
  /** Ouvre l'écran Administration (API) sur une section donnée. */
  onOpenAdmin?: (section?: AdminSection) => void;
  /** Dernière modification du logo, du cachet ou des signatures sur le serveur (ISO 8601). */
  charteModifieeLe?: string | null;
}

/** Images de la charte telles qu'enregistrées : reprises dans le formulaire après chaque relecture du serveur. */
const imagesDe = (settings: AppSettings): Pick<AppSettings, ImageCharte> => ({
  logoUrl: settings.logoUrl,
  sealUrl: settings.sealUrl,
  sceauUrl: settings.sceauUrl,
  signatureProviseurUrl: settings.signatureProviseurUrl,
  signatureTitulaireUrl: settings.signatureTitulaireUrl,
});

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
  onNavigate,
  onOpenProfil,
  candidates = [],
  allStats = {},
  onAdminDataChanged,
  usingApi = false,
  activeSessionId = null,
  onOpenSession,
  onOpenAdmin,
  charteModifieeLe = null,
}) => {
  const [activeTab, setActiveTab] = useState<'branding' | 'archives' | 'admin'>('branding');
  const [formData, setFormData] = useState<AppSettings>(settings);
  const [showSavedToast, setShowSavedToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('Paramètres enregistrés !');

  // Les images affichées sont toujours celles enregistrées (serveur en session connectée) : une relecture
  // de l'espace ou un refus du serveur ne doit jamais laisser un aperçu qui n'existe nulle part ailleurs.
  useEffect(() => {
    setFormData((prev) => ({ ...prev, ...imagesDe(settings) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.logoUrl, settings.sealUrl, settings.sceauUrl, settings.signatureProviseurUrl, settings.signatureTitulaireUrl]);

  /**
   * Point de passage unique des enregistrements : le formulaire reflète la saisie, la confirmation
   * n'apparaît qu'après l'accord du gestionnaire (sur le serveur en session connectée). En cas de refus,
   * les aperçus d'images reviennent aux valeurs enregistrées ; la saisie des textes est conservée.
   */
  const enregistrer = async (
    next: AppSettings,
    message: string,
    duree = 2500,
    options?: { enTeteDejaEnregistre?: boolean },
  ): Promise<boolean> => {
    setFormData(next);
    const ok = await onUpdateSettings(next, options);
    if (ok === false) {
      setFormData((prev) => ({ ...prev, ...imagesDe(settings) }));
      return false;
    }
    setToastMessage(usingApi && message === 'Paramètres enregistrés !' ? 'Paramètres enregistrés sur le serveur.' : message);
    setShowSavedToast(true);
    setTimeout(() => setShowSavedToast(false), duree);
    return true;
  };

  // Préréglages nationaux : référentiel de la plateforme en session API, liste de démonstration hors connexion.
  const [prereglages, setPrereglages] = useState<PrereglageNational[]>(usingApi ? [] : PREREGLAGES_DEMONSTRATION);
  const [prereglagesEtat, setPrereglagesEtat] = useState<'chargement' | 'pret' | 'erreur'>(usingApi ? 'chargement' : 'pret');
  const [prereglageEnCours, setPrereglageEnCours] = useState<number | null>(null);

  useEffect(() => {
    if (!usingApi) {
      setPrereglages(PREREGLAGES_DEMONSTRATION);
      setPrereglagesEtat('pret');
      return;
    }
    let actif = true;
    setPrereglagesEtat('chargement');
    loadPrereglagesNationaux()
      .then((liste) => {
        if (!actif) return;
        setPrereglages(liste);
        setPrereglagesEtat('pret');
      })
      .catch(() => {
        if (!actif) return;
        setPrereglages([]);
        setPrereglagesEtat('erreur');
      });
    return () => {
      actif = false;
    };
  }, [usingApi]);

  const prereglageActif = prereglageCourant(formData, prereglages);

  /**
   * Applique un préréglage : copie ses libellés dans l'en-tête ; cachet, signatures et logos sont conservés.
   * En session API, c'est le serveur qui copie le préréglage dans la fiche de l'établissement ; les libellés
   * qui viennent du serveur (établissement, année, session, examen) ne sont jamais écrasés.
   */
  const applyPreset = async (preset: PrereglageNational) => {
    setPrereglageEnCours(preset.id);
    try {
      let next: AppSettings;
      if (usingApi) {
        const profil = await appliquerPrereglageNational(preset.id);
        next = appliquerEnTeteAuxSettings(formData, profil.enTete);
      } else {
        next = appliquerPrereglageAuxSettings(formData, preset);
      }
      await enregistrer(next, `Préréglage officiel « ${preset.nomPays} » appliqué : en-tête du bulletin mis à jour.`, 3000,
        { enTeteDejaEnregistre: usingApi });
    } catch (err) {
      showError(err instanceof Error && err.message ? err.message : 'Préréglage non appliqué.');
    } finally {
      setPrereglageEnCours(null);
    }
  };

  const showError = (message: string) => {
    setToastMessage(message);
    setShowSavedToast(true);
    setTimeout(() => setShowSavedToast(false), 3500);
  };

  const applyCharteAsset = (champ: ImageCharte, dataUrl: string): Promise<boolean> => {
    const messages: Record<ImageCharte, [string, string]> = {
      logoUrl: [
        usingApi ? 'Logo enregistré dans la base de l’établissement : il sera retrouvé à chaque connexion.' : 'Logo enregistré.',
        'Logo retiré : les initiales de l’établissement sont affichées.',
      ],
      sealUrl: [
        'Sceau officiel enregistré : il apparaît au centre du bulletin et en filigrane.',
        "Sceau retiré : l'emplacement restera vide sur le bulletin pour apposition manuelle.",
      ],
      sceauUrl: ['Cachet enregistré : il apparaît désormais sur le bulletin.', "Cachet retiré : l'emplacement reste vide pour une apposition à la main."],
      signatureProviseurUrl: ['Signature enregistrée : elle apparaît désormais sur le bulletin.', "Signature retirée : l'emplacement reste vide pour une signature à la main."],
      signatureTitulaireUrl: ['Signature enregistrée : elle apparaît désormais sur le bulletin.', "Signature retirée : l'emplacement reste vide pour une signature à la main."],
    };
    return enregistrer({ ...formData, [champ]: dataUrl }, messages[champ][dataUrl ? 0 : 1], 3000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void enregistrer(formData, 'Paramètres enregistrés !');
  };

  const handleResetDefaults = async () => {
    const ok = await confirmAction({
      title: 'Rétablir les valeurs par défaut ?',
      text: usingApi
        ? 'Les textes du bulletin (signataires, numérotation) reviennent aux valeurs par défaut du logiciel. Le logo, le sceau, le cachet et les signatures enregistrés dans la base de l’établissement sont conservés.'
        : 'Les logos et paramètres officiels par défaut remplaceront la configuration actuelle.',
      confirmText: 'Rétablir',
      icon: 'warning',
    });
    if (ok) {
      // En session connectée, aucune image de démonstration ne doit partir au serveur ni remplacer celles de l'établissement.
      void enregistrer(usingApi ? {
        ...parametresSansDemonstration(DEFAULT_SETTINGS),
        ...imagesDe(settings),
        institutionName: formData.institutionName,
        academicYear: formData.academicYear,
        sessionName: formData.sessionName,
        examType: formData.examType,
      } : DEFAULT_SETTINGS, 'Paramètres enregistrés !');
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="settings-chrome bg-white rounded p-6 shadow-sm border border-[#eaedff] flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#0051d5] bg-[#eaedff] px-2.5 py-1 rounded">
            Configuration &amp; Charte Graphique
          </span>
          <h2 className="text-[22px] font-bold text-[#00236f] mt-1.5">
            Paramètres Institutionnels &amp; Gestion des Logos
          </h2>
          <p className="text-[13px] text-[#444651] mt-0.5">
            Modifiez le logo officiel, le sceau du jury, ainsi que les mentions de l'en-tête ministériel du bulletin A4.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handleResetDefaults()}
            className="px-3.5 py-2 rounded bg-[#f2f3ff] text-[#444651] text-[12px] font-semibold hover:bg-[#e2e7ff] transition-colors"
          >
            Rétablir valeurs par défaut
          </button>
          <button
            type="button"
            onClick={() => onNavigate('bulletin')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded bg-[#00236f] text-white text-[12px] font-semibold hover:bg-[#1e3a8a] transition-all shadow-xs"
          >
            <span className="material-symbols-outlined text-base">picture_as_pdf</span>
            <span>Prévisualiser sur le Bulletin</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs between Configuration & Session Archives */}
      <div className="settings-chrome flex w-full min-w-0 flex-wrap items-end gap-x-2 gap-y-1 border-b border-[#eaedff]">
        <button
          type="button"
          onClick={() => setActiveTab('branding')}
          className={`inline-flex max-w-full shrink-0 items-center gap-2 whitespace-nowrap pb-3 px-4 font-bold text-[13px] border-b-2 transition-all ${
            activeTab === 'branding'
              ? 'border-[#0051d5] text-[#0051d5]'
              : 'border-transparent text-[#444651] hover:text-[#131b2e]'
          }`}
        >
          <span className="material-symbols-outlined text-base shrink-0">palette</span>
          <span>Charte Graphique &amp; Établissement</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('archives')}
          className={`inline-flex max-w-full shrink-0 flex-wrap items-center gap-x-2 gap-y-1 pb-3 px-4 font-bold text-[13px] border-b-2 transition-all ${
            activeTab === 'archives'
              ? 'border-[#0051d5] text-[#0051d5]'
              : 'border-transparent text-[#444651] hover:text-[#131b2e]'
          }`}
        >
          <span className="material-symbols-outlined text-base shrink-0">history_edu</span>
          <span className="min-w-0 text-left leading-snug">Archives des Sessions &amp; Comparateur Pluriannuel</span>
          <span className="shrink-0 whitespace-nowrap text-[10px] font-bold uppercase bg-[#eaedff] text-[#00236f] px-2 py-0.5 rounded-full">
            Interannuel
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('admin')}
          className={`inline-flex max-w-full shrink-0 items-center gap-2 whitespace-nowrap pb-3 px-4 font-bold text-[13px] border-b-2 transition-all ${
            activeTab === 'admin'
              ? 'border-[#0051d5] text-[#0051d5]'
              : 'border-transparent text-[#444651] hover:text-[#131b2e]'
          }`}
        >
          <span className="material-symbols-outlined text-base shrink-0">admin_panel_settings</span>
          <span>Administration (API)</span>
        </button>
      </div>

      {activeTab === 'admin' ? (
        <AdminParametres onDataChanged={onAdminDataChanged} />
      ) : activeTab === 'archives' ? (
        <ArchivedSessionsSection
          settings={settings}
          candidates={candidates}
          allStats={allStats}
          onNavigateToBulletin={() => onNavigate('bulletin')}
          usingApi={usingApi}
          activeSessionId={activeSessionId}
          onOpenSession={onOpenSession}
          onOpenAdmin={onOpenAdmin}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Colonne gauche : images de l'établissement (même composant que la page Profil) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white p-5 rounded border border-[#eaedff] shadow-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#eaedff] pb-2">
              <h3 className="text-[14px] font-bold text-[#00236f] uppercase tracking-wide flex items-center gap-2">
                <span className="material-symbols-outlined text-lg text-[#0051d5]">image</span>
                Logo, Sceau, Cachet &amp; Signatures
              </h3>
              {usingApi && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#dcfce7] text-[#166534]">
                  Base de l’établissement
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#444651] leading-snug">
              {usingApi
                ? 'Ces images sont celles de la fiche de l’établissement : enregistrées dans sa base, elles sont relues à chaque connexion, depuis tout poste. Elles se gèrent aussi depuis « Profil de l’établissement › Charte graphique ».'
                : 'Logo de la barre latérale, sceau officiel du bulletin, cachet et signatures des cartes « Le Titulaire » et « Le Proviseur ».'}
            </p>

            <CharteImagesPanel
              settings={formData}
              usingApi={usingApi}
              modifieLe={charteModifieeLe}
              onChange={applyCharteAsset}
              onError={showError}
              onRetablirSceauDemo={() => {
                void enregistrer({ ...formData, sealUrl: TOGO_SETTINGS.sealUrl }, 'Sceau de démonstration réactivé.', 3000);
              }}
            />

            {usingApi && onOpenProfil && (
              <div className="pt-3 border-t border-[#eaedff]">
                <button
                  type="button"
                  onClick={onOpenProfil}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#eaedff] hover:bg-[#dce1ff] text-[#00236f] text-[11px] font-bold shadow-2xs transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">account_balance</span>
                  <span>Ouvrir le profil de l’établissement</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Institutional Identity Form */}
        <div className="lg:col-span-7 bg-white p-6 rounded border border-[#eaedff] shadow-xs">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="border-b border-[#eaedff] pb-3">
              <h3 className="text-[15px] font-bold text-[#00236f] uppercase tracking-wide">
                En-tête Officiel &amp; Textes du Bulletin
              </h3>
              <p className="text-[12px] text-[#444651]">
                Ces mentions apparaissent directement sur chaque bulletin de notes officiel et procès-verbal imprimé.
              </p>
            </div>

            {/* Préréglages nationaux : référentiel géré par la plateforme (API) ou liste de démonstration */}
            <div className="bg-[#f2f3ff] p-3 rounded border border-[#eaedff] space-y-2" data-testid="prereglages-nationaux">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-[#00236f] uppercase tracking-wide block">
                  Préréglages Nationaux en 1 Clic :
                </span>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                  usingApi ? 'bg-[#dcfce7] text-[#166534]' : 'bg-amber-100 text-amber-800'
                }`}>
                  {usingApi ? 'Référentiel de la plateforme' : 'Démonstration'}
                </span>
              </div>
              {prereglagesEtat === 'chargement' && (
                <p className="text-[11px] text-[#444651]">Chargement des préréglages de la plateforme…</p>
              )}
              {prereglagesEtat === 'erreur' && (
                <p className="text-[11px] text-[#ba1a1a]">
                  Préréglages indisponibles pour le moment : saisissez l'en-tête ci-dessous ou réessayez plus tard.
                </p>
              )}
              {prereglagesEtat === 'pret' && prereglages.length === 0 && (
                <p className="text-[11px] text-[#444651]">
                  Aucun préréglage national n'est proposé par la plateforme : saisissez l'en-tête ci-dessous.
                </p>
              )}
              {prereglages.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {prereglages.map((preset) => {
                    const selected = prereglageActif?.id === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        disabled={prereglageEnCours !== null}
                        onClick={() => void applyPreset(preset)}
                        aria-pressed={selected}
                        className={`p-2.5 rounded text-left border transition-all flex items-center gap-2.5 disabled:opacity-60 ${
                          selected
                            ? 'bg-white border-[#0051d5] shadow-xs ring-2 ring-[#0051d5]/40'
                            : 'bg-white/60 border-[#eaedff] hover:bg-white'
                        }`}
                      >
                        <span className="text-2xl" aria-hidden="true">{drapeau(preset.code) || preset.code}</span>
                        <div className="min-w-0">
                          <span className="text-[12px] font-bold text-[#00236f] block truncate">
                            {preset.nomPays} ({preset.sigleMinistere})
                          </span>
                          <span className="text-[10px] text-[#444651] block leading-tight truncate">
                            {preset.devise}
                          </span>
                        </div>
                        {prereglageEnCours === preset.id && (
                          <span className="material-symbols-outlined text-base text-[#0051d5] animate-spin ml-auto">progress_activity</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
              {!usingApi && (
                <p className="text-[10px] text-[#444651] leading-snug">
                  Hors connexion, cette liste est une démonstration. Connecté, elle vient du référentiel « Pays &amp; ministères » tenu par la plateforme.
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[12px]">
              {/* Shortcut Banner to Archives & Comparison */}
              <div className="sm:col-span-2 bg-gradient-to-r from-[#eaedff] to-[#f2f3ff] p-3.5 rounded-lg border border-[#dce1ff] flex flex-wrap items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-md bg-[#0051d5] text-white flex items-center justify-center shrink-0 shadow-xs">
                    <span className="material-symbols-outlined text-lg">history_edu</span>
                  </div>
                  <div>
                    <span className="text-[12px] font-bold text-[#00236f] block">
                      Archives des Sessions &amp; Comparateur Pluriannuel
                    </span>
                    <span className="text-[11px] text-[#444651]">
                      Consultez l'historique et comparez les résultats de l'établissement sur plusieurs années scolaires.
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('archives')}
                  className="px-3.5 py-1.5 rounded-md bg-[#0051d5] hover:bg-[#003cb3] text-white text-[11.5px] font-bold shrink-0 transition-all shadow-xs flex items-center gap-1 active:scale-95"
                >
                  <span>Consulter le Comparateur</span>
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </button>
              </div>

              {/* Highlighted Establishment Name Field */}
              <div className="sm:col-span-2 bg-[#f2f3ff] p-4 rounded-lg border-2 border-[#0051d5]/30 shadow-xs">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="flex items-center gap-2 font-bold text-[#00236f] uppercase text-[12px] tracking-wide">
                    <span className="material-symbols-outlined text-lg text-[#0051d5]">apartment</span>
                    <span>Nom Officiel de l'Établissement Scolaire (Lycée / Collège)</span>
                  </label>
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-[#0051d5] text-white px-2 py-0.5 rounded">
                    Obligatoire
                  </span>
                </div>
                <input
                  type="text"
                  required
                  placeholder="Ex : Lycée Moderne de Tokoin, Collège Protestant de Lomé"
                  value={formData.institutionName}
                  readOnly={usingApi}
                  title={usingApi ? 'Nom enregistré dans le profil de l’établissement (serveur) : modifiez-le depuis « Profil de l’établissement ».' : undefined}
                  onChange={(e) => setFormData({ ...formData, institutionName: e.target.value })}
                  className={`w-full text-[14px] py-2.5 px-3.5 rounded-md border border-[#0051d5]/40 outline-none focus:ring-2 focus:ring-[#0051d5]/30 focus:border-[#0051d5] font-bold text-[#00236f] ${usingApi ? 'bg-[#faf8ff] cursor-not-allowed' : 'bg-white'}`}
                />
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-2 pt-2 border-t border-[#0051d5]/15">
                  <span className="text-[11px] text-[#444651] block">
                    {usingApi
                      ? 'Nom lu depuis le profil de l’établissement enregistré sur le serveur : il se modifie depuis « Profil de l’établissement ».'
                      : 'Ce nom officiel apparaît sur tous les bulletins, bordereaux et procès-verbaux de votre établissement.'}
                  </span>
                  {onOpenProfil && (
                    <button
                      type="button"
                      onClick={onOpenProfil}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#0051d5] hover:bg-[#003cb3] text-white text-[11px] font-bold shrink-0 shadow-xs transition-colors"
                    >
                      <span className="material-symbols-outlined text-sm">account_balance</span>
                      <span>Profil de l’établissement</span>
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#444651] uppercase text-[11px] mb-1">
                  Pays / État Républicain
                </label>
                <input
                  type="text"
                  value={formData.countryName}
                  onChange={(e) => setFormData({ ...formData, countryName: e.target.value })}
                  className="w-full bg-[#f2f3ff] py-2 px-3 rounded border border-[#eaedff] outline-none focus:bg-white focus:border-[#0051d5]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#444651] uppercase text-[11px] mb-1">
                  Devise Nationale
                </label>
                <input
                  type="text"
                  value={formData.motto}
                  onChange={(e) => setFormData({ ...formData, motto: e.target.value })}
                  className="w-full bg-[#f2f3ff] py-2 px-3 rounded border border-[#eaedff] outline-none focus:bg-white focus:border-[#0051d5]"
                />
              </div>

              <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-4">
                <div>
                  <label className="block font-bold text-[#444651] uppercase text-[11px] mb-1">
                    Ministère de Tutelle
                  </label>
                  <input
                    type="text"
                    value={formData.ministryName}
                    onChange={(e) => setFormData({ ...formData, ministryName: e.target.value })}
                    className="w-full bg-[#f2f3ff] py-2 px-3 rounded border border-[#eaedff] outline-none focus:bg-white focus:border-[#0051d5]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#444651] uppercase text-[11px] mb-1">
                    Sigle
                  </label>
                  <input
                    type="text"
                    maxLength={20}
                    placeholder="MEPST"
                    value={formData.ministrySigle ?? ''}
                    onChange={(e) => setFormData({ ...formData, ministrySigle: e.target.value.toUpperCase() })}
                    className="w-full bg-[#f2f3ff] py-2 px-3 rounded border border-[#eaedff] outline-none focus:bg-white focus:border-[#0051d5]"
                  />
                </div>
              </div>



              <div>
                <label className="block font-bold text-[#444651] uppercase text-[11px] mb-1">
                  Année Académique
                </label>
                <input
                  type="text"
                  value={formData.academicYear}
                  readOnly={usingApi}
                  title={usingApi ? 'Année courante définie dans Administration › Années scolaires (serveur).' : undefined}
                  onChange={(e) => setFormData({ ...formData, academicYear: e.target.value })}
                  className={`w-full py-2 px-3 rounded border border-[#eaedff] outline-none focus:bg-white focus:border-[#0051d5] ${usingApi ? 'bg-[#faf8ff] text-[#757682] cursor-not-allowed' : 'bg-[#f2f3ff]'}`}
                />
                {usingApi && (
                  <span className="block text-[10.5px] text-[#757682] mt-1">Définie dans Administration › Années scolaires.</span>
                )}
              </div>

              <div>
                <label className="block font-bold text-[#444651] uppercase text-[11px] mb-1">
                  Session d'Examen
                </label>
                <input
                  type="text"
                  value={formData.sessionName}
                  readOnly={usingApi}
                  title={usingApi ? 'Session chargée, définie dans Administration › Sessions (serveur).' : undefined}
                  onChange={(e) => setFormData({ ...formData, sessionName: e.target.value })}
                  className={`w-full py-2 px-3 rounded border border-[#eaedff] outline-none focus:bg-white focus:border-[#0051d5] ${usingApi ? 'bg-[#faf8ff] text-[#757682] cursor-not-allowed' : 'bg-[#f2f3ff]'}`}
                />
                {usingApi && (
                  <span className="block text-[10.5px] text-[#757682] mt-1">Définie dans Administration › Sessions.</span>
                )}
              </div>

              <div>
                <label className="block font-bold text-[#444651] uppercase text-[11px] mb-1">
                  Le Proviseur (Signataire officiel)
                </label>
                <input
                  type="text"
                  value={formData.jurySignerName}
                  onChange={(e) => setFormData({ ...formData, jurySignerName: e.target.value })}
                  className="w-full bg-[#f2f3ff] py-2 px-3 rounded border border-[#eaedff] outline-none focus:bg-white focus:border-[#0051d5]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#444651] uppercase text-[11px] mb-1">
                  Le Titulaire (Visa)
                </label>
                <input
                  type="text"
                  value={formData.principalTeacherName}
                  onChange={(e) => setFormData({ ...formData, principalTeacherName: e.target.value })}
                  className="w-full bg-[#f2f3ff] py-2 px-3 rounded border border-[#eaedff] outline-none focus:bg-white focus:border-[#0051d5]"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-[#eaedff] flex items-center justify-between">
              <span className="text-[11px] text-[#444651]">
                {usingApi
                  ? 'Enregistré dans la base de l’établissement sur le serveur : retrouvé à chaque connexion.'
                  : 'Démonstration : enregistrement dans ce navigateur uniquement.'}
              </span>
              <button
                type="submit"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded bg-[#00236f] text-white text-[13px] font-bold hover:bg-[#1e3a8a] transition-all shadow-md"
              >
                <span className="material-symbols-outlined text-base">save</span>
                <span>Enregistrer les Modifications</span>
              </button>
            </div>
          </form>
        </div>
      </div>
      )}

      {/* Floating Save Toast */}
      {showSavedToast && (
        <div className="fixed bottom-6 right-6 bg-[#00236f] text-white px-4 py-3 rounded shadow-2xl flex items-center gap-2.5 z-50 animate-bounce text-[12px] font-medium border border-[#90a8ff]/30">
          <span className="material-symbols-outlined text-[#316bf3] text-base">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
