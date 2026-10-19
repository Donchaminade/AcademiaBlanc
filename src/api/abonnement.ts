import { useSyncExternalStore } from 'react';
import { apiGet, apiSend, getToken } from './client';
import type { EtatAbonnement, EvenementAbonnement, Forfait, OffrePublique } from '../utils/abonnement';
import { MOTIF_IMPRESSION_VERROUILLEE } from '../utils/abonnement';
import { definirVerrouImpression } from '../utils/verrouImpression';

/**
 * Abonnement de l'établissement connecté : lecture du statut calculé par le serveur, déclaration de paiement,
 * historique ; et un petit magasin partagé (badge, bandeau, boutons grisés) rafraîchi au chargement puis
 * toutes les 30 minutes. Aucune décision n'est prise avec l'horloge du navigateur.
 */

/** Rafraîchissement périodique du statut (le serveur recalcule l'échéance). */
export const INTERVALLE_RAFRAICHISSEMENT_MS = 30 * 60 * 1000;

export function chargerStatutAbonnement(): Promise<EtatAbonnement> {
  return apiGet<EtatAbonnement>('/api/abonnement/statut');
}

export function chargerHistoriqueAbonnement(): Promise<EvenementAbonnement[]> {
  return apiGet<EvenementAbonnement[]>('/api/abonnement/historique');
}

export function chargerOffre(): Promise<OffrePublique> {
  return apiGet<OffrePublique>('/api/public/offre');
}

export interface DeclarationPaiement {
  forfait?: Forfait | null;
  montant: number;
  reference?: string;
  operateur: string;
  datePaiement?: string;
  note?: string;
}

export function declarerPaiement(payload: DeclarationPaiement): Promise<EvenementAbonnement> {
  return apiSend<EvenementAbonnement>('/api/abonnement/declarations', 'POST', payload);
}

/* ------------------------------------------------------------------ */
/* Magasin partagé                                                     */
/* ------------------------------------------------------------------ */

let etatCourant: EtatAbonnement | null = null;
const abonnes = new Set<() => void>();

export function getEtatAbonnement(): EtatAbonnement | null {
  return etatCourant;
}

/** Pose l'état reçu du serveur (ou `null` hors session) et aligne la garde d'impression. */
export function setEtatAbonnement(etat: EtatAbonnement | null): void {
  etatCourant = etat;
  const verrou = Boolean(etat && !etat.plateforme && etat.lectureSeule);
  definirVerrouImpression(verrou, verrou ? MOTIF_IMPRESSION_VERROUILLEE : '');
  abonnes.forEach((listener) => listener());
}

/** Relit le statut sur l'API ; hors session, remet le magasin à zéro. */
export async function rafraichirAbonnement(): Promise<EtatAbonnement | null> {
  if (!getToken()) {
    setEtatAbonnement(null);
    return null;
  }
  const etat = await chargerStatutAbonnement();
  setEtatAbonnement(etat);
  return etat;
}

const subscribe = (listener: () => void) => {
  abonnes.add(listener);
  return () => {
    abonnes.delete(listener);
  };
};
const snapshot = () => etatCourant;

/** État d'abonnement courant, mis à jour à chaque rafraîchissement. */
export function useAbonnement(): EtatAbonnement | null {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
