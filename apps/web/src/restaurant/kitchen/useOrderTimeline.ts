import { useCallback, useEffect, useRef, useState } from 'react';
import { timelineApi, type OrderTimelineResponse } from './timelineApi';

export type TimelineState =
  | { status: 'idle' | 'loading'; data: null; error: null; fetchedAtMs: 0 }
  | { status: 'ready'; data: OrderTimelineResponse; error: null; fetchedAtMs: number }
  | { status: 'error'; data: OrderTimelineResponse | null; error: unknown; fetchedAtMs: number };

const IDLE: TimelineState = { status: 'idle', data: null, error: null, fetchedAtMs: 0 };

/**
 * Loads one order's timeline while `open`. `refreshKey` (e.g. the ticket's status) re-fetches silently, keeping the
 * last good data on screen. A response for a superseded request is dropped.
 */
export function useOrderTimeline(orderId: string, open: boolean, refreshKey: string) {
  const [state, setState] = useState<TimelineState>(IDLE);
  const seq = useRef(0);
  const have = useRef(false);

  const load = useCallback(() => {
    const mine = ++seq.current;
    if (!have.current) setState({ status: 'loading', data: null, error: null, fetchedAtMs: 0 });
    timelineApi.get(orderId).then(
      (data) => {
        if (mine !== seq.current) return;
        have.current = true;
        setState({ status: 'ready', data, error: null, fetchedAtMs: Date.now() });
      },
      (error: unknown) => {
        if (mine !== seq.current) return;
        setState((prev) => ({ status: 'error', data: prev.data, error, fetchedAtMs: prev.fetchedAtMs }));
      },
    );
  }, [orderId]);

  // A different order starts from scratch (declared first so it runs before the load below).
  useEffect(() => {
    have.current = false;
    setState(IDLE);
  }, [orderId]);

  useEffect(() => {
    if (!open) {
      seq.current++; // cancel anything in flight
      return;
    }
    load();
    return () => {
      seq.current++;
    };
  }, [open, load, refreshKey]);

  return { state, reload: load };
}
