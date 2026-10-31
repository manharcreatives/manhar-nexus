import { useEffect, useRef, type RefObject } from 'react';

/**
 * Calls `onProgress(p)` (0..1) as the user scrolls through a tall element that contains a sticky stage.
 * Same maths as `useScrollProgress('pin')` (-top / (height - viewport)); use it when React state (not just a CSS
 * variable) has to follow the scroll. rAF-throttled, passive listeners, idle when `enabled` is false.
 */
export function usePinScroll(ref: RefObject<HTMLElement | null>, enabled: boolean, onProgress: (p: number) => void): void {
  const cb = useRef(onProgress);
  useEffect(() => {
    cb.current = onProgress;
  });
  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return;
    let raf = 0;
    const calc = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const p = -r.top / Math.max(1, r.height - window.innerHeight);
      cb.current(Math.min(1, Math.max(0, p)));
    };
    const tick = () => {
      if (!raf) raf = requestAnimationFrame(calc);
    };
    tick();
    window.addEventListener('scroll', tick, { passive: true });
    window.addEventListener('resize', tick);
    return () => {
      window.removeEventListener('scroll', tick);
      window.removeEventListener('resize', tick);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [ref, enabled]);
}
