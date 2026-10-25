import { useCallback, useEffect, useRef, useState } from 'react';

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
  setData: (updater: (prev: T | null) => T | null) => void;
}

/** Loads on mount and whenever `fn` changes (memoize it); stale responses are ignored. */
export function useAsync<T>(fn: (() => Promise<T>) | null): AsyncState<T> {
  const [data, setDataState] = useState<T | null>(null);
  const [loading, setLoading] = useState(fn !== null);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const run = useCallback(() => {
    if (!fn) return;
    const id = ++seq.current;
    setLoading(true);
    setError(null);
    fn()
      .then((r) => {
        if (id === seq.current) setDataState(r);
      })
      .catch((e: unknown) => {
        if (id === seq.current) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (id === seq.current) setLoading(false);
      });
  }, [fn]);

  useEffect(() => {
    if (!fn) {
      seq.current++;
      setLoading(false);
      return;
    }
    run();
  }, [fn, run]);

  const setData = useCallback((updater: (prev: T | null) => T | null) => setDataState(updater), []);
  return { data, loading, error, reload: run, setData };
}
