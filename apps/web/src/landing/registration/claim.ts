import { CONTACT } from '../content/nav';
import { apiBase, REQUEST_TIMEOUT_MS, type SubmitOptions } from './submit';

/**
 * The owner's way into a freshly created account, with no email provider: after they pay, the page asks the server
 * for a one-time "set your password" link. The server releases it only to the browser that pressed "Pay now" (it
 * holds the payer secret from registration) and only with the last four digits of the registered mobile number.
 *
 * The token is a credential: it travels in the URL fragment only, is never logged and never put in a query string.
 */
export const CLAIM_PATH = '/public/claim';
export const SET_PASSWORD_PATH = '/set-password';
export const PAY_RETURN_PATH = '/pay/return';

/** Wait 3s, 6s, then 10s between calls: about 15 calls over roughly two minutes, well inside the server's limit. */
export const CLAIM_BACKOFF_MS: readonly number[] = [3_000, 6_000, 10_000];
export const CLAIM_MAX_POLLS = 15;
/** The wait before call number `attempt + 1` (attempt counts the calls already made, from 1). */
export const claimDelay = (attempt: number): number => CLAIM_BACKOFF_MS[Math.min(attempt - 1, CLAIM_BACKOFF_MS.length - 1)] ?? 10_000;

export const CLAIM_COPY = {
  pending: 'We are setting up your restaurant. This takes a minute, please keep this page open.',
  ready: 'Your restaurant is ready. Choose your password to sign in.',
  button: 'Set your password',
  later: 'We will send your sign-in link on WhatsApp shortly.',
  manual: 'We are finishing your account by hand. We will message you on WhatsApp shortly.',
  timedOut: 'This is taking longer than usual. No problem, we will message you on WhatsApp as soon as your account is ready.',
  rateLimited: 'Too many tries. Please wait a few minutes, or message us on WhatsApp.',
  otherDevice: 'Open this page on the device where you paid to sign in instantly.',
  noSecret: 'To sign in instantly, open this page on the same phone or computer where you paid. Or message us on WhatsApp and we will send you the link.',
  retry: 'Check again',
  whatsapp: 'Message us on WhatsApp',
  paymentReceived: 'Payment received. Thank you!',
  resumeTitle: (code: string) => `Request ${code} received`,
  resumeBody: 'If you already paid, check your payment to open your restaurant. If not, we will message you a payment link.',
  resumeCheck: 'Check payment',
  resumeDismiss: 'Dismiss',
} as const;

const storageKey = (referenceCode: string): string => `nx.payer.${referenceCode}`;

/** Remember the payer secret (handed out once, when the registration form was submitted) in this browser. Storage can be blocked; the page works without it. */
export function rememberPayerSecret(referenceCode: string, secret: string): void {
  try {
    window.localStorage.setItem(storageKey(referenceCode), secret);
  } catch {
    /* private window or blocked storage: the sign-in link then comes on WhatsApp */
  }
}

/** Forget the secret (the claim is done, or it can never work again), so it does not sit in storage for good. */
export function clearPayerSecret(referenceCode: string): void {
  try {
    window.localStorage.removeItem(storageKey(referenceCode));
  } catch {
    /* blocked storage: nothing to clear */
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

/** The most recent reference code (and when), so a visitor who pressed Back from the payment page can pick up again. */
const LAST_REF_KEY = 'nx.lastref';
const LAST_REF_TTL_MS = 48 * 60 * 60 * 1000;

/** Remember only the reference code and the time: no name, email or phone is stored. */
export function rememberLastReference(referenceCode: string, now: number = Date.now()): void {
  try {
    window.localStorage.setItem(LAST_REF_KEY, JSON.stringify({ c: referenceCode, t: now }));
  } catch {
    /* blocked storage: the visitor simply sees the normal form */
  }
}

export function clearLastReference(): void {
  try {
    window.localStorage.removeItem(LAST_REF_KEY);
  } catch {
    /* nothing to clear */
  }
}

/** The remembered reference code if it is recent (48 hours), else null. */
export function recallLastReference(now: number = Date.now()): string | null {
  try {
    const raw = window.localStorage.getItem(LAST_REF_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { c?: unknown; t?: unknown };
    if (typeof v.c !== 'string' || typeof v.t !== 'number' || now - v.t > LAST_REF_TTL_MS || !/^[A-Za-z0-9-]{4,32}$/.test(v.c)) return null;
    return v.c;
  } catch {
    return null;
  }
}

/** The last four digits of a phone number as typed (any format), or '' when there are fewer than four digits. */
export function lastFourDigits(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 4 ? digits.slice(-4) : '';
}

/** wa.me link to our support number with a prefilled message. */
export function supportWhatsAppUrl(text: string): string {
  return `${CONTACT.whatsappUrl}?text=${encodeURIComponent(text)}`;
}

export type ClaimResult =
  | { readonly kind: 'ready'; readonly token: string; readonly expiresAt: string }
  /** `paid`: the server says the money has arrived and the account is being made. */
  | { readonly kind: 'pending'; readonly paid: boolean }
  /** A person is finishing this account (typed amount, failed job...): stop waiting. */
  | { readonly kind: 'manual' }
  /** 429: stop polling. */
  | { readonly kind: 'rateLimited' }
  | { readonly kind: 'unknown' }
  | { readonly kind: 'failed' };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** Ask for the set-password link. Never rejects; a 404 means "not for you", anything else odd means "try again". */
export async function issueClaim(who: { referenceCode: string; phoneLast4: string }, payerSecret: string, options: SubmitOptions = {}): Promise<ClaimResult> {
  const doFetch = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? REQUEST_TIMEOUT_MS);
  try {
    const res = await doFetch(`${(options.baseUrl ?? apiBase()).replace(/\/+$/, '')}${CLAIM_PATH}/issue`, {
      method: 'POST',
      body: JSON.stringify({ referenceCode: who.referenceCode, phoneLast4: who.phoneLast4, payerSecret }),
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      signal: controller.signal,
    });
    if (res.status === 404) return { kind: 'unknown' };
    if (res.status === 429) return { kind: 'rateLimited' };
    if (!res.ok) return { kind: 'failed' };
    const body = (await res.json()) as unknown;
    if (!isRecord(body)) return { kind: 'failed' };
    if (body.status === 'ready' && typeof body.token === 'string' && body.token.length > 0) {
      return { kind: 'ready', token: body.token, expiresAt: typeof body.expiresAt === 'string' ? body.expiresAt : '' };
    }
    if (body.status === 'pending') return { kind: 'pending', paid: body.paid === true };
    if (body.status === 'manual') return { kind: 'manual' };
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
