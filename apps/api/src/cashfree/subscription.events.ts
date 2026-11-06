/** What a Cashfree Subscriptions webhook tells us, normalised (docs: payments/subscription/webhooks, version 2025-01-01). */
export type SubscriptionEvent =
  | { kind: 'status'; subscriptionId: string; status: string }
  | { kind: 'payment'; subscriptionId: string; cfPaymentId: string; paymentType: 'AUTH' | 'CHARGE'; success: boolean; amountRupees: number | null; failureReason: string | null; occurredAt: Date };

type Bag = Record<string, unknown>;
const isBag = (v: unknown): v is Bag => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : typeof v === 'number' ? String(v) : null);
const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

/** The event type of a subscription webhook body ("SUBSCRIPTION_..."), or null when the body is not one. */
export function subscriptionEventType(rawBody: string): string | null {
  const top = parse(rawBody);
  const type = top ? str(top.type) : null;
  return type !== null && type.startsWith('SUBSCRIPTION_') ? type : null;
}

function parse(rawBody: string): Bag | null {
  try {
    const parsed: unknown = JSON.parse(rawBody);
    return isBag(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Returns the parts we act on, or null for event types we only acknowledge (notification initiated, refunds, card
 * expiry reminders, controlled executions) and for bodies that are not subscription events.
 *  - SUBSCRIPTION_STATUS_CHANGED: data.subscription_details.subscription_status
 *  - SUBSCRIPTION_AUTH_STATUS / _PAYMENT_SUCCESS / _PAYMENT_FAILED: data.payment_id, cf_payment_id, payment_type
 *    (AUTH for the mandate authorisation debit, anything else for a monthly charge), payment_amount, payment_status.
 */
export function parseSubscriptionEvent(rawBody: string): SubscriptionEvent | null {
  const top = parse(rawBody);
  if (!top) return null;
  const type = str(top.type);
  const data = isBag(top.data) ? top.data : null;
  if (!type || !data) return null;

  if (type === 'SUBSCRIPTION_STATUS_CHANGED') {
    const details = isBag(data.subscription_details) ? data.subscription_details : null;
    const subscriptionId = str(details?.subscription_id) ?? str(data.subscription_id);
    const status = str(details?.subscription_status)?.toUpperCase();
    return subscriptionId && status ? { kind: 'status', subscriptionId, status } : null;
  }

  if (type === 'SUBSCRIPTION_AUTH_STATUS' || type === 'SUBSCRIPTION_PAYMENT_SUCCESS' || type === 'SUBSCRIPTION_PAYMENT_FAILED') {
    const subscriptionId = str(data.subscription_id);
    const cfPaymentId = str(data.cf_payment_id) ?? str(data.payment_id);
    if (!subscriptionId || !cfPaymentId) return null;
    const paymentStatus = str(data.payment_status)?.toUpperCase() ?? null;
    const authStatus = isBag(data.authorization_details) ? str(data.authorization_details.authorization_status)?.toUpperCase() : null;
    // AUTH_STATUS carries the authorisation's own status (ACTIVE / FAILED); the others carry payment_status.
    const success =
      type === 'SUBSCRIPTION_PAYMENT_FAILED' ? false : type === 'SUBSCRIPTION_PAYMENT_SUCCESS' ? paymentStatus === 'SUCCESS' : paymentStatus === 'SUCCESS' || authStatus === 'ACTIVE' || authStatus === 'SUCCESS';
    const eventTime = str(top.event_time);
    const when = eventTime ? new Date(eventTime) : new Date();
    const failure = isBag(data.failure_details) ? str(data.failure_details.failure_reason) : null;
    return {
      kind: 'payment',
      subscriptionId,
      cfPaymentId,
      paymentType: str(data.payment_type)?.toUpperCase() === 'AUTH' || type === 'SUBSCRIPTION_AUTH_STATUS' ? 'AUTH' : 'CHARGE',
      success,
      amountRupees: num(data.payment_amount),
      failureReason: failure ? failure.slice(0, 200) : null,
      occurredAt: Number.isNaN(when.getTime()) ? new Date() : when,
    };
  }
  return null;
}
