import type {
  ByeReason, GuestSession, MenuCategory, MenuItem, MenuPayload, PayIntent, PlaceOrderBody, PlaceOrderResult, StreamEventName, StreamHandlers,
  TableState, WaiterReason,
} from './types';
import { STREAM_EVENTS } from './types';

/** Same base the staff app uses (src/auth/api.ts; `/api` behind Caddy). Duplicated on purpose: this chunk must not import auth code. */
export const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000';

/** Error envelope of the API: `{ statusCode, error: { code, message, details? } }`. */
export type ApiErrorCode =
  | 'MENU_DISABLED' | 'ORDERING_OFF' | 'TABLE_CLOSED' | 'GUEST_TOKEN_INVALID' | 'ORDERING_LOCKED' | 'SOLD_OUT'
  | 'IDEMPOTENCY_KEY_REUSED' | 'BILL_NOT_READY' | 'UPI_UNAVAILABLE' | 'RATE_LIMITED' | 'VALIDATION' | 'NOT_FOUND';

export type ApiErrorKind = 'network' | 'timeout' | 'not-found' | 'disabled' | 'ordering-off' | 'auth' | 'rate' | 'invalid' | 'conflict' | 'server';

export class ApiError extends Error {
  constructor(
    readonly kind: ApiErrorKind,
    readonly status: number,
    message: string,
    readonly retryAfterSec?: number,
    /** The API's stable machine code, e.g. `SOLD_OUT`. Undefined for network errors and proxy pages. */
    readonly code?: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
  /** Worth retrying automatically (no answer from the server yet). */
  get transient(): boolean {
    return this.kind === 'network' || this.kind === 'timeout' || this.kind === 'server' || this.kind === 'rate';
  }
  /** `details.reason` of validation/limit errors (VARIANT_REQUIRED, ITEM_NOT_ON_MENU, PENDING_ORDERS, BAD_TOKEN, ...). */
  get reason(): string | undefined {
    const r = this.details?.reason;
    return typeof r === 'string' ? r : undefined;
  }
}

export function classify(status: number, code?: string): ApiErrorKind {
  if (status === 401) return 'auth';
  if (status === 403) return code === 'ORDERING_OFF' ? 'ordering-off' : 'disabled';
  if (status === 404 || status === 410) return 'not-found';
  if (status === 409) return 'conflict';
  if (status === 429) return 'rate';
  if (status === 400 || status === 413 || status === 415 || status === 422) return 'invalid';
  return 'server';
}

interface ErrorEnvelope { code?: string; message?: string; details?: Record<string, unknown> }

function envelopeOf(body: unknown): ErrorEnvelope {
  if (body && typeof body === 'object') {
    const e = (body as { error?: unknown }).error;
    if (e && typeof e === 'object') {
      const o = e as Record<string, unknown>;
      return {
        code: typeof o.code === 'string' ? o.code : undefined,
        message: typeof o.message === 'string' ? o.message : undefined,
        details: o.details && typeof o.details === 'object' ? (o.details as Record<string, unknown>) : undefined,
      };
    }
  }
  return {};
}

export type MenuResult = { status: 'ok'; data: MenuPayload } | { status: 'not-modified' };

export interface MenuApi {
  readonly mock: boolean;
  getMenu(etag?: string | null, signal?: AbortSignal): Promise<MenuResult>;
  createGuest(displayName?: string): Promise<GuestSession>;
  getState(guestToken: string, signal?: AbortSignal): Promise<TableState>;
  placeOrder(guestToken: string, body: PlaceOrderBody, idempotencyKey: string): Promise<PlaceOrderResult>;
  callWaiter(guestToken: string | null, reason: WaiterReason): Promise<void>;
  payIntent(guestToken: string | null): Promise<PayIntent>;
  /** Opens the live stream (auto-reconnect with backoff); returns a closer. Events are hints: the client re-reads state after them. */
  openStream(handlers: StreamHandlers): () => void;
}

const TIMEOUT_MS = 15000;

interface Reply<T> { status: number; body: T | null; headers: Headers }

async function request<T>(url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<Reply<T>> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort('timeout'), init.timeoutMs ?? TIMEOUT_MS);
  const outer = init.signal;
  const onOuter = () => ctl.abort('aborted');
  if (outer) {
    if (outer.aborted) ctl.abort('aborted');
    else outer.addEventListener('abort', onOuter, { once: true });
  }
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: ctl.signal, credentials: 'omit' });
  } catch (e) {
    if (outer?.aborted) throw e;
    if (ctl.signal.aborted) throw new ApiError('timeout', 0, 'The connection is slow.');
    throw new ApiError('network', 0, 'No connection.');
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener('abort', onOuter);
  }
  if (res.status === 304) return { status: 304, body: null, headers: res.headers };
  let body: unknown = null;
  const text = await res.text().catch(() => '');
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null; // a proxy error page, not our envelope
    }
  }
  if (!res.ok) {
    const env = envelopeOf(body);
    const hdr = Number(res.headers.get('Retry-After'));
    const det = Number(env.details?.retryAfterSeconds);
    const retry = Number.isFinite(hdr) && hdr > 0 ? hdr : Number.isFinite(det) && det > 0 ? det : undefined;
    throw new ApiError(classify(res.status, env.code), res.status, env.message ?? `Request failed (${res.status}).`, retry, env.code, env.details);
  }
  return { status: res.status, body: body as T, headers: res.headers };
}

const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

/** Defensive: the page never crashes on a missing array, whatever an old cache or a proxy hands it. */
export function normalizeMenu(raw: MenuPayload, headerEtag?: string | null): MenuPayload {
  const items = arr<MenuItem>(raw.items).map((i) => ({
    ...i,
    description: str(i.description),
    imageUrl: str(i.imageUrl),
    thumbUrl: str(i.thumbUrl),
    blurDataUri: str(i.blurDataUri),
    color: str(i.color),
    veg: i.veg ?? null,
    spice: typeof i.spice === 'number' ? i.spice : null,
    tags: arr<string>(i.tags),
    variants: arr<MenuItem['variants'][number]>(i.variants),
    addOnGroups: arr<MenuItem['addOnGroups'][number]>(i.addOnGroups).map((g) => ({ ...g, options: arr<MenuItem['addOnGroups'][number]['options'][number]>(g.options) })),
  }));
  const categories = arr<MenuCategory>(raw.categories).map((c) => ({
    ...c,
    description: str(c.description),
    imageUrl: str(c.imageUrl),
    blurDataUri: str(c.blurDataUri),
    color: str(c.color),
  }));
  return { ...raw, items, categories, etag: raw.etag || headerEtag || '' };
}

export function normalizeState(raw: Partial<TableState> | null): TableState {
  return {
    orders: arr<TableState['orders'][number]>(raw?.orders).map((o) => ({ ...o, lines: arr(o.lines), timeline: arr(o.timeline) })),
    bill: raw?.bill ? { ...raw.bill, taxLines: arr(raw.bill.taxLines) } : null,
    waiterCall: raw?.waiterCall && raw.waiterCall.open ? raw.waiterCall : { open: false },
  };
}

/** Reconnect delay: 1 s, 2 s, 4 s ... capped at 30 s, with +-30 % jitter so a restart does not stampede. */
export function backoffMs(attempt: number, rnd: () => number = Math.random): number {
  const base = Math.min(30000, 1000 * 2 ** Math.max(0, attempt));
  return Math.round(base * (0.7 + rnd() * 0.6));
}

export function createHttpApi(tableToken: string, apiBase: string = API_BASE): MenuApi {
  const base = `${apiBase}/public/menu/${encodeURIComponent(tableToken)}`;
  const jsonHeaders = (guest?: string | null, extra?: Record<string, string>): Record<string, string> => ({
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(guest ? { 'X-Guest-Token': guest } : {}),
    ...extra,
  });
  return {
    mock: false,
    async getMenu(etag, signal) {
      const r = await request<MenuPayload>(base, {
        method: 'GET',
        signal,
        headers: { Accept: 'application/json', ...(etag ? { 'If-None-Match': etag } : {}) },
      });
      if (r.status === 304 || !r.body) return { status: 'not-modified' };
      return { status: 'ok', data: normalizeMenu(r.body, r.headers.get('ETag')) };
    },
    async createGuest(displayName) {
      const r = await request<GuestSession>(`${base}/guest`, {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify(displayName ? { displayName } : {}),
      });
      if (!r.body?.guestToken) throw new ApiError('server', 500, 'Could not start your table session.');
      return r.body;
    },
    async getState(guestToken, signal) {
      const r = await request<Partial<TableState>>(`${base}/state`, { method: 'GET', signal, headers: jsonHeaders(guestToken) });
      return normalizeState(r.body);
    },
    async placeOrder(guestToken, body, idempotencyKey) {
      const r = await request<Omit<PlaceOrderResult, 'replayed'>>(`${base}/orders`, {
        method: 'POST',
        headers: jsonHeaders(guestToken, { 'Idempotency-Key': idempotencyKey }),
        body: JSON.stringify(body),
      });
      if (!r.body?.orderId) throw new ApiError('server', 500, 'The restaurant did not confirm your order. Check "Your table" before retrying.');
      return { ...r.body, replayed: r.headers.get('Idempotent-Replay') === 'true' || r.status === 200 };
    },
    async callWaiter(guestToken, reason) {
      await request(`${base}/waiter`, { method: 'POST', headers: jsonHeaders(guestToken), body: JSON.stringify({ reason }) });
    },
    async payIntent(guestToken) {
      const r = await request<PayIntent>(`${base}/pay-intent`, {
        method: 'POST',
        headers: jsonHeaders(guestToken),
        body: JSON.stringify({ method: 'upi' }),
      });
      if (!r.body?.upiUri) throw new ApiError('server', 500, 'UPI is not available right now.');
      return { ...r.body, qrPayload: r.body.qrPayload || r.body.upiUri };
    },
    openStream(h) {
      return openEventStream(`${base}/stream`, h);
    },
  };
}

/** Minimal surface of EventSource that the stream needs (lets tests inject a fake). */
export interface EventSourceLike {
  readyState: number;
  onopen: ((e: Event) => void) | null;
  onerror: ((e: Event) => void) | null;
  addEventListener(type: string, listener: (e: MessageEvent) => void): void;
  close(): void;
}
export type EventSourceFactory = (url: string) => EventSourceLike;

const CLOSED = 2; // EventSource.CLOSED

/**
 * SSE with our own reconnect policy on top of the browser's:
 *  - the browser retries by itself while the socket is merely dropped (readyState CONNECTING);
 *  - when it gives up (readyState CLOSED: a 4xx/5xx answer such as 429 or a proxy hiccup) we reopen with exponential backoff;
 *  - a `bye` event (server recycles the stream every 30 min, or the table token was rotated/disabled) closes it and we
 *    reopen at once ('refresh') or with backoff (anything else); the owner of the hook re-reads the menu on `bye`.
 * Polling in useSession is the safety net while the stream is down.
 */
export function openEventStream(
  url: string,
  h: StreamHandlers,
  factory: EventSourceFactory | undefined = typeof EventSource === 'undefined' ? undefined : (u) => new EventSource(u) as unknown as EventSourceLike,
  rnd: () => number = Math.random,
): () => void {
  if (!factory) {
    h.onError();
    return () => undefined;
  }
  let es: EventSourceLike | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let closed = false;
  let attempt = 0;

  const parse = (e: MessageEvent): unknown => {
    try {
      return JSON.parse(e.data as string);
    } catch {
      return null;
    }
  };
  const schedule = (ms?: number) => {
    if (closed) return;
    clearTimeout(timer);
    const wait = ms ?? backoffMs(attempt, rnd);
    attempt += 1;
    timer = setTimeout(connect, wait);
  };
  const connect = () => {
    if (closed) return;
    const src = factory(url);
    es = src;
    src.onopen = () => {
      attempt = 0;
      h.onOpen();
    };
    src.onerror = () => {
      h.onError();
      if (src.readyState === CLOSED) {
        src.close();
        if (es === src) es = null;
        schedule();
      }
    };
    for (const name of STREAM_EVENTS) {
      src.addEventListener(name, (e) => {
        const data = parse(e);
        if (name === 'bye') {
          src.close();
          if (es === src) es = null;
          h.onEvent('bye', data);
          const reason = (data as { reason?: ByeReason } | null)?.reason;
          schedule(reason === 'refresh' ? 0 : undefined);
          return;
        }
        h.onEvent(name as StreamEventName, data);
      });
    }
  };
  connect();
  return () => {
    closed = true;
    clearTimeout(timer);
    es?.close();
    es = null;
  };
}

/** Mock-mode options (`?mock=1`, dev/test builds only). */
export interface MockOptions { mode: 'confirm' | 'auto' | 'off' | 'closed'; outcome: 'accept' | 'reject' | 'edit'; fast: boolean; slowMs: number; offline: boolean }

export function parseMockOptions(search: string): MockOptions {
  const q = new URLSearchParams(search);
  const m = q.get('mode');
  const o = q.get('outcome');
  return {
    mode: m === 'auto' || m === 'off' || m === 'closed' ? m : 'confirm',
    outcome: o === 'reject' || o === 'edit' ? o : 'accept',
    fast: q.get('fast') === '1',
    slowMs: Number(q.get('slow')) || 0,
    offline: q.get('offline') === '1',
  };
}

/** The mock lives in its own lazy chunk: production visitors never download it. */
export async function loadApi(tableToken: string, mock: MockOptions | null): Promise<MenuApi> {
  if (mock) {
    const { createMockApi } = await import('./mock');
    return createMockApi(mock);
  }
  return createHttpApi(tableToken);
}

export type { StreamEventName };
