import { apiGet } from './client';
import type { PointInscription } from '../utils/analytique';

/**
 * Tableau de bord analytique de la plateforme (`GET /api/plateforme/analytique`), réservé au
 * propriétaire du logiciel (SUPER_ADMIN) : 403 pour un établissement ou un gestionnaire.
 */
export interface AnalytiqueVue {
  /** Instant UTC du calcul côté serveur. */
  calculeLe: string;
  /** Toutes les lignes de la table établissement, quel que soit leur état. */
  totalEtablissements: number;
  /** Établissements sans date d'inscription (antérieurs à la migration V12) : absents des barres, dans le cumul initial. */
  sansDateInscription: number;
  /** 12 mois glissants, du plus ancien au mois courant. */
  inscriptions: PointInscription[];
}

export function loadAnalytique(): Promise<AnalytiqueVue> {
  return apiGet<AnalytiqueVue>('/api/plateforme/analytique');
}
