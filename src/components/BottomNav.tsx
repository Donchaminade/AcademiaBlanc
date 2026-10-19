import React from 'react';
import type { ViewMode } from '../types';
import { entreeActive, entreesBas } from '../utils/mobileNav';
import type { EntreeBas, OptionsEntreesBas } from '../utils/mobileNav';

interface BottomNavProps extends OptionsEntreesBas {
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  /** « Plus » : ouvre le tiroir (PV, archives, administration, profil, déconnexion…). */
  onOpenMenu: () => void;
  menuOpen: boolean;
  /** Masquée (sans démontage des vues) quand une fenêtre plein écran est ouverte. */
  hidden?: boolean;
}

/**
 * Barre d'onglets fixe en bas des écrans étroits (< lg) : 4 à 5 entrées, icône + libellé court, zones
 * tactiles ≥ 44 px, zone sûre iOS. Masquée à l'impression (`no-print`) et à partir de `lg`.
 */
export const BottomNav: React.FC<BottomNavProps> = ({
  currentView,
  onViewChange,
  onOpenMenu,
  menuOpen,
  hidden = false,
  platformOnly,
  platformOwner,
}) => {
  const entrees = entreesBas({ platformOnly, platformOwner });
  const active = entreeActive(currentView, entrees);
  if (hidden) return null;

  const onActivate = (entree: EntreeBas) => {
    if (entree.view) onViewChange(entree.view);
    else onOpenMenu();
  };

  return (
    <nav
      aria-label="Navigation principale"
      className="bottom-nav lg:hidden fixed inset-x-0 bottom-0 z-40 bg-white border-t border-[#eaedff] shadow-[0_-1px_8px_rgba(0,0,0,0.06)] pb-[env(safe-area-inset-bottom)] no-print"
      data-testid="bottom-nav"
    >
      <ul className="flex items-stretch justify-around" role="list">
        {entrees.map((entree) => {
          const estActive = active === entree.id;
          const estPlus = entree.id === 'plus';
          return (
            <li key={entree.id} className="flex-1 min-w-0">
              <button
                type="button"
                onClick={() => onActivate(entree)}
                aria-current={estActive && !estPlus ? 'page' : undefined}
                aria-expanded={estPlus ? menuOpen : undefined}
                aria-controls={estPlus ? 'tiroir-navigation' : undefined}
                data-active={estActive ? 'oui' : 'non'}
                className={`relative flex h-14 min-h-[44px] w-full flex-col items-center justify-center gap-0.5 px-1 text-[10.5px] font-semibold leading-none transition-colors ${
                  estActive ? 'text-[#0051d5]' : 'text-[#444651] hover:text-[#00236f] active:bg-[#f2f3ff]'
                }`}
              >
                {estActive && (
                  <span aria-hidden="true" className="absolute top-0 left-1/2 h-0.5 w-10 -translate-x-1/2 rounded-b bg-[#0051d5]" />
                )}
                <span
                  aria-hidden="true"
                  className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors ${estActive ? 'bg-[#eaedff]' : ''}`}
                >
                  <span className="material-symbols-outlined text-[22px]" style={estActive ? { fontVariationSettings: "'FILL' 1" } : undefined}>
                    {entree.icon}
                  </span>
                </span>
                <span className="truncate max-w-full">{entree.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
