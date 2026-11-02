import { backoffDelay } from './backoff';
import { createSseParser, type SseMessage } from './sse';

export const TOPICS = ['orders', 'kitchen', 'tables', 'sessions', 'invoices', 'payments', 'expenses', 'notifications'] as const;
export type Topic = (typeof TOPICS)[number];
export type RealtimeStatus = 'connecting' | 'live' | 'polling' | 'reconnecting' | 'offline';

/** Shared surface for the SSE client and the serverless polling fallback. */
export interface RealtimeTransport {
  getStatus(): RealtimeStatus;
  subscribe(fn: (s: RealtimeSignal) => void): () => void;
  onStatus(fn: (s: RealtimeStatus) => void): () => void;
  start(locationId: string | null): void;
  stop(): void;
}

/** `resync` is synthetic: emitted on every (re)connect so pages refetch a fresh snapshot. */
export type RealtimeSignal = { kind: 'change'; topic: Topic; locationId: string | null } | { kind: 'resync' };

export interface RealtimeClientOptions {
  baseUrl: string;
  getToken: () => string | null;
  /** Silent token refresh (same path the api() helper uses). Resolves true when a new token is in place. */
  refresh: () => Promise<boolean>;
  fetchImpl?: typeof fetch;
  random?: () => number;
  /** Wait after `event: replaced` before reconnecting. */
  replacedBackoffMs?: number;
}

type Outcome = 'ended' | 'expired' | 'replaced' | 'unauthorized' | 'error';

const DEFAULT_HEARTBEAT_S = 20;
const isTopic = (v: unknown): v is Topic => typeof v === 'string' && (TOPICS as readonly string[]).includes(v);

/**
 * One SSE stream over fetch() (EventSource cannot send Authorization). Framework
 * free so it can be tested directly; RealtimeProvider owns the single instance.
 */
export class RealtimeClient implements RealtimeTransport {
  private status: RealtimeStatus = 'offline';
  private signalListeners = new Set<(s: RealtimeSignal) => void>();
  private statusListeners = new Set<(s: RealtimeStatus) => void>();
  private ctl: AbortController | null = null;
  private locationId: string | null = null;

  constructor(private readonly opts: RealtimeClientOptions) {}

  getStatus(): RealtimeStatus {
    return this.status;
  }

  subscribe(fn: (s: RealtimeSignal) => void): () => void {
    this.signalListeners.add(fn);
    return () => this.signalListeners.delete(fn);
  }

  onStatus(fn: (s: RealtimeStatus) => void): () => void {
    this.statusListeners.add(fn);
    return () => this.statusListeners.delete(fn);
  }

  /** (Re)start for a working location; any previous stream is aborted first. */
  start(locationId: string | null): void {
    this.abort();
    this.locationId = locationId;
    const ctl = new AbortController();
    this.ctl = ctl;
    this.setStatus('connecting');
    void this.run(ctl);
  }

  /** Abort the stream (sign-out, unmount, hidden tab). */
  stop(): void {
    this.abort();
    this.setStatus('offline');
  }

  private abort() {
    this.ctl?.abort();
    this.ctl = null;
  }

  private setStatus(s: RealtimeStatus) {
    if (this.status === s) return;
    this.status = s;
    for (const fn of [...this.statusListeners]) fn(s);
  }

  private emit(sig: RealtimeSignal) {
    for (const fn of [...this.signalListeners]) {
      try {
        fn(sig);
      } catch {
        /* one bad subscriber must not break the stream */
      }
    }
  }

  private sleep(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve) => {
      if (signal.aborted) return resolve();
      const t = setTimeout(done, ms);
      function done() {
        clearTimeout(t);
        signal.removeEventListener('abort', done);
        resolve();
      }
      signal.addEventListener('abort', done);
    });
  }

  private async run(ctl: AbortController): Promise<void> {
    const { random = Math.random, replacedBackoffMs = 30_000 } = this.opts;
    const signal = ctl.signal;
    let attempt = 0;
    let first = true;
    let lastUnauthorized = false;
    const reset = () => {
      attempt = 0;
      lastUnauthorized = false;
    };

    while (!signal.aborted) {
      this.setStatus(first ? 'connecting' : 'reconnecting');
      let outcome: Outcome;
      try {
        outcome = await this.connectOnce(signal, reset);
      } catch {
        outcome = 'error';
      }
      if (signal.aborted) return;
      first = false;
      this.setStatus('reconnecting');

      if (outcome === 'expired' || outcome === 'unauthorized') {
        const refreshed = await this.opts.refresh().catch(() => false);
        if (signal.aborted) return;
        const repeated = outcome === 'unauthorized' && lastUnauthorized;
        lastUnauthorized = outcome === 'unauthorized';
        if (refreshed && !repeated) continue; // new token: reconnect straight away
        await this.sleep(backoffDelay(attempt++, random), signal);
      } else if (outcome === 'replaced') {
        await this.sleep(replacedBackoffMs, signal);
      } else {
        await this.sleep(backoffDelay(attempt++, random), signal);
      }
    }
  }

  private async connectOnce(outer: AbortSignal, onLive: () => void): Promise<Outcome> {
    const conn = new AbortController();
    const abortConn = () => conn.abort();
    outer.addEventListener('abort', abortConn);
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    let silenceMs = 40_000;
    const arm = () => {
      clearTimeout(watchdog);
      watchdog = setTimeout(() => {
        conn.abort();
        void reader?.cancel().catch(() => undefined); // unblocks a pending read()
      }, silenceMs);
    };
    try {
      const token = this.opts.getToken();
      if (!token) return 'unauthorized';
      const qs = this.locationId ? `?locationId=${encodeURIComponent(this.locationId)}` : '';
      const doFetch = this.opts.fetchImpl ?? fetch;
      arm();
      const res = await doFetch(`${this.opts.baseUrl}/admin/realtime/stream${qs}`, {
        headers: { authorization: `Bearer ${token}`, accept: 'text/event-stream' },
        cache: 'no-store',
        signal: conn.signal,
      });
      if (res.status === 401) return 'unauthorized';
      if (!res.ok || !res.body) return 'error';
      reader = res.body.getReader();
      const decoder = new TextDecoder();
      const parser = createSseParser();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) return 'ended';
        arm();
        for (const msg of parser.push(decoder.decode(value, { stream: true }))) {
          const result = this.handle(msg, onLive, (s) => {
            silenceMs = s;
          });
          if (result) return result;
        }
      }
    } finally {
      clearTimeout(watchdog);
      outer.removeEventListener('abort', abortConn);
      void reader?.cancel().catch(() => undefined);
      conn.abort();
    }
  }

  private handle(msg: SseMessage, onLive: () => void, setSilence: (ms: number) => void): Outcome | undefined {
    switch (msg.event) {
      case 'hello': {
        let hb = DEFAULT_HEARTBEAT_S;
        try {
          const n = Number((JSON.parse(msg.data) as { heartbeatSeconds?: unknown }).heartbeatSeconds);
          if (Number.isFinite(n) && n > 0) hb = n;
        } catch {
          /* keep the default */
        }
        setSilence(hb * 2.5 * 1000);
        onLive();
        this.setStatus('live');
        this.emit({ kind: 'resync' });
        return undefined;
      }
      case 'change': {
        try {
          const d = JSON.parse(msg.data) as { topic?: unknown; locationId?: unknown };
          if (isTopic(d.topic)) this.emit({ kind: 'change', topic: d.topic, locationId: typeof d.locationId === 'string' ? d.locationId : null });
        } catch {
          /* malformed frame: ignore */
        }
        return undefined;
      }
      case 'expired':
        return 'expired';
      case 'replaced':
        return 'replaced';
      default:
        return undefined;
    }
  }
}
