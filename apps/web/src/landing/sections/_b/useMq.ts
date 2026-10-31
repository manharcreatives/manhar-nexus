import { useCallback, useSyncExternalStore } from 'react';

function mql(query: string): MediaQueryList | null {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(query) : null;
}

/**
 * Live `matchMedia(query).matches`. Always false where matchMedia does not exist (jsdom, SSR), which makes every
 * enhanced 3D / pinned mode in SECTIONS-B opt-in: the default render is the plain, fully readable layout.
 */
export function useMq(query: string): boolean {
  const subscribe = useCallback(
    (cb: () => void) => {
      const m = mql(query);
      if (!m) return () => undefined;
      m.addEventListener('change', cb);
      return () => m.removeEventListener('change', cb);
    },
    [query],
  );
  const get = useCallback(() => mql(query)?.matches ?? false, [query]);
  return useSyncExternalStore(subscribe, get, () => false);
}
