/**
 * Test double for the API's /auth endpoints plus a shared "browser" (cookie jar, BroadcastChannel, Web Locks,
 * per-tab sessionStorage) so several simulated tabs can run in one jsdom. It mirrors the server rules that
 * matter to ADR-034: cookie chosen by X-Nexus-Slot, no fallback from a slot to the device cookie, rotation with
 * reuse detection (a replayed rotated token revokes the session), logout revokes only its own session.
 * Test-only: never imported by app code.
 */
import { vi } from 'vitest';

export const PASSWORD = 'pw';

interface Session {
  id: string;
  email: string;
  revoked: boolean;
}

function b64url(s: string): string {
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function jwt(sid: string, email: string): string {
  return `${b64url('{"alg":"HS256","typ":"JWT"}')}.${b64url(JSON.stringify({ sid, sub: email }))}.sig`;
}
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface Call {
  path: string;
  method: string;
  slot: string | null;
  cookie: string | undefined;
  status: number;
}

export class FakeAuthServer {
  readonly jar = new Map<string, string>(); // the browser's refresh cookies (shared by every tab)
  readonly calls: Call[] = [];
  private sessions = new Map<string, Session>();
  private refreshTokens = new Map<string, { sid: string; consumed: boolean }>();
  private seq = 0;
  /** Milliseconds a refresh takes, so concurrent refreshes really overlap. */
  refreshLatencyMs = 5;

  readonly displayNames: Record<string, string> = {
    'owner@cafe.test': 'Owner Olive',
    'cashier@cafe.test': 'Cashier Chen',
    'waiter@cafe.test': 'Waiter Wu',
  };

  private res(status: number, body?: unknown): Response {
    return status === 204 ? new Response(null, { status }) : new Response(JSON.stringify(body ?? {}), { status, headers: { 'content-type': 'application/json' } });
  }

  private sessionOf(headers: Headers): Session | null {
    const token = headers.get('authorization')?.replace(/^Bearer /, '');
    if (!token) return null;
    try {
      const sid = (JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as { sid: string }).sid;
      const s = this.sessions.get(sid);
      return s && !s.revoked ? s : null;
    } catch {
      return null;
    }
  }

  private mintRefresh(sid: string): string {
    const token = `rt-${sid}-${++this.seq}`;
    this.refreshTokens.set(token, { sid, consumed: false });
    return token;
  }

  fetch = async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
    const path = new URL(String(input)).pathname;
    const method = init.method ?? 'GET';
    const headers = new Headers(init.headers);
    const slot = headers.get('x-nexus-slot');
    const cookieName = slot ? `nexus_rt_${slot}` : 'nexus_refresh';
    const cookie = this.jar.get(cookieName); // the browser attaches the cookie when the request is SENT
    const done = (status: number, body?: unknown): Response => {
      this.calls.push({ path, method, slot, cookie, status });
      return this.res(status, body);
    };

    if (path === '/auth/login') {
      const { email, password } = JSON.parse(String(init.body)) as { email: string; password: string };
      if (password !== PASSWORD || !this.displayNames[email]) return done(401, { error: { message: 'Invalid email or password' } });
      const id = `s${++this.seq}`;
      this.sessions.set(id, { id, email, revoked: false });
      this.jar.set(cookieName, this.mintRefresh(id));
      return done(200, { accessToken: jwt(id, email), user: { email, displayName: this.displayNames[email], realm: 'BUSINESS', businessId: 'b1' } });
    }

    if (path === '/auth/refresh') {
      await delay(this.refreshLatencyMs);
      const rec = cookie ? this.refreshTokens.get(cookie) : undefined;
      if (!rec) return done(401, { error: { message: 'Missing refresh token' } });
      const session = this.sessions.get(rec.sid)!;
      if (rec.consumed) {
        session.revoked = true; // reuse of a rotated token = theft: the whole session dies
        return done(401, { error: { message: 'Invalid refresh token' } });
      }
      if (session.revoked) return done(401, { error: { message: 'Session expired or revoked' } });
      rec.consumed = true;
      this.jar.set(cookieName, this.mintRefresh(session.id));
      return done(200, { accessToken: jwt(session.id, session.email), expiresIn: 300 });
    }

    if (path === '/auth/logout') {
      const s = this.sessionOf(headers);
      if (!s) return done(401, { error: { message: 'Unauthorized' } });
      s.revoked = true;
      this.jar.delete(cookieName); // only the named cookie is cleared
      return done(204);
    }

    if (path === '/auth/logout-all') {
      const s = this.sessionOf(headers);
      if (!s) return done(401, { error: { message: 'Unauthorized' } });
      for (const x of this.sessions.values()) if (x.email === s.email) x.revoked = true;
      this.jar.delete(cookieName);
      return done(204);
    }

    if (path === '/auth/me') {
      const s = this.sessionOf(headers);
      if (!s) return done(401, { error: { message: 'Unauthorized' } });
      return done(200, {
        id: s.id,
        email: s.email,
        displayName: this.displayNames[s.email],
        realm: 'BUSINESS',
        businessId: 'b1',
        roles: [{ key: 'owner', name: s.email.startsWith('owner') ? 'Owner' : 'Staff' }],
        business: { name: 'Cafe Ember', accentColor: null },
      });
    }

    return done(404, { error: { message: 'not mocked' } });
  };

  /** Number of /auth/refresh calls that came back 401. */
  refreshFailures(): number {
    return this.calls.filter((c) => c.path === '/auth/refresh' && c.status === 401).length;
  }
}

// ── The "browser" ──────────────────────────────────────────────────────────────

export class MemStorage implements Storage {
  private m = new Map<string, string>();
  get length(): number {
    return this.m.size;
  }
  clear(): void {
    this.m.clear();
  }
  getItem(k: string): string | null {
    return this.m.get(k) ?? null;
  }
  key(i: number): string | null {
    return [...this.m.keys()][i] ?? null;
  }
  removeItem(k: string): void {
    this.m.delete(k);
  }
  setItem(k: string, v: string): void {
    this.m.set(k, String(v));
  }
}

/** One BroadcastChannel bus per name; a message reaches every OTHER instance, like a real browser. */
class FakeBroadcastChannel {
  static all = new Map<string, Set<FakeBroadcastChannel>>();
  private listeners = new Set<(e: MessageEvent) => void>();
  constructor(readonly name: string) {
    const set = FakeBroadcastChannel.all.get(name) ?? new Set();
    set.add(this);
    FakeBroadcastChannel.all.set(name, set);
  }
  postMessage(data: unknown): void {
    for (const other of FakeBroadcastChannel.all.get(this.name) ?? []) {
      if (other !== this) queueMicrotask(() => other.listeners.forEach((l) => l({ data } as MessageEvent)));
    }
  }
  addEventListener(_t: string, l: (e: MessageEvent) => void): void {
    this.listeners.add(l);
  }
  removeEventListener(_t: string, l: (e: MessageEvent) => void): void {
    this.listeners.delete(l);
  }
  close(): void {
    FakeBroadcastChannel.all.get(this.name)?.delete(this);
  }
}

/** Minimal exclusive Web Locks: FIFO per name, supports AbortSignal while waiting. */
function makeLocks() {
  const tails = new Map<string, Promise<unknown>>();
  return {
    request(name: string, a: unknown, b?: unknown): Promise<unknown> {
      const opts = (typeof a === 'function' ? {} : a) as { signal?: AbortSignal };
      const cb = (typeof a === 'function' ? a : b) as () => unknown;
      const prev = tails.get(name) ?? Promise.resolve();
      let release!: () => void;
      const mine = new Promise<void>((r) => (release = r));
      tails.set(name, prev.then(() => mine));
      return new Promise((resolve, reject) => {
        let aborted = false;
        opts.signal?.addEventListener('abort', () => {
          aborted = true;
          release();
          reject(new DOMException('aborted', 'AbortError'));
        });
        void prev.then(async () => {
          if (aborted) return;
          try {
            resolve(await cb());
          } catch (e) {
            reject(e);
          } finally {
            release();
          }
        });
      });
    },
  };
}

export interface BrowserOptions {
  webLocks?: boolean;
}

/** Install the shared browser pieces (fetch, BroadcastChannel, optional Web Locks) for one test. */
export function installBrowser(server: FakeAuthServer, { webLocks = true }: BrowserOptions = {}): void {
  FakeBroadcastChannel.all.clear();
  vi.stubGlobal('fetch', vi.fn(server.fetch));
  vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel);
  Object.defineProperty(navigator, 'locks', { value: webLocks ? makeLocks() : undefined, configurable: true });
}

export function uninstallBrowser(): void {
  vi.unstubAllGlobals();
  Object.defineProperty(navigator, 'locks', { value: undefined, configurable: true });
  FakeBroadcastChannel.all.clear();
}

/** Make `window.sessionStorage` the given tab's storage (sessionStorage is per tab in a real browser). */
export function activateStorage(storage: Storage): void {
  Object.defineProperty(window, 'sessionStorage', { value: storage, configurable: true });
}
