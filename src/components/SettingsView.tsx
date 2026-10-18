import React, { useState, useRef } from 'react';
import { AppSettings, Candidate, CandidateComputedStats } from '../types';
import { DEFAULT_SETTINGS, TOGO_SETTINGS, CI_SETTINGS } from '../data/mockData';
import { ArchivedSessionsSection } from './ArchivedSessionsSection';
import { AdminParametres } from './AdminParametres';
import { isSafeImageUrl } from '../utils/safeUrl';
import { confirmAction } from '../utils/alerts';

interface SettingsViewProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  onNavigate: (view: 'dashboard' | 'students' | 'grading' | 'bulletin' | 'records' | 'settings') => void;
  onOpenAuth?: () => void;
  candidates?: Candidate[];
  allStats?: Record<string, CandidateComputedStats>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
  onNavigate,
  onOpenAuth,
  candidates = [],
  allStats = {},
}) => {
  const [activeTab, setActiveTab] = useState<'branding' | 'archives' | 'admin'>('branding');
  const [formData, setFormData] = useState<AppSettings>(settings);
  const [logoInputUrl, setLogoInputUrl] = useState('');
  const [sealInputUrl, setSealInputUrl] = useState('');
  const [showSavedToast, setShowSavedToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('Paramètres enregistrés !');
  const logoFileInputRef = useRef<HTMLInputElement>(null);
  const sealFileInputRef = useRef<HTMLInputElement>(null);

  const applyPreset = (preset: AppSettings, label: string) => {
    setFormData(preset);
    onUpdateSettings(preset);
    setToastMessage(`Préréglage officiel pour ${label} appliqué avec succès !`);
    setShowSavedToast(true);
    setTimeout(() => setShowSavedToast(false), 3000);
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
        const updated = { ...formData, [field]: reader.result };
        setFormData(updated);
        onUpdateSettings(updated);
        triggerToast();
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
    const updated = { ...formData, logoUrl: logoInputUrl.trim() };
    setFormData(updated);
    onUpdateSettings(updated);
    setLogoInputUrl('');
    triggerToast();
  };

  const applySealUrl = () => {
    if (!isSafeImageUrl(sealInputUrl)) {
      setToastMessage('URL de sceau refusée : utilisez une adresse http(s).');
      setShowSavedToast(true);
      setTimeout(() => setShowSavedToast(false), 3000);
      return;
    }
    const updated = { ...formData, sealUrl: sealInputUrl.trim() };
    setFormData(updated);
    onUpdateSettings(updated);
    setSealInputUrl('');
    triggerToast();
  };

  const triggerToast = () => {
    setShowSavedToast(true);
    setTimeout(() => setShowSavedToast(false), 2500);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings(formData);
    triggerToast();
  };

  const handleResetDefaults = async () => {
    const ok = await confirmAction({
      title: 'Rétablir les valeurs par défaut ?',
      text: 'Les logos et paramètres officiels par défaut remplaceront la configuration actuelle.',
      confirmText: 'Rétablir',
      icon: 'warning',
    });
    if (ok) {
      setFormData(DEFAULT_SETTINGS);
      onUpdateSettings(DEFAULT_SETTINGS);
      triggerToast();
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
        <AdminParametres />
      ) : activeTab === 'archives' ? (
        <ArchivedSessionsSection
          settings={settings}
          candidates={candidates}
          allStats={allStats}
          onNavigateToBulletin={() => onNavigate('bulletin')}
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
                  const updated = { ...formData, sealUrl: '' };
                  setFormData(updated);
                  onUpdateSettings(updated);
                  setToastMessage("Sceau supprimé : l'emplacement restera vide sur le bulletin pour apposition manuelle.");
                  setShowSavedToast(true);
                  setTimeout(() => setShowSavedToast(false), 3000);
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
                  const updated = { ...formData, sealUrl: TOGO_SETTINGS.sealUrl };
                  setFormData(updated);
                  onUpdateSettings(updated);
                  setToastMessage("Sceau officiel de la République Togolaise réactivé.");
                  setShowSavedToast(true);
                  setTimeout(() => setShowSavedToast(false), 3000);
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

            {/* Quick Country Preset Selectors */}
            <div className="bg-[#f2f3ff] p-3 rounded border border-[#eaedff] space-y-2">
              <span className="text-[11px] font-bold text-[#00236f] uppercase tracking-wide block">
                Préréglages Nationaux en 1 Clic :
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => applyPreset(TOGO_SETTINGS, 'le TOGO')}
                  className={`p-2.5 rounded text-left border transition-all flex items-center gap-2.5 ${
                    formData.countryName.includes('TOGO')
                      ? 'bg-white border-[#0051d5] shadow-xs ring-2 ring-[#0051d5]/40'
                      : 'bg-white/60 border-[#eaedff] hover:bg-white'
                  }`}
                >
                  <span className="text-2xl">🇹🇬</span>
                  <div>
                    <span className="text-[12px] font-bold text-[#00236f] block">
                      Togo (MEPST)
                    </span>
                    <span className="text-[10px] text-[#444651] block leading-tight">
                      Travail – Liberté – Patrie
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => applyPreset(CI_SETTINGS, "la CÔTE D'IVOIRE")}
                  className={`p-2.5 rounded text-left border transition-all flex items-center gap-2.5 ${
                    formData.countryName.includes('IVOIRE')
                      ? 'bg-white border-[#0051d5] shadow-xs ring-2 ring-[#0051d5]/40'
                      : 'bg-white/60 border-[#eaedff] hover:bg-white'
                  }`}
                >
                  <span className="text-2xl">🇨🇮</span>
                  <div>
                    <span className="text-[12px] font-bold text-[#00236f] block">
                      Côte d'Ivoire (MENA)
                    </span>
                    <span className="text-[10px] text-[#444651] block leading-tight">
                      Union – Discipline – Travail
                    </span>
                  </div>
                </button>
              </div>
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
                  onChange={(e) => setFormData({ ...formData, institutionName: e.target.value })}
                  className="w-full bg-white text-[14px] py-2.5 px-3.5 rounded-md border border-[#0051d5]/40 outline-none focus:ring-2 focus:ring-[#0051d5]/30 focus:border-[#0051d5] font-bold text-[#00236f]"
                />
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-2 pt-2 border-t border-[#0051d5]/15">
                  <span className="text-[11px] text-[#444651] block">
                    Ce nom officiel apparaît sur tous les bulletins, bordereaux et procès-verbaux de votre établissement.
                  </span>
                  {onOpenAuth && (
                    <button
                      type="button"
                      onClick={onOpenAuth}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#0051d5] hover:bg-[#003cb3] text-white text-[11px] font-bold shrink-0 shadow-xs transition-colors"
                    >
                      <span className="material-symbols-outlined text-sm">manage_accounts</span>
                      <span>Créer ou changer de compte établissement</span>
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

              <div className="sm:col-span-2">
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
                  Année Académique
                </label>
                <input
                  type="text"
                  value={formData.academicYear}
                  onChange={(e) => setFormData({ ...formData, academicYear: e.target.value })}
                  className="w-full bg-[#f2f3ff] py-2 px-3 rounded border border-[#eaedff] outline-none focus:bg-white focus:border-[#0051d5]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#444651] uppercase text-[11px] mb-1">
                  Session d'Examen
                </label>
                <input
                  type="text"
                  value={formData.sessionName}
                  onChange={(e) => setFormData({ ...formData, sessionName: e.target.value })}
                  className="w-full bg-[#f2f3ff] py-2 px-3 rounded border border-[#eaedff] outline-none focus:bg-white focus:border-[#0051d5]"
                />
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
