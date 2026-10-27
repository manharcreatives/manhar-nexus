import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { getAccessToken, tryRefresh } from '../auth/api';
import { useAuth } from '../auth/AuthContext';
import { useWorkLocation } from '../context/LocationContext';
import { createCoalescer } from './coalesce';
import { RealtimeClient, type RealtimeSignal, type RealtimeStatus, type Topic } from './client';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000';
/** A tab hidden longer than this drops its stream and resyncs on return. */
export const HIDDEN_PAUSE_MS = 60_000;
export const COALESCE_MS = 150;

interface RealtimeApi {
  /** False when no stream is (or can be) open: platform realm, signed out, or no provider. */
  enabled: boolean;
  status: RealtimeStatus;
  subscribe: (fn: (s: RealtimeSignal) => void) => () => void;
}

const NOOP_API: RealtimeApi = { enabled: false, status: 'offline', subscribe: () => () => undefined };
const Ctx = createContext<RealtimeApi>(NOOP_API);

export interface RealtimeProviderCoreProps {
  children: ReactNode;
  /** Connect only when true (tenant user, signed in, location resolved). */
  enabled: boolean;
  locationId: string | null;
  /** Injectable for tests; defaults to a client wired to the api() token + silent refresh. */
  client?: RealtimeClient;
}

/** Owns the single stream for this tab and fans signals out to subscribers. */
export function RealtimeProviderCore({ children, enabled, locationId, client: injected }: RealtimeProviderCoreProps) {
  const client = useMemo(
    () => injected ?? new RealtimeClient({ baseUrl: API_BASE, getToken: getAccessToken, refresh: tryRefresh }),
    [injected],
  );
  const [status, setStatus] = useState<RealtimeStatus>(client.getStatus());

  useEffect(() => {
    setStatus(client.getStatus());
    return client.onStatus(setStatus);
  }, [client]);

  useEffect(() => {
    if (!enabled) {
      client.stop();
      return;
    }
    let hiddenTimer: ReturnType<typeof setTimeout> | undefined;
    let paused = false;
    const open = () => {
      paused = false;
      client.start(locationId);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        clearTimeout(hiddenTimer);
        hiddenTimer = setTimeout(() => {
          paused = true;
          client.stop();
        }, HIDDEN_PAUSE_MS);
      } else {
        clearTimeout(hiddenTimer);
        if (paused) open(); // hello on the new stream triggers a resync
      }
    };
    open();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      clearTimeout(hiddenTimer);
      client.stop();
    };
  }, [client, enabled, locationId]);

  const value = useMemo<RealtimeApi>(
    () => ({ enabled, status, subscribe: (fn) => client.subscribe(fn) }),
    [enabled, status, client],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/**
 * Mount once inside AuthProvider + WorkLocationProvider. Connects for tenant
 * (BUSINESS) users only (once the working location has resolved, so the first
 * stream already carries it); the platform realm never opens a stream.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { status: authStatus, user } = useAuth();
  const { locationId, status: locStatus } = useWorkLocation();
  const enabled = authStatus === 'authenticated' && user?.realm === 'BUSINESS' && Boolean(user.businessId) && (locStatus === 'ready' || locStatus === 'error');
  return (
    <RealtimeProviderCore enabled={enabled} locationId={locationId}>
      {children}
    </RealtimeProviderCore>
  );
}

export function useRealtimeStatus(): RealtimeStatus {
  return useContext(Ctx).status;
}

/** True when a stream is wanted for this session (the badge hides itself otherwise). */
export function useRealtimeEnabled(): boolean {
  return useContext(Ctx).enabled;
}

/**
 * Calls `onChange` when any of `topics` changes, and on every (re)connect.
 * Bursts are coalesced into one call per ~150 ms; unsubscribes on unmount.
 */
export function useRealtimeTopics(topics: readonly Topic[], onChange: () => void): void {
  const { subscribe } = useContext(Ctx);
  const latest = useRef(onChange);
  useEffect(() => {
    latest.current = onChange;
  });
  const key = topics.join(',');
  useEffect(() => {
    if (key === '') return;
    const wanted = new Set(key.split(',') as Topic[]);
    const co = createCoalescer(() => latest.current(), COALESCE_MS);
    const off = subscribe((sig) => {
      if (sig.kind === 'resync' || wanted.has(sig.topic)) co.trigger();
    });
    return () => {
      off();
      co.cancel();
    };
  }, [key, subscribe]);
}

const POLL_LIVE_MS = 60_000;
const POLL_DEGRADED_MS = 15_000;

/**
 * Realtime refetch plus a safety-net poll: every 60 s while the stream is
 * live, every 15 s when it is not (also the behaviour with no provider).
 * Hidden tabs do not poll. `load` may change identity freely.
 */
export function useLiveRefresh(topics: readonly Topic[], load: () => unknown, enabled = true): void {
  const status = useRealtimeStatus();
  const latest = useRef(load);
  useEffect(() => {
    latest.current = load;
  });
  useRealtimeTopics(enabled ? topics : [], () => void latest.current());
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(
      () => {
        if (document.visibilityState !== 'hidden') void latest.current();
      },
      status === 'live' ? POLL_LIVE_MS : POLL_DEGRADED_MS,
    );
    return () => clearInterval(id);
  }, [status, enabled]);
}
