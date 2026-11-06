import { logger } from '../logging/logger';

/** What Vercel puts on the global object for the current request (the same place @vercel/functions reads). */
interface VercelContext {
  waitUntil?: (promise: Promise<unknown>) => void;
}
const VERCEL_CONTEXT = Symbol.for('@vercel/request-context');

/**
 * Runs `work` AFTER the current response has been sent, and never lets it fail or slow the caller.
 *
 * On Vercel the function would be frozen the moment the response goes out, so the work is handed to `waitUntil`, which
 * keeps the instance alive until it finishes. Anywhere else (local, Docker, tests) it is simply started on the next
 * tick. Either way any error is logged without detail beyond its name; the retry paths (Check payment, the cron
 * route) are the safety net, so a lost run is never a lost payment.
 */
export function afterResponse(label: string, work: () => Promise<unknown>): void {
  const run = new Promise<void>((resolve) => setImmediate(resolve))
    .then(work)
    .then(() => undefined)
    .catch((err: unknown) => {
      logger.child({ task: label }).warn(`background task failed: ${(err as Error)?.name ?? 'Error'}`);
    });
  try {
    const ctx = (globalThis as Record<symbol, { get?: () => VercelContext | undefined } | undefined>)[VERCEL_CONTEXT]?.get?.();
    ctx?.waitUntil?.(run);
  } catch {
    /* not on Vercel, or the context is unavailable: the promise still runs */
  }
}
