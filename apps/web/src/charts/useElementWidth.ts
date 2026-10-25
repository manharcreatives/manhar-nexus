import { useLayoutEffect, useRef, useState } from 'react';

/**
 * Tracks an element's content width so a chart can draw its viewBox at real
 * pixel size (text stays legible at 390px instead of shrinking with a fixed
 * viewBox). Falls back to `initial` where ResizeObserver is unavailable.
 */
export function useElementWidth<T extends HTMLElement>(initial = 640) {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(initial);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const w = Math.round(el.getBoundingClientRect().width);
      if (w > 0) setWidth(w);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, width };
}
