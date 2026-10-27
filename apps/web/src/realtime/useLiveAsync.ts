import { useCallback, useEffect, useRef, useState } from 'react';
import type { Topic } from './client';
import { useLiveRefresh } from './RealtimeProvider';

export interface LiveAsyncState<T> {
  data: T | null;
  /** True only for explicit (foreground) loads; live refreshes are silent. */
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * Like reports/useAsync, but also refetches quietly when one of `topics`
 * changes: the old data stays on screen, no loading flash, and a failed
 * background refresh keeps the last good data. Stale responses are ignored.
 */
export function useLiveAsync<T>(fn: (() => Promise<T>) | null, topics: readonly Topic[]): LiveAsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(fn !== null);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);
  const hasData = useRef(false);

  const run = useCallback(
    (background: boolean) => {
      if (!fn) return;
      const id = ++seq.current;
      if (!background) {
        setLoading(true);
        setError(null);
      }
      fn()
        .then((r) => {
          if (id !== seq.current) return;
          hasData.current = true;
          setData(r);
          setError(null);
        })
        .catch((e: unknown) => {
          if (id !== seq.current) return;
          if (!background || !hasData.current) setError(e instanceof Error ? e.message : String(e));
        })
        .finally(() => {
          if (id === seq.current) setLoading(false);
        });
    },
    [fn],
  );

  useEffect(() => {
    if (!fn) {
      seq.current++;
      setLoading(false);
      return;
    }
    run(false);
  }, [fn, run]);

  useLiveRefresh(topics, () => run(true), fn !== null);

  const reload = useCallback(() => run(false), [run]);
  return { data, loading, error, reload };
}
