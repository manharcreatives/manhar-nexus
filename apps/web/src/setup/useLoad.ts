import { useCallback, useEffect, useState } from 'react';

export interface Loaded<T> {
  data: T | null;
  loading: boolean;
  error: boolean;
  reload: () => void;
}

/** Loads on mount and on demand; keeps the previous data while reloading so lists do not flash. */
export function useLoad<T>(fn: () => Promise<T>): Loaded<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    setLoading(true);
    fn().then(
      (d) => {
        if (live) {
          setData(d);
          setError(false);
          setLoading(false);
        }
      },
      () => {
        if (live) {
          setError(true);
          setLoading(false);
        }
      },
    );
    return () => {
      live = false;
    };
  }, [tick, fn]);
  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { data, loading, error, reload };
}
