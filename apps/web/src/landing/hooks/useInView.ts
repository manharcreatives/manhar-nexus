import { useEffect, useRef, useState } from 'react';

export interface InViewOptions {
  /** Fraction of the element that must be visible (0..1). Default 0.2 */
  threshold?: number;
  /** IntersectionObserver rootMargin. Default '0px 0px -8% 0px' */
  rootMargin?: string;
  /** Stop observing after the first time it is seen. Default true */
  once?: boolean;
}

/**
 * [ref, inView]. Without IntersectionObserver (jsdom, very old browsers) it reports `true`
 * immediately so content is never stuck hidden.
 */
export function useInView<T extends HTMLElement = HTMLDivElement>({ threshold = 0.2, rootMargin = '0px 0px -8% 0px', once = true }: InViewOptions = {}) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(() => typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          if (once) io.disconnect();
        } else if (!once) {
          setInView(false);
        }
      },
      { threshold, rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold, rootMargin, once]);
  return [ref, inView] as const;
}

/**
 * Imperative variant that adds the class `is-in` to the element once visible (no re-render).
 * Pair with `.lp-reveal` (opacity/transform transition defined in landing.css).
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(options: InViewOptions = {}) {
  const ref = useRef<T>(null);
  const { threshold = 0.2, rootMargin = '0px 0px -8% 0px' } = options;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      el.classList.add('is-in');
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('is-in');
          io.disconnect();
        }
      },
      { threshold, rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold, rootMargin]);
  return ref;
}
