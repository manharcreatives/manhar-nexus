import { QR_MENU_LIVE } from './flags';
import type { CompareContent, CompareMoment, ScorecardRow } from './types';

const moment = (
  id: string,
  clock: string,
  label: string,
  title: string,
  without: string,
  withNexus: string,
): CompareMoment => {
  const [h, m] = clock.split(':').map(Number);
  const minutes = ((h ?? 0) % 24 === 0 ? 24 : (h ?? 0)) * 60 + (m ?? 0) - 18 * 60;
  return { id, clock, label, minutes, title, without, with: withNexus };
};

/** “One Saturday night, two ways” — five moments between 18:00 and 00:00. */
export const COMPARE_MOMENTS: readonly CompareMoment[] = [
  moment(
    'family-of-five',
    '18:30',
    '6:30 pm',
    'A family of five walks in',
    'You glance at the floor and guess. Someone is sure Table 4 is clear. It isn’t.',
    'The table board says Available, Occupied or Cleaning, in words. You open a session with the party size.',
  ),
  moment(
    'half-plate-less-spicy',
    '19:42',
    '7:42 pm',
    '“Half plate, less spicy, extra raita”',
    'It is said once, over noise. It becomes a scribble.',
    'The waiter picks the portion and the Add-ons you defined. The request carries exactly that to the kitchen.',
  ),
  moment(
    'kitchen-behind',
    '20:20',
    '8:20 pm',
    'The kitchen is behind',
    'Nobody knows which ticket is oldest. The loudest table eats first.',
    'The kitchen screen lists requests oldest first, with waiting time, and flags what is running late.',
  ),
  moment(
    'bill-time',
    '21:15',
    '9:15 pm',
    'Time for the bill',
    'The total is added on a phone calculator. GST is a rounded guess.',
    'Checkout is calculated on the server in whole paise, GST by line. Cash shows the change due.',
  ),
  moment(
    'closing',
    '23:45',
    '11:45 pm',
    'Closing',
    'You count the drawer against three sources. The gap becomes an argument.',
    'The daily closing shows sales, tax, payment methods and refunds. Verify checks that nothing was altered.',
  ),
];

const row = (
  id: string,
  criterion: string,
  paper: string,
  typicalPos: string,
  nexus: string,
  status: ScorecardRow['status'],
): ScorecardRow => ({ id, criterion, paper, typicalPos, nexus, status });

/** Qualitative scorecard. Where Nexus is behind, it says so. */
export const SCORECARD_ROWS: readonly ScorecardRow[] = [
  row(
    'table-to-kitchen',
    'Table-to-kitchen hand-off',
    'Spoken or scribbled',
    'Usually KOT print; screens often a paid add-on',
    'Service Requests to a live KOS, included in every plan',
    'ahead',
  ),
  row(
    'price-on-website',
    'Price on the website',
    'None needed',
    'Often “book a demo”',
    'Written down, GST stated',
    'ahead',
  ),
  row(
    'changing-paid-bill',
    'Changing a paid bill',
    'Easy and invisible',
    'Often possible with permissions',
    'Not possible — reversal with a reason only',
    'ahead',
  ),
  row(
    'tamper-evidence',
    'Proof that records weren’t altered',
    'None',
    'Varies',
    'Activity History with a Verify check',
    'ahead',
  ),
  row(
    'role-access',
    'Role-based staff access',
    'None',
    'Yes',
    'Yes — the cook never sees sales',
    'equal',
  ),
  row(
    'retry-safety',
    'Double-tap / retry safety',
    'None',
    'Varies',
    'Built in (idempotent requests)',
    'ahead',
  ),
  row(
    'daily-closing',
    'Daily closing numbers',
    'Manual',
    'Yes',
    'Yes — sales, tax, payment methods, refunds, CSV',
    'equal',
  ),
  row(
    'card-payments',
    'Card payments at Checkout',
    'n/a',
    'Usually yes',
    'Not yet — coming soon',
    'not-yet',
  ),
  row(
    'qr-aggregators',
    'QR ordering / aggregator links',
    'No',
    'Often yes (paid)',
    QR_MENU_LIVE ? 'QR menu and table ordering: yes (Nexus Menu). Aggregator links: not yet' : 'Not yet — coming soon',
    QR_MENU_LIVE ? 'equal' : 'not-yet',
  ),
  row(
    'printing',
    'Receipt printing',
    'Hand-written',
    'Yes',
    'Not yet — in the engine, being validated — coming soon',
    'not-yet',
  ),
  row(
    'stock-recipes',
    'Stock & recipes',
    'Notebook',
    'Often yes',
    'Not yet — coming soon',
    'not-yet',
  ),
  row(
    'offline',
    'Works with no internet',
    'Yes',
    'Some do',
    'No. Needs internet; keep a paper fallback',
    'not-yet',
  ),
  row(
    'languages',
    'Gujarati / Hindi screens',
    'n/a',
    'Varies',
    'English only for now',
    'not-yet',
  ),
  row(
    'customers',
    'Customers who can vouch for it',
    '—',
    'Many',
    'Not yet — we are opening to Founding Restaurants',
    'not-yet',
  ),
];

export const COMPARE: CompareContent = {
  header: {
    eyebrow: 'ONE SATURDAY NIGHT, TWO WAYS',
    headline: {
      text: 'Same restaurant. A different 6 pm to midnight.',
      accent: 'different',
    },
    subhead:
      'Pick a moment. On the left, how many restaurants run today; on the right, the same moment with Nexus.',
  },
  range: {
    startClock: '18:00',
    endClock: '00:00',
    startLabel: '6 pm',
    endLabel: 'midnight',
    totalMinutes: 360,
    ticks: ['18:00', '19:00', '20:00', '21:00', '22:00', '23:00', '00:00'],
    sliderLabel: 'Time of night',
  },
  moments: COMPARE_MOMENTS,
  withoutLabel: 'Without Nexus',
  withLabel: 'With Nexus',
  caption:
    'Illustrative night, not a customer story. Nexus today records cash and UPI payments; card payments, discounts and split bills are coming soon.',
  scorecardHeader: {
    eyebrow: 'AN HONEST SCORECARD',
    headline: {
      text: 'Honestly, how do we compare?',
      accent: 'Honestly',
    },
  },
  scorecardIntro:
    'We have marked where Nexus is ahead, where it is equal, and where it is not yet there. “Typical POS” means the common cloud billing software sold in India; “Paper + WhatsApp” means slips, a register and a group chat. Both are fair tools for some restaurants.',
  scorecardColumns: {
    criterion: 'What matters',
    paper: 'Paper + WhatsApp',
    typicalPos: 'Typical cloud POS',
    nexus: 'Nexus today',
  },
  statusLabels: {
    ahead: 'Ahead',
    equal: 'Equal',
    'not-yet': 'Not yet',
  },
  basisNote:
    'Qualitative and illustrative. This is a plain-language reading of common patterns, not a benchmark, a test result or a comparison with any named product — so there are no scores or percentages.',
  scorecard: SCORECARD_ROWS,
  footnote:
    'If your restaurant today needs card billing, printed receipts or aggregator links on day one, Nexus is not ready for you yet — and we would rather say so than sell you a promise.',
};
