import { useCallback, useEffect, useState } from 'react';

/** Pages publiques, hors application : site vitrine, connexion et création de compte. */
export type PublicRoute = 'vitrine' | 'connexion' | 'inscription';

export const ROUTE_PATHS: Record<PublicRoute, string> = {
  vitrine: '/',
  connexion: '/connexion',
  inscription: '/inscription',
};

export function routeFromPath(pathname: string): PublicRoute {
  const clean = pathname.replace(/\/+$/, '').toLowerCase() || '/';
  if (clean === ROUTE_PATHS.connexion) return 'connexion';
  if (clean === ROUTE_PATHS.inscription) return 'inscription';
  return 'vitrine';
}

export interface NavigateOptions {
  /** Remplace l’entrée d’historique au lieu d’en ajouter une (synchronisation d’onglet). */
  replace?: boolean;
}

/**
 * Routeur minimal fondé sur l’History API : `pushState` à la navigation, écoute de `popstate`
 * pour les boutons Précédent / Suivant. Suffisant pour trois URL, sans dépendance supplémentaire.
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
