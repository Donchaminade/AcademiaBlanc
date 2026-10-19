import React, { useEffect, useRef } from 'react';
import { indexFocusSuivant } from '../utils/mobileNav';

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
  /** Titre annoncé aux lecteurs d'écran. */
  label?: string;
  children: React.ReactNode;
}

const FOCALISABLES = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Tiroir latéral plein écran des écrans étroits (menu burger) : voile cliquable, panneau glissant depuis la
 * gauche, fermeture par croix, voile ou Échap, focus piégé dans le panneau, défilement de la page bloqué
 * tant qu'il est ouvert, focus rendu au bouton d'ouverture à la fermeture. Jamais rendu à partir de `lg`.
 */
export const MobileDrawer: React.FC<MobileDrawerProps> = ({ open, onClose, label = 'Navigation', children }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  // Blocage du défilement de fond et focus initial dans le panneau.
  useEffect(() => {
    if (!open) return undefined;
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    const premier = panelRef.current?.querySelector<HTMLElement>(FOCALISABLES);
    (premier ?? panelRef.current)?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = overflow;
      openerRef.current?.focus({ preventScroll: true });
    };
  }, [open]);

  // Échap ferme ; Tab reste dans le panneau.
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      const panel = panelRef.current;
      if (!panel) return;
      const focalisables = Array.from(panel.querySelectorAll<HTMLElement>(FOCALISABLES))
        .filter((element) => element.offsetParent !== null);
      const courant = focalisables.indexOf(document.activeElement as HTMLElement);
      const suivant = indexFocusSuivant(event, courant, focalisables.length);
      if (suivant !== null) {
        event.preventDefault();
        focalisables[suivant]?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="tiroir-mobile lg:hidden fixed inset-0 z-[60] no-print" role="presentation" data-testid="tiroir-mobile">
      <button
        type="button"
        aria-label="Fermer le menu"
        onClick={onClose}
        className="absolute inset-0 h-full w-full bg-[#00236f]/50 backdrop-blur-xs cursor-default"
        tabIndex={-1}
        data-testid="tiroir-voile"
      />
      <div
        id="tiroir-navigation"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className="tiroir-panneau absolute inset-y-0 left-0 w-[min(100%,22rem)] max-w-full bg-white shadow-2xl outline-none flex flex-col h-dvh"
      >
        {children}
      </div>
    </div>
  );
};
