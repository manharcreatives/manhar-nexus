import { QR_MENU_LIVE, QR_MENU_NAME } from './flags';
import type {
  AddOn,
  BillingCycle,
  FoundingOffer,
  OnboardingItem,
  Plan,
  PlanKey,
  PricingContent,
} from './types';

/* ───────────────────────────── money helpers ───────────────────────────── */

/** GST on subscriptions and onboarding fees. */
export const GST_RATE = 0.18;
export const GST_PERCENT = 18;

/** Amount including 18% GST, rounded to the nearest whole rupee. ₹599 → ₹707. */
export function gstInclusive(amount: number): number {
  return Math.round(amount * (1 + GST_RATE));
}

/** Amount including 18% GST to the paisa, as a rupee number with 2 decimals. ₹599 → 706.82. */
export function gstInclusiveExact(amount: number): number {
  return Math.round(amount * 118) / 100;
}

/** The GST portion alone, to the paisa. */
export function gstAmountExact(amount: number): number {
  return Math.round(amount * 18) / 100;
}

/**
 * Format rupees with Indian digit grouping and the ₹ sign.
 * Whole numbers print without decimals; pass `fractionDigits: 2` to force paise.
 *   formatINR(5990)            → '₹5,990'
 *   formatINR(100000)          → '₹1,00,000'
 *   formatINR(706.82)          → '₹706.82'
 */
export function formatINR(amount: number, options: { readonly fractionDigits?: 0 | 2 } = {}): string {
  const negative = amount < 0;
  const abs = Math.abs(amount);
  const digits = options.fractionDigits ?? (Number.isInteger(abs) ? 0 : 2);
  const [intPart = '0', frac] = abs.toFixed(digits).split('.');
  const last3 = intPart.slice(-3);
  const rest = intPart.slice(0, -3);
  const grouped = rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}` : last3;
  return `${negative ? '−' : ''}₹${grouped}${frac ? `.${frac}` : ''}`;
}

/** “₹1,532.82 incl. 18% GST” — the hover/tap hint under a price. */
export function gstHint(amount: number): string {
  return `${formatINR(gstInclusiveExact(amount), { fractionDigits: 2 })} incl. ${GST_PERCENT}% GST`;
}

const ONES = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
] as const;
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'] as const;

function below1000(n: number): string {
  const parts: string[] = [];
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds > 0) parts.push(`${ONES[hundreds]} hundred`);
  if (rest > 0) {
    if (rest < 20) parts.push(ONES[rest] ?? '');
    else parts.push(`${TENS[Math.floor(rest / 10)]}${rest % 10 ? ` ${ONES[rest % 10]}` : ''}`);
  }
  return parts.join(' ');
}

/** 12990 → 'twelve thousand nine hundred ninety'. Supports 0 – 99,99,999. */
export function rupeesInWords(amount: number): string {
  const n = Math.round(Math.abs(amount));
  if (n === 0) return 'zero';
  const parts: string[] = [];
  const lakhs = Math.floor(n / 100000);
  const thousands = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;
  if (lakhs > 0) parts.push(`${below1000(lakhs)} lakh`);
  if (thousands > 0) parts.push(`${below1000(thousands)} thousand`);
  if (rest > 0) parts.push(below1000(rest));
  return parts.join(' ');
}

/** Screen-reader label: 'twelve thousand nine hundred ninety rupees per year plus GST'. */
export function priceAriaLabel(amount: number, cycle: BillingCycle): string {
  return `${rupeesInWords(amount)} rupees per ${cycle === 'yearly' ? 'year' : 'month'} plus GST`;
}

/* ───────────────────────────── plans ───────────────────────────── */

const planHref = (key: PlanKey): string => `/#register?plan=${key}&cycle=yearly`;

/**
 * Registration deep link for a plan card. The FOUNDATION hook reads the hash params.
 *   planCtaHref('floor', 'yearly') → '/#register?plan=floor&cycle=yearly'
 */
export function planCtaHref(plan: PlanKey, cycle: BillingCycle = 'yearly'): string {
  return `/#register?plan=${plan}&cycle=${cycle}`;
}

export const PLANS: readonly Plan[] = [
  {
    key: 'counter',
    name: 'Counter',
    eyebrow: 'FOR CAFÉS AND COUNTERS',
    tagline: 'One counter, a few tables, and every rupee accounted for.',
    badge: 'START SMALL',
    forLine: 'Cafés, bakeries, small eateries (1 outlet).',
    monthly: 599,
    yearly: 5990,
    yearlySaving: 1198,
    yearlyPerMonth: 499,
    foundingYearly: 4490,
    outlets: '1 outlet',
    staffLogins: 'Up to 5 staff logins',
    highlights: [
      '1 outlet, up to 5 staff logins',
      QR_MENU_LIVE ? `${QR_MENU_NAME}: QR menu and table ordering` : 'Menu with portions, Add-ons and Sold-Out',
      'Live kitchen screen, no refresh',
      'Checkout with GST; cash and UPI',
      'Reports, Activity History, standard roles',
    ],
    features: [
      'Business Workspace for 1 outlet, up to 5 staff logins',
      'Menu with portions, Add-ons and a Sold-Out switch',
      ...(QR_MENU_LIVE ? [`${QR_MENU_NAME}: QR digital menu and table ordering (guest orders are confirmed by your waiter)`] : []),
      'Floor map with live Dining Table status',
      'Guest Sessions and Service Requests, round after round',
      'Kitchen Operations Screen — live, no refresh',
      'Checkout with GST by line; cash (with change due) and UPI',
      'Refund and Void, always with a reason',
      // Moved here from Floor: the Owner “Today” home and 14-day trend are in every plan (03b §1.4 rows 13–14).
      'Owner “Today” home, daily closing report, sales summary, top items, 14-day trend, CSV download',
      'Standard roles, Activity History with Verify, default alerts',
    ],
    cta: { label: 'Start with Counter', href: planHref('counter') },
    highlight: false,
    enquiryOnly: false,
  },
  {
    key: 'floor',
    name: 'Floor',
    eyebrow: 'FOR DINE-IN RESTAURANTS',
    tagline: 'Floor and kitchen finally speaking the same language.',
    badge: 'BEST FOR MOST DINE-IN ROOMS',
    forLine: 'Standard dine-in restaurants (1 outlet).',
    monthly: 1299,
    yearly: 12990,
    yearlySaving: 2598,
    yearlyPerMonth: 1082,
    foundingYearly: 9740,
    outlets: '1 outlet',
    staffLogins: 'Up to 15 staff logins',
    highlights: [
      'Everything in Counter',
      'Up to 15 staff logins and custom roles',
      'Operating Costs with approvals',
      'Alerts Center with rules you can tune',
      'Email and WhatsApp support',
    ],
    features: [
      'Everything in Counter',
      'Up to 15 staff logins and custom roles',
      'Operating Costs with approve / reject',
      'Alerts Center with rules you can tune',
      'Email and WhatsApp support in business hours',
      'Launch Pack available at ₹3,499',
    ],
    cta: { label: 'Start with Floor', href: planHref('floor') },
    highlight: true,
    enquiryOnly: false,
  },
  {
    key: 'pass',
    name: 'Pass',
    eyebrow: 'FOR BUSY ROOMS',
    tagline: 'When plates leave the pass every few seconds, you need no surprises.',
    badge: 'ROOM TO GROW',
    forLine: 'Busy rooms and small groups (up to 3 outlets).',
    monthly: 2499,
    yearly: 24990,
    yearlySaving: 4998,
    yearlyPerMonth: 2083,
    foundingYearly: 18740,
    outlets: 'Up to 3 outlets',
    staffLogins: 'Up to 40 staff logins',
    highlights: [
      'Everything in Floor',
      'Up to 3 outlets with a location switcher',
      'Up to 40 staff logins',
      'Priority queue with a named contact',
      'Launch Pack included',
    ],
    features: [
      'Everything in Floor',
      'Up to 3 outlets with a location switcher and location-scoped roles',
      'Up to 40 staff logins',
      'Priority support queue with a named contact',
      'Quarterly review call (30 minutes)',
      'Launch Pack included',
      'First access to new modules as they ship (no dates promised)',
      'Price locked for 24 months for Founding Restaurants',
    ],
    cta: { label: 'Start with Pass', href: planHref('pass') },
    highlight: false,
    enquiryOnly: false,
  },
  {
    key: 'many-doors',
    name: 'Many Doors',
    eyebrow: 'FOR GROUPS',
    tagline: 'Four outlets or forty? Let’s design it together.',
    badge: 'TALK TO US',
    forLine: 'Restaurant groups with 4+ outlets.',
    monthly: null,
    yearly: null,
    yearlySaving: null,
    yearlyPerMonth: null,
    foundingYearly: null,
    outlets: '4+ outlets',
    staffLogins: 'Custom',
    highlights: ['4+ outlets, custom onboarding', 'Custom roles at scale', 'Tell us what to build first'],
    features: [
      '4+ outlets, central menu and cross-outlet needs',
      'Custom roles at scale and custom onboarding',
      'A conversation about what we should build first',
    ],
    cta: { label: 'Talk to us', href: '/#register?plan=many-doors&cycle=yearly' },
    highlight: false,
    enquiryOnly: true,
    note: 'Central menu and cross-outlet comparison aren’t built yet — Many Doors restaurants help decide the order.',
  },
];

/** Plans with public prices (everything except Many Doors). */
export const PRICED_PLANS: readonly Plan[] = PLANS.filter((p) => !p.enquiryOnly);

export function getPlan(key: PlanKey): Plan {
  const plan = PLANS.find((p) => p.key === key);
  if (!plan) throw new Error(`Unknown plan: ${key}`);
  return plan;
}

/** Ex-GST price for a plan in a billing cycle, or null for enquiry plans. */
export function planPrice(plan: Plan, cycle: BillingCycle): number | null {
  return cycle === 'yearly' ? plan.yearly : plan.monthly;
}

/* ───────────────────────────── Founding Restaurants ───────────────────────────── */

export const FOUNDING_OFFER: FoundingOffer = {
  eyebrow: 'FOUNDING RESTAURANTS · UNTIL 31 JAN 2027',
  title: 'Founding Restaurants',
  body: '25% off your first year on any yearly plan, Launch Pack included, and your price locked for year two. In return, we ask for honest feedback. Nexus is new; you’d be among our first restaurants.',
  code: 'FOUNDING26',
  discountPercent: 25,
  opensOn: '2026-11-01',
  closesAt: '2027-01-31T23:59:00+05:30',
  closesLabel: '31 Jan 2027',
  perks: [
    'Yearly plan at 25% off the first year',
    'Year-2 renewal at today’s list price (price lock for 24 months)',
    'Launch Pack included',
    'A direct line to the builders; your feedback shapes the build order of coming-soon modules',
    '14-day pilot available first (by approval)',
  ],
  asks: [
    'Two 30-minute feedback calls in the first two months',
    'Permission to contact you about issues',
    'Your name or logo only with your written consent',
  ],
  honestFraming:
    'Nexus is new. You would be among our first restaurants. That is why the price is lower, and why we set you up by hand, in batches — a few at a time. We will tell you the wait honestly.',
};

/** True from 1 Nov 2026 until 23:59 IST on 31 Jan 2027. Pure: pass a Date to test. */
export function isFoundingOfferOpen(now: Date = new Date()): boolean {
  const opens = Date.parse(`${FOUNDING_OFFER.opensOn}T00:00:00+05:30`);
  const closes = Date.parse(FOUNDING_OFFER.closesAt);
  const t = now.getTime();
  return t >= opens && t <= closes;
}

/* ───────────────────────────── add-ons and onboarding ───────────────────────────── */

export const ADD_ONS: readonly AddOn[] = [
  {
    id: 'extra-outlet',
    name: 'Extra outlet',
    price: '+50% of your plan’s price, per outlet per month',
    note: 'Our team creates each location with you. Pass includes 3 outlets, then ₹999 per extra outlet per month.',
    status: 'available',
  },
  {
    id: 'extra-logins',
    name: 'Extra staff login',
    price: '₹49 per login per month (₹490 a year)',
    note: 'A policy limit applied by our team when we set up your Workspace.',
    status: 'available',
  },
  {
    id: 'premium-support',
    name: 'Premium support',
    price: '₹799 per month (₹7,990 a year)',
    note: 'A priority queue, a named contact and a monthly 30-minute review call. Pass already includes the queue and a named contact, with a quarterly review call. We don’t promise response times we can’t yet prove.',
    status: 'available',
  },
  {
    id: 'printer-setup',
    name: 'Printer & kitchen-ticket setup',
    price: 'Coming soon — not sold yet',
    note: 'The print engine is built but not yet validated with real printers.',
    status: 'coming-soon',
  },
  {
    id: 'messaging',
    name: 'WhatsApp / SMS messaging',
    price: 'Coming soon — not sold yet',
    note: 'When it ships, credits will be passed on at cost plus handling.',
    status: 'coming-soon',
  },
];

export const LAUNCH_PACK_PRICE = 3499;

export const ONBOARDING: readonly OnboardingItem[] = [
  {
    id: 'launch-pack',
    name: 'Launch Pack',
    amount: LAUNCH_PACK_PRICE,
    price: '₹3,499',
    detail:
      'Menu upload (up to 150 items), floor layout, staff roles, one remote training and a go-live check-in. Worth about ₹4,500 à la carte. Included with Pass and for Founding Restaurants.',
  },
  {
    id: 'menu-upload',
    name: 'Menu upload',
    amount: 1500,
    price: '₹1,500',
    detail: 'Up to 150 items; ₹5 per extra item. We enter categories, items, variants, Add-ons and tax categories from your Excel, PDF or photos.',
  },
  {
    id: 'floor-layout',
    name: 'Floor & table layout',
    amount: 500,
    price: '₹500',
    detail: 'Dining Areas, Dining Tables and capacities.',
  },
  {
    id: 'remote-training',
    name: 'Staff, roles & training (remote)',
    amount: 1500,
    price: '₹1,500',
    detail: 'A 2-hour video session for up to 8 staff, plus role setup.',
  },
  {
    id: 'onsite-training',
    name: 'On-site training (Gujarat)',
    amount: 3500,
    price: '₹3,500 + travel at actuals',
    detail: 'In person, one visit.',
  },
  {
    id: 'go-live',
    name: 'Go-live day check-in',
    amount: 1000,
    price: '₹1,000',
    detail: 'We are on call during your first service.',
  },
  {
    id: 'migration',
    name: 'Historic data migration',
    amount: null,
    price: 'Not offered at launch',
    detail: 'We enter your menu, not your past sales. Keep exporting from your old system for your records.',
  },
];

/* ───────────────────────────── section copy ───────────────────────────── */

export const PRICING: PricingContent = {
  header: {
    eyebrow: 'PRICING, WRITTEN DOWN',
    headline: {
      text: 'One price per outlet. No add-on maze.',
      accent: 'price',
    },
    subhead: 'The kitchen screen, alerts, Activity History and role-based access are already in. Prices exclude 18% GST.',
  },
  toggle: {
    monthly: 'Monthly',
    yearly: 'Yearly — 2 months free',
    ariaLabel: 'Billing period',
  },
  gstNote: '+ GST',
  gstInclusiveHint: 'incl. 18% GST',
  foundingRibbon: FOUNDING_OFFER.body,
  strikeLabel: 'List price',
  yearlyPerMonthLabel: '≈ per month',
  savingLabel: 'You save',
  perMonth: '/month',
  perYear: '/year',
  letsTalk: 'Let’s talk',
  underGrid: {
    lead: 'Not sure?',
    label: 'Book a live demo',
    href: '/#register?begin=demo',
  },
  footnote:
    'All prices exclude 18% GST. Staff-login and outlet limits are applied by our team when we set up your Workspace. ' + (QR_MENU_LIVE ? 'Printing, bookings, stock, WhatsApp messaging and card payments are coming soon and aren’t part of any plan today.' : 'Printing, QR ordering, bookings, stock, WhatsApp messaging and card payments are coming soon and aren’t part of any plan today.'),
  flowTitle: 'Pay online, start with a person',
  flow: [
    {
      number: '01',
      title: 'Register',
      body: 'Two minutes, one form.',
      icon: 'ClipboardList',
    },
    {
      number: '02',
      title: 'Pay',
      body: 'A secure payment link — UPI, card or net banking via Cashfree.',
      icon: 'CreditCard',
    },
    {
      number: '03',
      title: 'Workspace',
      body: 'We set up your Business Workspace by hand.',
      icon: 'KeyRound',
    },
    {
      number: '04',
      title: 'First service',
      body: 'Open a table and send your first Service Request.',
      icon: 'Rocket',
    },
  ],
  onboardingTitle: 'Onboarding (one-time)',
  onboardingIntro:
    'Launch Pack ₹3,499 — menu upload (up to 150 items), floor layout, staff roles, one remote training, go-live check-in. Or pick à la carte.',
  onboardingRefund: 'Setup fees are refundable in full before work starts; completed work is not refundable.',
  addOnsTitle: 'Add-ons',
  comingSoonTitle: 'Coming soon (not sold yet)',
  includedTitle: 'Included, where others charge extra',
  included: [
    'Kitchen Operations Screen (KOS) on any screen you own',
    'Activity History with Verify',
    'Role-based access, so the cook never sees sales',
    'CSV download of your reports',
    'Alerts Center (rules you can tune from Floor)',
    'Operating Costs with approvals (from Floor)',
  ],
  billingFaqTitle: 'Billing, briefly',
  billingFaqIds: ['free-trial', 'cancel-and-data', 'hidden-fees', 'payments', 'refund-policy'],
};
