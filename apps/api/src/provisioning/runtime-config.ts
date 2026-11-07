/**
 * Environment reads for the payment and provisioning area, in one place, so the way a value is cleaned up (trailing
 * slashes, trimming, minimum length) cannot drift between callers.
 */

/** The public web origin without a trailing slash (QR_PUBLIC_BASE_URL), or null when it is not set. */
export function publicBaseUrl(env: NodeJS.ProcessEnv = process.env): string | null {
  const raw = env.QR_PUBLIC_BASE_URL?.trim().replace(/\/+$/, '');
  return raw ? raw : null;
}

/** The shortest CRON_SECRET we accept: a short secret can be guessed over time. */
export const MIN_CRON_SECRET_LENGTH = 32;

export type CronSecret = { ok: true; secret: string } | { ok: false; reason: 'unset' | 'too-short' };

/** CRON_SECRET, or why the cron route must stay disabled. */
export function cronSecret(env: NodeJS.ProcessEnv = process.env): CronSecret {
  const secret = env.CRON_SECRET;
  if (!secret) return { ok: false, reason: 'unset' };
  if (secret.length < MIN_CRON_SECRET_LENGTH) return { ok: false, reason: 'too-short' };
  return { ok: true, secret };
}
