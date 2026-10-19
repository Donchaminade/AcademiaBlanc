import { apiGet, apiSend } from './client';
import { VERSION_CONDITIONS } from '../legal/versions';

/** Ligne de preuve d'acceptation (`GET /api/etablissement/acceptations`). */
export interface AcceptationConditions {
  id: number;
  utilisateurId: number;
  email: string;
  versionConditions: string;
  /** ISO 8601 UTC, horodatage du serveur. */
  accepteLe: string;
  adresseIp: string | null;
  userAgent: string | null;
}

/** Dernière acceptation de l'établissement (`GET /api/etablissement/acceptations/derniere`), `null` si aucune (204). */
export interface DerniereAcceptation {
  versionConditions: string;
  accepteLe: string;
  email: string;
}

/** Historique complet — réservé au responsable et aux administrateurs (403 sinon). */
export function loadAcceptations(): Promise<AcceptationConditions[]> {
  return apiGet<AcceptationConditions[]>('/api/etablissement/acceptations');
}

/** Dernière version acceptée, lisible par tout utilisateur de l'établissement ; `null` si aucune. */
export async function loadDerniereAcceptation(): Promise<DerniereAcceptation | null> {
  const derniere = await apiGet<DerniereAcceptation | undefined>('/api/etablissement/acceptations/derniere');
  return derniere ?? null;
}

/** Ré-acceptation après mise à jour des conditions (OWNER / ADMIN) : une nouvelle ligne est enregistrée. */
export function accepterConditions(versionConditions: string = VERSION_CONDITIONS): Promise<AcceptationConditions> {
  return apiSend<AcceptationConditions>('/api/etablissement/acceptations', 'POST', {
    acceptationConditions: true,
    versionConditions,
  });
}
