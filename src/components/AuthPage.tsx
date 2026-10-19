import React, { useEffect } from 'react';
import { AuthView, type AuthMode } from './AuthView';
import type { SchoolAccount } from '../types';
import { ROUTE_PATHS } from '../utils/router';

interface AuthPageProps {
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
  /** Retour au site vitrine (`/`). */
  onBack: () => void;
  onSelectSchool: (schoolId: string) => void;
  onAccountCreated: (newSchool: SchoolAccount) => void;
  onApiReady: () => void;
  /** Appelé par le formulaire après une connexion réussie sans compte local correspondant. */
  onClose: () => void;
}

/**
 * Pages `/connexion` et `/inscription` : le formulaire d’authentification existant, affiché en pleine page,
 * hors du site vitrine, avec un lien de retour vers celui-ci.
 */
export const AuthPage: React.FC<AuthPageProps> = ({
  mode,
  onModeChange,
  onBack,
  onSelectSchool,
  onAccountCreated,
  onApiReady,
  onClose,
}) => {
  useEffect(() => {
    const previous = document.title;
    document.title = `${mode === 'login' ? 'Connexion' : 'Créer le compte de mon établissement'} • AcademiaBlanc`;
    return () => {
      document.title = previous;
    };
  }, [mode]);

  return (
    <div className="min-h-dvh bg-[#faf8ff] text-[#131b2e] antialiased flex flex-col">
      <header className="border-b border-[#eaedff] bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <a
            href={ROUTE_PATHS.vitrine}
            onClick={(event) => {
              if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
              event.preventDefault();
              onBack();
            }}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] font-semibold text-[#00236f] transition-colors hover:bg-[#f2f3ff] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0051d5]"
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">arrow_back</span>
            <span>Retour au site</span>
          </a>
          <span className="flex items-center gap-2 text-[14px] font-bold tracking-tight text-[#00236f]">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#00236f] text-white">
              <span className="material-symbols-outlined text-lg" aria-hidden="true">account_balance</span>
            </span>
            AcademiaBlanc
          </span>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center p-3 sm:p-6">
        <AuthView
          embedded
          hideCloseButton
          initialMode={mode}
          onModeChange={onModeChange}
          onSelectSchool={onSelectSchool}
          onAccountCreated={onAccountCreated}
          onApiReady={onApiReady}
          onClose={onClose}
        />
      </main>
    </div>
  );
};

export default AuthPage;
