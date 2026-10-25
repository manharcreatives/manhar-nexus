import { useCallback, useEffect, useRef, useState } from 'react';
import type { ApiError } from '../auth/api';

export interface WidgetState<T> {
  data: T | null;
  /** True only while there is nothing to show yet (background refreshes keep the old data). */
  loading: boolean;
  error: string | null;
  /** The API said no (403) or the module is off: the widget should not render at all. */
  hidden: boolean;
  reload: () => void;
}

/**
 * Loads one Home widget independently. `fn` must be memoized. When enabled and
 * `refreshMs` is set, it refreshes while the tab is visible. A 403 hides the
 * widget instead of showing an error; a 404 (endpoint/module absent) too.
 */
export function useWidget<T>(fn: (() => Promise<T>) | null, refreshMs?: number): WidgetState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(fn !== null);
  const [error, setError] = useState<string | null>(null);
  const [hidden, setHidden] = useState(fn === null);
  const seq = useRef(0);
  const hasData = useRef(false);

  const run = useCallback(
    (background = false) => {
      if (!fn) return;
      const id = ++seq.current;
      if (!background) {
        setLoading(!hasData.current);
        setError(null);
      }
      fn()
        .then((r) => {
          if (id !== seq.current) return;
          hasData.current = true;
          setData(r);
          setError(null);
          setHidden(false);
        })
        .catch((e: unknown) => {
          if (id !== seq.current) return;
          const status = (e as Partial<ApiError>)?.status;
          if (status === 403 || status === 404) {
            setHidden(true);
            return;
          }
          // A failed background refresh keeps the last good numbers on screen.
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
      setHidden(true);
      setLoading(false);
      return;
    }
    // A new source (e.g. another location) must never show the previous one's numbers.
    hasData.current = false;
    setData(null);
    setHidden(false);
    run();
    if (!refreshMs) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') run(true);
    }, refreshMs);
    return () => window.clearInterval(timer);
  }, [fn, run, refreshMs]);

  const reload = useCallback(() => run(false), [run]);
  return { data, loading, error, hidden, reload };
}
