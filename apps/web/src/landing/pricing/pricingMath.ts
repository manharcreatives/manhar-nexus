import {
  FOUNDING_OFFER,
  GST_PERCENT,
  gstInclusiveExact,
  formatINR,
  priceAriaLabel,
  rupeesInWords,
  type BillingCycle,
  type Plan,
} from '../content';
import { formatIsoDay, formatIstClock } from '../sectionsC/format';

/** Where the Founding Restaurants window stands relative to `now`. */
export type FoundingState = 'upcoming' | 'open' | 'closed';

/** 'upcoming' before 00:00 IST on opensOn, 'open' until 23:59 IST on the last day, then 'closed'. Pure: pass a Date to test. */
export function foundingState(now: Date = new Date()): FoundingState {
  const opens = Date.parse(`${FOUNDING_OFFER.opensOn}T00:00:00+05:30`);
  const closes = Date.parse(FOUNDING_OFFER.closesAt);
  const t = now.getTime();
  if (t < opens) return 'upcoming';
  if (t > closes) return 'closed';
  return 'open';
}

/** '1 Nov 2026 – 31 Jan 2027, 11:59 pm IST' built from the content dates, never hard-coded. */
export function foundingWindowLabel(): string {
  return `${formatIsoDay(FOUNDING_OFFER.opensOn)} – ${formatIsoDay(FOUNDING_OFFER.closesAt)}, ${formatIstClock(FOUNDING_OFFER.closesAt)}`;
}

/** The mono eyebrow for the banner, relabelled for the 'upcoming' state. */
export function foundingEyebrow(state: FoundingState): string {
  if (state === 'upcoming') {
    return `FOUNDING RESTAURANTS · OPENS ${formatIsoDay(FOUNDING_OFFER.opensOn).toUpperCase()}`;
  }
  return FOUNDING_OFFER.eyebrow;
}

/** Amount with 18% GST to the paisa, or the amount itself when GST is shown separately. */
export function withGst(amount: number, inclusive: boolean): number {
  return inclusive ? gstInclusiveExact(amount) : amount;
}

export interface PriceView {
  /** The big number: what the visitor would pay per billing period (ex- or incl. GST per the switch). */
  readonly amount: number;
  /** Crossed-out list price when a Founding discount applies, else null. */
  readonly listAmount: number | null;
  readonly unit: 'month' | 'year';
  /** Yearly only: the approximate monthly equivalent of `amount`. */
  readonly perMonth: number | null;
  /** Rupees saved against paying monthly for 12 months (yearly only). */
  readonly saving: number | null;
  /** The same price in the other GST mode, for the hint line ('₹1,532.82 with GST'). */
  readonly otherMode: number;
}

export interface PriceOptions {
  readonly inclusive: boolean;
  /** True only while the Founding window is open. Applies to yearly prices only. */
  readonly founding: boolean;
}

/** Everything a plan card needs to print a price. Null for enquiry-only plans. */
export function priceView(plan: Plan, cycle: BillingCycle, options: PriceOptions): PriceView | null {
  if (plan.monthly === null || plan.yearly === null) return null;
  const { inclusive, founding } = options;

  if (cycle === 'monthly') {
    return {
      amount: withGst(plan.monthly, inclusive),
      listAmount: null,
      unit: 'month',
      perMonth: null,
      saving: null,
      otherMode: withGst(plan.monthly, !inclusive),
    };
  }

  const discounted = founding && plan.foundingYearly !== null;
  const base = discounted && plan.foundingYearly !== null ? plan.foundingYearly : plan.yearly;
  // Published per-month figures are used as-is for list prices; discounted prices are rounded.
  const perMonthEx = discounted ? Math.round(base / 12) : plan.yearlyPerMonth ?? Math.round(base / 12);
  return {
    amount: withGst(base, inclusive),
    listAmount: discounted ? withGst(plan.yearly, inclusive) : null,
    unit: 'year',
    perMonth: inclusive ? Math.round(gstInclusiveExact(base) / 12) : perMonthEx,
    saving: withGst(plan.monthly * 12 - base, inclusive),
    otherMode: withGst(base, !inclusive),
  };
}

/** Screen-reader label for the big price: 'twelve thousand nine hundred ninety rupees per year plus GST'. */
export function priceLabel(view: PriceView, inclusive: boolean): string {
  const cycle: BillingCycle = view.unit === 'year' ? 'yearly' : 'monthly';
  if (!inclusive) return priceAriaLabel(view.amount, cycle);
  return `${rupeesInWords(Math.floor(view.amount))} rupees${
    Math.round((view.amount % 1) * 100) ? ` and ${Math.round((view.amount % 1) * 100)} paise` : ''
  } per ${view.unit} including ${GST_PERCENT} percent GST`;
}

/** '₹1,299' -> short display; keeps paise only when present. */
export const money = (amount: number): string => formatINR(amount);

/** Plan features that still make sense once the Founding window is over. */
export function visibleFeatures(plan: Plan, state: FoundingState): readonly string[] {
  if (state !== 'closed') return plan.features;
  return plan.features.filter((f) => !/founding/i.test(f));
}

/** Text that mentions the Founding offer is trimmed once the window has closed. */
export function foundingAwareText(text: string, state: FoundingState): string {
  if (state !== 'closed') return text;
  const trimmed = text
    .replace(/ and for Founding Restaurants/g, '')
    .split(' · ')
    .filter((part) => !/founding restaurants offer/i.test(part))
    .join(' · ');
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}
