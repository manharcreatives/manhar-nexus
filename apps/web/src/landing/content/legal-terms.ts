import { LAST_UPDATED, LAST_UPDATED_ISO, clause, lp } from './legal-blocks';
import type { LegalDocument } from './types';

export const TERMS: LegalDocument = {
  slug: 'terms',
  path: '/terms',
  title: 'Terms & Conditions',
  shortTitle: 'Terms',
  lastUpdated: LAST_UPDATED,
  lastUpdatedISO: LAST_UPDATED_ISO,
  summary:
    'The terms for using Manhar Nexus, the restaurant operations platform from Manhar Creatives. Plans, data, cancellation and governing law.',
  intro: [
    lp(
      'These Terms & Conditions (“Terms”) govern your access to and use of Manhar Nexus (the “Service”), a restaurant-operations software platform provided by Manhar Creatives, [a proprietorship / partnership / LLP / company — SPECIFY LEGAL FORM], Udyam registration no. [UDYAM REGISTRATION NUMBER], having its registered address at [REGISTERED ADDRESS], Visnagar, District Mehsana, Gujarat, India [PIN CODE] (“Manhar Creatives”, “we”, “us”). GSTIN: [GSTIN, if applicable].',
    ),
    lp(
      'By registering, paying for, or using the Service you agree to these Terms on behalf of the restaurant, café, hotel, bakery, cloud kitchen or other business you represent (the “Customer”, “you”). If you do not agree, do not use the Service.',
    ),
  ],
  sections: [
    {
      id: 'service',
      heading: '1. The Service',
      blocks: [
        clause(
          '1.1',
          'Manhar Nexus provides cloud software for running a food-service business: Business Workspace, menu (Catalog) with variants and Add-ons, Dining Areas and Dining Tables, Guest Sessions and Service Requests, the Kitchen Operations Screen (KOS), Checkout with cash and UPI payment recording, refunds and voids, reports, operating-costs tracking (where included in your plan), staff roles and permissions, and Activity History. Modules available to you depend on the plan you purchase.',
        ),
        clause(
          '1.2',
          'Features marked “coming soon” on our website are not part of the Service until released. We do not promise a release date, and a purchase is never conditional on a coming-soon feature unless we confirm it in writing.',
        ),
        clause(
          '1.3',
          'The Service records and calculates; it is not an accounting, tax or legal advisory service. You remain responsible for your own GST filings, invoices as required by law, and statutory compliance.',
        ),
        clause(
          '1.4',
          'Connectivity. The Service needs an internet connection. It is designed to tolerate interruptions (for example, retrying actions), but it is not an offline point-of-sale system. You should keep a manual fallback for service hours.',
        ),
        clause(
          '1.5',
          'Printing and hardware. Thermal-printer support (through a Local Print Agent) is being validated and is not part of the Service unless we confirm it in writing for your site after testing with your printer. We cannot guarantee that every printer model or driver will work. Reports can be printed from your browser.',
        ),
      ],
    },
    {
      id: 'eligibility',
      heading: '2. Eligibility and accounts',
      blocks: [
        clause(
          '2.1',
          'The Service is for businesses and professionals. You must be at least 18 years old and have authority to bind the Customer.',
        ),
        clause(
          '2.2',
          'You provide accurate registration details (business name, owner name, mobile number, email, location, and tax details where relevant) and keep them current.',
        ),
        clause(
          '2.3',
          'Workspaces are provisioned by our team after registration and successful payment (or after approval of a pilot). We aim to provision within [ONE WORKING DAY — CONFIRM] but this is a target, not a guarantee.',
        ),
        clause(
          '2.4',
          'You are responsible for all activity under your Workspace, including staff logins, PINs and devices. Keep credentials confidential. Tell us at once of any suspected unauthorised access.',
        ),
      ],
    },
    {
      id: 'plans-fees-taxes',
      heading: '3. Plans, fees and taxes',
      blocks: [
        clause(
          '3.1',
          'Plans, prices, billing periods and add-ons are shown on our pricing page and in your order confirmation. Prices are in Indian Rupees (₹) and are exclusive of GST (currently 18%) and any other applicable tax, unless stated otherwise.',
        ),
        clause(
          '3.2',
          'Payment terms, auto-renewal, failed payments and invoices are set out in the Billing & Payments Policy. Refunds and cancellation are set out in the Refund & Cancellation Policy. Both form part of these Terms.',
        ),
        clause(
          '3.3',
          'We may change prices for future billing periods by giving at least 30 days’ written notice (email and in-app). A change never applies to a period you have already paid for. If you do not accept the change, you may cancel before it takes effect.',
        ),
        clause(
          '3.4',
          'Launch or founding offers apply only on the stated terms and dates, and only to the plan and period stated. Founding-offer price locks continue only while your subscription remains continuously active.',
        ),
      ],
    },
    {
      id: 'pilot',
      heading: '4. Free pilot (where offered)',
      blocks: [
        clause(
          '4.1',
          'At our discretion we may provision a time-limited pilot Workspace (typically 14 days) for evaluation. Pilots are available by invitation or approval, are provided “as is”, and may be limited in features and support.',
        ),
        clause(
          '4.2',
          'At the end of the pilot you may subscribe to a paid plan. If you do not, the pilot Workspace becomes read-only for 7 days so you can export your data, and is then closed and deleted as described in clause 11.',
        ),
      ],
    },
    {
      id: 'your-data',
      heading: '5. Your data and our rights in it',
      blocks: [
        clause(
          '5.1',
          'You own your data. Menus, prices, table layouts, Service Requests, Checkouts, Guest information, staff details and reports entered into or generated from your Workspace are “Customer Data”. You grant us only the rights needed to provide, secure, support and improve the Service for you.',
        ),
        clause(
          '5.2',
          'For personal data of your guests and staff that you put into the Service, you are the data fiduciary (controller) and we act as your data processor, as described in the Privacy Policy and the Data Processing Addendum summary.',
        ),
        clause(
          '5.3',
          'We may create aggregated and de-identified statistics about how the Service is used (for example, total Service Requests per day across all Workspaces) to operate and improve the Service. These do not identify you, your guests or your staff.',
        ),
        clause(
          '5.4',
          'You are responsible for having lawful grounds, notices and consents for the personal data you collect from your guests and staff, including any marketing messages you send.',
        ),
      ],
    },
    {
      id: 'financial-records',
      heading: '6. Financial records and Activity History',
      blocks: [
        clause(
          '6.1',
          'Records such as Checkouts, invoices and payments are designed to be immutable. Mistakes are corrected through reason-bearing Void, refund or reversal records, not by deleting the original. Activity History is append-only. You acknowledge that this is intentional and that voided or cancelled numbers remain consumed.',
        ),
        clause(
          '6.2',
          'Payment recording: where a guest pays by UPI or another method outside the Service, the Service may require your staff to confirm the payment (for example by entering a transaction reference). You are responsible for verifying that money has actually been received. We are not a bank, payment aggregator or payment guarantor for payments your guests make to you.',
        ),
      ],
    },
    {
      id: 'acceptable-use',
      heading: '7. Acceptable use',
      blocks: [
        lp(
          'You and your users must follow the Acceptable Use Policy. We may suspend access to protect the Service, other customers or the law, as described there.',
        ),
      ],
    },
    {
      id: 'ip',
      heading: '8. Intellectual property',
      blocks: [
        clause(
          '8.1',
          'We and our licensors own the Service, its software, design, documentation and trademarks (including “Manhar Nexus” and “Manhar Creatives”). You receive a limited, non-exclusive, non-transferable, revocable right to use the Service during your subscription for your internal business operations.',
        ),
        clause(
          '8.2',
          'You keep your own name, logo and branding. You grant us the right to display your branding inside your Workspace and on your receipts.',
        ),
        clause('8.3', 'We will not use your name or logo in marketing without your written permission.'),
        clause(
          '8.4',
          'If you give us feedback or suggestions, we may use them without obligation to you.',
        ),
      ],
    },
    {
      id: 'support',
      heading: '9. Support',
      blocks: [
        lp(
          'Support is provided through [SUPPORT EMAIL] and [WHATSAPP / PHONE SUPPORT CHANNEL — CONFIRM] during [SUPPORT HOURS, IST]. Plans with priority support are handled ahead of the standard queue. We do not promise a specific response or resolution time unless your order says so in writing.',
        ),
      ],
    },
    {
      id: 'availability',
      heading: '10. Availability, backups and changes',
      blocks: [
        clause(
          '10.1',
          'We work to keep the Service available but do not guarantee uninterrupted or error-free operation. We may carry out maintenance, preferably outside typical service hours, and will try to give notice of planned downtime.',
        ),
        clause(
          '10.2',
          'We take regular backups of the Service database. Backups exist for our recovery from failure; they are not a substitute for your own exports. You can export your reports and records as described in clause 11.',
        ),
        clause(
          '10.3',
          'We may improve, change or retire features. If we remove a feature you are paying for, we will give reasonable notice and, if the removal materially reduces the Service, a pro-rata refund for the remaining prepaid period.',
        ),
      ],
    },
    {
      id: 'term-and-cancellation',
      heading: '11. Term, cancellation and data after termination',
      blocks: [
        clause(
          '11.1',
          'Subscriptions run for the billing period you chose (monthly or yearly) and renew as described in the Billing & Payments Policy.',
        ),
        clause(
          '11.2',
          'You may cancel any time from your account or by writing to [SUPPORT EMAIL]. Cancellation takes effect at the end of the paid period (subject to the refund rules).',
        ),
        clause(
          '11.3',
          'We may suspend or terminate for non-payment (after the grace period), material breach, or unlawful use, on notice where practicable.',
        ),
        clause(
          '11.4',
          'Export window. For 30 days after your subscription ends (or after suspension for non-payment), you may request or use export of your Customer Data (report downloads in CSV are available in the app; a fuller export of your Workspace data — sales, Checkouts and invoices, items, tables and staff list — is prepared by us on request in a common format such as CSV or JSON). During this window your Workspace is read-only except for export.',
        ),
        clause(
          '11.5',
          'Deletion. After the export window we delete your Workspace’s Customer Data from our live systems within [30] days. Copies in encrypted backups expire as backup retention rolls over (currently up to [14] days for scheduled logical backups; [7] days for managed point-in-time recovery where used). We may retain limited records we are legally required to keep (for example our own invoices and payment records to you) for the period the law requires.',
        ),
        clause(
          '11.6',
          'You are responsible for retaining the records the law requires you to keep (for example GST and accounting records). Please export before the window closes.',
        ),
      ],
    },
    {
      id: 'warranties',
      heading: '12. Warranties and disclaimers',
      blocks: [
        clause(
          '12.1',
          'We provide the Service with reasonable skill and care. Except as stated in these Terms, and to the extent permitted by law, the Service is provided “as is” and “as available” without warranties of merchantability, fitness for a particular purpose, or non-infringement.',
        ),
        clause(
          '12.2',
          'We do not warrant that reports, tax calculations or inventory figures are free of errors caused by incorrect configuration (for example wrong tax rates entered by you) or incorrect data entry.',
        ),
        clause(
          '12.3',
          'Features that depend on third parties (payment processors, UPI apps, printers, internet providers, messaging providers) are subject to their availability and terms.',
        ),
      ],
    },
    {
      id: 'liability',
      heading: '13. Limitation of liability',
      blocks: [
        clause(
          '13.1',
          'To the maximum extent permitted by law, neither party is liable for indirect, incidental, special or consequential loss, or for loss of profit, revenue, goodwill or business opportunity.',
        ),
        clause(
          '13.2',
          'Our total aggregate liability arising out of or relating to the Service in any 12-month period is limited to the fees you paid us for the Service in the 6 months preceding the event giving rise to the claim [LAWYER TO CONFIRM CAP — 6 OR 12 MONTHS].',
        ),
        clause(
          '13.3',
          'Nothing in these Terms excludes liability that cannot be excluded by law, including for fraud or wilful misconduct.',
        ),
      ],
    },
    {
      id: 'indemnity',
      heading: '14. Indemnity',
      blocks: [
        lp(
          'You will defend and indemnify us against third-party claims arising from (a) Customer Data you upload in breach of law or third-party rights, (b) your breach of the Acceptable Use Policy, or (c) your failure to obtain the consents or give the notices required for personal data you collect, except to the extent caused by our breach.',
        ),
      ],
    },
    {
      id: 'confidentiality',
      heading: '15. Confidentiality',
      blocks: [
        lp(
          'Each party will protect the other’s non-public business information with at least reasonable care and use it only to perform these Terms, except where disclosure is required by law.',
        ),
      ],
    },
    {
      id: 'force-majeure',
      heading: '16. Force majeure',
      blocks: [
        lp(
          'Neither party is liable for delay or failure caused by events beyond reasonable control (for example natural disaster, government action, widespread internet or power failure, failure of a third-party platform), other than payment obligations already due.',
        ),
      ],
    },
    {
      id: 'notices-changes',
      heading: '17. Notices and changes to these Terms',
      blocks: [
        clause(
          '17.1',
          'We send notices to the email and mobile number on your account and may display them in the app. You must keep these current.',
        ),
        clause(
          '17.2',
          'We may update these Terms. We will give at least 30 days’ notice of material changes. Continuing to use the Service after the effective date means you accept the update; if you do not, you may cancel before it takes effect.',
        ),
      ],
    },
    {
      id: 'governing-law',
      heading: '18. Governing law, disputes and jurisdiction',
      blocks: [
        clause('18.1', 'These Terms are governed by the laws of India.'),
        clause(
          '18.2',
          'The parties will first try to resolve any dispute in good faith by written notice to the other, for 30 days.',
        ),
        clause(
          '18.3',
          'If unresolved, the dispute is subject to the exclusive jurisdiction of the competent courts at Mehsana, Gujarat (Visnagar is in Mehsana district) [LAWYER: confirm whether the territorial court for Visnagar is the court at Visnagar or Mehsana, and whether you prefer arbitration under the Arbitration and Conciliation Act, 1996 with the seat in a city of your choice instead].',
        ),
        clause(
          '18.4',
          'Nothing prevents either party from seeking urgent injunctive relief from a competent court.',
        ),
      ],
    },
    {
      id: 'general',
      heading: '19. General',
      blocks: [
        lp(
          'These Terms, with the policies they refer to and your order confirmation, are the entire agreement between us on the Service. If any clause is unenforceable, the rest continues. Failure to enforce a right is not a waiver. You may not assign these Terms without our written consent; we may assign them to a successor of our business with notice. Electronic records and acceptance are valid under the Information Technology Act, 2000.',
        ),
      ],
    },
    {
      id: 'contact',
      heading: '20. Contact',
      blocks: [
        lp(
          'Manhar Creatives · [REGISTERED ADDRESS], Visnagar, Mehsana, Gujarat, India · [SUPPORT EMAIL] · [PHONE] · Grievance Officer: see Privacy Policy.',
        ),
      ],
    },
  ],
  internalNote:
    'Drafting note — T&C. Assumptions: (1) Manhar Creatives is the contracting entity; legal form, Udyam number, address and GSTIN are placeholders. (2) B2B use — the Customer is a business, so the Consumer Protection Act, 2019 “consumer” definition (which generally excludes commercial purposes) is assumed not to apply; lawyer to confirm. (3) Liability cap, jurisdiction, and 30-day notice periods are proposals. (4) 14-day refund, 7-day grace and 30-day export window follow 03b. (5) Deletion tooling for a whole Workspace must actually exist before clause 11.5 is promised — verify with engineering. (6) Pilots are manual because workspace provisioning is manual today. (7) Hosting region/provider is not stated here; ADR-013 says India region is preferred, not that it is confirmed, and the repo contains two deploy paths (Docker+Caddy vs Vercel+Neon) — decide and fill in. (8) Printing is API-only and unvalidated today (codebase analysis 01), so the Terms do not promise it. (9) A fuller data export is a manual job today (no JSON export feature exists). Content-agent edits to the draft: clause 1.4 and 10.2 no longer mention “preserving drafts” or “test restores” (the cart is not persisted across reloads and the production restore drill is still pending); the nested placeholder in 18.3 was flattened (“the seat in a city of your choice”).',
};
