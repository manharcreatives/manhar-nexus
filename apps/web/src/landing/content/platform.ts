import type { ModuleStatus, PlatformContent, PlatformModule, ImageName } from './types';

const live = (
  number: string,
  id: string,
  title: string,
  curiousLine: string,
  description: string,
  proof: string,
  icon: string,
  image?: ImageName,
): PlatformModule => ({
  id,
  number,
  title,
  curiousLine,
  description,
  proof,
  status: 'live' satisfies ModuleStatus,
  icon,
  ...(image ? { image } : {}),
});

const soon = (
  id: string,
  title: string,
  curiousLine: string,
  description: string,
  icon: string,
  image?: ImageName,
): PlatformModule => ({
  id,
  number: '',
  title,
  curiousLine,
  description,
  proof: '',
  status: 'coming-soon' satisfies ModuleStatus,
  icon,
  ...(image ? { image } : {}),
});

/** The twelve modules that exist today. Every line maps to a LIVE row in the feature truth table. */
export const PLATFORM_MODULES: readonly PlatformModule[] = [
  live(
    '01',
    'floor',
    'Floor & Dining Tables',
    'Which table is really free?',
    'Draw your Dining Areas once. Every Dining Table shows Available, Occupied or Cleaning — in words, not just colour.',
    'Table state in text, for any screen and any eyesight.',
    'LayoutGrid',
    'table-setting-topdown',
  ),
  live(
    '02',
    'menu',
    'Menu & Add-ons',
    'Half plate, less spicy, extra raita — captured once.',
    'Categories, items, portions and Add-ons with rules (single or multiple, min and max, priced). Mark a dish Sold-Out with one switch.',
    'Variants and Add-ons are validated on the server, not just on the screen.',
    'UtensilsCrossed',
    'indian-thali-overhead',
  ),
  live(
    '03',
    'sessions',
    'Guest Sessions & Service Requests',
    'One visit, however many rounds.',
    'Open a table with party size, add rounds as the meal goes on, send each Service Request to the kitchen, and mark items served.',
    'Repeated taps are recognised as the same request.',
    'ConciergeBell',
  ),
  live(
    '04',
    'kos',
    'Kitchen Operations Screen (KOS)',
    'A kitchen that knows what to cook next.',
    'Service Requests arrive oldest-first with waiting time. Accept, start preparing, mark ready.',
    'Running-late items are flagged automatically.',
    'ChefHat',
    'kitchen-pass-ticket-rail',
  ),
  live(
    '05',
    'checkout',
    'Checkout',
    'The bill that adds up, every time.',
    'One Checkout per Guest Session. GST by line, cash with change due, UPI with a transaction-reference confirmation.',
    'Money is calculated in whole paise, on the server.',
    'Receipt',
  ),
  live(
    '06',
    'bills',
    'Bills, Refunds & Voids',
    'Mistakes fixed in the open.',
    'Search every Checkout. Refund with a mandatory reason, capped at what was paid. Void keeps the number consumed.',
    'Refunds can’t exceed what was paid — even if two people try at once.',
    'Undo2',
  ),
  live(
    '07',
    'reports',
    'Reports',
    'Tonight’s truth, tomorrow’s decisions.',
    'Daily closing, sales summary, top items, a 14-day trend. Download as CSV or print from the browser.',
    'The first screen the owner sees is “Today”.',
    'ChartColumn',
    'owner-tablet-reports',
  ),
  live(
    '08',
    'costs',
    'Operating Costs',
    'Where the running costs actually go.',
    'Categories, expenses and an approval flow with a reason when something is rejected.',
    'Approvals are recorded in Activity History.',
    'Wallet',
  ),
  live(
    '09',
    'roles',
    'Roles & Access',
    'The cook doesn’t need to see sales.',
    // “Manager” → “Location Manager” to match the real system role name.
    'Owner, Location Manager, Checkout Associate, Service Team, Kitchen Team and more — or build your own role.',
    'Every restricted action is checked on the server, not just hidden on the screen.',
    'KeyRound',
  ),
  live(
    '10',
    'activity',
    'Activity History',
    'Who did what, and can we prove it?',
    'A timeline of sensitive actions across your Business Workspace. Hit Verify to check the chain is intact.',
    'Records are linked so a silent change breaks the chain.',
    'History',
  ),
  live(
    '11',
    'alerts',
    'Alerts Center',
    'Told when it matters, quiet when it doesn’t.',
    'In-app alerts for things that need attention, with rules you can tune.',
    // Softened: “alerts relevant to your role” is not verified in code.
    'A bell in the app keeps every alert in one place.',
    'Bell',
  ),
  live(
    '12',
    'locations',
    'Locations',
    'One login, more than one door.',
    'Work in one outlet at a time, with roles scoped to a location.',
    'Our team sets up each location with you.',
    'MapPin',
  ),
];

/** Roadmap cards. Muted, tagged COMING SOON, never priced as value. */
export const COMING_SOON_MODULES: readonly PlatformModule[] = [
  soon(
    'printing',
    'Printing & kitchen tickets',
    'Paper, when the pass wants paper.',
    'The print engine is built; it is not yet validated with real printers.',
    'Printer',
  ),
  soon(
    'bookings',
    'Bookings',
    'A table promised, a table kept.',
    'The booking engine exists; the screen for your team is still to come.',
    'CalendarClock',
  ),
  soon(
    'guests',
    'Guest profiles',
    'Remember the regulars.',
    'The guest records exist in the engine; screens and consent wording are still to come.',
    'Users',
  ),
  soon(
    'qr-menu',
    'QR Scan Menu',
    'Scan, browse, call a waiter.',
    'In design. Not available yet.',
    'QrCode',
    'qr-table-tent-blank',
  ),
  soon(
    'stock',
    'Stock & recipes',
    'Know what is in the storeroom.',
    'Planned. Not available yet.',
    'Boxes',
    'storeroom-crates-morning',
  ),
  soon(
    'messaging',
    'WhatsApp messaging',
    'Reach guests where they already are.',
    'Planned. Not available yet.',
    'MessageCircle',
  ),
  soon(
    'discounts',
    'Discounts & split Checkouts',
    'Kind gestures, written down.',
    'Planned. Not available yet.',
    'Percent',
  ),
  soon(
    'languages',
    'Gujarati / Hindi screens',
    'Screens in the language of the floor.',
    'Planned. English only for now.',
    'Languages',
  ),
];

export const PLATFORM: PlatformContent = {
  header: {
    eyebrow: 'THE PLATFORM',
    headline: {
      text: 'One platform. Switch on only what your restaurant needs today.',
      accent: 'needs',
    },
    subhead:
      'Nexus is built as a core with modules. Your Business Workspace starts small and grows without a migration.',
  },
  modules: PLATFORM_MODULES,
  comingSoonTitle: 'Coming soon',
  comingSoonTag: 'COMING SOON',
  comingSoon: COMING_SOON_MODULES,
  comingSoonNote:
    'These are in design or in the engine. We will not charge for something that isn’t here, and we will tell you before it is.',
  liveTag: 'LIVE',
};

export const ALL_PLATFORM_MODULES: readonly PlatformModule[] = [
  ...PLATFORM_MODULES,
  ...COMING_SOON_MODULES,
];
