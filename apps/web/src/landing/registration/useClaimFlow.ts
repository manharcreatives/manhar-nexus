import { useCallback, useEffect, useRef, useState } from 'react';
import { CLAIM_MAX_POLLS, claimDelay, clearPayerSecret, issueClaim, recallPayerSecret } from './claim';

/** After this many "not for you" answers the secret is dropped: a fifth wrong try will not turn right. */
const MAX_UNKNOWN = 5;
import type { SubmitOptions } from './submit';

export type ClaimFlow =
  | { readonly state: 'idle' }
  | { readonly state: 'pending'; readonly paid: boolean }
  | { readonly state: 'ready'; readonly token: string }
  /** A person is finishing the account by hand. */
  | { readonly state: 'manual' }
  /** This browser does not hold the payer secret (another device, cleared storage). */
  | { readonly state: 'noSecret' }
  /** The server said 404: the secret or the last four digits did not match. */
  | { readonly state: 'unknown' }
  | { readonly state: 'rateLimited' }
  | { readonly state: 'timedOut' };

/**
 * Asks the server for the owner's set-password link, with backoff (3s, 6s, then 10s), for about two minutes. Stops at
 * once on a final answer (ready, manual, not-for-you) and on 429. `start()` can be called again ("Check again").
 * Used by the thank-you ticket and by the /pay/return page, so both behave the same.
 */
export function useClaimFlow(who: { referenceCode: string; phoneLast4: string }, options?: SubmitOptions): { flow: ClaimFlow; start: () => void; stop: () => void } {
  const [flow, setFlow] = useState<ClaimFlow>({ state: 'idle' });
  const run = useRef(0);
  const unknowns = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef({ who, options });
  latest.current = { who, options };

  const stop = useCallback(() => {
    run.current += 1;
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const start = useCallback(() => {
    stop();
    const mine = run.current;
    const { who: w } = latest.current;
    const secret = recallPayerSecret(w.referenceCode);
    if (!secret) {
      setFlow({ state: 'noSecret' });
      return;
    }
    let attempts = 0;
    const tick = async (): Promise<void> => {
      attempts += 1;
      const { who: now, options: opts } = latest.current;
      const result = await issueClaim(now, secret, opts);
      if (run.current !== mine) return;
      if (result.kind === 'ready') {
        // The token is in hand: the secret has done its job and is removed from this browser.
        clearPayerSecret(w.referenceCode);
        return setFlow({ state: 'ready', token: result.token });
      }
      if (result.kind === 'manual') return setFlow({ state: 'manual' });
      if (result.kind === 'unknown') {
        // A typo in the last four digits is a 404 too, so one miss must not cost the secret; five in a row do.
        unknowns.current += 1;
        if (unknowns.current >= MAX_UNKNOWN) clearPayerSecret(w.referenceCode);
        return setFlow({ state: 'unknown' });
      }
      if (result.kind === 'rateLimited') return setFlow({ state: 'rateLimited' });
      if (attempts >= CLAIM_MAX_POLLS) return setFlow({ state: 'timedOut' });
      setFlow({ state: 'pending', paid: result.kind === 'pending' && result.paid });
      timer.current = setTimeout(() => void tick(), claimDelay(attempts));
    };
    setFlow({ state: 'pending', paid: false });
    void tick();
  }, [stop]);

  useEffect(() => stop, [stop]);

  return { flow, start, stop };
}
