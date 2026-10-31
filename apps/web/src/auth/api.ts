/**
 * Minimal API client. The access token lives in memory only (never in
 * localStorage — XSS can't exfiltrate a durable credential); the refresh token
 * is an httpOnly cookie the browser sends to /auth/refresh. On a 401, we try a
 * single silent refresh and retry the original request once.
 *
 * Per-tab sessions (ADR-034): the in-memory access token was always per tab. What used to be shared was the
 * single refresh cookie + one localStorage flag, so a second sign-in replaced the first user in every tab.
 * A tab can now own a SLOT: a random id in sessionStorage that selects its own HttpOnly cookie
 * (`nexus_rt_<slot>`) via the `X-Nexus-Slot` header. Without a slot the tab uses the browser-wide device
 * session exactly as before ("remember me on this device").
 */
import {
  SLOT_HEADER,
  broadcastAuth,
  claimSlot,
  clearSlot,
  forgetSlotAndDetach,
  isDetached,
  newSlotId,
  readSlot,
  sessionKind,
  setDetached,
  withCrossTabLock,
  writeSlot,
  type SessionKind,
} from './tabSession';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000';

let accessToken: string | null = null;
/** Session id (`sid` claim) this tab signed in as. A refresh that answers with a different one is a different identity. */
let expectedSid: string | null = null;

/**
 * Non-sensitive "a session may exist" hint (a bare flag, never a token). It is set at
 * login and cleared at logout / when the refresh is refused, so a visitor with no
 * session never fires a doomed POST /auth/refresh (a guaranteed 401 console error on
 * every first load). Security is unchanged (ADR-024): the access token stays in memory
 * and the refresh token stays in the httpOnly cookie; the flag grants nothing.
 *
 * It describes the DEVICE session only. A tab that owns a slot, or that was detached from the device session,
 * is decided by its own sessionStorage state (see hasSessionHint).
 */
const SESSION_HINT_KEY = 'nx.session';
function deviceHint(): boolean {
  try {
    return window.localStorage.getItem(SESSION_HINT_KEY) === '1';
  } catch {
    return true; // storage blocked: we cannot tell, so fall back to attempting the silent refresh
  }
}
/** True when this tab may have a session to restore: its own slot, or (if not detached) the device session. */
export function hasSessionHint(): boolean {
  if (readSlot()) return true;
  if (isDetached()) return false;
  return deviceHint();
}
export function setSessionHint(on: boolean): void {
  try {
    if (on) window.localStorage.setItem(SESSION_HINT_KEY, '1');
    else window.localStorage.removeItem(SESSION_HINT_KEY);
  } catch {
    /* storage unavailable: the hint is only an optimisation */
  }
}

export type AuthLostReason = 'expired' | 'accountChanged';
/** Called when the session can no longer be refreshed (forces re-login). */
let onAuthLost: ((reason: AuthLostReason) => void) | null = null;
let lossNotified = false;

export function setAccessToken(token: string | null): void {
  accessToken = token;
  if (token === null) expectedSid = null;
}
export function getAccessToken(): string | null {
  return accessToken;
}
export function setAuthLostHandler(handler: (reason: AuthLostReason) => void): void {
  onAuthLost = handler;
}

/** `sid` claim of an access token (display-independent identity check; the server is the verifier). Null if not a JWT. */
export function sessionIdOf(token: string): string | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '='));
    const sid = (JSON.parse(json) as { sid?: unknown }).sid;
    return typeof sid === 'string' ? sid : null;
  } catch {
    return null;
  }
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
  // Auth endpoints that touch the refresh cookie (logout, logout-all, change-password) must name this tab's slot.
  if (path.startsWith('/auth/')) {
    const slot = readSlot();
    if (slot) headers.set(SLOT_HEADER, slot);
  }
  return fetch(`${API_BASE}${path}`, { ...init, headers, credentials: 'include' });
}

/** This tab can no longer use its own session (revoked, cookie gone): forget it and stay off the device session. */
function forgetTabSession(): void {
  forgetSlotAndDetach();
}

let refreshInFlight: Promise<boolean> | null = null;

async function refreshOnce(slot: string | null): Promise<boolean> {
  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json', ...(slot ? { [SLOT_HEADER]: slot } : {}) },
    body: '{}',
  });
  if (!res.ok) {
    if (res.status === 401) {
      if (slot) forgetTabSession();
      else setSessionHint(false);
    }
    return false;
  }
  const data = (await res.json()) as { accessToken?: string };
  if (!data.accessToken) return false;
  const sid = sessionIdOf(data.accessToken);
  if (expectedSid && sid && sid !== expectedSid) {
    // The shared device cookie now belongs to another sign-in (another tab signed in as someone else). Do NOT adopt
    // it: this tab's screen shows the previous user, and its requests must never silently run as a different one.
    accessToken = null;
    expectedSid = null;
    lossNotified = true;
    onAuthLost?.('accountChanged');
    return false;
  }
  accessToken = data.accessToken;
  if (sid) expectedSid = sid;
  if (!slot) setSessionHint(true);
  return true;
}

/**
 * POST /auth/refresh using this tab's httpOnly cookie (its slot cookie, else the device cookie); updates the
 * in-memory token. Single-flighted inside the tab, and serialised across tabs that share a cookie with a Web
 * Lock: the second tab then sends the already-rotated cookie, so rotation can never look like token theft and
 * log everyone out.
 */
export async function tryRefresh(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  lossNotified = false;
  const slot = readSlot();
  refreshInFlight = (async () => {
    try {
      return await withCrossTabLock(`refresh:${slot ?? 'device'}`, () => refreshOnce(slot));
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
    const slot = readSlot();
    if (await tryRefresh()) {
      res = await raw(path, init);
    } else {
      accessToken = null;
      expectedSid = null;
      if (!slot) setSessionHint(false); // a tab session never touches the device hint
      if (!lossNotified) onAuthLost?.('expired');
    }
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw makeError(res.status, body);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export interface LoginOptions {
  /**
   * true  = "remember me on this device": the browser-wide session, shared by tabs and kept across restarts.
   * false = this tab only: its own slot and cookie; other tabs can be signed in as other users.
   * Default: remembered, unless the tab was detached from the device session (then tab-only).
   */
  remember?: boolean;
}

/** Unauthenticated login. Returns the access token + user; sets the refresh cookie (device or this tab's slot). */
export async function login(
  email: string,
  password: string,
  options: LoginOptions = {},
): Promise<{ accessToken: string; user: { email: string; displayName?: string; realm: string; businessId: string | null } }> {
  const remember = options.remember ?? !isDetached();
  const slot = remember ? null : (readSlot() ?? newSlotId());
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json', ...(slot ? { [SLOT_HEADER]: slot } : {}) },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw makeError(res.status, body);
  accessToken = (body as { accessToken: string }).accessToken;
  expectedSid = sessionIdOf(accessToken);
  if (slot) {
    writeSlot(slot);
    void claimSlot(slot); // this document owns the slot from now on (duplicate-tab detection)
  } else {
    clearSlot();
    setDetached(false);
    setSessionHint(true);
    broadcastAuth('device-signed-in');
  }
  return body as never;
}

/** Which kind of session this tab is using right now. */
export function currentSessionKind(): SessionKind {
  return sessionKind();
}

/**
 * Local sign-out bookkeeping, after the server call. A tab session forgets its slot (and stays off the device
 * session); the device session clears the hint and tells the other device tabs.
 */
export function endLocalSession(): void {
  // A tab that owns a slot, or was detached from the device session, never touches the device session.
  const tabScoped = readSlot() !== null || isDetached();
  accessToken = null;
  expectedSid = null;
  if (tabScoped) forgetTabSession();
  else {
    setSessionHint(false);
    broadcastAuth('device-signed-out');
  }
}

/**
 * "Use another account in this tab" for a tab on the device session: leave it without ending it (other tabs keep
 * working) and make the next sign-in tab-only.
 */
export function detachFromDeviceSession(): void {
  accessToken = null;
  expectedSid = null;
  setDetached(true);
}
