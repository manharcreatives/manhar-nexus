import { QR_MENU_LIVE } from './flags';
import type { Faq, SectionHeader } from './types';

/** FAQ section header. Not in the page-copy report; written to match its voice. */
export const FAQ_HEADER: SectionHeader = {
  eyebrow: 'ASKED BEFORE YOU PAY',
  headline: {
    text: 'Questions worth asking before you pay.',
    accent: 'asking',
  },
  subhead: 'Straight answers, including the uncomfortable ones.',
};

/** The five questions shown first; the rest sit behind “More questions”. */
export const FAQ_FEATURED_IDS: readonly string[] = [
  'getting-started',
  ...(QR_MENU_LIVE ? ['nexus-menu'] : ['hardware-printers']),
  'free-trial',
  'hidden-fees',
  'data-ownership',
];

/**
 * Sixteen questions. `answer` is plain text and is also the text used in the
 * FAQPage JSON-LD (see seo.ts), so the visible page and the structured data cannot drift.
 */
export const FAQS: readonly Faq[] = [
  ...(QR_MENU_LIVE
    ? [
        {
          id: 'nexus-menu',
          topic: 'product' as const,
          question: 'Can my guests order from their phones?',
          answer:
            'Yes, with Nexus Menu. Each table gets its own QR code; guests open your live menu in their phone browser (no app, no login), browse with photos, and can send an order and follow its status. By default your waiter confirms every guest order before the kitchen starts, and your staff confirm every payment, so a person is always in the loop. Prices are recalculated on the server, sold-out dishes can’t be ordered, and a closed table shows the menu read-only. You can switch guest ordering off for any table.',
        },
      ]
    : []),
  {
    id: 'getting-started',
    topic: 'start',
    question: 'How long does it take to get started?',
    answer:
      'We create your Business Workspace by hand, and our target is within one working day of payment. Entering your menu and drawing your tables takes anything from a few hours to a few days, depending on the size of your menu — you can do it yourself, or we can do it for you with a Launch Pack. We stay available for your first service.',
  },
  {
    id: 'hardware-printers',
    topic: 'product',
    question: 'What hardware do I need? Do you support printers?',
    // Softened: printing is built in the engine but has no screen and no validated printer yet.
    answer:
      'Nexus runs in a web browser, so any phone, tablet or computer with a modern browser and internet works, including for the Kitchen Operations Screen. Receipt and kitchen-ticket printing through a local print agent is built in the engine but not yet validated with real printers, so it is coming soon; today you can print reports from your browser. We will tell you honestly before you pay if your setup needs something that isn’t ready.',
  },
  {
    id: 'internet-drops',
    topic: 'product',
    question: 'What happens if the internet drops?',
    answer:
      'Nexus needs an internet connection and is not an offline billing system. Screens show when they are reconnecting, repeated taps and retries are recognised so you do not get duplicate Service Requests or payments, and everything re-syncs when the connection returns. For a long outage, keep a paper pad for kitchen slips and enter them later.',
  },
  {
    id: 'data-ownership',
    topic: 'data',
    question: 'Who owns my data?',
    // Softened: a full Workspace export is a manual job today; CSV report downloads are self-serve.
    answer:
      'You do. Menus, tables, Service Requests, Checkouts, reports and staff details in your Business Workspace belong to your business. You can download reports as CSV at any time, and when you leave we give you a 30-day window to export your data — reports from the app, and a fuller export of your Workspace data prepared by us on request — before it is deleted. We do not sell your data or your guests’ data.',
    links: [{ text: 'Privacy Policy', href: '/privacy' }],
  },
  {
    id: 'gst',
    topic: 'product',
    question: 'How does GST work in Nexus?',
    answer:
      'You set tax categories and rates; Nexus calculates GST on the server for every line, groups it by rate on the Checkout and shows it in your reports. Prices are tax-exclusive today. Nexus does not file returns or generate e-invoices — it gives you accurate figures to hand to your accountant. This is general information, not tax advice; please confirm your rates with your CA.',
  },
  {
    id: 'multiple-outlets',
    topic: 'product',
    question: 'Can I run more than one outlet?',
    answer:
      'Yes, in a basic way. One login can work across locations, with a location switcher and roles scoped per location. Our team creates the locations with you. Central menu management and cross-outlet comparison are not built yet — if you run four or more outlets, choose “Many Doors” and tell us what you need.',
  },
  {
    id: 'free-trial',
    topic: 'billing',
    question: 'Is there a free trial?',
    answer:
      'There’s no instant self-serve trial, because we set each Workspace up by hand. Instead you can book a free live demo, ask for a 14-day pilot (we’ll have a short call first), or pay and use the 14-day money-back guarantee, counted from the day your Workspace is activated.',
  },
  {
    id: 'cancel-and-data',
    topic: 'billing',
    question: 'Can I cancel? What happens to my data?',
    answer:
      'Yes. Monthly plans can be cancelled any time and run to the end of the paid month. Yearly plans run to the end of the term and do not renew. After your subscription ends you have 30 days to export your data; then it is deleted from our live systems, and encrypted backups roll off as they expire. See the Refund & Cancellation Policy for details.',
    links: [{ text: 'Refund & Cancellation Policy', href: '/refund-policy' }],
  },
  {
    id: 'hidden-fees',
    topic: 'billing',
    question: 'Are there hidden fees?',
    answer:
      'No. Prices are written on this page and exclude 18% GST. One-time onboarding fees (Launch Pack ₹3,499, or à la carte) and add-ons (extra outlet, extra staff logins, premium support) are listed with their prices. Nexus does not take a cut of your sales. Payment-gateway charges on your guests’ payments don’t apply today because Nexus only records cash and UPI payments you receive directly.',
  },
  {
    id: 'payments',
    topic: 'billing',
    question: 'How do I pay, and what if a payment fails?',
    answer:
      'Yearly plans are paid once by UPI, card or net banking through a secure Cashfree payment link, and we remind you before renewal — nothing is debited automatically. Monthly plans use UPI AutoPay (your bank notifies you 24 hours before each debit and you can revoke it any time). If a payment fails you get a reminder and a payment link, a 7-day grace period with full service, then a limited mode while you sort it out.',
    links: [{ text: 'Billing & Payments Policy', href: '/billing-policy' }],
  },
  {
    id: 'refund-policy',
    topic: 'billing',
    question: 'What is the refund policy?',
    answer:
      'Within 14 days of your Workspace being activated, you can ask for a full refund of your first subscription payment — no reasons needed. After that, monthly plans stop at the end of the month and yearly plans are non-refundable except where we fail to deliver, a feature you paid for is withdrawn, or you were charged in error. Onboarding fees are refundable before work starts.',
    links: [{ text: 'Refund & Cancellation Policy', href: '/refund-policy' }],
  },
  {
    id: 'security',
    topic: 'data',
    question: 'How secure is Nexus?',
    answer:
      'Each restaurant’s data is separated from every other restaurant’s, staff only see what their role allows, passwords are stored as one-way hashes with lockout after repeated failures, paid Checkouts can’t be edited, and Activity History can be verified for tampering. Nexus hasn’t had an external penetration test or formal certification yet, and no system is perfectly secure. We will share hosting and backup details before you pay.',
  },
  {
    id: 'support',
    topic: 'company',
    question: 'What support do I get, and in which languages?',
    answer:
      'Every plan includes email support in business hours; Floor adds WhatsApp; Pass adds a priority queue and a named contact. We don’t promise response-time guarantees we can’t prove yet. The screens are in English today; Gujarati and Hindi are planned.',
    internalNote:
      'Owner: add which languages your support team can offer (e.g. Gujarati, Hindi, English) — only if true. Then update the sentence and the JSON-LD availableLanguage.',
  },
  {
    id: 'switching',
    topic: 'start',
    question: 'Can I move over from my current billing software?',
    answer:
      'Yes for your menu: send us your menu in Excel, PDF or even photos and we’ll enter it with the menu-upload service. We don’t import your past sales history at launch, so keep exporting from your old system for your records, and run both side by side for a few days if you like.',
  },
  {
    id: 'checkout-payments',
    topic: 'product',
    question: 'Which payments can I take at Checkout?',
    answer:
      'Cash, with the amount tendered and change due calculated for you, and UPI, where your staff confirm the payment using the transaction reference. Card payments, online payment links and discounts are coming soon. You remain responsible for confirming that UPI money has actually arrived.',
  },
  {
    id: 'about-manhar',
    topic: 'company',
    question: 'Who is Manhar Creatives, and is Nexus ready?',
    answer:
      'Manhar Creatives is a design and software studio in Visnagar, Gujarat that builds brand systems, websites and custom software. Nexus is our restaurant product. It is built, tested and ready for pilots, but it hasn’t yet run many restaurants, which is why we’re opening to Founding Restaurants first and setting each up by hand. We’d rather say that plainly than invent customers.',
    links: [{ text: 'manharcreatives.com', href: 'https://www.manharcreatives.com' }],
  },
];

export function getFaq(id: string): Faq | undefined {
  return FAQS.find((f) => f.id === id);
}

/** FAQs for a list of ids, in the order given. Unknown ids are skipped. */
export function faqsByIds(ids: readonly string[]): readonly Faq[] {
  return ids.flatMap((id) => {
    const f = getFaq(id);
    return f ? [f] : [];
  });
}
