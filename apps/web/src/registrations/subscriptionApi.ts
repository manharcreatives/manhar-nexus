import { api } from '../auth/api';

/** A UPI AutoPay mandate staff set up for a request's monthly plan (the API never sends the Cashfree session). */
export interface Subscription {
  id: string;
  registrationId: string;
  subscriptionId: string;
  status: string;
  planKey: string;
  amountPaise: number;
  breakdown: { label: string; amountPaise: number }[] | null;
  firstChargeAt: string | null;
  activatedAt: string | null;
  cancelledAt: string | null;
  lastChargeStatus: string | null;
  lastChargeAt: string | null;
  /** Path of the owner's authorisation page; only while the mandate still waits for the owner. */
  authPath: string | null;
  createdAt: string;
  charges: { cfPaymentId: string; kind: string; status: string; amountPaise: number; failureReason: string | null; occurredAt: string }[];
}

export type SubscriptionRefreshOutcome = 'updated' | 'ignored' | 'duplicate' | 'amount-mismatch';

export const listSubscriptions = (registrationId: string): Promise<Subscription[]> =>
  api<Subscription[]>(`/internal/registrations/${registrationId}/subscriptions`);

/** The plan is optional (the request's own plan is used); the price is always the server's. */
export const createSubscription = (registrationId: string, body: { planKey?: string; replaceOpen?: boolean }): Promise<Subscription> =>
  api<Subscription>(`/internal/registrations/${registrationId}/subscriptions`, { method: 'POST', body: JSON.stringify(body) });

export const cancelSubscription = (registrationId: string, id: string): Promise<Subscription> =>
  api<Subscription>(`/internal/registrations/${registrationId}/subscriptions/${id}/cancel`, { method: 'POST', body: JSON.stringify({}) });

export const refreshSubscription = (registrationId: string, id: string): Promise<{ outcome: SubscriptionRefreshOutcome; subscription: Subscription }> =>
  api(`/internal/registrations/${registrationId}/subscriptions/${id}/refresh`, { method: 'POST', body: JSON.stringify({}) });

/** Mandates that still wait for the owner, or debit: a new one is refused while one of these exists. */
export const LIVE_SUBSCRIPTION_STATUSES = ['INITIALIZED', 'BANK_APPROVAL_PENDING', 'ACTIVE', 'ON_HOLD', 'PAUSED', 'CUSTOMER_PAUSED'] as const;
export const isLiveSubscription = (s: Pick<Subscription, 'status'>): boolean => (LIVE_SUBSCRIPTION_STATUSES as readonly string[]).includes(s.status);

/** The page the owner opens to authorise the mandate in their UPI app. */
export const authorisationUrl = (s: Pick<Subscription, 'authPath'>, origin = window.location.origin): string | null =>
  s.authPath ? `${origin}${s.authPath}` : null;

export function autopayMessage(
  r: { contactName: string; restaurantName: string },
  url: string,
  amountPaise: number,
  formatRupees: (paise: number) => string,
): string {
  return `Hello ${r.contactName}, this is Manhar Nexus. To start UPI AutoPay for ${r.restaurantName} (₹${formatRupees(amountPaise)} a month, GST included), please approve it here: ${url} . You can cancel it any time from your UPI app.`;
}
