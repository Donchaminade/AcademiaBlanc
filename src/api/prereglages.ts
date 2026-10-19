import { useEffect, useState } from 'react';
import { apiBaseUrl, apiDelete, apiGet, apiSend } from './client';
import type { ProfilEtablissement } from './etablissement';
import { PREREGLAGE_DEMONSTRATION_DEFAUT } from '../data/prereglagesDemo';
import type { EnTeteEtablissement, PrereglageNational } from '../utils/prereglages';

/** Vue plateforme (`/api/plateforme/prereglages-nationaux`) : tous les champs, état et nombre d'établissements. */
export interface PrereglageNationalPlateforme extends PrereglageNational {
  ordre: number;
  actif: boolean;
  /** Nombre d'établissements dont l'en-tête est rattaché à ce préréglage. */
  etablissements: number;
}

/** Corps de création / modification. */
export interface SaisiePrereglage {
  code: string;
  nomPays: string;
  republique: string;
  devise: string;
  ministere: string;
  sigleMinistere: string;
  autoriteRegionale: string | null;
  piedDePage: string | null;
  ordre: number;
  parDefaut?: boolean;
}

const PLATEFORME = '/api/plateforme/prereglages-nationaux';

/* ------------------------------------------------------------------ */
/* Établissement connecté                                              */
/* ------------------------------------------------------------------ */

/** Préréglages actifs, triés par la plateforme (tout utilisateur connecté). */
export function loadPrereglagesNationaux(): Promise<PrereglageNational[]> {
  return apiGet<PrereglageNational[]>('/api/prereglages-nationaux');
}

/** Applique un préréglage à l'établissement du jeton : l'API copie ses libellés et renvoie la fiche à jour. */
export function appliquerPrereglageNational(id: number): Promise<ProfilEtablissement> {
  return apiSend<ProfilEtablissement>(`/api/etablissement/prereglage-national/${id}`, 'POST', {});
}

/** Enregistre l'en-tête officiel saisi à la main (république, devise, ministère…). */
export function saveEnTete(enTete: EnTeteEtablissement): Promise<ProfilEtablissement> {
  return apiSend<ProfilEtablissement>('/api/etablissement/en-tete', 'PUT', enTete);
}

/* ------------------------------------------------------------------ */
/* Plateforme                                                          */
/* ------------------------------------------------------------------ */

export function loadPrereglagesPlateforme(): Promise<PrereglageNationalPlateforme[]> {
  return apiGet<PrereglageNationalPlateforme[]>(PLATEFORME);
}

export function creerPrereglage(saisie: SaisiePrereglage): Promise<PrereglageNationalPlateforme> {
  return apiSend<PrereglageNationalPlateforme>(PLATEFORME, 'POST', saisie);
}

export function modifierPrereglage(id: number, saisie: SaisiePrereglage): Promise<PrereglageNationalPlateforme> {
  return apiSend<PrereglageNationalPlateforme>(`${PLATEFORME}/${id}`, 'PUT', saisie);
}

export function activerPrereglage(id: number, actif: boolean): Promise<PrereglageNationalPlateforme> {
  return apiSend<PrereglageNationalPlateforme>(`${PLATEFORME}/${id}/actif`, 'PUT', { actif });
}

export function definirPrereglageParDefaut(id: number): Promise<PrereglageNationalPlateforme> {
  return apiSend<PrereglageNationalPlateforme>(`${PLATEFORME}/${id}/defaut`, 'PUT', {});
}

export function supprimerPrereglage(id: number): Promise<void> {
  return apiDelete(`${PLATEFORME}/${id}`);
}

/* ------------------------------------------------------------------ */
/* Vitrine (sans jeton)                                                */
/* ------------------------------------------------------------------ */

/** Délai court : la vitrine ne doit pas attendre un serveur endormi pour afficher son bandeau. */
const DELAI_PUBLIC_MS = 8_000;

let cachePublic: Promise<PrereglageNational> | null = null;

/**
 * Préréglage par défaut de la plateforme (`GET /api/public/prereglage-defaut`), sans jeton.
 * Repli sur le préréglage de démonstration si l'API est injoignable ou vide, pour ne jamais casser le hors connexion.
 */
export function loadPrereglageDefaut(): Promise<PrereglageNational> {
  if (!cachePublic) {
    cachePublic = (async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), DELAI_PUBLIC_MS);
      try {
        const response = await fetch(`${apiBaseUrl()}/api/public/prereglage-defaut`, {
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });
        if (!response.ok) return PREREGLAGE_DEMONSTRATION_DEFAUT;
        const data = await response.json() as Partial<PrereglageNational> | null;
        if (!data || !data.republique) return PREREGLAGE_DEMONSTRATION_DEFAUT;
        return { ...PREREGLAGE_DEMONSTRATION_DEFAUT, ...data } as PrereglageNational;
      } catch {
        return PREREGLAGE_DEMONSTRATION_DEFAUT;
      } finally {
        clearTimeout(timer);
      }
    })();
  }
  return cachePublic;
}

/**
 * Préréglage par défaut pour la vitrine et les pages d'authentification : valeur de démonstration
 * affichée immédiatement, remplacée par celle de la plateforme dès la réponse de l'API.
 */
export function usePrereglageDefaut(): PrereglageNational {
  const [prereglage, setPrereglage] = useState<PrereglageNational>(PREREGLAGE_DEMONSTRATION_DEFAUT);
  useEffect(() => {
    let actif = true;
    void loadPrereglageDefaut().then((valeur) => {
      if (actif) setPrereglage(valeur);
    });
    return () => {
      actif = false;
    };
  }, []);
  return prereglage;
}
