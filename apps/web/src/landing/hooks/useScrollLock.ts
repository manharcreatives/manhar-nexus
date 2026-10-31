import { useEffect } from 'react';

/** Locks page scroll (html overflow hidden) while `active`; restores the previous value afterwards. */
export function useScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {
      root.style.overflow = prev;
    };
  }, [active]);
}
