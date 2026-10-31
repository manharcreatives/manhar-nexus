/**
 * Refresh-cookie naming for per-tab sessions (ADR-034).
 *
 * Two kinds of browser session exist side by side:
 *  - DEVICE session: the original cookie `nexus_refresh` (persistent, shared by every tab of the browser
 *    profile). Used when the client sends no slot header. This is the single-user "remember this device" path.
 *  - TAB session: one cookie per slot, `nexus_rt_<slot>`, where `<slot>` is a random, non-secret id the tab
 *    keeps in sessionStorage and sends in the `X-Nexus-Slot` header. The cookie is still HttpOnly, SameSite=Strict
 *    and path-scoped to /auth; only its NAME varies, so two tabs can hold two different users' sessions.
 *
 * The slot id is not a credential: knowing it grants nothing, the cookie value (opaque refresh token) is.
 */

export const DEVICE_REFRESH_COOKIE = 'nexus_refresh';
export const SLOT_COOKIE_PREFIX = 'nexus_rt_';
export const SLOT_HEADER = 'x-nexus-slot';

/** Slot ids are 16-64 chars of [A-Za-z0-9]: safe in a cookie name and in a header, no separators or controls. */
const SLOT_RE = /^[A-Za-z0-9]{16,64}$/;

/** At most this many live tab-session cookies are kept per browser; the least recently used are evicted on login. */
export const MAX_SLOT_COOKIES = 24;

export function isValidSlot(slot: string): boolean {
  return SLOT_RE.test(slot);
}

export function slotCookieName(slot: string): string {
  return `${SLOT_COOKIE_PREFIX}${slot}`;
}

/** `nexus_rt_<slot>` -> slot, or null when the name is not a well-formed slot cookie. */
export function slotFromCookieName(name: string): string | null {
  if (!name.startsWith(SLOT_COOKIE_PREFIX)) return null;
  const slot = name.slice(SLOT_COOKIE_PREFIX.length);
  return isValidSlot(slot) ? slot : null;
}

export interface SlotCookieState {
  name: string;
  /** The cookie maps to a refresh token whose session is live (unrevoked, unexpired). */
  alive: boolean;
  /** Session.lastSeenAt epoch ms (0 when unknown). Orders eviction among live cookies. */
  lastSeenMs: number;
}

/**
 * Which tab-session cookies to expire on a successful login: every dead one (unknown token, revoked or expired
 * session), then, if still above `max`, the least recently used live ones. Pure so it can be unit-tested.
 */
export function selectSlotCookiesToDrop(states: SlotCookieState[], max: number = MAX_SLOT_COOKIES): string[] {
  const drop = states.filter((s) => !s.alive).map((s) => s.name);
  const live = states.filter((s) => s.alive).sort((a, b) => a.lastSeenMs - b.lastSeenMs);
  const excess = live.length - max;
  if (excess > 0) drop.push(...live.slice(0, excess).map((s) => s.name));
  return drop;
}
