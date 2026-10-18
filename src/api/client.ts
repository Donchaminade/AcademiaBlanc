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

/**
 * Erreur HTTP de l’API : le message vient du serveur (`{ "message": "Action non autorisée : …" }`).
 * `status` vaut 0 quand aucune réponse n’a été reçue (réseau coupé, CORS refusé, délai dépassé).
 */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export const isForbidden = (err: unknown): err is ApiError => err instanceof ApiError && err.status === 403;

/**
 * Serveur injoignable ou pas encore prêt : aucune réponse, délai dépassé, ou passerelle en 502/503/504
 * (cas typique d’un hébergement gratuit qui redémarre après une période d’inactivité).
 */
export const isUnavailable = (err: unknown): err is ApiError =>
  err instanceof ApiError && (err.status === 0 || (err.status >= 502 && err.status <= 504));

export const MESSAGE_SERVEUR_INDISPONIBLE =
  'Le serveur est en cours de démarrage ou injoignable. Réessayez dans une minute.';

/** Délai maximal d’une requête : laisse le temps à un serveur endormi de redémarrer (~50 s). */
export const DELAI_REQUETE_MS = 60_000;

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

/**
 * Compte plateforme sans établissement rattaché (propriétaire créé au démarrage, gestionnaire) :
 * aucun espace de travail d’établissement à charger ni à afficher.
 */
export function isPlatformOnlyAccount(session: AuthSession | null = getSession()): boolean {
  return isPlatformAccount(session) && !session?.etablissementId;
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

const STATUS_MESSAGES: Record<number, string> = {
  400: 'Requête invalide : vérifiez les champs saisis.',
  401: 'Session expirée. Reconnectez-vous.',
  403: 'Vous n’avez pas le droit d’effectuer cette action.',
  404: 'Élément introuvable.',
  409: 'Suppression impossible : des données y sont encore rattachées.',
  500: 'Erreur du serveur.',
  502: MESSAGE_SERVEUR_INDISPONIBLE,
  503: MESSAGE_SERVEUR_INDISPONIBLE,
  504: MESSAGE_SERVEUR_INDISPONIBLE,
};

/** Message d’un statut HTTP quand le serveur ne fournit aucun détail. */
export function messagePourStatut(status: number): string {
  return STATUS_MESSAGES[status] ?? (status >= 500 ? 'Erreur du serveur.' : `Erreur ${status}`);
}

/**
 * Privilégie le `message` renvoyé par le serveur (`ApiExceptionHandler` : `{ "message": "…" }`),
 * sinon une phrase française selon le statut. Une passerelle en 502/503/504 renvoie souvent du HTML :
 * son texte n’est jamais repris.
 */
async function messageErreur(response: Response): Promise<string> {
  if (response.status < 502 || response.status > 504) {
    try {
      const data = await response.json() as { message?: string; erreur?: string; error?: string } | null;
      const detail = data?.message ?? data?.erreur;
      if (detail && detail.trim()) return detail.trim();
      // Le champ `error` de Spring (« Forbidden », « Not Found »…) est en anglais : on lui préfère notre phrase.
    } catch {
      // corps vide ou non JSON
    }
  }
  return messagePourStatut(response.status);
}

interface RequestOptions extends RequestInit {
  /** Délai maximal avant abandon (défaut : `DELAI_REQUETE_MS`). */
  timeoutMs?: number;
}

async function request<T>(path: string, { timeoutMs = DELAI_REQUETE_MS, ...options }: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}${path}`, { ...options, headers, signal: controller.signal });
  } catch {
    // Réseau coupé, CORS refusé, serveur arrêté ou délai dépassé : aucune réponse HTTP n’a été reçue.
    throw new ApiError(0, MESSAGE_SERVEUR_INDISPONIBLE);
  } finally {
    clearTimeout(timer);
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

/**
 * Connexion de la page `/admin` : même vérification des identifiants que `login`, mais le serveur
 * ne délivre un jeton qu’aux rôles de la plateforme (403 sinon) et signale par un 401 explicite
 * une plateforme dont le propriétaire n’a pas été initialisé.
 */
export function loginPlateforme(email: string, motDePasse: string): Promise<AuthSession> {
  return request<AuthSession>('/api/auth/login-plateforme', {
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
