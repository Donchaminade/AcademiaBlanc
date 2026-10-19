import { useCallback, useEffect, useState } from 'react';

/**
 * Pages publiques, hors application : site vitrine, connexion et création de compte,
 * `/admin`, entrée réservée à la plateforme (non référencée depuis la vitrine), et les trois
 * documents légaux (`/cgu`, `/confidentialite`, `/conditions`), consultables sans authentification.
 */
export type PublicRoute = 'vitrine' | 'connexion' | 'inscription' | 'admin' | LegalRoute;

export type LegalRoute = 'cgu' | 'confidentialite' | 'conditions';

export const ROUTE_PATHS: Record<PublicRoute, string> = {
  vitrine: '/',
  connexion: '/connexion',
  inscription: '/inscription',
  admin: '/admin',
  cgu: '/cgu',
  confidentialite: '/confidentialite',
  conditions: '/conditions',
};

export const LEGAL_ROUTES: readonly LegalRoute[] = ['cgu', 'confidentialite', 'conditions'];

export function isLegalRoute(route: PublicRoute): route is LegalRoute {
  return (LEGAL_ROUTES as readonly string[]).includes(route);
}

export function routeFromPath(pathname: string): PublicRoute {
  const clean = pathname.replace(/\/+$/, '').toLowerCase() || '/';
  if (clean === ROUTE_PATHS.connexion) return 'connexion';
  if (clean === ROUTE_PATHS.inscription) return 'inscription';
  if (clean === ROUTE_PATHS.admin) return 'admin';
  for (const legal of LEGAL_ROUTES) {
    if (clean === ROUTE_PATHS[legal]) return legal;
  }
  return 'vitrine';
}

/**
 * Navigation interne depuis un composant qui ne reçoit pas `navigate` (pieds de page, liens légaux) :
 * met l’URL à jour puis signale `popstate` pour que `usePublicRoute` relise la route. Un clic avec
 * modificateur (nouvel onglet, bouton du milieu) est laissé au navigateur par les appelants.
 */
export function naviguerVersChemin(path: string): void {
  if (window.location.pathname !== path) window.history.pushState(null, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo({ top: 0, left: 0 });
}

/** Vrai pour un clic gauche simple, sans modificateur : la navigation interne peut remplacer celle du navigateur. */
export function clicNavigationInterne(event: { defaultPrevented: boolean; button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean }): boolean {
  return !event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

export interface NavigateOptions {
  /** Remplace l’entrée d’historique au lieu d’en ajouter une (synchronisation d’onglet). */
  replace?: boolean;
}

/**
 * Routeur minimal fondé sur l’History API : `pushState` à la navigation, écoute de `popstate`
 * pour les boutons Précédent / Suivant. Suffisant pour quelques URL, sans dépendance supplémentaire.
 */
export function usePublicRoute(): [PublicRoute, (route: PublicRoute, options?: NavigateOptions) => void] {
  const [route, setRoute] = useState<PublicRoute>(() =>
    typeof window === 'undefined' ? 'vitrine' : routeFromPath(window.location.pathname));

  useEffect(() => {
    const onPopState = () => setRoute(routeFromPath(window.location.pathname));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((next: PublicRoute, options?: NavigateOptions) => {
    const path = ROUTE_PATHS[next];
    if (window.location.pathname !== path) {
      if (options?.replace) window.history.replaceState(null, '', path);
      else window.history.pushState(null, '', path);
    }
    if (!options?.replace) window.scrollTo({ top: 0, left: 0 });
    setRoute(next);
  }, []);

  return [route, navigate];
}
