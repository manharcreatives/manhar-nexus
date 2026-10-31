import { LAST_UPDATED, LAST_UPDATED_ISO, lp, lul, table } from './legal-blocks';
import type { LegalDocument } from './types';

export const PRIVACY: LegalDocument = {
  slug: 'privacy',
  path: '/privacy',
  title: 'Privacy Policy',
  shortTitle: 'Privacy',
  lastUpdated: LAST_UPDATED,
  lastUpdatedISO: LAST_UPDATED_ISO,
  summary:
    'How Manhar Creatives handles personal data under India’s IT Act and DPDP Act, and the roles of restaurants and Nexus.',
  intro: [
    lp(
      'This Privacy Policy explains how Manhar Creatives (“we”, “us”) handles personal data when you visit our website or use Manhar Nexus. It is written with reference to the Information Technology Act, 2000 (“IT Act”), the Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011 (“SPDI Rules”), and the Digital Personal Data Protection Act, 2023 (“DPDP Act”) and Rules, 2025 as they come into force in phases (most obligations of data fiduciaries are scheduled to apply from approximately May 2027 — [LAWYER TO CONFIRM CURRENT STATUS]).',
    ),
  ],
  sections: [
    {
      id: 'roles',
      heading: '1. Who is responsible — two roles',
      blocks: [
        table(
          ['Situation', 'Our role', 'Who decides purposes'],
          [
            [
              'Website visitors, enquiries, registrations, billing contacts, your staff’s login details',
              'We are the data fiduciary (controller)',
              'We do',
            ],
            [
              'Guest and customer information that a restaurant enters into its own Business Workspace (names, phone numbers, bookings, visit notes, service history)',
              'We are a data processor; the restaurant is the data fiduciary',
              'The restaurant does',
            ],
          ],
        ),
        lp(
          'If you are a guest of a restaurant that uses Nexus, the restaurant is who decided to collect your data and is who you should contact first to exercise your rights. We will help them respond.',
        ),
      ],
    },
    {
      id: 'what-we-collect',
      heading: '2. What we collect',
      blocks: [
        lp(
          'From people who register or enquire: restaurant/business name, owner and contact person name, mobile number, email, city/location, business type, number of outlets, plan choice, billing details (business name, address, GSTIN if you give it), messages you send us.',
        ),
        lp(
          'From payment collection: payment status, transaction reference, amount, method type and masked identifiers shared by our payment processor, Cashfree Payments. We do not receive or store your full card number, CVV, UPI PIN or net-banking credentials; those are handled by the processor and your bank.',
        ),
        lp(
          'From using the Service (Workspace users): staff names, roles, login identifiers, hashed credentials, device registrations, activity (Activity History) records, IP address and browser/device information used for security and rate-limiting.',
        ),
        lp(
          'Inside a Workspace (restaurant’s data): menu, tables, Service Requests, Checkouts, payments recorded, cost entries, and — if the restaurant chooses — guest details and bookings.',
        ),
        lp(
          'Website technical data: standard server logs (IP, pages, time). The marketing website sets only cookies/local storage listed in section 8.',
        ),
        lp(
          'We do not intentionally collect “sensitive personal data or information” as defined under the SPDI Rules (such as passwords in readable form, financial instrument details, health, biometric data) except passwords, which are stored only as one-way hashes, and payment information handled by our processor.',
        ),
      ],
    },
    {
      id: 'why-we-use-it',
      heading: '3. Why we use it',
      blocks: [
        lul(
          'To create and run your Workspace and provide support (performance of the contract).',
          'To bill you, issue invoices and collect subscriptions (contract, legal obligation).',
          'To secure the Service, prevent abuse and keep an audit trail (legitimate use; legal obligation).',
          'To communicate service notices, billing reminders and changes (contract).',
          'To respond to enquiries and, with your consent where required, send product updates. You can unsubscribe at any time.',
          'To improve the Service using aggregated, de-identified usage statistics.',
        ),
        lp(
          'We do not sell personal data. We do not use restaurants’ guest data for our own marketing.',
        ),
      ],
    },
    {
      id: 'sharing',
      heading: '4. Sharing and sub-processors',
      blocks: [
        lp(
          'We share data only as needed with: (a) Cashfree Payments India Pvt Ltd (payment processing); (b) our hosting/database provider [HOSTING PROVIDER AND REGION — CONFIRM]; (c) email/SMS/WhatsApp delivery providers [LIST WHEN CHOSEN]; (d) professional advisers; (e) authorities where the law requires. Providers are bound by confidentiality and security obligations. We keep a list of sub-processors and will share it on request [AND PUBLISH AT /data-processing].',
        ),
      ],
    },
    {
      id: 'storage',
      heading: '5. Where data is stored; cross-border transfers',
      blocks: [
        lp(
          'We prefer India-region infrastructure. [CONFIRM: Production data is stored in ___ (provider), region ___ (India).] If any provider processes data outside India (for example an email delivery service), we will list it. Under the DPDP Act, transfers outside India are permitted except to countries the Central Government may restrict by notification.',
        ),
      ],
    },
    {
      id: 'retention',
      heading: '6. How long we keep data',
      blocks: [
        table(
          ['Data', 'Retention'],
          [
            ['Registration/enquiry records not converted', 'Up to [12] months, then deleted'],
            ['Active Workspace data', 'For as long as your subscription is active'],
            [
              'After subscription ends',
              'Export window 30 days, then deletion from live systems within [30] days; encrypted backups roll off within the backup retention period (up to [14] days logical backups; [7] days managed point-in-time recovery)',
            ],
            [
              'Our own invoices, payment and tax records',
              'As required by applicable law (commonly several years; [CA/LAWYER TO CONFIRM PERIOD])',
            ],
            ['Activity History / audit records', 'Within the Workspace life cycle; deleted with the Workspace'],
            ['Website server logs', 'Up to [90] days'],
          ],
        ),
        lp(
          'Financial records inside a Workspace (Checkouts, payments) are immutable by design while the Workspace exists; whole-Workspace deletion happens only through our deletion process after the export window.',
        ),
      ],
    },
    {
      id: 'security',
      heading: '7. Security measures (those that are actually in place)',
      blocks: [
        lul(
          'Each restaurant’s data is isolated to its own Business Workspace; access is checked against the signed-in user’s business on the server.',
          'Role-based permissions: staff see and do only what their role allows; owner-level financial settings are not available to waiters or kitchen staff.',
          'Passwords are stored as one-way hashes; sessions use short-lived tokens; login endpoints are rate-limited.',
          'Financial records are immutable and corrections are logged; Activity History is append-only and hash-chained so tampering is detectable.',
          'Duplicate-action protection (idempotency) on money-related requests.',
          'Encrypted connections (HTTPS/TLS) for traffic between your devices and the Service [CONFIRM TLS IS ENFORCED IN PRODUCTION].',
          'Database backup and restore procedures are documented in our runbooks [CONFIRM production backup schedule and off-host copy before publishing].',
          'Encryption at rest is [CONFIRM WITH HOSTING PROVIDER — do not publish until verified].',
          'Access to production systems is limited to authorised Manhar Creatives staff [CONFIRM]. No system is perfectly secure; we cannot guarantee absolute security.',
        ),
      ],
    },
    {
      id: 'cookies',
      heading: '8. Cookies and similar technologies',
      blocks: [
        lp(
          'The marketing website uses only: (a) strictly necessary storage (for example remembering a form draft or a theme choice), and (b) [ANALYTICS — NONE / NAME THE TOOL; if used, obtain consent via a banner]. The signed-in app uses authentication tokens and local storage to keep you signed in. You can clear these in your browser settings; the app may then ask you to sign in again.',
        ),
      ],
    },
    {
      id: 'your-rights',
      heading: '9. Your rights',
      blocks: [
        lp(
          'Subject to law, you may ask us to: access the personal data we hold about you; correct or update it; erase it (where we are not legally required to keep it); withdraw consent; nominate someone to exercise rights on your behalf; and have your grievance addressed. For data in a restaurant’s Workspace, please contact the restaurant; we will assist them. Write to the Grievance Officer below. We aim to acknowledge within [48 hours] and resolve within [30] days [DPDP Rules timelines to be confirmed by lawyer].',
        ),
      ],
    },
    {
      id: 'children',
      heading: '10. Children',
      blocks: [
        lp(
          'Nexus is built for restaurant businesses and is not directed at children. We do not knowingly collect data of anyone under 18. Restaurants are responsible for lawful handling of any data about children that they choose to record (we recommend not recording it).',
        ),
      ],
    },
    {
      id: 'breach',
      heading: '11. Breach',
      blocks: [
        lp(
          'If we become aware of a personal-data breach affecting data we hold, we will notify affected restaurants/individuals and the Data Protection Board of India as required by law, without undue delay [LAWYER: confirm timeline under DPDP Rules]. Restaurants should tell us immediately if they suspect compromise of their accounts.',
        ),
      ],
    },
    {
      id: 'grievance-officer',
      heading: '12. Grievance Officer',
      blocks: [
        lp(
          'Name: [GRIEVANCE OFFICER NAME] · Designation: [DESIGNATION] · Email: [GRIEVANCE EMAIL] · Phone: [PHONE] · Address: [REGISTERED ADDRESS], Visnagar, Mehsana, Gujarat, India. Hours: [DAYS/HOURS IST]. [If DPDP Rules require a Data Protection Officer or published contact for your category, add it here.]',
        ),
      ],
    },
    {
      id: 'changes',
      heading: '13. Changes',
      blocks: [
        lp(
          'We will post updates here with a new “Last updated” date and notify registered customers of material changes by email.',
        ),
      ],
    },
  ],
  internalNote:
    'Drafting note — Privacy Policy. Assumptions: (1) Nexus is B2B; guest data belongs to the restaurant. (2) Cashfree handles all card/UPI credentials via its hosted checkout — this is the intended design and is not yet built; confirm when integrated. (3) The security list reflects ADRs 004, 016, 017, 021 and runbooks in the repo; the TLS, encryption-at-rest and staff-access items are bracketed because the repo does not prove production configuration. (4) Retention numbers are proposals. (5) DPDP timelines (Rules notified Nov 2025; most obligations ~18 months later) come from secondary sources — verify against the Gazette. (6) No analytics tool is assumed; if one is added, a consent banner may be required. (7) No guest-facing apps exist yet; when QR ordering/Guest CRM ships, add consent wording and a guest-facing notice template for restaurants. Content-agent edit: the security bullet on backups no longer says the restore procedures “have been exercised in a test environment” (the staging restore drill is still pending per the codebase analysis).',
};
