import React, { useEffect } from 'react';
import { AuthView, type AuthMode } from './AuthView';
import { LiensLegaux } from './legal/LiensLegaux';

interface AuthPageProps {
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
  /** Retour au site vitrine (`/`). */
  onBack: () => void;
  /** Compte d’établissement créé sur le serveur : entrée dans l’application. */
  onAccountCreated: () => void;
  onApiReady: () => void;
  /** Appelé par le formulaire après une connexion réussie sans compte local correspondant. */
  onClose: () => void;
}

/**
 * Pages `/connexion` et `/inscription` : le formulaire d’authentification existant, affiché en pleine page,
 * hors du site vitrine, avec un lien de retour vers celui-ci (carte flottante en deux panneaux).
 */
export const AuthPage: React.FC<AuthPageProps> = ({
  mode,
  onModeChange,
  onBack,
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
    <AuthView
      embedded
      hideCloseButton
      initialMode={mode}
      onModeChange={onModeChange}
      onAccountCreated={onAccountCreated}
      onApiReady={onApiReady}
      onClose={onClose}
      onBack={onBack}
      // Documents légaux sous le formulaire (nouvel onglet : la saisie en cours n’est pas perdue)
      pied={<LiensLegaux nouvelOnglet className="w-full" />}
    />
  );
};

export default AuthPage;
