import type { OwnerFillIn } from './types';

/**
 * Everything the owner (or the lawyer / CA) must supply before launch, in one place.
 *
 * `tokens` are the literal square-bracket placeholders that appear, visibly, in the legal
 * pages — they must stay in the copy until the real value replaces them. Entries with an
 * empty `tokens` list are facts that live in code/config rather than in a bracket.
 * `suggested` is a value already known from the brief that the owner can simply accept.
 */
export const OWNER_FILL_INS: readonly OwnerFillIn[] = [
  /* ── company identity ── */
  {
    key: 'legal-form',
    label: 'Legal form of Manhar Creatives (proprietorship / partnership / LLP / company)',
    tokens: ['[a proprietorship / partnership / LLP / company — SPECIFY LEGAL FORM]'],
    usedIn: ['terms'],
  },
  {
    key: 'udyam',
    label: 'Udyam registration number',
    tokens: ['[UDYAM REGISTRATION NUMBER]'],
    usedIn: ['terms'],
  },
  {
    key: 'registered-address',
    label: 'Registered address (confirm the Sona Complex address is the registered one)',
    tokens: ['[REGISTERED ADDRESS]'],
    usedIn: ['terms', 'privacy'],
    suggested: 'Sona Complex, A-252, Kansa Cross Road, Opp. Khodiyar Hotel',
  },
  {
    key: 'pin-code',
    label: 'PIN code of the registered address',
    tokens: ['[PIN CODE]'],
    usedIn: ['terms'],
    suggested: '384315',
  },
  {
    key: 'gstin',
    label: 'GSTIN (and whether Manhar Creatives is GST-registered at all)',
    tokens: ['[GSTIN, if applicable]'],
    usedIn: ['terms'],
  },
  {
    key: 'gst-registration-decision',
    label: 'GST registration decision — if not registered, prices must be quoted inclusive of taxes',
    tokens: [
      '[If Manhar Creatives is not yet GST-registered, replace with: “Prices are inclusive of any applicable taxes” — OWNER/CA DECISION.]',
      '[CA TO CONFIRM INVOICE RULES]',
      '[CA TO CONFIRM APPLICABILITY.]',
    ],
    usedIn: ['billing-policy'],
  },

  /* ── support and contact ── */
  {
    key: 'support-email',
    label: 'Support email address',
    tokens: ['[SUPPORT EMAIL]'],
    usedIn: ['terms', 'refund-policy'],
    suggested: 'info@manharcreatives.com',
  },
  {
    key: 'support-channel',
    label: 'WhatsApp / phone support channel',
    tokens: ['[WHATSAPP / PHONE SUPPORT CHANNEL — CONFIRM]'],
    usedIn: ['terms'],
    suggested: '+91 97145 71522',
  },
  {
    key: 'support-hours',
    label: 'Support hours (IST). Also decide whether the mobile-menu line “we reply the same working day” is true.',
    tokens: ['[SUPPORT HOURS, IST]'],
    usedIn: ['terms'],
  },
  {
    key: 'phone',
    label: 'Phone number for the Terms and the Grievance Officer',
    tokens: ['[PHONE]'],
    usedIn: ['terms', 'privacy'],
    suggested: '+91 97145 71522',
  },
  {
    key: 'billing-email',
    label: 'Billing email address',
    tokens: ['[BILLING EMAIL]'],
    usedIn: ['billing-policy'],
    suggested: 'info@manharcreatives.com',
  },
  {
    key: 'abuse-email',
    label: 'Abuse-reporting email address',
    tokens: ['[ABUSE EMAIL]'],
    usedIn: ['acceptable-use'],
    suggested: 'info@manharcreatives.com',
  },
  {
    key: 'support-languages',
    label:
      'Languages your support team can really offer (Gujarati / Hindi / English). Update the support FAQ and the JSON-LD availableLanguage.',
    tokens: [],
    usedIn: ['faq: support', 'seo: organizationJsonLd'],
  },

  /* ── grievance officer ── */
  {
    key: 'grievance-officer',
    label: 'Grievance Officer: name, designation, email, hours (and a DPO contact if the DPDP Rules require one)',
    tokens: [
      '[GRIEVANCE OFFICER NAME]',
      '[DESIGNATION]',
      '[GRIEVANCE EMAIL]',
      '[DAYS/HOURS IST]',
      '[If DPDP Rules require a Data Protection Officer or published contact for your category, add it here.]',
    ],
    usedIn: ['privacy'],
  },

  /* ── hosting and security facts (do not publish until verified) ── */
  {
    key: 'hosting',
    label: 'Hosting provider and region (repo has two deploy paths: Docker+Caddy and Vercel+Neon — decide, then name it)',
    tokens: [
      '[HOSTING PROVIDER AND REGION — CONFIRM]',
      '[CONFIRM: Production data is stored in ___ (provider), region ___ (India).]',
      '[hosting provider]',
    ],
    usedIn: ['privacy', 'data-processing', 'trust: built-for-india'],
  },
  {
    key: 'production-security-facts',
    label: 'Production facts to verify before claiming them: TLS enforced, encryption at rest, backup schedule with off-host copy, who has production access',
    tokens: [
      '[CONFIRM TLS IS ENFORCED IN PRODUCTION]',
      '[CONFIRM production backup schedule and off-host copy before publishing]',
      '[CONFIRM WITH HOSTING PROVIDER — do not publish until verified]',
      '[CONFIRM]',
      '[confirm]',
      '[CONFIRM IN EMPLOYMENT/CONTRACTOR TERMS]',
    ],
    usedIn: ['privacy', 'data-processing'],
  },
  {
    key: 'subprocessors',
    label: 'Email / SMS / WhatsApp providers, once chosen, and where the sub-processor list is published',
    tokens: ['[LIST WHEN CHOSEN]', '[messaging/email providers]', '[AND PUBLISH AT /data-processing]'],
    usedIn: ['privacy', 'data-processing'],
  },
  {
    key: 'analytics',
    label: 'Analytics tool (none / name it — a consent banner may then be required)',
    tokens: ['[ANALYTICS — NONE / NAME THE TOOL; if used, obtain consent via a banner]'],
    usedIn: ['privacy'],
  },

  /* ── numbers the lawyer / owner should set ── */
  {
    key: 'provisioning-target',
    label: 'Workspace provisioning target (proposed: one working day)',
    tokens: ['[ONE WORKING DAY — CONFIRM]'],
    usedIn: ['terms'],
    suggested: 'one working day',
  },
  {
    key: 'deletion-days',
    label: 'Days to delete live data after the 30-day export window, and notice period for new sub-processors (proposed: 30)',
    tokens: ['[30]'],
    usedIn: ['terms', 'privacy', 'data-processing'],
    suggested: '30',
  },
  {
    key: 'backup-retention',
    label: 'Backup retention: logical backups (proposed 14 days) and point-in-time recovery (proposed 7 days)',
    tokens: ['[14]', '[7]'],
    usedIn: ['terms', 'privacy'],
  },
  {
    key: 'retention-periods',
    label: 'Retention: unconverted registrations (proposed 12 months), server logs (proposed 90 days), tax/invoice records (CA/lawyer)',
    tokens: ['[12]', '[90]', '[CA/LAWYER TO CONFIRM PERIOD]'],
    usedIn: ['privacy'],
  },
  {
    key: 'rights-timelines',
    label: 'Acknowledge-within and resolve-within timelines for data-rights requests, and breach-notification timeline under the DPDP Rules',
    tokens: [
      '[48 hours]',
      '[DPDP Rules timelines to be confirmed by lawyer]',
      '[LAWYER: confirm timeline under DPDP Rules]',
      '[LAWYER TO CONFIRM CURRENT STATUS]',
    ],
    usedIn: ['privacy'],
  },
  {
    key: 'liability-cap',
    label: 'Liability cap: fees paid in the preceding 6 or 12 months',
    tokens: ['[LAWYER TO CONFIRM CAP — 6 OR 12 MONTHS]'],
    usedIn: ['terms'],
  },
  {
    key: 'jurisdiction',
    label: 'Courts at Visnagar or Mehsana, or arbitration (and its seat)',
    tokens: [
      '[LAWYER: confirm whether the territorial court for Visnagar is the court at Visnagar or Mehsana, and whether you prefer arbitration under the Arbitration and Conciliation Act, 1996 with the seat in a city of your choice instead]',
    ],
    usedIn: ['terms'],
  },
  {
    key: 'refund-thresholds',
    label: 'Refund policy options: pro-rata yearly refund, provisioning-failure window, outage threshold, refund timeline',
    tokens: [
      '[OWNER OPTION: offer pro-rata refund within 30 days.]',
      '[5 working days]',
      '[24 consecutive hours or X hours in a month]',
      '[7–10 working days]',
    ],
    usedIn: ['refund-policy'],
  },
  {
    key: 'billing-operations',
    label: 'Billing details to confirm with Cashfree and operations: invoice-correction window, retry schedule, limited-mode timing, response time to billing queries',
    tokens: [
      '[the same month]',
      '[per Cashfree retry schedule]',
      '[OPERATIONAL TO CONFIRM]',
      '[3 working days]',
    ],
    usedIn: ['billing-policy'],
  },
  {
    key: 'dpa-document',
    label: 'Signable DPA (prepare with a lawyer) and the breach-notice target (proposed within 72 hours)',
    tokens: ['[PREPARE WITH LAWYER]', '[TARGET: within 72 hours of becoming aware — LAWYER TO CONFIRM]'],
    usedIn: ['data-processing'],
  },

  /* ── page and site facts ── */
  {
    key: 'domain',
    label: 'Production domain (replaces the [DOMAIN] placeholder in canonical URLs, Open Graph and JSON-LD)',
    tokens: [],
    usedIn: ['seo: SITE_ORIGIN', 'index.html', 'sitemap.xml'],
  },
  {
    key: 'organization-logo',
    label: 'Manhar Creatives logo file (Primary_H_Black/White, BG_Dark_V) — also for Organization JSON-LD `logo`',
    tokens: [],
    usedIn: ['nav', 'seo: organizationJsonLd'],
  },
  {
    key: 'og-image',
    label: 'Brand v2 Open Graph image at /landing/og-1200x630.png (the existing og.png uses an old, banned green)',
    tokens: [],
    usedIn: ['seo: HOME_OG', 'images: OG_IMAGE'],
  },
  {
    key: 'about-story',
    label: 'About page: confirm the two paragraphs about the studio’s experience around restaurants are true, or rewrite them',
    tokens: [],
    usedIn: ['about: paragraphs[0..1]'],
  },
  {
    key: 'founder-signature',
    label: 'Approve the founder signature “Utsav Prajapati, Founder, Manhar Creatives”',
    tokens: [],
    usedIn: ['about: signature'],
  },
  {
    key: 'contact-data',
    label: 'Confirm email, phone, WhatsApp, address and social links are the ones to publish (taken from manharcreatives.com)',
    tokens: [],
    usedIn: ['nav: CONTACT'],
  },
  {
    key: 'cashfree-integration',
    label: 'Cashfree account facts (subscriptions enabled, AFA ≥ ₹15,000, variable mandates) before the Pay step goes live; until then the interim copy stays',
    tokens: [],
    usedIn: ['how: payInterim', 'register: FAILURE_MESSAGES.interim', 'billing-policy'],
  },
  {
    key: 'founding-offer-dates',
    label: 'Founding Restaurants window (proposed 1 Nov 2026 – 31 Jan 2027) and hand-setup capacity',
    tokens: [],
    usedIn: ['plans: FOUNDING_OFFER', 'nav: FOOTER_CHIP'],
  },
];

/** Every square-bracket token that must appear verbatim in the legal copy. */
export const OWNER_FILL_IN_TOKENS: readonly string[] = OWNER_FILL_INS.flatMap((f) => f.tokens);
