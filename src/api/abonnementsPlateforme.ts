import { apiGet, apiSend } from './client';
import type { EvenementAbonnement, Forfait, StatutAbonnement } from '../utils/abonnement';

/**
 * Portail super admin : `/api/plateforme/abonnements/**` (liste des établissements avec leur statut effectif,
 * activation après paiement mobile money, essai, suspension, réactivation, historique global des paiements,
 * paramètres commerciaux).
 */

export interface AbonnementEtablissement {
  id: number;
  nom: string;
  ville: string;
  email?: string;
  nomResponsable?: string;
  creeLe: string | null;
  actif: boolean;
  statut: StatutAbonnement;
  statutLibelle: string;
  forfait: Forfait | null;
  forfaitChoisi: Forfait | null;
  debut: string | null;
  fin: string | null;
  echeance: string | null;
  essaiJusquAu: string | null;
  joursRestants: number | null;
  enGrace: boolean;
  lectureSeule: boolean;
  acces: boolean;
  declarationsAVerifier: number;
}

export interface ActivationAbonnement {
  forfait: Forfait;
  /** `AAAA-MM-JJ` (UTC) ; aujourd'hui par défaut. */
  debut?: string;
  montant?: number;
  reference?: string;
  operateurMobile?: string;
  note?: string;
  declarationId?: number;
}

export interface PaiementsPlateforme {
  evenements: EvenementAbonnement[];
  mois: string;
  totalMois: number;
  nombrePaiementsMois: number;
  declarationsAVerifier: number;
  devise: string;
}

export interface ParametresCommerciaux {
  tarifMensuel: number;
  tarifAnnuel: number;
  devise: string;
  telWhatsapp: string;
  telAppel: string;
  beneficiaire: string;
  instructions: string;
  dureeEssaiJours: number;
  joursGrace: number;
  modifieLe: string | null;
}

const BASE = '/api/plateforme/abonnements';

export const listerAbonnements = () => apiGet<AbonnementEtablissement[]>(BASE);
export const historiqueEtablissement = (id: number) => apiGet<EvenementAbonnement[]>(`${BASE}/${id}/historique`);
export const activerAbonnement = (id: number, payload: ActivationAbonnement) =>
  apiSend<AbonnementEtablissement>(`${BASE}/${id}/activer`, 'POST', payload);
export const demarrerEssai = (id: number, note?: string) =>
  apiSend<AbonnementEtablissement>(`${BASE}/${id}/essai`, 'POST', { note: note ?? null });
export const suspendreAbonnement = (id: number, note?: string) =>
  apiSend<AbonnementEtablissement>(`${BASE}/${id}/suspendre`, 'POST', { note: note ?? null });
export const reactiverAbonnement = (id: number, note?: string) =>
  apiSend<AbonnementEtablissement>(`${BASE}/${id}/reactiver`, 'POST', { note: note ?? null });
export const listerPaiements = (mois?: string) =>
  apiGet<PaiementsPlateforme>(mois ? `${BASE}/paiements?mois=${encodeURIComponent(mois)}` : `${BASE}/paiements`);
export const lireParametresCommerciaux = () => apiGet<ParametresCommerciaux>(`${BASE}/parametres`);
export const enregistrerParametresCommerciaux = (payload: Omit<ParametresCommerciaux, 'devise' | 'modifieLe'>) =>
  apiSend<ParametresCommerciaux>(`${BASE}/parametres`, 'PUT', payload);
