import React from 'react';
import { LogoEtablissement } from './LogoEtablissement';

interface MobileHeaderProps {
  institutionName: string;
  logoUrl?: string;
  /** Sous-titre court : session active, ou rôle du compte plateforme. */
  subtitle?: string;
  menuOpen: boolean;
  onOpenMenu: () => void;
  /** Recherche rapide d'un élève (Ctrl+K) ; absent pour une session plateforme. */
  onOpenSearch?: () => void;
}

/**
 * En-tête compact fixe des écrans étroits (< lg) : bouton burger, logo et nom de l'établissement tronqué,
 * recherche. Masqué à partir de `lg` (la barre latérale reprend) et à l'impression (élément `header`).
 */
export const MobileHeader: React.FC<MobileHeaderProps> = ({
  institutionName,
  logoUrl,
  subtitle,
  menuOpen,
  onOpenMenu,
  onOpenSearch,
}) => (
  <header
    className="mobile-header lg:hidden fixed inset-x-0 top-0 z-40 h-14 bg-white/95 backdrop-blur-md border-b border-[#eaedff] shadow-[0_1px_8px_rgba(0,0,0,0.04)] pt-[env(safe-area-inset-top)] no-print"
    data-testid="mobile-header"
  >
    <div className="flex h-14 items-center gap-2 px-2">
      <button
        type="button"
        onClick={onOpenMenu}
        aria-expanded={menuOpen}
        aria-controls="tiroir-navigation"
        aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[#00236f] hover:bg-[#eaedff] active:bg-[#dce1ff] transition-colors"
        data-testid="bouton-burger"
      >
        <span className="material-symbols-outlined text-2xl">menu</span>
      </button>

      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <LogoEtablissement
          src={logoUrl}
          nom={institutionName}
          alt={`Logo de ${institutionName}`}
          className="h-8 w-8 shrink-0 rounded-xs"
        />
        <div className="min-w-0">
          <p className="truncate text-[14px] font-bold leading-tight tracking-tight text-[#00236f]" title={institutionName}>
            {institutionName}
          </p>
          {subtitle && (
            <p className="truncate text-[11px] font-medium leading-tight text-[#444651]" title={subtitle}>
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {onOpenSearch && (
        <button
          type="button"
          onClick={onOpenSearch}
          aria-label="Rechercher un élève"
          title="Rechercher un élève (Ctrl+K)"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[#0051d5] hover:bg-[#eaedff] active:bg-[#dce1ff] transition-colors"
        >
          <span className="material-symbols-outlined text-2xl">search</span>
        </button>
      )}
    </div>
  </header>
);
