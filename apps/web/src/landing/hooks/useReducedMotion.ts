import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function mql(): MediaQueryList | null {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(QUERY) : null;
}

/** Non-hook read (safe in jsdom, where matchMedia does not exist). */
export function prefersReducedMotion(): boolean {
  return mql()?.matches ?? false;
}

function subscribe(cb: () => void): () => void {
  const m = mql();
  if (!m) return () => undefined;
  m.addEventListener('change', cb);
  return () => m.removeEventListener('change', cb);
}

/** True when the visitor asked for reduced motion. Live-updates if the OS setting changes. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, prefersReducedMotion, () => false);
}

/** True on devices whose primary pointer cannot hover (phones/tablets): skip pointer parallax/tilt. */
export function isCoarsePointer(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(hover: none)').matches;
}
