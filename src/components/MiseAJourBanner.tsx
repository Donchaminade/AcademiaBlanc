import React, { useState, useSyncExternalStore } from 'react';
import { ignorerNouvelleVersion, lireEtatMiseAJour, surEtatMiseAJour } from '../pwa/miseAJour';

/**
 * Bandeau discret affiché quand un nouveau build de l'application attend d'être appliqué : l'utilisateur
 * actualise quand il le souhaite (rien n'est rechargé pendant une saisie). Au-dessus de la barre d'onglets
 * sur mobile, en bas à droite sur bureau.
 */
export const MiseAJourBanner: React.FC = () => {
  const etat = useSyncExternalStore(surEtatMiseAJour, lireEtatMiseAJour, lireEtatMiseAJour);
  const [enCours, setEnCours] = useState(false);
  if (!etat.disponible) return null;

  const actualiser = () => {
    setEnCours(true);
    void etat.appliquer();
  };

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="bandeau-mise-a-jour"
      className="fixed left-4 right-4 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] lg:left-auto lg:right-6 lg:bottom-6 lg:max-w-sm z-[60] bg-white text-[#131b2e] border border-[#dce1ff] rounded-lg shadow-2xl px-4 py-3 flex items-center gap-3 text-[13px]"
    >
      <span className="material-symbols-outlined text-[#0051d5] text-xl" aria-hidden="true">system_update_alt</span>
      <p className="flex-1 min-w-0 font-medium">Nouvelle version disponible.</p>
      <button
        type="button"
        onClick={ignorerNouvelleVersion}
        disabled={enCours}
        className="text-[12px] font-semibold text-[#444651] hover:text-[#00236f] px-2 py-1 rounded transition-colors disabled:opacity-50"
      >
        Plus tard
      </button>
      <button
        type="button"
        onClick={actualiser}
        disabled={enCours}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#0051d5] text-white text-[12px] font-semibold hover:bg-[#003cb3] transition-colors disabled:opacity-60"
      >
        {enCours && <span className="material-symbols-outlined text-sm animate-spin" aria-hidden="true">progress_activity</span>}
        <span>Actualiser</span>
      </button>
    </div>
  );
};

export default MiseAJourBanner;
