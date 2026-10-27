/**
 * Minimal API client. The access token lives in memory only (never in
 * localStorage — XSS can't exfiltrate a durable credential); the refresh token
 * is an httpOnly cookie the browser sends to /auth/refresh. On a 401, we try a
 * single silent refresh and retry the original request once.
 */
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000';

let accessToken: string | null = null;

/**
 * Non-sensitive "a session may exist" hint (a bare flag, never a token). It is set at
 * login and cleared at logout / when the refresh is refused, so a visitor with no
 * session never fires a doomed POST /auth/refresh (a guaranteed 401 console error on
 * every first load). Security is unchanged (ADR-024): the access token stays in memory
 * and the refresh token stays in the httpOnly cookie; the flag grants nothing.
 */
const SESSION_HINT_KEY = 'nx.session';
export function hasSessionHint(): boolean {
  try {
    return window.localStorage.getItem(SESSION_HINT_KEY) === '1';
  } catch {
    return true; // storage blocked: we cannot tell, so fall back to attempting the silent refresh
  }
}
export function setSessionHint(on: boolean): void {
  try {
    if (on) window.localStorage.setItem(SESSION_HINT_KEY, '1');
    else window.localStorage.removeItem(SESSION_HINT_KEY);
  } catch {
    /* storage unavailable: the hint is only an optimisation */
  }
}
/** Called when the session can no longer be refreshed (forces re-login). */
let onAuthLost: (() => void) | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}
export function getAccessToken(): string | null {
  return accessToken;
}
export function setAuthLostHandler(handler: () => void): void {
  onAuthLost = handler;
}

export interface ApiError extends Error {
  status: number;
  code?: string;
}

function makeError(status: number, body: unknown): ApiError {
  const err = new Error(
    (body as { error?: { message?: string } })?.error?.message ?? `Request failed (${status})`,
  ) as ApiError;
  err.status = status;
  err.code = (body as { error?: { code?: string } })?.error?.code;
  return err;
}

async function raw(path: string, init: RequestInit): Promise<Response> {
  const headers = new Headers(init.headers);
  if (accessToken) headers.set('authorization', `Bearer ${accessToken}`);
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  return fetch(`${API_BASE}${path}`, { ...init, headers, credentials: 'include' });
}

let refreshInFlight: Promise<boolean> | null = null;

/**
 * POST /auth/refresh using the httpOnly cookie; updates the in-memory token.
 * Single-flighted: concurrent callers share one request, so parallel 401s can't
 * trigger a refresh storm that trips the backend's reuse detection.
 */
export async function tryRefresh(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      if (!res.ok) {
        if (res.status === 401) setSessionHint(false);
        return false;
      }
      const data = (await res.json()) as { accessToken?: string };
      if (!data.accessToken) return false;
      accessToken = data.accessToken;
      setSessionHint(true);
      return true;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

/** Authenticated JSON request with one automatic refresh-and-retry on 401. */
export async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  let res = await raw(path, init);
  if (res.status === 401 && accessToken) {
    if (await tryRefresh()) {
      res = await raw(path, init);
    } else {
      accessToken = null;
      setSessionHint(false);
      onAuthLost?.();
    }
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw makeError(res.status, body);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

/** Unauthenticated login. Returns the access token + user; sets refresh cookie. */
export async function login(
  email: string,
  password: string,
): Promise<{ accessToken: string; user: { email: string; displayName?: string; realm: string; businessId: string | null } }> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw makeError(res.status, body);
  accessToken = (body as { accessToken: string }).accessToken;
  setSessionHint(true);
  return body as never;
}
