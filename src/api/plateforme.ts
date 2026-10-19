import { apiGet } from './client';
import type { PointInscription, RevenusMois } from '../utils/analytique';

/**
 * Tableau de bord analytique de la plateforme (`GET /api/plateforme/analytique`), réservé au
 * propriétaire du logiciel (SUPER_ADMIN) : 403 pour un établissement ou un gestionnaire.
 * Tout est calculé par le serveur en UTC ; le client ne fait que totaliser et formater.
 */

export type StatutAbonnementAnalytique = 'EN_ATTENTE_PAIEMENT' | 'ESSAI' | 'ACTIF' | 'EXPIRE' | 'SUSPENDU';

/** Effectifs par statut effectif à l'instant du calcul ; `total` = toutes les lignes de la table établissement. */
export interface CartesAnalytique {
  actifs: number;
  essai: number;
  enAttentePaiement: number;
  suspendus: number;
  expires: number;
  total: number;
}

export interface EtablissementChurn {
  id: number;
  nom: string;
  /** Date de l'événement (suspension, ou constat de l'expiration par le serveur). */
  date: string;
  statut: 'EXPIRE' | 'SUSPENDU';
  statutLibelle: string;
}

export interface ChurnAnalytique {
  debutFenetre: string;
  finFenetre: string;
  /** Base du taux : essai ou abonnement en cours il y a 30 jours. */
  enServiceIlYA30Jours: number;
  perdus: number;
  /** `perdus / enServiceIlYA30Jours × 100`, arrondi au dixième ; null sans base. */
  taux: number | null;
  etablissements: EtablissementChurn[];
  /** Définition exacte, rédigée par le serveur (affichée dans l'info-bulle). */
  definition: string;
}

export interface AnalytiqueVue {
  /** Instant UTC du calcul côté serveur. */
  calculeLe: string;
  devise: string;
  cartes: CartesAnalytique;
  /** 6 mois civils, du plus ancien au mois courant. */
  revenus: RevenusMois[];
  definitionRevenus: string;
  churn: ChurnAnalytique;
  /** Établissements sans date d'inscription (antérieurs à la migration V12) : absents des barres, dans le cumul initial. */
  sansDateInscription: number;
  /** 12 mois glissants, du plus ancien au mois courant. */
  inscriptions: PointInscription[];
}

export function loadAnalytique(): Promise<AnalytiqueVue> {
  return apiGet<AnalytiqueVue>('/api/plateforme/analytique');
}
