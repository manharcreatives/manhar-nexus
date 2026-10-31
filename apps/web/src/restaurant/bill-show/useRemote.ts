import { useCallback, useEffect, useRef, useState } from 'react';

export type RemoteState<T> =
  | { status: 'loading'; data: null; error: null }
  | { status: 'ready'; data: T; error: null }
  | { status: 'error'; data: T | null; error: unknown };

/**
 * Loads `fn` on mount and whenever `reload` is called. A background reload keeps the last good data on screen and only
 * flips to `error` (with that data still available) when it fails. A response for a superseded request is dropped.
 * `fn` must be stable (wrap it in useCallback).
 */
export function useRemote<T>(fn: () => Promise<T>): { state: RemoteState<T>; reload: () => void } {
  const [state, setState] = useState<RemoteState<T>>({ status: 'loading', data: null, error: null });
  const seq = useRef(0);
  const have = useRef(false);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const lastFn = useRef(fn);

  const reload = useCallback(() => {
    const mine = ++seq.current;
    if (!have.current) setState({ status: 'loading', data: null, error: null });
    fnRef.current().then(
      (data) => {
        if (mine !== seq.current) return;
        have.current = true;
        setState({ status: 'ready', data, error: null });
      },
      (error: unknown) => {
        if (mine !== seq.current) return;
        setState((prev) => ({ status: 'error', data: prev.data, error }));
      },
    );
  }, []);

  useEffect(() => {
    if (lastFn.current !== fn) {
      lastFn.current = fn; // a different subject: do not show the previous one's data while loading
      have.current = false;
    }
    reload();
    return () => {
      seq.current++;
    };
  }, [reload, fn]);

  return { state, reload };
}
