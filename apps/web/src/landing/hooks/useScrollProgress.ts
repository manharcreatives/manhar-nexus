import { useEffect, useRef } from 'react';
import { prefersReducedMotion } from './useReducedMotion';

export type ScrollProgressMode = 'view' | 'pin' | 'hero';

/**
 * Writes a 0..1 value to the CSS custom property `--p` (or `prop`) on the returned element's style.
 * - 'view': 0 when the element enters the viewport bottom, 1 when it leaves the top.
 * - 'pin' : 0..1 across a tall section that contains a sticky stage (-top / (height - viewport)).
 * - 'hero': scrollY / (0.6 * viewport height); for a hero that flattens as you scroll away.
 * rAF-throttled and only active while the element is near the viewport. With reduced motion (or no
 * IntersectionObserver, e.g. jsdom) it sets the FINAL state (1) once and attaches nothing.
 * Always give your CSS a sensible static look for the value used in that final state.
 */
export function useScrollProgress<T extends HTMLElement = HTMLDivElement>(mode: ScrollProgressMode = 'view', prop = '--p') {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
      el.style.setProperty(prop, '1');
      return;
    }
    let raf = 0;
    let on = false;
    const calc = () => {
      raf = 0;
      if (!on) return;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const p =
        mode === 'pin'
          ? -r.top / Math.max(1, r.height - vh)
          : mode === 'hero'
            ? window.scrollY / (vh * 0.6)
            : (vh - r.top) / (vh + r.height);
      el.style.setProperty(prop, Math.min(1, Math.max(0, p)).toFixed(4));
    };
    const tick = () => {
      if (!raf) raf = requestAnimationFrame(calc);
    };
    const io = new IntersectionObserver(
      ([entry]) => {
        on = entry.isIntersecting;
        tick();
      },
      { rootMargin: '10% 0px' },
    );
    io.observe(el);
    window.addEventListener('scroll', tick, { passive: true });
    window.addEventListener('resize', tick);
    return () => {
      io.disconnect();
      window.removeEventListener('scroll', tick);
      window.removeEventListener('resize', tick);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [mode, prop]);
  return ref;
}
