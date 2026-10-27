/**
 * Collapses a burst of triggers into one call. The first trigger opens a
 * window of `ms`; further triggers inside it are absorbed and `fn` runs once
 * when the window closes, so latency is bounded by `ms` (a plain debounce
 * could starve under a steady stream of events).
 */
export function createCoalescer(fn: () => void, ms = 150): { trigger: () => void; cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return {
    trigger() {
      if (timer !== null) return;
      timer = setTimeout(() => {
        timer = null;
        fn();
      }, ms);
    },
    cancel() {
      if (timer !== null) clearTimeout(timer);
      timer = null;
    },
  };
}
