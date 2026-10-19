import { useEffect, useState } from 'react';
import { apiBaseUrl } from '../../api/client';
import { OFFRE_INCONNUE, parseOffrePublique, type OffrePublique } from './offrePublique';

/** Délai court : la vitrine ne doit pas attendre un serveur endormi pour afficher ses tarifs. */
const DELAI_PUBLIC_MS = 8_000;

let cache: Promise<OffrePublique> | null = null;

/**
 * Offre publique (`GET /api/public/offre`), sans jeton. Repli sur {@link OFFRE_INCONNUE} si l'endpoint
 * n'existe pas encore, répond en erreur ou est injoignable : la vitrine affiche alors « Tarif communiqué
 * à l'inscription » sans jamais inventer de montant.
 */
export function loadOffrePublique(): Promise<OffrePublique> {
  if (!cache) {
    cache = (async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), DELAI_PUBLIC_MS);
      try {
        const response = await fetch(`${apiBaseUrl()}/api/public/offre`, {
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });
        if (!response.ok) return OFFRE_INCONNUE;
        return parseOffrePublique(await response.json()) ?? OFFRE_INCONNUE;
      } catch {
        return OFFRE_INCONNUE;
      } finally {
        clearTimeout(timer);
      }
    })();
  }
  return cache;
}

/** Offre « muette » affichée immédiatement, remplacée par celle de la plateforme dès la réponse. */
export function useOffrePublique(): OffrePublique {
  const [offre, setOffre] = useState<OffrePublique>(OFFRE_INCONNUE);
  useEffect(() => {
    let actif = true;
    void loadOffrePublique().then((valeur) => {
      if (actif) setOffre(valeur);
    });
    return () => {
      actif = false;
    };
  }, []);
  return offre;
}
