import { LAST_UPDATED, LAST_UPDATED_ISO, clause, lcallout, lol, lp, table } from './legal-blocks';
import type { LegalDocument } from './types';

/* ───────────────────────────── Refund & Cancellation ───────────────────────────── */

export const REFUND: LegalDocument = {
  slug: 'refund-policy',
  path: '/refund-policy',
  title: 'Refund & Cancellation Policy',
  shortTitle: 'Refund & Cancellation',
  lastUpdated: LAST_UPDATED,
  lastUpdatedISO: LAST_UPDATED_ISO,
  summary: '14-day money-back guarantee, how to cancel, and what happens to your data.',
  intro: [
    lcallout(
      'Plain version first: you can try Nexus for 14 days and get your money back. After that, you can cancel any time; you keep access until the end of what you paid for.',
    ),
  ],
  sections: [
    {
      id: 'satisfaction-refund',
      heading: '1. 14-day satisfaction refund',
      blocks: [
        lp(
          'If you are not satisfied with Manhar Nexus, ask for a refund within 14 days of the date your Workspace was activated (not the date of payment). We refund the subscription fee you paid for that first period (monthly or yearly), including the GST on it, in full. We do not ask for a reason, although we would value it. This applies once per business (and per GSTIN/phone number).',
        ),
      ],
    },
    {
      id: 'cancel-monthly',
      heading: '2. Cancelling a monthly plan',
      blocks: [
        lp(
          'Cancel any time before the next renewal date. You keep access until the end of the paid month. We do not refund the current month after day 14 (clause 1), and we do not charge you again. UPI AutoPay / e-mandates are cancelled on our side when you cancel; you can also revoke the mandate in your UPI/banking app.',
        ),
      ],
    },
    {
      id: 'cancel-yearly',
      heading: '3. Cancelling a yearly plan',
      blocks: [
        lp(
          'After the 14-day window, yearly plans are not refundable for the elapsed or remaining term, except in the cases below. You keep access until the end of the term and the plan will not renew. [OWNER OPTION: offer pro-rata refund within 30 days.]',
        ),
      ],
    },
    {
      id: 'always-refund',
      heading: '4. Cases where we refund or credit regardless',
      blocks: [
        clause('(a)', 'We fail to provision your Workspace within [5 working days] of payment for reasons on our side → full refund.'),
        clause('(b)', 'The Service is materially unavailable for your business for more than [24 consecutive hours or X hours in a month] because of our fault → credit or pro-rata refund for the affected period.'),
        clause('(c)', 'We withdraw a paid feature and it materially reduces the Service → pro-rata refund of the remaining prepaid period.'),
        clause('(d)', 'You were charged twice or an incorrect amount → refund of the excess within 7 working days of verification.'),
      ],
    },
    {
      id: 'setup-fees',
      heading: '5. Onboarding and setup fees',
      blocks: [
        lp(
          'Setup services (menu upload, printer/device setup, staff training, Launch Pack) are charged separately. If you cancel before work starts, you get a full refund. Once work has started, we charge for the work completed (proportionate to the scope delivered); fees for delivered work are non-refundable. Founding-partner onboarding that was provided free has no refund value.',
        ),
      ],
    },
    {
      id: 'add-ons',
      heading: '6. Add-ons',
      blocks: [
        lp(
          'Add-ons billed monthly can be removed before the next renewal; the paid month is not refunded after day 14 of that add-on’s activation.',
        ),
      ],
    },
    {
      id: 'how-refunds-are-made',
      heading: '7. How refunds are made',
      blocks: [
        lp(
          'To request: email [SUPPORT EMAIL] from your registered email with your business name and payment reference. Approved refunds go back to the original payment method through Cashfree within [7–10 working days] of approval (bank timelines vary). We bear the gateway cost on refunds that fall under clauses 1 and 4. Refunds for UPI AutoPay or card payments reverse to the same account/card.',
        ),
      ],
    },
    {
      id: 'your-data',
      heading: '8. What happens to your data',
      blocks: [
        lp(
          'After cancellation or a refund, your Workspace follows the export-and-deletion timeline in the Terms (30-day export window, then deletion). Please export first.',
        ),
      ],
    },
    {
      id: 'pilots-discounts',
      heading: '9. Pilots and discounts',
      blocks: [
        lp(
          'Free pilots have nothing to refund. Discounted founding prices are refunded at the amount actually paid. Referral or discount credits have no cash value.',
        ),
      ],
    },
  ],
  internalNote:
    'Drafting note — Refund Policy. Assumptions: (1) 14-day window counted from Workspace activation, since provisioning is manual and can lag payment. (2) Yearly plans non-refundable after day 14 — aligned with 03b; a lawyer may prefer a pro-rata window. (3) Thresholds in clause 4(b) are placeholders for the owner to set. (4) Gateway refund timelines and fee treatment must be checked in the Cashfree dashboard/agreement. (5) Consumer-protection e-commerce rules mainly protect consumers; this policy is written for business customers but is deliberately fair in case a sole proprietor is treated as a consumer.',
};

/* ───────────────────────────── Billing & Payments ───────────────────────────── */

export const BILLING: LegalDocument = {
  slug: 'billing-policy',
  path: '/billing-policy',
  title: 'Billing & Payments Policy',
  shortTitle: 'Billing & Payments',
  lastUpdated: LAST_UPDATED,
  lastUpdatedISO: LAST_UPDATED_ISO,
  summary:
    'How Manhar Nexus subscriptions are billed: GST, UPI AutoPay, payment links, renewals and failed payments.',
  intro: [],
  sections: [
    {
      id: 'who-bills-you',
      heading: '1. Who bills you',
      blocks: [
        lp(
          'All subscription billing is handled centrally by Manhar Creatives. Payments for the Nexus subscription are processed by Cashfree Payments India Pvt Ltd, a payment aggregator regulated in India. This policy covers payment for the software subscription only — not the bills your own guests pay at your restaurant.',
        ),
      ],
    },
    {
      id: 'prices-gst',
      heading: '2. Prices and GST',
      blocks: [
        lp(
          'Prices on our website are in ₹ and exclude GST (18%). GST is added at checkout and shown on your tax invoice. Provide your GSTIN at registration (or later, within [the same month]) to receive an invoice with it [CA TO CONFIRM INVOICE RULES]. We issue a tax invoice for every payment, emailed to your registered address. [If Manhar Creatives is not yet GST-registered, replace with: “Prices are inclusive of any applicable taxes” — OWNER/CA DECISION.]',
        ),
      ],
    },
    {
      id: 'billing-options',
      heading: '3. Billing options',
      blocks: [
        table(
          ['Plan period', 'How you pay', 'Renewal'],
          [
            [
              'Yearly',
              'One payment by UPI, card or net banking through a Cashfree payment link/checkout',
              'Manual renewal. We email reminders 30, 15 and 7 days before expiry. Nothing is charged automatically.',
            ],
            [
              'Monthly',
              'UPI AutoPay (recommended), or card standing instruction; e-NACH where your bank account allows',
              'Auto-renews monthly until cancelled, using the mandate you approve',
            ],
            ['First month / setup fees', 'One-time payment at checkout', '—'],
          ],
        ),
      ],
    },
    {
      id: 'auto-renewal',
      heading: '4. Auto-renewal and e-mandates (Reserve Bank of India rules)',
      blocks: [
        clause(
          '4.1',
          'You approve a recurring payment mandate with your bank/UPI app, which includes our name, the maximum amount, frequency and validity. We charge only within what you approved.',
        ),
        clause(
          '4.2',
          'Under RBI’s e-mandate framework (2026), your bank/UPI app notifies you at least 24 hours before each debit and after each debit. Recurring debits above ₹15,000 need extra authentication each time; our monthly plans are priced below that limit.',
        ),
        clause(
          '4.3',
          'You can pause, modify or revoke the mandate any time in your UPI/banking app. Revoking it stops future debits; it does not by itself cancel your subscription or erase amounts already due — please also cancel in your account.',
        ),
        clause(
          '4.4',
          'If a plan price changes, we give 30 days’ notice and, where the new amount exceeds your mandate limit, we will ask you to approve a new mandate.',
        ),
      ],
    },
    {
      id: 'failed-payments',
      heading: '5. Failed payments (dunning)',
      blocks: [
        table(
          ['Day', 'What happens'],
          [
            ['Day 0', 'Debit fails. We email/WhatsApp you with a payment link. Service continues.'],
            ['Days 1–3', 'We retry the debit [per Cashfree retry schedule]. Reminder on day 3.'],
            ['Day 7', 'Final reminder. Grace period ends at end of day 7. Service still fully available.'],
            [
              'Days 8–14',
              'Limited mode: you can finish open Checkouts, close the day, view reports and export; new Guest Sessions/Service Requests are blocked. We avoid switching you to limited mode in the middle of your declared service hours where we can [OPERATIONAL TO CONFIRM].',
            ],
            ['Day 15', 'Subscription suspended. Data held for export for 30 days.'],
          ],
        ),
        lp('Paying the overdue amount at any point restores full access immediately.'),
      ],
    },
    {
      id: 'invoices-gstin',
      heading: '6. Invoices, receipts and GSTIN',
      blocks: [
        lp(
          'Tax invoices are generated for each payment and emailed. To correct a GSTIN or business name, tell us within [the same month]; we cannot always re-issue invoices after returns are filed.',
        ),
      ],
    },
    {
      id: 'refunds-chargebacks',
      heading: '7. Refunds, chargebacks, and disputes',
      blocks: [
        lp(
          'Refunds follow the Refund & Cancellation Policy. If you have a billing question, write to [BILLING EMAIL] before raising a chargeback; we will respond within [3 working days]. Fraudulent chargebacks may lead to suspension.',
        ),
      ],
    },
    {
      id: 'payment-security',
      heading: '8. Payment security',
      blocks: [
        lp(
          'Card, UPI and net-banking details are entered on Cashfree’s secure pages or your own UPI app. We never see or store your full card number, CVV or UPI PIN.',
        ),
      ],
    },
    {
      id: 'upgrades-downgrades',
      heading: '9. Upgrades and downgrades',
      blocks: [
        lp(
          'Upgrades are effective immediately; we charge the difference for the rest of the period (pro-rata). Downgrades apply from the next renewal. Moving from monthly to yearly: remaining monthly days are credited against the yearly price.',
        ),
      ],
    },
    {
      id: 'tds',
      heading: '10. Taxes you withhold',
      blocks: [
        lp(
          'If you deduct TDS on payments to us as required by law, tell us beforehand and give us the TDS certificate. [CA TO CONFIRM APPLICABILITY.]',
        ),
      ],
    },
  ],
  internalNote:
    'Drafting note — Billing Policy. Assumptions: (1) Billing flow mirrors 03b: annual = manual payment link; monthly = UPI AutoPay primary. (2) Cashfree retry schedule, pre-debit handling and whether Cashfree sends the 24-hour notice are not verified — confirm with Cashfree; adjust day-by-day table. (3) Limited mode and suspension are commercial proposals and must be implemented (the repo has SUSPENDED states for Manhar’s records but no automatic billing yet). (4) GST registration status of Manhar Creatives is unknown; the 18% GST statement presumes registration. (5) Payments-aggregator licensing is Cashfree’s, not ours; we are a merchant collecting our own subscription.',
};

/* ───────────────────────────── Acceptable Use ───────────────────────────── */

export const ACCEPTABLE_USE: LegalDocument = {
  slug: 'acceptable-use',
  path: '/acceptable-use',
  title: 'Acceptable Use Policy',
  shortTitle: 'Acceptable Use',
  lastUpdated: LAST_UPDATED,
  lastUpdatedISO: LAST_UPDATED_ISO,
  summary: 'Rules for using Manhar Nexus responsibly.',
  intro: [lp('You and your staff will not, and will not allow anyone to:')],
  sections: [
    {
      id: 'rules',
      heading: 'What is not allowed',
      blocks: [
        lol(
          'Use the Service for unlawful purposes, including recording sales to evade tax, falsifying invoices, or laundering money.',
          'Attempt to access another business’s Workspace, bypass permissions, probe for vulnerabilities, or run load/penetration tests without our written consent.',
          'Upload malware, or interfere with the Service, its infrastructure, or other customers’ use.',
          'Resell, sublicense or provide the Service to others as a service bureau without our agreement; share one staff login among several people; or use the Service for a different legal entity than the one registered.',
          'Scrape, reverse-engineer, decompile or copy the Service, except to the extent the law permits.',
          'Send spam or unsolicited commercial messages, or send messages without the consents and registrations the law requires (for example telecom regulations on commercial communications, once messaging features exist).',
          'Upload content that is defamatory, obscene, infringes someone’s rights, or that includes sensitive personal data of guests (for example health or identity-document numbers) without a lawful need.',
          'Store personal data of children or collect data from guests without giving them the required notice.',
          'Use the Service in a way that puts abnormal load on it (for example automated scripts hitting the API) beyond reasonable use.',
          'Misrepresent your identity, business or GSTIN.',
        ),
      ],
    },
    {
      id: 'consequences',
      heading: 'Consequences',
      blocks: [
        lp(
          'We may remove content, throttle or suspend access (immediately where there is risk to security, other customers or legal compliance), and terminate for repeated or serious breach. Where we can, we will contact you first. Suspension for breach does not entitle you to a refund. Reports of abuse: [ABUSE EMAIL].',
        ),
      ],
    },
  ],
  internalNote:
    'Drafting note — AUP. Assumptions: standard SaaS B2B list tailored to restaurants; telecom/messaging rules (TRAI DLT etc.) are mentioned generically — lawyer to refine before WhatsApp/SMS features launch.',
};

/* ───────────────────────────── Data Processing Addendum (summary) ───────────────────────────── */

export const DPA: LegalDocument = {
  slug: 'data-processing',
  path: '/data-processing',
  title: 'Data Processing Summary',
  shortTitle: 'Data Processing',
  lastUpdated: LAST_UPDATED,
  lastUpdatedISO: LAST_UPDATED_ISO,
  summary: 'How Nexus processes personal data on behalf of restaurants.',
  intro: [
    lp(
      'This summary is a plain-language overview of how Manhar Creatives (the Processor) handles personal data for the restaurant (the Fiduciary / Controller). A full signed DPA is available on request [PREPARE WITH LAWYER].',
    ),
  ],
  sections: [
    {
      id: 'summary',
      heading: 'Summary of commitments',
      blocks: [
        table(
          ['Topic', 'Commitment'],
          [
            [
              'Roles',
              'The restaurant decides why and how guest/staff personal data is used; Manhar Creatives processes it only on the restaurant’s documented instructions (the Terms and Workspace configuration).',
            ],
            [
              'Subject matter & duration',
              'Hosting and operating the Business Workspace for the subscription term plus the export window.',
            ],
            [
              'Data types',
              'Staff names/contact, guest names/phone/email/preferences/bookings (if the restaurant records them), order and payment records, device and log data.',
            ],
            [
              'Purposes',
              'Providing, securing, supporting and billing the Service; no sale; no use for advertising.',
            ],
            [
              'Confidentiality',
              'Staff with access are bound by confidentiality [CONFIRM IN EMPLOYMENT/CONTRACTOR TERMS].',
            ],
            [
              'Security',
              'Measures as listed in section 7 of the Privacy Policy: tenant isolation, role-based permissions, hashed credentials, TLS [confirm], immutable financial records, append-only Activity History, documented backup and restore procedures.',
            ],
            [
              'Sub-processors',
              'Cashfree (payments), [hosting provider], [messaging/email providers]. We will give [30] days’ notice of new sub-processors; the restaurant may object on reasonable grounds.',
            ],
            [
              'Assistance',
              'We will help the restaurant respond to data-principal requests (access, correction, erasure) and cooperate on regulator queries, within reasonable time.',
            ],
            [
              'Breach',
              'We will inform the restaurant without undue delay [TARGET: within 72 hours of becoming aware — LAWYER TO CONFIRM] with the information we have.',
            ],
            [
              'Return / deletion',
              '30-day export window, then deletion from live systems within [30] days; backups roll off per retention. Legal-retention exceptions apply to our own billing records.',
            ],
            [
              'Audits',
              'We will provide reasonable information to show compliance; on-site audits only by agreement, at the restaurant’s cost.',
            ],
            [
              'Cross-border',
              'Preference for India-region hosting; any processing outside India will be disclosed.',
            ],
            ['Liability', 'Per the Terms.'],
            ['Governing law', 'India; Mehsana, Gujarat courts.'],
          ],
        ),
      ],
    },
  ],
  internalNote:
    'Drafting note — DPA summary. The DPDP Act uses “Data Fiduciary” and “Data Processor”; processor obligations in the Rules are phased in. This summary is intentionally operational; a lawyer should convert it to a signable annexure if enterprise customers ask. Content-agent edit: “backups and restore tests” became “documented backup and restore procedures” (no production restore drill has been recorded).',
};
