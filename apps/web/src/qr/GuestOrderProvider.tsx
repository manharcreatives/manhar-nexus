import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveRefresh } from '../realtime/RealtimeProvider';
import { useToast } from '../ui/Toast';
import { qrApi } from './api';
import { getSoundPref, isAudioUnlocked, playChime, setSoundPref, unlockAudio } from './chime';
import type { GuestOrder, WaiterAlert } from './types';

export interface TableGuestInfo {
  /** Guest orders waiting for confirmation on the table. */
  pending: number;
  /** Open waiter call / bill request, if any. */
  call: WaiterAlert | null;
}

export interface GuestOrderState {
  /** False when the user may not handle guest orders (everything below stays empty). */
  enabled: boolean;
  loaded: boolean;
  /** The last load failed (old data stays on screen). */
  failed: boolean;
  /** Awaiting confirmation, oldest first. */
  orders: GuestOrder[];
  calls: WaiterAlert[];
  /** Orders waiting + open calls: the nav badge. */
  attention: number;
  byTable: ReadonlyMap<string, TableGuestInfo>;
  refresh: () => void;
  dropOrder: (id: string) => void;
  dropCall: (tableId: string) => void;
  sound: {
    on: boolean;
    /** Audio can actually play (a user gesture has unlocked it). */
    unlocked: boolean;
    setOn: (on: boolean) => void;
    /** Unlock from a click and play a sample. */
    test: () => void;
  };
}

const EMPTY_MAP: ReadonlyMap<string, TableGuestInfo> = new Map();
const NOOP: GuestOrderState = {
  enabled: false,
  loaded: false,
  failed: false,
  orders: [],
  calls: [],
  attention: 0,
  byTable: EMPTY_MAP,
  refresh: () => undefined,
  dropOrder: () => undefined,
  dropCall: () => undefined,
  sound: { on: false, unlocked: false, setOn: () => undefined, test: () => undefined },
};

const Ctx = createContext<GuestOrderState>(NOOP);

export const useGuestOrders = (): GuestOrderState => useContext(Ctx);

const callKey = (c: WaiterAlert) => `${c.tableId}|${c.at}|${c.reason}`;

/**
 * One loader for the whole app shell: the inbox page, the nav badge and the Tables page chips
 * read the same state, so there is a single request stream, one chime and one toast per event.
 * Mount once inside the Toast + Realtime providers.
 */
export function GuestOrderProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [orders, setOrders] = useState<GuestOrder[]>([]);
  const [calls, setCalls] = useState<WaiterAlert[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [soundOn, setSoundOn] = useState(getSoundPref);
  const [unlocked, setUnlocked] = useState(isAudioUnlocked);

  const seenOrders = useRef<Set<string> | null>(null);
  const seenCalls = useRef<Set<string> | null>(null);
  const inFlight = useRef(false);
  const rerun = useRef(false);
  const soundRef = useRef(soundOn);
  soundRef.current = soundOn;
  const tRef = useRef(t);
  tRef.current = t;
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const announce = useCallback((kind: 'order' | 'call', text: string) => {
    toastRef.current.show(text, 'info');
    if (soundRef.current && !playChime(kind)) setUnlocked(false);
  }, []);

  const load = useCallback(async function run(): Promise<void> {
    if (inFlight.current) {
      rerun.current = true;
      return;
    }
    inFlight.current = true;
    try {
      const [nextOrders, nextCalls] = await Promise.all([qrApi.pendingOrders(), qrApi.alerts()]);
      const sorted = [...nextOrders].sort((a, b) => a.placedAt.localeCompare(b.placedAt));
      setOrders(sorted);
      setCalls(nextCalls);
      setFailed(false);
      setLoaded(true);

      // Chime + toast only for things that arrived after the first load.
      const orderIds = new Set(sorted.map((o) => o.id));
      if (seenOrders.current) {
        const fresh = sorted.filter((o) => !seenOrders.current?.has(o.id));
        if (fresh.length > 0) {
          const first = fresh[0];
          announce(
            'order',
            fresh.length === 1
              ? tRef.current('qr.orders.toastOne', { table: first.tableCode })
              : tRef.current('qr.orders.toastMany', { count: fresh.length }),
          );
        }
      }
      seenOrders.current = orderIds;

      const callIds = new Set(nextCalls.map(callKey));
      if (seenCalls.current) {
        const fresh = nextCalls.filter((c) => !seenCalls.current?.has(callKey(c)));
        if (fresh.length > 0) {
          const c = fresh[0];
          announce('call', tRef.current(`qr.alerts.toast.${c.reason}`, { table: c.tableCode }));
        }
      }
      seenCalls.current = callIds;
    } catch {
      setFailed(true);
    } finally {
      inFlight.current = false;
      if (rerun.current) {
        rerun.current = false;
        await run();
      }
    }
  }, [announce]);

  useEffect(() => {
    if (!enabled) {
      setOrders([]);
      setCalls([]);
      setLoaded(false);
      seenOrders.current = null;
      seenCalls.current = null;
      return;
    }
    void load();
  }, [enabled, load]);

  // Live: any order / table / session change refetches; a 60 s (15 s when degraded) poll is the safety net.
  useLiveRefresh(['orders', 'tables', 'sessions'], load, enabled);

  // The first click or key press anywhere unlocks audio, so a chime can sound later without a special step.
  useEffect(() => {
    if (!enabled || !soundOn || unlocked) return;
    const unlock = () => {
      void unlockAudio().then(setUnlocked);
    };
    document.addEventListener('pointerdown', unlock, { once: true });
    document.addEventListener('keydown', unlock, { once: true });
    return () => {
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
    };
  }, [enabled, soundOn, unlocked]);

  const setOn = useCallback((on: boolean) => {
    setSoundOn(on);
    setSoundPref(on);
    if (on) void unlockAudio().then(setUnlocked);
  }, []);

  const test = useCallback(() => {
    void unlockAudio().then((ok) => {
      setUnlocked(ok);
      if (ok) playChime('order');
    });
  }, []);

  const byTable = useMemo(() => {
    const map = new Map<string, TableGuestInfo>();
    for (const o of orders) {
      const cur = map.get(o.tableId) ?? { pending: 0, call: null };
      map.set(o.tableId, { ...cur, pending: cur.pending + 1 });
    }
    for (const c of calls) {
      const cur = map.get(c.tableId) ?? { pending: 0, call: null };
      map.set(c.tableId, { ...cur, call: c });
    }
    return map;
  }, [orders, calls]);

  const value = useMemo<GuestOrderState>(
    () =>
      enabled
        ? {
            enabled,
            loaded,
            failed,
            orders,
            calls,
            attention: orders.length + calls.length,
            byTable,
            refresh: () => void load(),
            dropOrder: (id) => setOrders((l) => l.filter((o) => o.id !== id)),
            dropCall: (tableId) => setCalls((l) => l.filter((c) => c.tableId !== tableId)),
            sound: { on: soundOn, unlocked, setOn, test },
          }
        : NOOP,
    [enabled, loaded, failed, orders, calls, byTable, load, soundOn, unlocked, setOn, test],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
