import { useEffect, useRef } from 'react';
import { isCoarsePointer, prefersReducedMotion } from './useReducedMotion';

/**
 * Pointer tilt for flat "3D" cards. Writes `--lp-rx` / `--lp-ry` (deg) on the element; style the element with
 *   transform: perspective(900px) rotateX(var(--lp-rx,0deg)) rotateY(var(--lp-ry,0deg));
 * (the `.lp-tilt` class in landing.css already does this, with a transition). Disabled on touch devices
 * and for reduced motion (the properties stay unset -> flat). `max` is the maximum angle in degrees.
 */
export function useTilt<T extends HTMLElement = HTMLDivElement>(max = 8) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion() || isCoarsePointer()) return;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        el.style.setProperty('--lp-ry', `${(px * max * 2).toFixed(2)}deg`);
        el.style.setProperty('--lp-rx', `${(-py * max * 2).toFixed(2)}deg`);
      });
    };
    const reset = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      el.style.removeProperty('--lp-rx');
      el.style.removeProperty('--lp-ry');
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', reset);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', reset);
      reset();
    };
  }, [max]);
  return ref;
}
