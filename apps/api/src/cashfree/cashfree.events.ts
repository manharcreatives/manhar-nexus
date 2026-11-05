/** What the payment-link webhook tells us, normalised from whichever body shape Cashfree sends. */
export interface LinkEvent {
  linkId: string;
  /** Cashfree's status text, upper-cased: ACTIVE | PAID | PARTIALLY_PAID | EXPIRED | CANCELLED ... */
  linkStatus: string;
  /** Rupees paid so far, when the event says. */
  amountPaidRupees: number | null;
  /** order.order_id of the successful payment, when present. */
  orderId: string | null;
}

type Bag = Record<string, unknown>;
const isBag = (v: unknown): v is Bag => typeof v === 'object' && v !== null && !Array.isArray(v);

const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : typeof v === 'number' ? String(v) : null);
const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

/** `a` may itself be a JSON string (form-encoded bodies carry nested objects that way). */
const asBag = (v: unknown): Bag | null => {
  if (isBag(v)) return v;
  if (typeof v === 'string') {
    try {
      const parsed: unknown = JSON.parse(v);
      return isBag(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
};

/**
 * Cashfree's docs show the link event as JSON ({ type: "PAYMENT_LINK_EVENT", data: { link_id, link_status, ..., order } })
 * but also say link webhooks come "in a form data format". Both are accepted: the same fields are looked up at the top
 * level, under `data`, or as a JSON string inside a form field. Returns null when the body is not a link event
 * (other event types are acknowledged and ignored by the caller).
 */
export function parseLinkEvent(rawBody: string, contentType: string | undefined): LinkEvent | null {
  let top: Bag | null = null;
  if (contentType?.toLowerCase().includes('application/x-www-form-urlencoded')) {
    top = Object.fromEntries(new URLSearchParams(rawBody));
  } else {
    top = asBag(rawBody);
  }
  if (!top) return null;

  const type = str(top.type);
  if (type !== null && type !== 'PAYMENT_LINK_EVENT') return null;

  const data = asBag(top.data) ?? top;
  const linkId = str(data.link_id);
  const linkStatus = str(data.link_status)?.toUpperCase() ?? null;
  if (!linkId || !linkStatus) return null;

  const order = asBag(data.order);
  return {
    linkId,
    linkStatus,
    amountPaidRupees: num(data.link_amount_paid),
    orderId: str(order?.order_id) ?? str(data.order_id),
  };
}
