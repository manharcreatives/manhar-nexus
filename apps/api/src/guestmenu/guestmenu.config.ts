import { isAbsolute, join } from 'node:path';

/**
 * Tunables of the QR digital menu (ADR-035). Everything is read from the environment per call, like
 * registration.limits.ts, so tests and operators can change a value without a rebuild. Invalid or non-positive
 * values silently fall back to the default (the env is optional for every variable here).
 */
function positiveInt(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

/** `GUESTMENU_<NAME>` integer. */
export function gm(name: string, fallback: number): number {
  return positiveInt(process.env[`GUESTMENU_${name}`], fallback);
}

/** Rate-limit knob `GUESTMENU_LIMIT_<NAME>` (requests per minute, or concurrent streams). */
export function limit(name: string, fallback: number): number {
  return positiveInt(process.env[`GUESTMENU_LIMIT_${name}`], fallback);
}

/** One-minute window used by every per-minute limit. */
export const WINDOW_MS = 60_000;

/** Defaults. Public wifi puts a whole dining room behind ONE IP, so the per-IP read limits are deliberately generous. */
export const LIMIT_DEFAULTS = {
  MENU_IP: 300,
  MENU_TOKEN: 900,
  BAD_TOKEN_IP: 30,
  GUEST_CREATE_IP: 20,
  GUEST_CREATE_TOKEN: 30,
  STATE_GUEST: 60,
  STATE_IP: 600,
  ORDER_GUEST: 4,
  ORDER_TOKEN: 20,
  ORDER_IP: 40,
  WAITER_GUEST: 6,
  WAITER_TOKEN: 12,
  WAITER_IP: 30,
  PAY_GUEST: 10,
  PAY_IP: 40,
  STREAM_OPEN_IP: 30,
  STREAM_CONCURRENT_IP: 20,
  STREAM_CONCURRENT_TOKEN: 60,
  MEDIA_IP: 1200,
} as const;

export const lim = (name: keyof typeof LIMIT_DEFAULTS): number => limit(name, LIMIT_DEFAULTS[name]);

export const caps = {
  /** Distinct lines per guest order. */
  maxLines: (): number => gm('MAX_LINES', 25),
  /** Quantity per line. */
  maxQty: (): number => gm('MAX_QTY', 20),
  /** Total quantity per order. */
  maxTotalQty: (): number => gm('MAX_TOTAL_QTY', 60),
  /** Guest orders waiting for confirmation, per table visit. */
  maxPendingOrders: (): number => gm('MAX_PENDING_ORDERS', 5),
  /** Guest device tokens per table visit. */
  maxGuestsPerSession: (): number => gm('MAX_GUESTS_PER_SESSION', 40),
  guestTokenTtlHours: (): number => gm('GUEST_TOKEN_TTL_HOURS', 12),
  /** A stream is closed (the browser reconnects and is re-validated) after this long. */
  streamMaxSeconds: (): number => gm('STREAM_MAX_SECONDS', 1800),
  /** Debounce of bus-driven fan-out. */
  hubDebounceMs: (): number => gm('HUB_DEBOUNCE_MS', 120),
  /** How long a resolved table token is cached in memory (invalidated on rotate / settings change in-process). */
  tokenCacheMs: (): number => gm('TOKEN_CACHE_MS', 3000),
  /** How long the business-level menu payload is cached (invalidated on in-process menu edits). */
  menuCacheMs: (): number => gm('MENU_CACHE_MS', 2000),
};

// ── Media ──────────────────────────────────────────────────────────────────────

/**
 * Directory of the local-disk ImageStore (env MEDIA_DIR). Development defaults to `./var/media` under the working directory.
 * In production there is NO default: an unset MEDIA_DIR means uploads answer 503 (so photos are never written to a
 * container layer that disappears on the next deploy); already-stored files keep being served.
 */
export function mediaDir(): string | null {
  const raw = process.env.MEDIA_DIR?.trim();
  if (raw) return isAbsolute(raw) ? raw : join(process.cwd(), raw);
  return process.env.NODE_ENV === 'production' ? null : join(process.cwd(), 'var', 'media');
}

/** Largest accepted upload in bytes (env MEDIA_MAX_UPLOAD_BYTES, default 6 MiB). */
export function mediaMaxBytes(): number {
  return positiveInt(process.env.MEDIA_MAX_UPLOAD_BYTES, 6 * 1024 * 1024);
}

/**
 * Public base that media paths are appended to when the PUBLIC menu returns absolute URLs.
 * MEDIA_PUBLIC_BASE_URL (e.g. https://app.example.com/api, no trailing slash) wins; otherwise the request origin.
 */
export function mediaPublicBase(req: { protocol: string; get(name: string): string | undefined }): string {
  const fixed = process.env.MEDIA_PUBLIC_BASE_URL?.trim().replace(/\/+$/, '');
  if (fixed) return fixed;
  const host = req.get('host') ?? 'localhost';
  // Behind Caddy (`handle_path /api/*` strips the prefix) the API sends X-Forwarded-Prefix: /api. Only honoured when a
  // proxy is trusted, and only as a plain path (letters, digits, `-`, `_`, `/`), so a client cannot inject a URL.
  const prefix = Number(process.env.TRUST_PROXY ?? 0) > 0 ? (req.get('x-forwarded-prefix') ?? '').trim().replace(/\/+$/, '') : '';
  return `${req.protocol}://${host}${/^\/[A-Za-z0-9_\-/]{0,60}$/.test(prefix) ? prefix : ''}`;
}

/** Optional web origin used to build the printable guest URL (QR_PUBLIC_BASE_URL, e.g. https://app.example.com). */
export function qrPublicBase(): string | null {
  const raw = process.env.QR_PUBLIC_BASE_URL?.trim().replace(/\/+$/, '');
  return raw ? raw : null;
}
