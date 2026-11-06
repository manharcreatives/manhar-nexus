/**
 * Manhar Nexus plan catalog and price quotes: the single source of truth for what a plan costs.
 *
 * The API prices payment links from this (so staff never type an amount), and the landing page's displayed prices
 * are checked against it by a test so the two cannot drift. All money here is integer PAISE; list prices are
 * EX-GST and GST is added once, at the end, on the discounted subtotal.
 */

export const BILLING_CYCLES = ['monthly', 'yearly'] as const;
export type BillingCycleKey = (typeof BILLING_CYCLES)[number];

/** Plans that have a public price. Many Doors (4+ outlets) is a conversation, not a price. */
export const PRICED_PLAN_KEYS = ['counter', 'floor', 'pass'] as const;
export type PricedPlanKey = (typeof PRICED_PLAN_KEYS)[number];

/** Every plan key a registration can carry ('not-sure' = the visitor did not pick one). */
export const PLAN_KEYS = ['counter', 'floor', 'pass', 'many-doors', 'not-sure'] as const;
export type PlanKeyValue = (typeof PLAN_KEYS)[number];

export const GST_PERCENT = 18;

export interface PlanPrice {
  name: string;
  /** Ex-GST list price per month, paise. */
  monthlyPaise: number;
  /** Ex-GST list price per year, paise. */
  yearlyPaise: number;
  /** Ex-GST yearly price during the Founding Restaurants window, paise (a fixed, rounded price, not computed). */
  foundingYearlyPaise: number;
  /** True when the one-time Launch Pack is part of the plan at no charge. */
  includesLaunchPack: boolean;
}

export const PLAN_PRICES: Readonly<Record<PricedPlanKey, PlanPrice>> = {
  counter: { name: 'Counter', monthlyPaise: 59_900, yearlyPaise: 599_000, foundingYearlyPaise: 449_000, includesLaunchPack: false },
  floor: { name: 'Floor', monthlyPaise: 129_900, yearlyPaise: 1_299_000, foundingYearlyPaise: 974_000, includesLaunchPack: false },
  pass: { name: 'Pass', monthlyPaise: 249_900, yearlyPaise: 2_499_000, foundingYearlyPaise: 1_874_000, includesLaunchPack: true },
};

/** One-time Launch Pack (we set the workspace up with you), ex-GST. Included in Pass and in Founding yearly plans. */
export const LAUNCH_PACK_PAISE = 349_900;

/** The Founding Restaurants offer: a discounted first-year price on YEARLY plans, with the Launch Pack included. */
export const FOUNDING = {
  opensOn: '2026-11-01',
  closesAt: '2027-01-31T23:59:00+05:30',
  discountPercent: 25,
} as const;

export function isFoundingOpen(at: Date): boolean {
  const opens = Date.parse(`${FOUNDING.opensOn}T00:00:00+05:30`);
  const closes = Date.parse(FOUNDING.closesAt);
  const t = at.getTime();
  return t >= opens && t <= closes;
}

export function isPricedPlan(key: string): key is PricedPlanKey {
  return (PRICED_PLAN_KEYS as readonly string[]).includes(key);
}

export interface QuoteLine {
  label: string;
  /** Signed paise: negative for a discount. */
  amountPaise: number;
}

export interface Quote {
  planKey: PricedPlanKey;
  planName: string;
  cycle: BillingCycleKey;
  foundingApplied: boolean;
  launchPackCharged: boolean;
  /** What the owner pays: subtotal + GST, paise. This is the payment link amount. */
  totalPaise: number;
  subtotalPaise: number;
  gstPaise: number;
  gstPercent: number;
  lines: QuoteLine[];
  /** A line fit for the payment link's purpose (shown to the owner by Cashfree), at most 200 characters. */
  description: string;
}

export class QuoteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuoteError';
  }
}

export interface QuoteInput {
  planKey: string;
  cycle: string;
  /** The moment the Founding offer is judged at: pass the registration date so a lead keeps the offer it signed up under. */
  offerDate?: Date;
  /** Add the one-time Launch Pack when the plan does not already include it. */
  launchPack?: boolean;
}

/** Whole paise, GST on a subtotal: half-up like the landing page's gstInclusiveExact. */
export function gstOn(subtotalPaise: number): number {
  return Math.round((subtotalPaise * GST_PERCENT) / 100);
}

/**
 * Prices a plan. Throws QuoteError for a plan without a public price (Many Doors, "not sure") or a bad cycle:
 * those need a person to pick the plan or enter an amount.
 */
export function quotePlan(input: QuoteInput): Quote {
  if (!isPricedPlan(input.planKey)) {
    throw new QuoteError(
      input.planKey === 'many-doors'
        ? 'Many Doors (4+ outlets) has no public price: agree the amount with the customer first.'
        : 'No plan was chosen for this request: pick a plan first.',
    );
  }
  if (!(BILLING_CYCLES as readonly string[]).includes(input.cycle)) {
    throw new QuoteError(`Unknown billing cycle: ${input.cycle}`);
  }
  const cycle = input.cycle as BillingCycleKey;
  const plan = PLAN_PRICES[input.planKey];
  const founding = cycle === 'yearly' && isFoundingOpen(input.offerDate ?? new Date());

  const listPaise = cycle === 'yearly' ? plan.yearlyPaise : plan.monthlyPaise;
  const lines: QuoteLine[] = [{ label: `${plan.name} plan, ${cycle}`, amountPaise: listPaise }];
  let subtotal = listPaise;

  if (founding) {
    const discount = plan.foundingYearlyPaise - plan.yearlyPaise; // negative
    lines.push({ label: `Founding Restaurants offer (${FOUNDING.discountPercent}% off the first year)`, amountPaise: discount });
    subtotal += discount;
  }

  const launchPackIncluded = plan.includesLaunchPack || founding;
  const launchPackCharged = Boolean(input.launchPack) && !launchPackIncluded;
  if (launchPackCharged) {
    lines.push({ label: 'Launch Pack (one-time setup)', amountPaise: LAUNCH_PACK_PAISE });
    subtotal += LAUNCH_PACK_PAISE;
  }

  const gstPaise = gstOn(subtotal);
  lines.push({ label: `GST ${GST_PERCENT}%`, amountPaise: gstPaise });

  const flags = [founding ? `Founding ${FOUNDING.discountPercent}% off` : null, launchPackCharged ? 'with Launch Pack' : null].filter(Boolean);
  const description = `Manhar Nexus ${plan.name}, ${cycle}${flags.length ? ` (${flags.join(', ')})` : ''}, incl. ${GST_PERCENT}% GST`.slice(0, 200);

  return {
    planKey: input.planKey,
    planName: plan.name,
    cycle,
    foundingApplied: founding,
    launchPackCharged,
    totalPaise: subtotal + gstPaise,
    subtotalPaise: subtotal,
    gstPaise,
    gstPercent: GST_PERCENT,
    lines,
    description,
  };
}
