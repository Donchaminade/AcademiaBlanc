import React from 'react';
import { ViewMode, AppSettings } from '../types';
import { DEMO_EXAM_LABEL } from '../utils/bulletinHeader';
import { LogoEtablissement } from './LogoEtablissement';
import { estSessionInter, libelleModeSession } from '../utils/sessionMode';
import type { ModeSession } from '../utils/sessionMode';

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
  /** Ouvre la page « Profil de l’établissement » (fiche, charte, compte, statistiques). */
  onOpenProfil?: () => void;
  /** Hors connexion : mène à la page `/connexion`. Jamais proposé pendant une session active. */
  onConnexion?: () => void;
  onOpenSearch?: () => void;
  sessionOptions?: string[];
  /** Libellé court du type d'examen de la session active (référentiel de la plateforme) ; absent en démonstration. */
  examType?: string;
  /** Mode de la session active (badge « Inter-établissements » sous le sélecteur) ; absent en démonstration. */
  sessionMode?: ModeSession;
  /** Nom du centre d'examen en session inter-établissements (l'établissement hôte). */
  centreExamen?: string;
  centerOptions?: string[];
  /** Compte de niveau plateforme (propriétaire du logiciel ou gestionnaire) : affiche l’entrée « Plateforme ». */
  platformOwner?: boolean;
  /**
   * Compte plateforme sans établissement rattaché : seules les fonctions de la plateforme sont proposées
   * (aucun sélecteur de session ou de centre, aucun menu d’établissement, aucune donnée locale).
   */
  platformOnly?: boolean;
  /** Propriétaire du logiciel : ouvre le tableau de bord analytique (première entrée de la plateforme). */
  onOpenAnalytique?: () => void;
  /** Vrai quand l'onglet « Analytique » de la vue Plateforme est affiché. */
  analytiqueActive?: boolean;
  /** Ouvre la vue Plateforme sur l'onglet Établissements (à défaut : simple changement de vue). */
  onOpenPlateforme?: () => void;
  /** Vrai quand l'établissement est connecté à l'API : plus aucune valeur de démonstration n'est affichée. */
  usingApi?: boolean;
  /** Utilisateur connecté à l'API (nom et rôle) pour le pied de la barre latérale. */
  apiUser?: { name: string; role: string } | null;
  /** Ouvre l'écran d'administration (matières, enseignants, classes, élèves…). */
  onOpenAdmin?: () => void;
  /** Ferme la session API et revient à l'écran de connexion. */
  onLogout?: () => void;
  /**
   * `fixed` (défaut) : barre latérale de bureau, visible à partir de `lg`.
   * `drawer` : contenu du tiroir mobile (menu burger), en flux, pleine largeur du tiroir, avec bouton de fermeture.
   */
  variant?: 'fixed' | 'drawer';
  /** Tiroir mobile : ferme le tiroir (croix en haut à droite). */
  onClose?: () => void;
}

const DEMO_SESSIONS = [
  'BAC II Blanc 2025 - Série D',
  'BAC II Blanc 2025 - Série C',
  'BAC I Blanc 2025 - Série A4',
  'BEPC Blanc National 2025',
];

const DEMO_CENTERS = [
  'Lycée Moderne de Tokoin (Centre 01)',
  'Lycée 2 Février (Centre 04)',
  'Collège Protestant Lomé',
  'Lycée Scientifique de Lomé',
];

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || '?';

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
  onOpenProfil,
  onConnexion,
  onOpenSearch,
  sessionOptions,
  examType,
  sessionMode,
  centreExamen,
  centerOptions,
  platformOwner = false,
  platformOnly = false,
  onOpenAnalytique,
  analytiqueActive = false,
  onOpenPlateforme,
  usingApi = false,
  apiUser,
  onOpenAdmin,
  onLogout,
  variant = 'fixed',
  onClose,
}) => {
  const sessionChoices = usingApi ? (sessionOptions || []) : (sessionOptions && sessionOptions.length > 0 ? sessionOptions : DEMO_SESSIONS);
  const centerChoices = usingApi ? (centerOptions || []) : (centerOptions && centerOptions.length > 0 ? centerOptions : DEMO_CENTERS);
  const footerName = apiUser?.name || settings.jurySignerName;
  const footerRole = apiUser ? apiUser.role : 'Chef d’établissement & Jury';
  const drawer = variant === 'drawer';
  // Bureau : barre fixe à partir de `lg` (masquée en dessous, remplacée par le tiroir et la barre du bas).
  // Tiroir : en flux dans le panneau mobile, défilement interne, pied de panneau au-dessus de la zone sûre iOS.
  const asideClass = drawer
    ? 'relative h-full w-full bg-[#ffffff] flex flex-col justify-between overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]'
    : 'hidden lg:flex fixed left-0 top-0 h-full w-80 bg-[#ffffff] z-50 flex-col justify-between shadow-[0_1px_8px_rgba(0,0,0,0.04)] border-r border-[#eaedff]';

  const closeButton = drawer && onClose && (
    <button
      type="button"
      onClick={onClose}
      aria-label="Fermer le menu"
      className="shrink-0 inline-flex h-11 w-11 items-center justify-center rounded-lg text-[#00236f] hover:bg-[#eaedff] transition-colors"
      data-testid="fermer-tiroir"
    >
      <span className="material-symbols-outlined text-2xl">close</span>
    </button>
  );

  const plateformeAffichee = currentView === 'plateforme';
  const analytiqueEntry = onOpenAnalytique && (
    <button
      type="button"
      onClick={onOpenAnalytique}
      aria-current={plateformeAffichee && analytiqueActive ? 'page' : undefined}
      className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded transition-all text-[13px] text-left font-medium ${
        plateformeAffichee && analytiqueActive
          ? 'bg-[#1e3a8a] text-white shadow-[0_1px_8px_rgba(0,0,0,0.04)] font-semibold'
          : 'text-[#00236f] bg-[#f2f3ff] hover:bg-[#eaedff]'
      }`}
      data-testid="menu-analytique"
    >
      <span className="material-symbols-outlined text-lg">monitoring</span>
      <span>Analytique</span>
    </button>
  );
  const platformEntry = (
    <>
      {analytiqueEntry}
      <button
        type="button"
        onClick={onOpenPlateforme ?? (() => onViewChange('plateforme'))}
        aria-current={plateformeAffichee && !(analytiqueEntry && analytiqueActive) ? 'page' : undefined}
        className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded transition-all text-[13px] text-left font-medium ${
          plateformeAffichee && !(analytiqueEntry && analytiqueActive)
            ? 'bg-[#1e3a8a] text-white shadow-[0_1px_8px_rgba(0,0,0,0.04)] font-semibold'
            : 'text-[#00236f] bg-[#f2f3ff] hover:bg-[#eaedff]'
        }`}
      >
        <span className="material-symbols-outlined text-lg">domain</span>
        <span>{platformOnly ? 'Établissements & gestionnaires' : 'Plateforme : établissements & gestionnaires'}</span>
      </button>
    </>
  );

  const accountIdentity = (
    <div className="flex items-center gap-2.5 min-w-0">
      {apiUser ? (
        <span
          aria-hidden="true"
          className="w-8 h-8 shrink-0 rounded-full bg-[#00236f] text-white text-[11px] font-bold flex items-center justify-center ring-2 ring-[#0051d5]/20"
        >
          {initials(apiUser.name)}
        </span>
      ) : (
        <img
          alt="Profile"
          className="w-8 h-8 rounded-full object-cover ring-2 ring-[#0051d5]/20"
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuBfMWADhnssFAqE2_oiXq8p3ziGlR17RS02-06FWHwjbMygfyusLAV36M1EG2uCbGXuWNCGEPd8C6nGTKb3fW-U8Apqss4V5P64HFdCLMzMEmlqzvmXBzNqlVL54U47x1K1ehLyuJf1wQeV4My4oFYO9TadSpl9izIImu_z6xQGAPGbIf5QnrjI9WiRC-uaJpFrn5VzJZH7kRYei1Q2hQ3VyeGg-M-Q6lxyewt1Xt3LK6L-OucXQU9hew"
        />
      )}
      <div className="min-w-0">
        <p className="text-[12px] text-[#131b2e] font-semibold truncate leading-tight" title={footerName}>
          {footerName}
        </p>
        <p className="text-[11px] text-[#444651] truncate leading-tight" title={footerRole}>
          {footerRole}
        </p>
      </div>
    </div>
  );

  const logoutButton = apiUser && onLogout && (
    <button
      type="button"
      onClick={onLogout}
      className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded bg-white text-red-700 text-[12px] font-bold border border-red-200 hover:bg-red-50 hover:border-red-300 transition-colors"
      title="Fermer la session et revenir à l'écran de connexion"
    >
      <span className="material-symbols-outlined text-base">logout</span>
      <span>Se déconnecter</span>
    </button>
  );

  // Session plateforme sans établissement : ni sélecteurs, ni recherche d'élève, ni menus d'établissement,
  // ni bloc « Base de l'établissement » — rien qui renvoie à des données d'établissement ou de démonstration.
  if (platformOnly) {
    return (
      <aside className={asideClass}>
        <div className="flex flex-col">
          <div className="px-6 pt-6 pb-5 bg-[#f2f3ff] border-b border-[#eaedff]">
            <div className="flex items-center gap-3">
              <LogoEtablissement
                src={settings.logoUrl}
                nom={settings.institutionName}
                alt="Logo AcademiaBlanc"
                className="h-9 w-9 shrink-0 rounded-xs"
              />
              <div className="flex flex-col min-w-0 flex-1">
                <span className="font-bold text-[#00236f] tracking-tight truncate text-[16px] leading-[22px]">
                  {settings.institutionName}
                </span>
                <span className="text-[12px] text-[#444651] font-medium leading-[16px]">
                  Administration du logiciel
                </span>
              </div>
              {closeButton}
            </div>
          </div>

          <nav className="px-4 py-3 space-y-1" aria-label="Plateforme">
            <p className="px-3.5 pt-1 pb-2 text-[11px] font-semibold text-[#444651] uppercase tracking-wider">
              Plateforme
            </p>
            {platformEntry}
          </nav>
        </div>

        <div className="p-4 bg-[#f2f3ff] space-y-3 border-t border-[#eaedff]">
          {accountIdentity}
          {logoutButton}
        </div>
      </aside>
    );
  }

  const renderEmptyChoice = (label: string, action: string) => (
    <div className="flex items-center justify-between gap-2 bg-[#f2f3ff] text-[12px] py-2 px-3 rounded">
      <span className="text-[#444651] italic">{label}</span>
      {onOpenAdmin && (
        <button
          type="button"
          onClick={onOpenAdmin}
          className="text-[#0051d5] font-semibold whitespace-nowrap hover:underline"
        >
          {action}
        </button>
      )}
    </div>
  );

  return (
    <aside className={asideClass}>
      <div className="flex flex-col">
        {/* Brand & PWA badge */}
        <div className="px-6 pt-6 pb-4 bg-[#f2f3ff]">
          <div className="flex items-center gap-3">
            <LogoEtablissement
              src={settings.logoUrl}
              nom={settings.institutionName}
              alt={`Logo de ${settings.institutionName}`}
              className="h-9 w-9 shrink-0 rounded-xs"
            />
            <div className="flex flex-col min-w-0 flex-1">
              <span className="font-bold text-[#00236f] tracking-tight truncate text-[16px] leading-[22px]">
                {settings.institutionName}
              </span>
              <span className="text-[12px] text-[#444651] font-medium leading-[16px]">
                Examens d'État PWA
              </span>
            </div>
            {closeButton}
          </div>
          <button
            type="button"
            onClick={onToggleOffline}
            className="mt-3 w-full inline-flex items-center justify-between px-2.5 py-1.5 rounded bg-[#eaedff] text-[#00236f] text-[11px] font-semibold tracking-wide hover:bg-[#dce1ff] transition-colors"
            title="Basculer entre le mode en ligne et le mode hors-ligne local"
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
            {sessionChoices.length === 0 ? (
              renderEmptyChoice('Aucune session', 'Créer une session')
            ) : (
              <div className="relative">
                <select
                  value={selectedSession}
                  onChange={(e) => onSessionChange(e.target.value)}
                  className="w-full appearance-none bg-[#f2f3ff] text-[#131b2e] text-[12px] py-2 px-3 pr-8 rounded outline-none cursor-pointer font-medium hover:bg-[#e2e7ff] transition-colors"
                >
                  {sessionChoices.map((label) => <option key={label} value={label}>{label}</option>)}
                </select>
                <span className="material-symbols-outlined absolute right-2 top-2.5 pointer-events-none text-[#444651] text-base">
                  expand_more
                </span>
              </div>
            )}
            {(usingApi ? examType : sessionChoices.length > 0) && (
              <p className="flex items-center gap-1 text-[11px] text-[#444651]" title="Type d'examen de la session active">
                <span className="material-symbols-outlined text-[14px] text-[#0051d5]">workspace_premium</span>
                <span className="font-semibold text-[#00236f]">{usingApi ? examType : DEMO_EXAM_LABEL}</span>
              </p>
            )}
            {usingApi && estSessionInter(sessionMode) && (
              <p
                className="inline-flex items-center gap-1 rounded bg-[#fff3e0] border border-[#ffcc80] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#8a4b00]"
                title={centreExamen ? `Session inter-établissements — centre d'examen : ${centreExamen}` : 'Session inter-établissements'}
                data-testid="badge-session-inter"
              >
                <span className="material-symbols-outlined text-[13px]">hub</span>
                <span>{libelleModeSession(sessionMode)}</span>
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] font-semibold text-[#444651] uppercase tracking-wider">
              Centre d'Examen / Lycée
            </label>
            {centerChoices.length === 0 ? (
              renderEmptyChoice('Aucun centre', 'Créer un centre')
            ) : (
              <div className="relative">
                <select
                  value={selectedCenter}
                  onChange={(e) => onCenterChange(e.target.value)}
                  className="w-full appearance-none bg-[#f2f3ff] text-[#131b2e] text-[12px] py-2 px-3 pr-8 rounded outline-none cursor-pointer font-medium hover:bg-[#e2e7ff] transition-colors"
                >
                  {centerChoices.map((label) => <option key={label} value={label}>{label}</option>)}
                </select>
                <span className="material-symbols-outlined absolute right-2 top-2.5 pointer-events-none text-[#444651] text-base">
                  location_city
                </span>
              </div>
            )}
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

          {platformOwner && platformEntry}

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

          {/* Administration des données de l'établissement (API) */}
          {onOpenAdmin && (
            <button
              type="button"
              onClick={onOpenAdmin}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded transition-all text-[13px] text-left font-medium border ${
                currentView === 'admin'
                  ? 'bg-[#1e3a8a] text-white border-[#1e3a8a] shadow-[0_1px_8px_rgba(0,0,0,0.04)] font-semibold'
                  : 'text-[#00236f] bg-[#eaedff]/60 border-[#dce1ff] hover:bg-[#eaedff]'
              }`}
              title="Saisir les années, centres, sessions, matières, coefficients, enseignants, classes et élèves"
            >
              <span className={`material-symbols-outlined text-lg ${currentView === 'admin' ? '' : 'text-[#0051d5]'}`}>admin_panel_settings</span>
              <span className="flex flex-col min-w-0">
                <span className="font-semibold">Administration</span>
                <span className={`text-[10.5px] leading-tight truncate ${currentView === 'admin' ? 'text-white/80' : 'text-[#444651]'}`}>
                  Matières · Enseignants · Classes · Élèves
                </span>
              </span>
            </button>
          )}

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
                <span>Télécharger tous les bulletins</span>
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

          {/* Profil de l'établissement : fiche, charte, compte connecté, statistiques */}
          {onOpenProfil && (
            <button
              type="button"
              onClick={onOpenProfil}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded transition-all text-[13px] text-left font-medium ${
                currentView === 'profil'
                  ? 'bg-[#1e3a8a] text-white shadow-[0_1px_8px_rgba(0,0,0,0.04)] font-semibold'
                  : 'text-[#00236f] bg-white border border-[#eaedff] hover:bg-[#eaedff]'
              }`}
            >
              <span className={`material-symbols-outlined text-lg ${currentView === 'profil' ? '' : 'text-[#0051d5]'}`}>account_balance</span>
              <span className="font-semibold">Profil de l’établissement</span>
            </button>
          )}

          {/* Hors connexion : accès à la page de connexion (jamais pendant une session active) */}
          {onConnexion && !usingApi && (
            <button
              type="button"
              onClick={onConnexion}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded transition-all text-[13px] text-left font-semibold text-white bg-[#0051d5] hover:bg-[#003cb3]"
              title="Connecter l’établissement à sa base"
            >
              <span className="material-symbols-outlined text-lg">login</span>
              <span>Se connecter</span>
            </button>
          )}
        </nav>
      </div>

      {/* Footer & Sync Status */}
      <div className="p-4 bg-[#f2f3ff] space-y-3 border-t border-[#eaedff]">
        {/* Hors connexion : bandeau discret « Mode démonstration » ; connecté : rappel de la source des données */}
        <div
          className={`p-3 rounded shadow-[0_1px_8px_rgba(0,0,0,0.04)] space-y-1.5 border ${usingApi ? 'bg-white border-[#eaedff]' : 'bg-amber-50 border-amber-200'}`}
          role={usingApi ? undefined : 'status'}
          data-testid={usingApi ? 'source-donnees-api' : 'bandeau-demonstration'}
        >
          <div className="flex items-center justify-between">
            <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${usingApi ? 'text-[#131b2e]' : 'text-amber-900'}`}>
              <span className={`material-symbols-outlined text-sm ${usingApi ? 'text-[#0051d5]' : 'text-amber-700'}`}>{usingApi ? 'cloud_done' : 'science'}</span>
              <span>{usingApi ? 'Base de l’établissement' : 'Mode démonstration'}</span>
            </span>
            <span className={`font-mono text-[11px] font-semibold ${usingApi ? 'text-[#0051d5]' : 'text-amber-800'}`}>{usingApi ? 'API' : 'DÉMO'}</span>
          </div>
          <p className={`text-[12px] leading-tight ${usingApi ? 'text-[#444651]' : 'text-amber-900/80'}`}>
            {usingApi
              ? 'Données enregistrées sur le serveur de l’établissement'
              : 'Données fictives, conservées dans ce navigateur. Connectez-vous pour voir celles de votre établissement.'}
          </p>
        </div>

        <div className="flex items-center justify-between gap-3 pt-1">
          {onOpenProfil ? (
            <button
              type="button"
              onClick={onOpenProfil}
              className="min-w-0 flex-1 text-left rounded hover:bg-[#dae2fd] transition-colors -m-1 p-1"
              title="Ouvrir le profil de l’établissement et de mon compte"
            >
              {accountIdentity}
            </button>
          ) : accountIdentity}
          <button
            className="p-1.5 rounded hover:bg-[#dae2fd] text-[#444651] hover:text-[#0051d5] transition-colors"
            title="Paramètres de l'application"
            type="button"
            onClick={() => onViewChange('settings')}
          >
            <span className="material-symbols-outlined text-base">tune</span>
          </button>
        </div>

        {logoutButton}
      </div>
    </aside>
  );
};
