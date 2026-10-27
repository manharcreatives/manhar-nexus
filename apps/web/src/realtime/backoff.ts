export const BACKOFF_BASE_MS = 500;
export const BACKOFF_CAP_MS = 15_000;

/**
 * Reconnect delay for the nth consecutive failure (0-based): 0.5 s doubling to
 * a 15 s ceiling, with jitter between 50% and 100% of the ceiling so many
 * clients dropped together do not return in lockstep. `random` is injectable.
 */
export function backoffDelay(attempt: number, random: () => number = Math.random): number {
  const ceiling = Math.min(BACKOFF_CAP_MS, BACKOFF_BASE_MS * 2 ** Math.max(0, attempt));
  return Math.round(ceiling * (0.5 + 0.5 * random()));
}
