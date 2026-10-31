/**
 * Per-tab session bookkeeping (ADR-034). Everything here is NON-SECRET: a random slot id, two flags and
 * "something changed" signals. No token, no credential and no user data is ever stored or broadcast here.
 *
 *  - slot id (sessionStorage `nx.slot`): names this tab's own refresh cookie (`nexus_rt_<slot>`, HttpOnly, held
 *    by the browser, invisible to JavaScript). sessionStorage is per tab, so each tab can be a different user.
 *  - detached flag (sessionStorage `nx.detached`): this tab must not adopt the device-wide session; it signs in
 *    on its own.
 *  - BroadcastChannel `nx-auth`: lets device-session tabs learn that the device session was created or ended.
 *  - Web Locks: serialise refresh-token rotation across tabs that share a cookie, and detect a duplicated tab
 *    (browsers copy sessionStorage on "Duplicate tab") so two live tabs never share one slot.
 */

const SLOT_KEY = 'nx.slot';
const DETACHED_KEY = 'nx.detached';
const CHANNEL = 'nx-auth';

/** Header the API reads to pick the per-tab refresh cookie. */
export const SLOT_HEADER = 'x-nexus-slot';

// In-memory mirrors: they keep a tab working when sessionStorage is blocked (the slot then lasts until reload).
let memSlot: string | null = null;
let memDetached = false;

function ss(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/** 32 random hex chars (128 bits). Not a secret; random so slots never collide and cannot be guessed to attack another tab. */
export function newSlotId(): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

const SLOT_SHAPE = /^[A-Za-z0-9]{16,64}$/;

export function readSlot(): string | null {
  let v: string | null = null;
  try {
    v = ss()?.getItem(SLOT_KEY) ?? null;
  } catch {
    v = null;
  }
  v = v ?? memSlot;
  return v && SLOT_SHAPE.test(v) ? v : null;
}

export function writeSlot(slot: string): void {
  memSlot = slot;
  try {
    ss()?.setItem(SLOT_KEY, slot);
  } catch {
    /* storage blocked: the in-memory copy still serves this page load */
  }
}

export function clearSlot(): void {
  memSlot = null;
  try {
    ss()?.removeItem(SLOT_KEY);
  } catch {
    /* ignore */
  }
}

export function isDetached(): boolean {
  try {
    if (ss()?.getItem(DETACHED_KEY) === '1') return true;
  } catch {
    /* fall through to the memory flag */
  }
  return memDetached;
}

export function setDetached(on: boolean): void {
  memDetached = on;
  try {
    if (on) ss()?.setItem(DETACHED_KEY, '1');
    else ss()?.removeItem(DETACHED_KEY);
  } catch {
    /* ignore */
  }
}

/** This tab's own session is gone (signed out, revoked, cookie lost): drop the slot and stay off the device session. */
export function forgetSlotAndDetach(): void {
  clearSlot();
  setDetached(true);
}

/** 'tab' = this tab owns a slot (its own session); 'device' = the browser-wide remembered session. */
export type SessionKind = 'device' | 'tab';
export function sessionKind(): SessionKind {
  return readSlot() ? 'tab' : 'device';
}

// ── Web Locks ────────────────────────────────────────────────────────────────

interface LockManagerLike {
  request(name: string, callback: () => unknown): Promise<unknown>;
  request(name: string, options: { signal?: AbortSignal }, callback: () => unknown): Promise<unknown>;
}
function locks(): LockManagerLike | null {
  const l = (typeof navigator !== 'undefined' ? (navigator as unknown as { locks?: LockManagerLike }).locks : undefined) ?? null;
  return l && typeof l.request === 'function' ? l : null;
}

/**
 * Run `fn` while holding a cross-tab lock. Used around refresh so two tabs that share one cookie rotate it one at
 * a time: the second tab then sends the already-rotated cookie instead of the stale one (which the server would
 * treat as token theft). Without the Web Locks API (older browsers, jsdom) `fn` simply runs.
 */
export async function withCrossTabLock<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const l = locks();
  if (!l) return fn();
  return (await l.request(`nx-lock:${name}`, () => fn())) as T;
}

const claimed = new Set<string>();

/**
 * Claim `slot` for this document for its whole lifetime. Resolves false when ANOTHER live tab already owns it,
 * which happens when the browser duplicated the tab (sessionStorage is copied). The caller then drops the slot and
 * shows a sign-in, so two tabs never share a session by accident. A reload re-claims: the previous document's lock
 * is released as it unloads, hence the short wait before concluding the slot is taken.
 */
export function claimSlot(slot: string, waitMs = 400): Promise<boolean> {
  if (claimed.has(slot)) return Promise.resolve(true);
  const l = locks();
  if (!l) {
    claimed.add(slot);
    return Promise.resolve(true);
  }
  return new Promise<boolean>((resolve) => {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), waitMs);
    l.request(`nx-slot:${slot}`, { signal: ac.signal }, () => {
      clearTimeout(timer);
      claimed.add(slot);
      resolve(true);
      return new Promise<void>(() => undefined); // never settles: held until this document goes away
    }).catch(() => {
      clearTimeout(timer);
      resolve(false); // aborted while waiting: another live tab holds the slot
    });
  });
}

/** Test helper: forget in-memory claims. */
export function resetTabSessionForTests(): void {
  claimed.clear();
  memSlot = null;
  memDetached = false;
  try {
    if (channel) channel.close();
  } catch {
    /* ignore */
  }
  channel = undefined;
}

// ── Non-secret cross-tab signals ─────────────────────────────────────────────

export type AuthSignal = 'device-signed-in' | 'device-signed-out';

let channel: BroadcastChannel | null | undefined;
function chan(): BroadcastChannel | null {
  if (channel !== undefined) return channel;
  try {
    channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel(CHANNEL) : null;
  } catch {
    channel = null;
  }
  return channel;
}

/** Tell the other tabs that the DEVICE session changed. Carries only the signal name. */
export function broadcastAuth(signal: AuthSignal): void {
  try {
    chan()?.postMessage({ type: signal });
  } catch {
    /* best effort */
  }
}

/** Listen for device-session signals from other tabs. Returns the unsubscribe function. */
export function onAuthSignal(handler: (signal: AuthSignal) => void): () => void {
  const c = chan();
  if (!c) return () => undefined;
  const listener = (e: MessageEvent) => {
    const type = (e.data as { type?: unknown } | null)?.type;
    if (type === 'device-signed-in' || type === 'device-signed-out') handler(type);
  };
  c.addEventListener('message', listener);
  return () => c.removeEventListener('message', listener);
}
