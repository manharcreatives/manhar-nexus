import { apiBase, REQUEST_TIMEOUT_MS, type SubmitOptions } from './submit';

/** Public owner-payment endpoints (apps/api: behind CUSTOMER_PAY_ENABLED, unauthenticated, throttled per IP). */
export const PAY_PATH = '/public/payments';

/** Plans with a fixed price: only these can be paid online without a conversation. */
export const PAYABLE_PLANS: readonly string[] = ['counter', 'floor', 'pass'];

export const PAY_COPY = {
  button: 'Pay now',
  busy: 'Opening payment…',
  later: 'Prefer to pay later? No problem. We will message you with a payment link.',
  check: 'I have paid, check',
  checking: 'Checking…',
  paid: 'Payment received. Thank you! We will set up your account and message you.',
  notYet: 'We have not seen the payment yet. It can take a minute. Try again shortly.',
  contactUs: 'We will check your plan and message you a payment link, so there is nothing to pay right now.',
  alreadyPaid: 'This request is already paid. We will message you about your account.',
  failed: 'We could not open the payment just now. No problem, we will message you a payment link.',
} as const;

export interface PayLink {
  readonly linkUrl: string;
  readonly amountPaise: number;
}

export type PayResult =
  | { readonly kind: 'link'; readonly link: PayLink }
  | { readonly kind: 'paid' }
  | { readonly kind: 'contact-us' }
  | { readonly kind: 'failed' };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

async function call(path: string, init: RequestInit, options: SubmitOptions): Promise<unknown> {
  const doFetch = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? REQUEST_TIMEOUT_MS);
  try {
    const res = await doFetch(`${(options.baseUrl ?? apiBase()).replace(/\/+$/, '')}${PAY_PATH}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      signal: controller.signal,
    });
    if (!res.ok) return undefined;
    return (await res.json()) as unknown;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

/** Whether the server offers online payment right now. Never rejects; any problem means "not offered". */
export async function fetchPayAvailable(options: SubmitOptions = {}): Promise<boolean> {
  const body = await call('/config', { method: 'GET' }, options);
  return isRecord(body) && body.customerPay === true;
}

/** Ask for the owner's payment link. The price is the server's; only the proof of ownership is sent. */
export async function requestPayLink(who: { referenceCode: string; email: string }, options: SubmitOptions = {}): Promise<PayResult> {
  const body = await call('/pay-link', { method: 'POST', body: JSON.stringify(who) }, options);
  if (!isRecord(body)) return { kind: 'failed' };
  if (body.outcome === 'paid') return { kind: 'paid' };
  if (body.outcome === 'contact-us') return { kind: 'contact-us' };
  const link = isRecord(body.link) ? body.link : null;
  if (body.outcome === 'link' && link && typeof link.linkUrl === 'string' && typeof link.amountPaise === 'number' && /^https:\/\//.test(link.linkUrl)) {
    return { kind: 'link', link: { linkUrl: link.linkUrl, amountPaise: link.amountPaise } };
  }
  return { kind: 'failed' };
}

/** Paid yet? `null` when we could not tell. */
export async function fetchPaid(who: { referenceCode: string; email: string }, options: SubmitOptions = {}): Promise<boolean | null> {
  const body = await call('/status', { method: 'POST', body: JSON.stringify(who) }, options);
  return isRecord(body) && typeof body.paid === 'boolean' ? body.paid : null;
}
