import { readCashfreeConfig } from './cashfree.config';

/**
 * UPI AutoPay subscriptions for monthly plans. OFF unless SUBSCRIPTIONS_ENABLED is exactly "true" or "1" (read at call
 * time, so an env change plus redeploy flips it). Also needs the Cashfree keys, and Subscriptions enabled on the
 * Cashfree account (the sandbox has it; production needs the merchant to request it in the dashboard).
 */
export function subscriptionsFlag(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env.SUBSCRIPTIONS_ENABLED?.trim().toLowerCase();
  return raw === 'true' || raw === '1';
}

export function subscriptionsAvailable(env: NodeJS.ProcessEnv = process.env): boolean {
  return subscriptionsFlag(env) && readCashfreeConfig(env) !== null;
}
