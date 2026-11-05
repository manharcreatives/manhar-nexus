/**
 * Cashfree settings, read from the environment at call time (like guestmenu.config), so tests can set them and a
 * missing key never stops the API from booting: it only makes payment-link creation answer 503.
 *
 *   CASHFREE_CLIENT_ID / CASHFREE_CLIENT_SECRET  Cashfree "App ID" / "Secret Key" (sandbox or production pair)
 *   CASHFREE_ENV          sandbox (default) | production. Selects the API host, so the pair must match.
 *   CASHFREE_API_VERSION  x-api-version header (default 2025-01-01)
 *   CASHFREE_WEBHOOK_URL  public https URL Cashfree should call; default `${QR_PUBLIC_BASE_URL}/api/public/cashfree/webhook`
 */
export interface CashfreeConfig {
  clientId: string;
  clientSecret: string;
  environment: 'sandbox' | 'production';
  /** e.g. https://sandbox.cashfree.com/pg */
  baseUrl: string;
  apiVersion: string;
  /** Sent as link_meta.notify_url when known. */
  webhookUrl: string | undefined;
}

export const DEFAULT_API_VERSION = '2025-01-01';
export const WEBHOOK_PATH = '/api/public/cashfree/webhook';

/** The configuration, or null when the key pair is not set. */
export function readCashfreeConfig(env: NodeJS.ProcessEnv = process.env): CashfreeConfig | null {
  const clientId = env.CASHFREE_CLIENT_ID?.trim();
  const clientSecret = env.CASHFREE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  const environment = env.CASHFREE_ENV?.trim().toLowerCase() === 'production' ? 'production' : 'sandbox';
  const explicit = env.CASHFREE_WEBHOOK_URL?.trim();
  const publicBase = env.QR_PUBLIC_BASE_URL?.trim().replace(/\/+$/, '');
  return {
    clientId,
    clientSecret,
    environment,
    baseUrl: environment === 'production' ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg',
    apiVersion: env.CASHFREE_API_VERSION?.trim() || DEFAULT_API_VERSION,
    webhookUrl: explicit || (publicBase ? `${publicBase}${WEBHOOK_PATH}` : undefined),
  };
}
