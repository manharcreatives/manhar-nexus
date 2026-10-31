import { useCallback, useEffect, useRef } from 'react';

const mq = (q: string) => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(q).matches;
export const prefersReducedMotion = () => mq('(prefers-reduced-motion: reduce)');
/** True on mouse/trackpad devices (hover tilt); false on touch (scroll-linked depth instead). */
export const hasFinePointer = () => mq('(hover: hover) and (pointer: fine)');

// ───────────── one shared scroll loop (passive listener + rAF) ─────────────
type Frame = (scrollY: number, viewportH: number) => void;
const frames = new Set<Frame>();
let queued = false;
let bound = false;

function run() {
  queued = false;
  const y = window.scrollY;
  const h = window.innerHeight;
  frames.forEach((f) => f(y, h));
}
function onScroll() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(run);
}

/** Subscribe to scroll frames. Callbacks write CSS variables directly: no React renders while scrolling. */
export function onScrollFrame(fn: Frame): () => void {
  frames.add(fn);
  if (!bound) {
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    bound = true;
  }
  fn(window.scrollY, window.innerHeight);
  return () => {
    frames.delete(fn);
    if (!frames.size && bound) {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      bound = false;
    }
  };
}

// ───────────── scroll-linked reveal ─────────────
let revealIO: IntersectionObserver | null = null;
function revealObserver(): IntersectionObserver | null {
  if (typeof IntersectionObserver === 'undefined') return null;
  revealIO ??= new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          (e.target as HTMLElement).dataset.in = '1';
          revealIO?.unobserve(e.target);
        }
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
  );
  return revealIO;
}

/** Ref callback: the element fades/rises in once when it enters the viewport (CSS does the motion). */
export function useReveal<T extends HTMLElement>(): (el: T | null) => void {
  const last = useRef<T | null>(null);
  return useCallback((el: T | null) => {
    if (last.current) revealIO?.unobserve(last.current);
    last.current = el;
    if (!el) return;
    const io = revealObserver();
    if (io) io.observe(el);
    else el.dataset.in = '1';
  }, []);
}

// ───────────── scroll-linked depth for cards (touch devices) ─────────────
const visible = new Set<HTMLElement>();
let depthIO: IntersectionObserver | null = null;
let depthOff: (() => void) | null = null;

function ensureDepth() {
  if (depthIO || typeof IntersectionObserver === 'undefined') return;
  depthIO = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) visible.add(e.target as HTMLElement);
      else visible.delete(e.target as HTMLElement);
    }
    if (visible.size && !depthOff) {
      depthOff = onScrollFrame((_y, vh) => {
        visible.forEach((el) => {
          const r = el.getBoundingClientRect();
          const p = (r.top + r.height / 2 - vh / 2) / (vh / 2);
          el.style.setProperty('--dy', Math.max(-1, Math.min(1, p)).toFixed(3));
        });
      });
    } else if (!visible.size && depthOff) {
      depthOff();
      depthOff = null;
    }
  }, { rootMargin: '10% 0px' });
}

/** Ref callback: writes --dy (-1 above centre .. 1 below) on the element while it is on screen. */
export function useDepth<T extends HTMLElement>(): (el: T | null) => void {
  const last = useRef<T | null>(null);
  return useCallback((el: T | null) => {
    if (last.current) {
      depthIO?.unobserve(last.current);
      visible.delete(last.current);
    }
    last.current = el;
    if (!el || prefersReducedMotion()) return;
    ensureDepth();
    depthIO?.observe(el);
  }, []);
}

/** Pointer tilt for desktop: writes --rx/--ry/--gx/--gy; resets on leave. Returns handlers to spread on the element. */
export function usePointerTilt<T extends HTMLElement>(max = 5) {
  const raf = useRef(0);
  const onPointerMove = useCallback(
    (e: React.PointerEvent<T>) => {
      if (e.pointerType !== 'mouse' || prefersReducedMotion()) return;
      const el = e.currentTarget;
      const { clientX, clientY } = e;
      if (raf.current) return;
      raf.current = requestAnimationFrame(() => {
        raf.current = 0;
        const r = el.getBoundingClientRect();
        const px = (clientX - r.left) / r.width;
        const py = (clientY - r.top) / r.height;
        el.style.setProperty('--ry', `${((px - 0.5) * max * 2).toFixed(2)}deg`);
        el.style.setProperty('--rx', `${((0.5 - py) * max * 2).toFixed(2)}deg`);
        el.style.setProperty('--gx', `${(px * 100).toFixed(1)}%`);
        el.style.setProperty('--gy', `${(py * 100).toFixed(1)}%`);
        el.dataset.tilt = '1';
      });
    },
    [max],
  );
  const onPointerLeave = useCallback((e: React.PointerEvent<T>) => {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = 0;
    const el = e.currentTarget;
    el.style.removeProperty('--rx');
    el.style.removeProperty('--ry');
    delete el.dataset.tilt;
  }, []);
  useEffect(() => () => { if (raf.current) cancelAnimationFrame(raf.current); }, []);
  return { onPointerMove, onPointerLeave };
}

export function haptic(ms = 8): void {
  try {
    if (!prefersReducedMotion()) navigator.vibrate?.(ms);
  } catch {
    /* unsupported */
  }
}
