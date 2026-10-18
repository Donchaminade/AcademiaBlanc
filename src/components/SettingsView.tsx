import React, { useState, useRef } from 'react';
import { AppSettings } from '../types';
import { DEFAULT_SETTINGS, TOGO_SETTINGS, CI_SETTINGS } from '../data/mockData';

interface SettingsViewProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  onNavigate: (view: 'dashboard' | 'students' | 'grading' | 'bulletin' | 'records' | 'settings') => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
  onNavigate,
}) => {
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

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const updated = { ...formData, [field]: reader.result };
        setFormData(updated);
        onUpdateSettings(updated);
        triggerToast();
      }
    };
    reader.readAsDataURL(file);
  };

  const applyLogoUrl = () => {
    if (!logoInputUrl.trim()) return;
    const updated = { ...formData, logoUrl: logoInputUrl.trim() };
    setFormData(updated);
    onUpdateSettings(updated);
    setLogoInputUrl('');
    triggerToast();
  };

  const applySealUrl = () => {
    if (!sealInputUrl.trim()) return;
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

  const handleResetDefaults = () => {
    if (confirm('Voulez-vous rétablir les logos et paramètres officiels par défaut ?')) {
      setFormData(DEFAULT_SETTINGS);
      onUpdateSettings(DEFAULT_SETTINGS);
      triggerToast();
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded p-6 shadow-sm border border-[#eaedff] flex flex-wrap items-center justify-between gap-4">
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
            onClick={handleResetDefaults}
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
              <div className="w-20 h-20 rounded-full bg-white p-2 shadow-xs flex items-center justify-center border border-[#eaedff] overflow-hidden">
                <img
                  src={formData.sealUrl}
                  alt="Aperçu Sceau"
                  className="max-h-full max-w-full object-contain"
                />
              </div>
              <span className="text-[11px] text-[#444651] mt-2 font-medium">
                Sceau central et filigrane officiel A4
              </span>
            </div>

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
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded bg-[#eaedff] text-[#00236f] text-[12px] font-bold hover:bg-[#dce1ff] transition-all"
              >
                <span className="material-symbols-outlined text-base">upload_file</span>
                <span>Téléverser le Sceau du Jury</span>
              </button>
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-bold uppercase text-[#444651]">
                Ou URL du Sceau
              </label>
              <div className="flex gap-1.5">
                <input
                  type="url"
                  placeholder="https://.../sceau-republique.png"
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
              <div className="sm:col-span-2">
                <label className="block font-bold text-[#444651] uppercase text-[11px] mb-1">
                  Nom du Système / Établissement
                </label>
                <input
                  type="text"
                  value={formData.institutionName}
                  onChange={(e) => setFormData({ ...formData, institutionName: e.target.value })}
                  className="w-full bg-[#f2f3ff] text-[13px] py-2 px-3 rounded border border-[#eaedff] outline-none focus:bg-white focus:border-[#0051d5] font-semibold"
                />
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
