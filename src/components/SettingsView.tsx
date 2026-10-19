import React, { useEffect, useState, useRef } from 'react';
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
import { CharteAssetUpload } from './CharteAssetUpload';
import { CharteField } from '../api/charte';
import { isSafeImageUrl } from '../utils/safeUrl';
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
}

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
}) => {
  const [activeTab, setActiveTab] = useState<'branding' | 'archives' | 'admin'>('branding');
  const [formData, setFormData] = useState<AppSettings>(settings);
  const [logoInputUrl, setLogoInputUrl] = useState('');
  const [sealInputUrl, setSealInputUrl] = useState('');
  const [showSavedToast, setShowSavedToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('Paramètres enregistrés !');
  const logoFileInputRef = useRef<HTMLInputElement>(null);
  const sealFileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Point de passage unique des enregistrements : le formulaire reflète la saisie, la confirmation
   * n'apparaît qu'après l'accord du gestionnaire (sur le serveur en session connectée).
   */
  const enregistrer = async (
    next: AppSettings,
    message: string,
    duree = 2500,
    options?: { enTeteDejaEnregistre?: boolean },
  ): Promise<boolean> => {
    setFormData(next);
    const ok = await onUpdateSettings(next, options);
    if (ok === false) return false;
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

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: 'logoUrl' | 'sealUrl'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/') || file.size > 1_500_000) {
      setToastMessage('Choisissez une image (PNG, JPG, WEBP, GIF) de moins de 1,5 Mo.');
      setShowSavedToast(true);
      setTimeout(() => setShowSavedToast(false), 3000);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string' && isSafeImageUrl(reader.result)) {
        void enregistrer({ ...formData, [field]: reader.result }, 'Paramètres enregistrés !');
      }
    };
    reader.readAsDataURL(file);
  };

  const applyLogoUrl = () => {
    if (!isSafeImageUrl(logoInputUrl)) {
      setToastMessage('URL de logo refusée : utilisez une adresse http(s).');
      setShowSavedToast(true);
      setTimeout(() => setShowSavedToast(false), 3000);
      return;
    }
    void enregistrer({ ...formData, logoUrl: logoInputUrl.trim() }, 'Paramètres enregistrés !')
      .then((ok) => { if (ok) setLogoInputUrl(''); });
  };

  const applySealUrl = () => {
    if (!isSafeImageUrl(sealInputUrl)) {
      setToastMessage('URL de sceau refusée : utilisez une adresse http(s).');
      setShowSavedToast(true);
      setTimeout(() => setShowSavedToast(false), 3000);
      return;
    }
    void enregistrer({ ...formData, sealUrl: sealInputUrl.trim() }, 'Paramètres enregistrés !')
      .then((ok) => { if (ok) setSealInputUrl(''); });
  };

  const showError = (message: string) => {
    setToastMessage(message);
    setShowSavedToast(true);
    setTimeout(() => setShowSavedToast(false), 3500);
  };

  const applyCharteAsset = (field: CharteField, dataUrl: string) => {
    void enregistrer({ ...formData, [field]: dataUrl }, dataUrl
      ? 'Image enregistrée : elle apparaît désormais sur le bulletin.'
      : "Image retirée : l'emplacement reste vide pour une apposition à la main.");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void enregistrer(formData, 'Paramètres enregistrés !');
  };

  const handleResetDefaults = async () => {
    const ok = await confirmAction({
      title: 'Rétablir les valeurs par défaut ?',
      text: 'Les logos et paramètres officiels par défaut remplaceront la configuration actuelle.',
      confirmText: 'Rétablir',
      icon: 'warning',
    });
    if (ok) {
      void enregistrer(usingApi ? {
        ...DEFAULT_SETTINGS,
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
          {/* Left Column: Logo & Seal Management */}
        <div className="lg:col-span-5 space-y-6">
          {/* Logo Card */}
          <div className="bg-white p-5 rounded border border-[#eaedff] shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#eaedff] pb-2">
              <h3 className="text-[14px] font-bold text-[#00236f] uppercase tracking-wide flex items-center gap-2">
                <span className="material-symbols-outlined text-lg text-[#0051d5]">image</span>
                Logo Principal de l'Académie
              </h3>
            </div>

            {/* Logo Preview */}
            <div className="flex flex-col items-center justify-center p-4 bg-[#f2f3ff] rounded border border-dashed border-[#dce1ff]">
              <div className="w-24 h-24 bg-white rounded-lg p-2 shadow-xs flex items-center justify-center border border-[#eaedff] overflow-hidden">
                <img
                  src={formData.logoUrl}
                  alt="Aperçu Logo"
                  className="max-h-full max-w-full object-contain"
                />
              </div>
              <span className="text-[11px] text-[#444651] mt-2 font-medium">
                Logo affiché en barre latérale et sur l'en-tête A4
              </span>
            </div>

            {/* Upload File Button */}
            <div>
              <input
                ref={logoFileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleFileChange(e, 'logoUrl')}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => logoFileInputRef.current?.click()}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded bg-[#0051d5] text-white text-[12px] font-bold hover:bg-[#003ea8] transition-all shadow-xs"
              >
                <span className="material-symbols-outlined text-base">upload_file</span>
                <span>Téléverser une image (PNG / JPG / SVG)</span>
              </button>
            </div>

            {/* URL input alternative */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold uppercase text-[#444651]">
                Ou renseigner l'URL d'une image
              </label>
              <div className="flex gap-1.5">
                <input
                  type="url"
                  placeholder="https://.../mon-logo.png"
                  value={logoInputUrl}
                  onChange={(e) => setLogoInputUrl(e.target.value)}
                  className="flex-1 bg-[#f2f3ff] text-[12px] py-1.5 px-3 rounded border border-[#eaedff] outline-none focus:bg-white focus:border-[#0051d5]"
                />
                <button
                  type="button"
                  onClick={applyLogoUrl}
                  className="px-3 py-1.5 rounded bg-[#eaedff] text-[#00236f] text-[12px] font-semibold hover:bg-[#dce1ff]"
                >
                  OK
                </button>
              </div>
            </div>
          </div>

          {/* Sceau du Jury Card */}
          <div className="bg-white p-5 rounded border border-[#eaedff] shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#eaedff] pb-2">
              <h3 className="text-[14px] font-bold text-[#00236f] uppercase tracking-wide flex items-center gap-2">
                <span className="material-symbols-outlined text-lg text-[#0051d5]">verified</span>
                Sceau Officiel du Jury / DEXCO
              </h3>
            </div>

            <div className="flex flex-col items-center justify-center p-4 bg-[#f2f3ff] rounded border border-dashed border-[#dce1ff]">
              {formData.sealUrl && formData.sealUrl.trim() !== '' ? (
                <div className="w-20 h-20 rounded-full bg-white p-2 shadow-xs flex items-center justify-center border border-[#eaedff] overflow-hidden">
                  <img
                    src={formData.sealUrl}
                    alt="Aperçu Sceau"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              ) : (
                <div className="w-20 h-20 rounded-full border-2 border-dashed border-[#a0a5b5] bg-white flex flex-col items-center justify-center p-1 text-center shadow-2xs">
                  <span className="material-symbols-outlined text-[#6b7280] text-xl">ink_pen</span>
                  <span className="text-[8.5px] text-[#4b5563] uppercase font-bold leading-tight mt-0.5">
                    Zone Vierge
                  </span>
                  <span className="text-[7.5px] text-[#9ca3af]">
                    (Tampon manuel)
                  </span>
                </div>
              )}
              <span className="text-[11px] text-[#444651] mt-2 font-medium text-center">
                {formData.sealUrl && formData.sealUrl.trim() !== ''
                  ? 'Sceau numérique actif (imprimé au centre et en filigrane).'
                  : 'Aucun sceau téléversé : l\'emplacement est laissé totalement vide sur le bulletin pour apposition d\'un cachet physique manuel à l\'encre.'}
              </span>
            </div>

            {/* Clear / Reset Seal Button */}
            {formData.sealUrl && formData.sealUrl.trim() !== '' ? (
              <button
                type="button"
                onClick={() => {
                  void enregistrer({ ...formData, sealUrl: '' },
                    "Sceau supprimé : l'emplacement restera vide sur le bulletin pour apposition manuelle.", 3000);
                }}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-900 text-[11.5px] font-bold border border-amber-200 transition-colors shadow-2xs"
              >
                <span className="material-symbols-outlined text-base text-amber-700">ink_eraser</span>
                <span>Ne rien mettre (laisser vide pour tampon manuel)</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  void enregistrer({ ...formData, sealUrl: TOGO_SETTINGS.sealUrl },
                    'Sceau officiel par défaut réactivé.', 3000);
                }}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md bg-[#eaedff] hover:bg-[#dce1ff] text-[#00236f] text-[11.5px] font-bold border border-[#dce1ff] transition-colors"
              >
                <span className="material-symbols-outlined text-base text-[#0051d5]">verified</span>
                <span>Rétablir le Sceau Officiel de l'État</span>
              </button>
            )}

            <div>
              <input
                ref={sealFileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleFileChange(e, 'sealUrl')}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => sealFileInputRef.current?.click()}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded bg-[#0051d5] text-white text-[12px] font-bold hover:bg-[#003ea8] transition-all shadow-xs"
              >
                <span className="material-symbols-outlined text-base">upload_file</span>
                <span>Téléverser un Sceau / Cachet Spécifique</span>
              </button>
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-bold uppercase text-[#444651]">
                Ou URL d'un Sceau
              </label>
              <div className="flex gap-1.5">
                <input
                  type="url"
                  placeholder="https://.../mon-sceau.png"
                  value={sealInputUrl}
                  onChange={(e) => setSealInputUrl(e.target.value)}
                  className="flex-1 bg-[#f2f3ff] text-[12px] py-1.5 px-3 rounded border border-[#eaedff] outline-none focus:bg-white focus:border-[#0051d5]"
                />
                <button
                  type="button"
                  onClick={applySealUrl}
                  className="px-3 py-1.5 rounded bg-[#eaedff] text-[#00236f] text-[12px] font-semibold hover:bg-[#dce1ff]"
                >
                  OK
                </button>
              </div>
            </div>
          </div>

          {/* Cachet & signatures des cartes « Le Titulaire » / « Le Proviseur » */}
          <div className="bg-white p-5 rounded border border-[#eaedff] shadow-xs space-y-1">
            <div className="flex items-center justify-between border-b border-[#eaedff] pb-2 mb-1">
              <h3 className="text-[14px] font-bold text-[#00236f] uppercase tracking-wide flex items-center gap-2">
                <span className="material-symbols-outlined text-lg text-[#0051d5]">approval</span>
                Cachet &amp; Signatures du Bulletin
              </h3>
            </div>
            <p className="text-[11px] text-[#444651] leading-snug pb-1">
              Images affichées dans les cartes « {formData.principalTeacherTitle || 'Le Titulaire'} » et
              « {formData.jurySignerTitle || 'Le Proviseur'} » en bas du bulletin. Sans image, l'emplacement
              reste vide pour le cachet humide et les signatures à la main.
            </p>

            <CharteAssetUpload
              label="Sceau / cachet de l'établissement"
              hint="Cachet rond ou rectangulaire, idéalement PNG détouré (fond transparent)."
              icon="approval"
              shape="round"
              value={formData.sceauUrl}
              onChange={(dataUrl) => applyCharteAsset('sceauUrl', dataUrl)}
              onError={showError}
            />
            <CharteAssetUpload
              label={`Signature du ${(formData.jurySignerTitle || 'Proviseur').replace(/^le\s+/i, '')}`}
              hint="Signature manuscrite scannée, affichée à côté du cachet."
              icon="draw"
              value={formData.signatureProviseurUrl}
              onChange={(dataUrl) => applyCharteAsset('signatureProviseurUrl', dataUrl)}
              onError={showError}
            />
            <CharteAssetUpload
              label={`Signature du ${(formData.principalTeacherTitle || 'Titulaire').replace(/^le\s+/i, '')}`}
              hint="Optionnelle : signature scannée du titulaire de la classe."
              icon="draw"
              value={formData.signatureTitulaireUrl}
              onChange={(dataUrl) => applyCharteAsset('signatureTitulaireUrl', dataUrl)}
              onError={showError}
            />
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
                Enregistrement automatique dans le stockage local IndexedDB.
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
