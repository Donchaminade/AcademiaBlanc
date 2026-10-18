export interface AuthSession {
  token: string;
  etablissementId: number;
  role: string;
  nomEtablissement: string;
  email: string;
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

export function setToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  sessionStorage.removeItem(TOKEN_KEY);
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
    throw new Error(message);
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
