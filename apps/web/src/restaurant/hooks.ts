import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Single-flight guard for state-changing actions. While one run is in flight
 * further calls are ignored (double-click / double-tap safe) and `busy` drives
 * the disabled + loading UI.
 */
export function useSingleFlight() {
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const run = useCallback(async function run<T>(fn: () => Promise<T>): Promise<T | undefined> {
    if (inFlight.current) return undefined;
    inFlight.current = true;
    setBusy(true);
    try {
      return await fn();
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, []);
  return { busy, run };
}

/** Current time, re-rendering every `everyMs` so elapsed labels stay fresh. */
export function useNow(everyMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  return now;
}
