import { readCashfreeConfig } from './cashfree.config';

/**
 * "Pay now" for the owner (no staff in the loop). OFF unless CUSTOMER_PAY_ENABLED is exactly "true" or "1", read at
 * call time so it can be flipped by an env change and redeploy, and tests can set it.
 *
 *   CUSTOMER_PAY_ENABLED     true | 1 to switch it on (default off)
 *   CUSTOMER_PAY_RATE_LIMIT  requests per IP per window on the public pay endpoints (default 20)
 *   CUSTOMER_PAY_RATE_TTL_MS window length in ms (default 1 hour)
 */
export function customerPayFlag(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env.CUSTOMER_PAY_ENABLED?.trim().toLowerCase();
  return raw === 'true' || raw === '1';
}

/** Offered to visitors only when the flag is on AND Cashfree keys are present (no button that cannot work). */
export function customerPayAvailable(env: NodeJS.ProcessEnv = process.env): boolean {
  return customerPayFlag(env) && readCashfreeConfig(env) !== null;
}

function positiveInt(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

export const customerPayRateLimit = (): number => positiveInt(process.env.CUSTOMER_PAY_RATE_LIMIT, 20);
export const customerPayRateTtlMs = (): number => positiveInt(process.env.CUSTOMER_PAY_RATE_TTL_MS, 3_600_000);
