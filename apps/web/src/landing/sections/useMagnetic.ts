import { useEffect, useRef } from 'react';
import { isCoarsePointer, prefersReducedMotion } from '../hooks/useReducedMotion';

/**
 * Magnetic primary button: while the pointer is within `radius` px of the element, it drifts towards it by at most
 * `max` px (transform only), easing back on leave. Desktop pointers only; off for touch and reduced motion.
 * Attach the returned ref to a wrapper around the button (never to the button itself, which has its own :active transform).
 */
export function useMagnetic<T extends HTMLElement = HTMLSpanElement>(max = 6, radius = 96) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion() || isCoarsePointer()) return;
    let raf = 0;
    const move = (e: PointerEvent) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        const reach = Math.max(r.width, r.height) / 2 + radius;
        const d = Math.hypot(dx, dy);
        if (d > reach) {
          el.style.transform = '';
          return;
        }
        const k = (1 - d / reach) * max;
        const len = d || 1;
        el.style.transform = `translate(${((dx / len) * k).toFixed(2)}px, ${((dy / len) * k).toFixed(2)}px)`;
      });
    };
    const leave = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      el.style.transform = '';
    };
    window.addEventListener('pointermove', move, { passive: true });
    document.addEventListener('pointerleave', leave);
    return () => {
      window.removeEventListener('pointermove', move);
      document.removeEventListener('pointerleave', leave);
      leave();
    };
  }, [max, radius]);
  return ref;
}
