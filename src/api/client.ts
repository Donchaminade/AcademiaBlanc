export interface AuthSession {
  token: string;
  utilisateurId?: number;
  /** Null pour un gestionnaire de la plateforme (aucun établissement rattaché). */
  etablissementId: number | null;
  role: string;
  nomEtablissement: string;
  email: string;
  nomUtilisateur?: string;
  /** Codes « RESSOURCE:ACTION » détenus. OWNER et SUPER_ADMIN reçoivent la liste complète. */
  permissions?: string[];
}

export const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Responsable de l’établissement',
  ADMIN: 'Administrateur',
  SECRETAIRE: 'Secrétariat',
  ENSEIGNANT: 'Enseignant',
  SUPER_ADMIN: 'Propriétaire de la plateforme',
  GESTIONNAIRE_PLATEFORME: 'Gestionnaire de la plateforme',
};

/** Erreur HTTP de l’API : le message vient du serveur (`{ "message": "Action non autorisée : …" }`). */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export const isForbidden = (err: unknown): err is ApiError => err instanceof ApiError && err.status === 403;

export function roleLabel(role?: string | null): string {
  if (!role) return 'Compte établissement';
  return ROLE_LABELS[role.toUpperCase()] || role;
}

/** Rôle du propriétaire du logiciel, distinct de OWNER / ADMIN / SECRETAIRE. */
export const PLATFORM_ROLE = 'SUPER_ADMIN';
/** Gestionnaire ajouté par le propriétaire : droits fins sur la plateforme, aucun établissement. */
export const PLATFORM_MANAGER_ROLE = 'GESTIONNAIRE_PLATEFORME';

const SESSION_EVENT = 'academiablanc:session';

/** S’abonne aux changements de session (connexion, déconnexion, rafraîchissement des droits). */
export function onSessionChange(listener: () => void): () => void {
  window.addEventListener(SESSION_EVENT, listener);
  window.addEventListener('storage', listener);
  return () => {
    window.removeEventListener(SESSION_EVENT, listener);
    window.removeEventListener('storage', listener);
  };
}

function notifySession(): void {
  try {
    window.dispatchEvent(new Event(SESSION_EVENT));
  } catch {
    // environnement sans window
  }
}

const TOKEN_KEY = 'academiablanc_token';

export function apiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_URL || 'http://localhost:8080';
  return configured.replace(/\/$/, '');
}

export function getToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

const SESSION_KEY = 'academiablanc_session';

export function setToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function setSession(session: AuthSession): void {
  sessionStorage.setItem(TOKEN_KEY, session.token);
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  notifySession();
}

export function getSession(): AuthSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) as AuthSession : null;
  } catch {
    return null;
  }
}

export function isPlatformOwner(session: AuthSession | null = getSession()): boolean {
  return session?.role === PLATFORM_ROLE;
}

/** Compte de niveau plateforme (propriétaire ou gestionnaire) : écran « Plateforme » au lieu des écrans d’établissement. */
export function isPlatformAccount(session: AuthSession | null = getSession()): boolean {
  return session?.role === PLATFORM_ROLE || session?.role === PLATFORM_MANAGER_ROLE;
}

export function clearToken(): void {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  notifySession();
}

export interface MeResponse {
  utilisateurId: number;
  etablissementId: number | null;
  role: string;
  nomEtablissement: string | null;
  email: string;
  nomUtilisateur: string;
  actif: boolean;
  permissions: string[];
}

/**
 * Relit le compte courant sur l’API et met la session à jour (rôle et permissions).
 * À appeler au chargement : les droits peuvent avoir changé depuis la connexion.
 */
export async function refreshSession(): Promise<AuthSession | null> {
  const current = getSession();
  if (!current || !getToken()) return null;
  const me = await request<MeResponse>('/api/auth/me');
  const next: AuthSession = {
    ...current,
    utilisateurId: me.utilisateurId,
    etablissementId: me.etablissementId,
    role: me.role,
    nomEtablissement: me.nomEtablissement || current.nomEtablissement,
    email: me.email,
    nomUtilisateur: me.nomUtilisateur,
    permissions: me.permissions,
  };
  setSession(next);
  return next;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}${path}`, { ...options, headers });
  } catch {
    throw new Error(`API injoignable (${apiBaseUrl()}). Démarrez le backend puis réessayez.`);
  }

  if (!response.ok) {
    let message = `Erreur ${response.status}`;
    try {
      const data = await response.json() as { message?: string; error?: string };
      if (data.message) message = data.message;
      else if (data.error) message = data.error;
    } catch {
      // corps non JSON
    }
    throw new ApiError(response.status, message);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function login(email: string, motDePasse: string): Promise<AuthSession> {
  return request<AuthSession>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, motDePasse }),
  });
}

export function signup(payload: {
  nom: string;
  ville: string;
  email: string;
  motDePasse: string;
  nomResponsable: string;
  telephone?: string;
  region?: string;
  typeEtablissement?: string;
}): Promise<AuthSession> {
  return request<AuthSession>('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>(path);
}

export function apiSend<T>(path: string, method: 'POST' | 'PUT', body: unknown): Promise<T> {
  return request<T>(path, { method, body: JSON.stringify(body) });
}

export function apiDelete(path: string): Promise<void> {
  return request<void>(path, { method: 'DELETE' });
}
