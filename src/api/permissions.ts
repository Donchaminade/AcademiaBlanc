import { useCallback, useSyncExternalStore } from 'react';
import { getSession, onSessionChange } from './client';

/**
 * Permissions fines « RESSOURCE:ACTION », miroir des enums du backend.
 * Le serveur reste la source de vérité : ces helpers servent uniquement à masquer ou désactiver l’interface.
 */

export type Ressource =
  | 'ANNEES' | 'CENTRES' | 'SESSIONS' | 'MATIERES' | 'COEFFICIENTS' | 'ENSEIGNANTS' | 'CLASSES' | 'SERIES'
  | 'AFFECTATIONS' | 'ELEVES' | 'NOTES' | 'BULLETINS' | 'PARAMETRES' | 'UTILISATEURS'
  | 'ETABLISSEMENTS' | 'GESTIONNAIRES' | 'TYPES_EXAMEN' | 'PREREGLAGES';

export type Action = 'VOIR' | 'DETAILS' | 'CREER' | 'MODIFIER' | 'SUPPRIMER' | 'IMPRIMER';

export const ACTIONS: Action[] = ['VOIR', 'DETAILS', 'CREER', 'MODIFIER', 'SUPPRIMER', 'IMPRIMER'];

export const ACTION_LABELS: Record<Action, string> = {
  VOIR: 'Voir',
  DETAILS: 'Détails',
  CREER: 'Créer',
  MODIFIER: 'Modifier',
  SUPPRIMER: 'Supprimer',
  IMPRIMER: 'Imprimer',
};

export const ACTION_HINTS: Record<Action, string> = {
  VOIR: 'Lister les fiches',
  DETAILS: 'Ouvrir une fiche et ses champs sensibles',
  CREER: 'Ajouter une fiche (générer pour les bulletins)',
  MODIFIER: 'Modifier une fiche existante',
  SUPPRIMER: 'Supprimer ou désactiver',
  IMPRIMER: 'Imprimer ou télécharger',
};

export const RESSOURCE_LABELS: Record<Ressource, string> = {
  ANNEES: 'Années scolaires',
  CENTRES: 'Centres d’examen',
  SESSIONS: 'Sessions',
  MATIERES: 'Matières',
  COEFFICIENTS: 'Coefficients',
  ENSEIGNANTS: 'Enseignants',
  CLASSES: 'Classes',
  SERIES: 'Séries du lycée',
  AFFECTATIONS: 'Affectations',
  ELEVES: 'Élèves',
  NOTES: 'Notes',
  BULLETINS: 'Bulletins',
  PARAMETRES: 'Paramètres',
  UTILISATEURS: 'Utilisateurs & droits',
  ETABLISSEMENTS: 'Établissements',
  GESTIONNAIRES: 'Gestionnaires',
  TYPES_EXAMEN: 'Types d’examen',
  PREREGLAGES: 'Pays & ministères',
};

/** Ressources d’établissement dont l’écriture rend l’écran Administration utile. */
export const RESSOURCES_ETABLISSEMENT: Ressource[] = [
  'ANNEES', 'CENTRES', 'SESSIONS', 'MATIERES', 'COEFFICIENTS', 'ENSEIGNANTS', 'CLASSES', 'SERIES', 'AFFECTATIONS', 'ELEVES', 'NOTES', 'BULLETINS', 'PARAMETRES', 'UTILISATEURS',
];

export const code = (ressource: Ressource, action: Action) => `${ressource}:${action}`;

export function hasPermission(permissions: readonly string[] | undefined, ressource: Ressource, action: Action): boolean {
  return Boolean(permissions?.includes(code(ressource, action)));
}

/** Vrai si l’utilisateur peut écrire quelque part dans le référentiel ou gérer les utilisateurs. */
export function hasAdminAccess(permissions: readonly string[] | undefined): boolean {
  if (!permissions || permissions.length === 0) return false;
  if (permissions.some((p) => p.startsWith('UTILISATEURS:'))) return true;
  return permissions.some((p) => {
    const [ressource, action] = p.split(':');
    return RESSOURCES_ETABLISSEMENT.includes(ressource as Ressource)
      && (action === 'CREER' || action === 'MODIFIER' || action === 'SUPPRIMER');
  });
}

const subscribe = (listener: () => void) => onSessionChange(listener);
const snapshot = () => {
  const session = getSession();
  return session ? JSON.stringify(session.permissions ?? []) : '[]';
};

export interface Permissions {
  /** Codes détenus. */
  permissions: string[];
  can: (ressource: Ressource, action: Action) => boolean;
  /** Au moins une des actions demandées. */
  canAny: (ressource: Ressource, ...actions: Action[]) => boolean;
  adminAccess: boolean;
}

/** Lit les permissions de la session courante et se met à jour quand la session change. */
export function usePermissions(): Permissions {
  const raw = useSyncExternalStore(subscribe, snapshot, snapshot);
  const permissions = JSON.parse(raw) as string[];
  const can = useCallback((ressource: Ressource, action: Action) => hasPermission(permissions, ressource, action), [raw]);
  const canAny = useCallback((ressource: Ressource, ...actions: Action[]) => actions.some((a) => hasPermission(permissions, ressource, a)), [raw]);
  return { permissions, can, canAny, adminAccess: hasAdminAccess(permissions) };
}
