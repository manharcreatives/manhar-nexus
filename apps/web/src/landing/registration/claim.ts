import { apiBase, REQUEST_TIMEOUT_MS, type SubmitOptions } from './submit';

/**
 * The owner's way into a freshly created account, with no email provider: after they pay, the thank-you page asks the
 * server for a one-time "set your password" link. The server releases it only to the browser that pressed "Pay now"
 * (it holds a payer secret that the reference code and email alone can never replace).
 *
 * The token is a credential: it travels in the URL fragment only, is never logged and never put in a query string.
 */
export const CLAIM_PATH = '/public/claim';
export const SET_PASSWORD_PATH = '/set-password';

/** Poll every 4 seconds for about two minutes while the account is being built, then fall back to WhatsApp. */
export const CLAIM_POLL_MS = 4_000;
export const CLAIM_MAX_POLLS = 30;

export const CLAIM_COPY = {
  pending: 'We are setting up your restaurant. This takes a minute, please keep this page open.',
  ready: 'Your restaurant is ready. Choose your password to sign in.',
  button: 'Set your password',
  later: 'We will send your sign-in link on WhatsApp shortly.',
  timedOut: 'This is taking longer than usual. No problem, we will message you on WhatsApp as soon as your account is ready.',
} as const;

const storageKey = (referenceCode: string): string => `nx.payer.${referenceCode}`;

/** Remember the payer secret in this browser. Storage can be blocked; the page works without it. */
export function rememberPayerSecret(referenceCode: string, secret: string): void {
  try {
    window.localStorage.setItem(storageKey(referenceCode), secret);
  } catch {
    /* private window or blocked storage: the sign-in link then comes on WhatsApp */
  }
}

export function recallPayerSecret(referenceCode: string): string | null {
  try {
    const value = window.localStorage.getItem(storageKey(referenceCode));
    return value && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

export type ClaimResult =
  | { readonly kind: 'ready'; readonly token: string; readonly expiresAt: string }
  | { readonly kind: 'pending' }
  | { readonly kind: 'unknown' }
  | { readonly kind: 'failed' };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** Ask for the set-password link. Never rejects; a 404 means "not for you", anything else odd means "try again". */
export async function issueClaim(who: { referenceCode: string; email: string }, payerSecret: string, options: SubmitOptions = {}): Promise<ClaimResult> {
  const doFetch = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? REQUEST_TIMEOUT_MS);
  try {
    const res = await doFetch(`${(options.baseUrl ?? apiBase()).replace(/\/+$/, '')}${CLAIM_PATH}/issue`, {
      method: 'POST',
      body: JSON.stringify({ ...who, payerSecret }),
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      signal: controller.signal,
    });
    if (res.status === 404) return { kind: 'unknown' };
    if (!res.ok) return { kind: 'failed' };
    const body = (await res.json()) as unknown;
    if (!isRecord(body)) return { kind: 'failed' };
    if (body.status === 'ready' && typeof body.token === 'string' && body.token.length > 0) {
      return { kind: 'ready', token: body.token, expiresAt: typeof body.expiresAt === 'string' ? body.expiresAt : '' };
    }
    if (body.status === 'pending') return { kind: 'pending' };
    return { kind: 'failed' };
  } catch {
    return { kind: 'failed' };
  } finally {
    clearTimeout(timer);
  }
}

/** Where the "Set your password" button goes. The token is in the fragment, so it is never sent to any server. */
export function setPasswordHref(token: string): string {
  return `${SET_PASSWORD_PATH}#t=${encodeURIComponent(token)}`;
}
