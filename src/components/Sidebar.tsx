import React from 'react';
import { ViewMode, AppSettings } from '../types';

interface SidebarProps {
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  selectedSession: string;
  onSessionChange: (session: string) => void;
  selectedCenter: string;
  onCenterChange: (center: string) => void;
  isOfflineMode: boolean;
  onToggleOffline: () => void;
  settings: AppSettings;
  candidatesCount: number;
  onOpenBatchPrint?: () => void;
  onOpenAuth?: () => void;
  onOpenSearch?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onViewChange,
  selectedSession,
  onSessionChange,
  selectedCenter,
  onCenterChange,
  isOfflineMode,
  onToggleOffline,
  settings,
  candidatesCount,
  onOpenBatchPrint,
  onOpenAuth,
  onOpenSearch,
}) => {
  return (
    <aside className="fixed left-0 top-0 h-full w-80 bg-[#ffffff] z-50 flex flex-col justify-between shadow-[0_1px_8px_rgba(0,0,0,0.04)] border-r border-[#eaedff]">
      <div className="flex flex-col">
        {/* Brand & PWA badge */}
        <div className="px-6 pt-6 pb-4 bg-[#f2f3ff]">
          <div className="flex items-center gap-3">
            <img
              alt="Logo Académie Examens Blancs"
              className="h-8 w-auto max-w-[40px] object-contain rounded-xs"
              src={settings.logoUrl}
            />
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-[#00236f] tracking-tight truncate text-[16px] leading-[22px]">
                {settings.institutionName}
              </span>
              <span className="text-[12px] text-[#444651] font-medium leading-[16px]">
                Examens d'État PWA
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onToggleOffline}
            className="mt-3 w-full inline-flex items-center justify-between px-2.5 py-1.5 rounded bg-[#eaedff] text-[#00236f] text-[11px] font-semibold tracking-wide hover:bg-[#dce1ff] transition-colors"
            title="Cliquer pour basculer la simulation de connexion"
          >
            <span className="flex items-center gap-2">
              <span className="material-symbols-outlined text-sm text-[#0051d5] animate-pulse">
                {isOfflineMode ? 'wifi_off' : 'sync'}
              </span>
              <span>{isOfflineMode ? 'Mode Hors-ligne (Actif)' : 'PWA Installée / Hors-ligne Actif'}</span>
            </span>
            <span className="text-[9px] uppercase font-bold text-[#0051d5] bg-white px-1.5 py-0.5 rounded shadow-xs">
              {isOfflineMode ? 'LOCAL' : 'READY'}
            </span>
          </button>
        </div>

        {/* Exam Session & Center Selectors */}
        <div className="px-6 py-4 space-y-3 bg-[#faf8ff] border-b border-[#eaedff]">
          <div className="space-y-1">
            <label className="block text-[11px] font-semibold text-[#444651] uppercase tracking-wider">
              Session d'Examen Blanc
            </label>
            <div className="relative">
              <select
                value={selectedSession}
                onChange={(e) => onSessionChange(e.target.value)}
                className="w-full appearance-none bg-[#f2f3ff] text-[#131b2e] text-[12px] py-2 px-3 pr-8 rounded outline-none cursor-pointer font-medium hover:bg-[#e2e7ff] transition-colors"
              >
                <option value="BAC II Blanc 2025 - Série D">BAC II Blanc 2025 - Série D</option>
                <option value="BAC II Blanc 2025 - Série C">BAC II Blanc 2025 - Série C</option>
                <option value="BAC I Blanc 2025 - Série A4">BAC I Blanc 2025 - Série A4</option>
                <option value="BEPC Blanc National 2025">BEPC Blanc National 2025</option>
              </select>
              <span className="material-symbols-outlined absolute right-2 top-2.5 pointer-events-none text-[#444651] text-base">
                expand_more
              </span>
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] font-semibold text-[#444651] uppercase tracking-wider">
              Centre d'Examen / Lycée
            </label>
            <div className="relative">
              <select
                value={selectedCenter}
                onChange={(e) => onCenterChange(e.target.value)}
                className="w-full appearance-none bg-[#f2f3ff] text-[#131b2e] text-[12px] py-2 px-3 pr-8 rounded outline-none cursor-pointer font-medium hover:bg-[#e2e7ff] transition-colors"
              >
                <option value="Lycée Moderne de Tokoin (Centre 01)">Lycée Moderne de Tokoin (Centre 01)</option>
                <option value="Lycée 2 Février (Centre 04)">Lycée 2 Février (Centre 04)</option>
                <option value="Collège Protestant Lomé">Collège Protestant Lomé</option>
                <option value="Lycée Scientifique de Lomé">Lycée Scientifique de Lomé</option>
              </select>
              <span className="material-symbols-outlined absolute right-2 top-2.5 pointer-events-none text-[#444651] text-base">
                location_city
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Menu Links */}
        <nav className="px-4 py-3 space-y-1">
          {/* Quick Search Shortcut */}
          {onOpenSearch && (
            <button
              type="button"
              onClick={onOpenSearch}
              className="w-full flex items-center justify-between px-3.5 py-2 rounded-lg bg-[#f2f3ff] hover:bg-[#e2e7ff] text-[#444651] text-[12px] font-medium transition-colors border border-[#eaedff] mb-2 group shadow-2xs"
              title="Rechercher un candidat (Ctrl+K)"
            >
              <span className="flex items-center gap-2">
                <span className="material-symbols-outlined text-base text-[#0051d5] group-hover:scale-110 transition-transform">
                  search
                </span>
                <span>Rechercher élève...</span>
              </span>
              <kbd className="text-[10px] bg-white px-1.5 py-0.5 rounded border border-[#eaedff] font-mono text-[#444651] font-bold shadow-2xs">
                Ctrl+K
              </kbd>
            </button>
          )}

          {/* Dashboard */}
          <button
            type="button"
            onClick={() => onViewChange('dashboard')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded transition-all text-[13px] text-left font-medium ${
              currentView === 'dashboard'
                ? 'bg-[#1e3a8a] text-white shadow-[0_1px_8px_rgba(0,0,0,0.04)] font-semibold'
                : 'text-[#444651] hover:bg-[#eaedff] hover:text-[#131b2e]'
            }`}
          >
            <span className="material-symbols-outlined text-lg">analytics</span>
            <span>Tableau de bord &amp; Statistiques</span>
          </button>

          {/* Students List (Étape 1) */}
          <button
            type="button"
            onClick={() => onViewChange('students')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded transition-all text-[13px] text-left font-medium ${
              currentView === 'students'
                ? 'bg-[#1e3a8a] text-white shadow-[0_1px_8px_rgba(0,0,0,0.04)] font-semibold'
                : 'text-[#444651] hover:bg-[#eaedff] hover:text-[#131b2e]'
            }`}
          >
            <span className="flex items-center gap-3">
              <span className="material-symbols-outlined text-lg">group</span>
              <span>1. Liste des Candidats</span>
            </span>
            <span className={`font-mono text-[11px] px-1.5 py-0.5 rounded ${
              currentView === 'students' ? 'bg-white text-[#00236f] font-bold' : 'bg-[#eaedff] text-[#0051d5] font-semibold'
            }`}>
              {candidatesCount}
            </span>
          </button>

          {/* Grading & Deliberation (Étape 2) */}
          <button
            type="button"
            onClick={() => onViewChange('grading')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded transition-all text-[13px] text-left font-medium ${
              currentView === 'grading'
                ? 'bg-[#1e3a8a] text-white shadow-[0_1px_8px_rgba(0,0,0,0.04)] font-semibold'
                : 'text-[#444651] hover:bg-[#eaedff] hover:text-[#131b2e]'
            }`}
          >
            <span className="material-symbols-outlined text-lg">edit_note</span>
            <span>2. Saisie des Notes &amp; Jury</span>
          </button>

          {/* Bulletin Officiel (Étape 3) */}
          <button
            type="button"
            onClick={() => onViewChange('bulletin')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded transition-all text-[13px] text-left font-medium ${
              currentView === 'bulletin'
                ? 'bg-[#1e3a8a] text-white shadow-[0_1px_8px_rgba(0,0,0,0.04)] font-semibold'
                : 'text-[#444651] hover:bg-[#eaedff] hover:text-[#131b2e]'
            }`}
          >
            <span className="material-symbols-outlined text-lg">picture_as_pdf</span>
            <span>3. Bulletin Officiel &amp; PDF</span>
          </button>

          {/* Tirage Groupé en 1 Clic (Nouveau) */}
          {onOpenBatchPrint && (
            <button
              type="button"
              onClick={onOpenBatchPrint}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded transition-all text-[13px] text-left font-bold text-[#0051d5] bg-[#eaedff]/60 hover:bg-[#eaedff] border border-[#dce1ff]"
            >
              <span className="flex items-center gap-3">
                <span className="material-symbols-outlined text-lg text-[#0051d5]">print_connect</span>
                <span>Impression Groupée (1 Clic)</span>
              </span>
              <span className="font-mono text-[10px] bg-[#0051d5] text-white px-1.5 py-0.5 rounded">
                A4
              </span>
            </button>
          )}

          {/* Records & Global PV */}
          <button
            type="button"
            onClick={() => onViewChange('records')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded transition-all text-[13px] text-left font-medium ${
              currentView === 'records'
                ? 'bg-[#1e3a8a] text-white shadow-[0_1px_8px_rgba(0,0,0,0.04)] font-semibold'
                : 'text-[#444651] hover:bg-[#eaedff] hover:text-[#131b2e]'
            }`}
          >
            <span className="material-symbols-outlined text-lg">assignment_turned_in</span>
            <span>Palmarès &amp; PV Global</span>
          </button>

          {/* Settings & Archives */}
          <button
            type="button"
            onClick={() => onViewChange('settings')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded transition-all text-[13px] text-left font-medium ${
              currentView === 'settings'
                ? 'bg-[#1e3a8a] text-white shadow-[0_1px_8px_rgba(0,0,0,0.04)] font-semibold'
                : 'text-[#444651] hover:bg-[#eaedff] hover:text-[#131b2e]'
            }`}
          >
            <span className="material-symbols-outlined text-lg">tune</span>
            <span>Paramètres &amp; Archives</span>
          </button>

          {/* Compte Établissement & Déconnexion / Switcher */}
          {onOpenAuth && (
            <button
              type="button"
              onClick={onOpenAuth}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded transition-all text-[13px] text-left font-medium ${
                currentView === 'auth'
                  ? 'bg-[#1e3a8a] text-white shadow-[0_1px_8px_rgba(0,0,0,0.04)] font-semibold'
                  : 'text-[#00236f] bg-white border border-[#eaedff] hover:bg-[#eaedff]'
              }`}
            >
              <span className="material-symbols-outlined text-lg text-[#0051d5]">account_balance</span>
              <span className="font-semibold">Compte Établissement</span>
            </button>
          )}
        </nav>
      </div>

      {/* Footer & Sync Status */}
      <div className="p-4 bg-[#f2f3ff] space-y-3 border-t border-[#eaedff]">
        <div className="p-3 rounded bg-white shadow-[0_1px_8px_rgba(0,0,0,0.04)] space-y-1.5 border border-[#eaedff]">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#131b2e]">
              <span className="material-symbols-outlined text-sm text-[#0051d5]">cloud_done</span>
              <span>Sync Locale</span>
            </span>
            <span className="font-mono text-[11px] text-[#0051d5] font-semibold">100% OK</span>
          </div>
          <p className="text-[12px] text-[#444651] leading-tight">
            Toutes les notes synchronisées en local (IndexedDB)
          </p>
        </div>

        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              alt="Profile"
              className="w-8 h-8 rounded-full object-cover ring-2 ring-[#0051d5]/20"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuBfMWADhnssFAqE2_oiXq8p3ziGlR17RS02-06FWHwjbMygfyusLAV36M1EG2uCbGXuWNCGEPd8C6nGTKb3fW-U8Apqss4V5P64HFdCLMzMEmlqzvmXBzNqlVL54U47x1K1ehLyuJf1wQeV4My4oFYO9TadSpl9izIImu_z6xQGAPGbIf5QnrjI9WiRC-uaJpFrn5VzJZH7kRYei1Q2hQ3VyeGg-M-Q6lxyewt1Xt3LK6L-OucXQU9hew"
            />
            <div className="min-w-0">
              <p className="text-[12px] text-[#131b2e] font-semibold truncate leading-tight">
                {settings.jurySignerName}
              </p>
              <p className="text-[11px] text-[#444651] truncate leading-tight">
                Proviseure &amp; Jury
              </p>
            </div>
          </div>
          <button
            className="p-1.5 rounded hover:bg-[#dae2fd] text-[#444651] hover:text-[#0051d5] transition-colors"
            title="Paramètres de l'application"
            type="button"
            onClick={() => onViewChange('settings')}
          >
            <span className="material-symbols-outlined text-base">tune</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
