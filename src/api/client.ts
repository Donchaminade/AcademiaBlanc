export interface AuthSession {
  token: string;
  etablissementId: number;
  role: string;
  nomEtablissement: string;
  email: string;
  nomUtilisateur?: string;
}

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Responsable de l’établissement',
  ADMIN: 'Administrateur',
  SECRETAIRE: 'Secrétariat',
  ENSEIGNANT: 'Enseignant',
  SUPER_ADMIN: 'Propriétaire de la plateforme',
};

export function roleLabel(role?: string | null): string {
  if (!role) return 'Compte établissement';
  return ROLE_LABELS[role.toUpperCase()] || role;
}

/** Rôle du propriétaire du logiciel, distinct de OWNER / ADMIN / SECRETAIRE. */
export const PLATFORM_ROLE = 'SUPER_ADMIN';

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

export function clearToken(): void {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(SESSION_KEY);
}

/** Erreur HTTP de l’API : `message` est toujours une phrase française affichable. */
export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

const STATUS_MESSAGES: Record<number, string> = {
  400: 'Requête invalide : vérifiez les champs saisis.',
  401: 'Session expirée. Reconnectez-vous.',
  403: 'Vous n’avez pas le droit d’effectuer cette action.',
  404: 'Élément introuvable.',
  409: 'Suppression impossible : des données y sont encore rattachées.',
  500: 'Erreur du serveur.',
  502: 'Serveur indisponible. Réessayez dans un instant.',
  503: 'Serveur indisponible. Réessayez dans un instant.',
};

/** Message d’un statut HTTP quand le serveur ne fournit aucun détail. */
export function messagePourStatut(status: number): string {
  return STATUS_MESSAGES[status] ?? (status >= 500 ? 'Erreur du serveur.' : `Erreur ${status}`);
}

/** Privilégie le `message` renvoyé par le serveur, sinon une phrase française selon le statut. */
async function messageErreur(response: Response): Promise<string> {
  try {
    const data = await response.json() as { message?: string; error?: string } | null;
    if (data?.message && data.message.trim()) return data.message.trim();
    // Le champ `error` de Spring (« Forbidden », « Not Found »…) est en anglais : on lui préfère notre phrase.
  } catch {
    // corps vide ou non JSON
  }
  return messagePourStatut(response.status);
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
    throw new ApiError(response.status, await messageErreur(response));
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
