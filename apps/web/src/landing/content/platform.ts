import { QR_MENU_LIVE, QR_MENU_NAME } from './flags';
import type { ModuleStatus, PlatformContent, PlatformModule, ImageName } from './types';

const live = (
  id: string,
  title: string,
  curiousLine: string,
  summary: string,
  description: string,
  proof: string,
  icon: string,
  image?: ImageName,
): PlatformModule => ({
  id,
  number: '',
  title,
  curiousLine,
  summary,
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
  summary: description,
  description,
  proof: '',
  status: 'coming-soon' satisfies ModuleStatus,
  icon,
  ...(image ? { image } : {}),
});

/** The QR digital menu + self-ordering. Gated: "Live" only when QR_MENU_LIVE (content/flags.ts) is true. */
const NEXUS_MENU_LIVE: PlatformModule = {
  id: 'nexus-menu',
  number: '',
  title: `${QR_MENU_NAME}: QR digital menu`,
  curiousLine: 'Scan. Browse. Order. Pay.',
  summary: 'A live menu on every table, with photos of every dish. Guests can order, call the waiter and follow their bill.',
  description:
    'Every table gets a QR code. Guests open your live menu on their own phone, with no app and no login. Edit a dish and the menu changes at once.',
  proof: 'Prices are recomputed on the server, and your waiter confirms guest orders by default.',
  status: 'live',
  icon: 'QrCode',
  image: 'qr-table-tent-blank',
};

const NEXUS_MENU_SOON: PlatformModule = {
  ...NEXUS_MENU_LIVE,
  summary: 'A QR menu on every table with photos of every dish, guest ordering and a live table bill. Being finished.',
  proof: '',
  status: 'coming-soon',
};

const CORE_MODULES: readonly PlatformModule[] = [
  live(
    'kos',
    'Kitchen Operations Screen (KOS)',
    'A kitchen that knows what to cook next.',
    'Service Requests arrive oldest-first with waiting time. Accept, prepare, mark ready.',
    'Service Requests arrive oldest-first with waiting time. Accept, start preparing, mark ready.',
    'Running-late items are flagged automatically.',
    'ChefHat',
    'kitchen-pass-ticket-rail',
  ),
  live(
    'floor',
    'Floor & Dining Tables',
    'Which table is really free?',
    'Draw your Dining Areas once. Every table reads Available, Occupied or Cleaning, in words.',
    'Draw your Dining Areas once. Every Dining Table shows Available, Occupied or Cleaning, in words, not just colour.',
    'Table state in text, for any screen and any eyesight.',
    'LayoutGrid',
    'table-setting-topdown',
  ),
  live(
    'checkout',
    'Checkout',
    'The bill that adds up, every time.',
    'GST by line, cash with change due, UPI with a reference. Calculated on the server, in paise.',
    'One Checkout per Guest Session. GST by line, cash with change due, UPI with a transaction-reference confirmation.',
    'Money is calculated in whole paise, on the server.',
    'Receipt',
  ),
  live(
    'bills',
    'Bills, Refunds & Voids',
    'Mistakes fixed in the open.',
    'Refund with a mandatory reason, capped at what was paid. Nothing paid is ever edited.',
    'Search every Checkout. Refund with a mandatory reason, capped at what was paid. Void keeps the number consumed.',
    'Refunds can’t exceed what was paid, even if two people try at once.',
    'Undo2',
  ),
  live(
    'reports',
    'Reports',
    'Tonight’s truth, tomorrow’s decisions.',
    'Daily closing, sales summary, top items and a 14-day trend. Download as CSV.',
    'Daily closing, sales summary, top items, a 14-day trend. Download as CSV or print from the browser.',
    'The first screen the owner sees is “Today”.',
    'ChartColumn',
    'owner-tablet-reports',
  ),
];

/** The compact "and also" strip: live, real, not headline. */
const ALSO_MODULES: readonly PlatformModule[] = [
  live(
    'menu',
    'Menu & Add-ons',
    'Half plate, less spicy, extra raita, captured once.',
    'Categories, portions and Add-ons with rules. Mark a dish Sold-Out with one switch.',
    'Categories, items, portions and Add-ons with rules (single or multiple, min and max, priced). Mark a dish Sold-Out with one switch.',
    'Variants and Add-ons are validated on the server, not just on the screen.',
    'UtensilsCrossed',
    'indian-thali-overhead',
  ),
  live(
    'sessions',
    'Guest Sessions & Service Requests',
    'One visit, however many rounds.',
    'Open a table with party size, add rounds, send each Service Request to the kitchen.',
    'Open a table with party size, add rounds as the meal goes on, send each Service Request to the kitchen, and mark items served.',
    'Repeated taps are recognised as the same request.',
    'ConciergeBell',
  ),
  live(
    'costs',
    'Operating Costs',
    'Where the running costs actually go.',
    'Categories, expenses and an approval flow with a reason on rejection.',
    'Categories, expenses and an approval flow with a reason when something is rejected.',
    'Approvals are recorded in Activity History.',
    'Wallet',
  ),
  live(
    'roles',
    'Roles & Access',
    'The cook doesn’t need to see sales.',
    'Owner, Location Manager, Checkout Associate, Service Team, Kitchen Team, or your own role.',
    'Owner, Location Manager, Checkout Associate, Service Team, Kitchen Team and more, or build your own role.',
    'Every restricted action is checked on the server, not just hidden on the screen.',
    'KeyRound',
  ),
  live(
    'activity',
    'Activity History',
    'Who did what, and can we prove it?',
    'A timeline of sensitive actions. Hit Verify to check the chain is intact.',
    'A timeline of sensitive actions across your Business Workspace. Hit Verify to check the chain is intact.',
    'Records are linked so a silent change breaks the chain.',
    'History',
  ),
  live(
    'alerts',
    'Alerts Center',
    'Told when it matters, quiet when it doesn’t.',
    'In-app alerts for things that need attention, with rules you can tune.',
    'In-app alerts for things that need attention, with rules you can tune.',
    'A bell in the app keeps every alert in one place.',
    'Bell',
  ),
  live(
    'locations',
    'Locations',
    'One login, more than one door.',
    'Work in one outlet at a time, with roles scoped to a location.',
    'Work in one outlet at a time, with roles scoped to a location.',
    'Our team sets up each location with you.',
    'MapPin',
  ),
];

const withNumbers = (list: readonly PlatformModule[]): PlatformModule[] =>
  list.map((m, i) => ({ ...m, number: String(i + 1).padStart(2, '0') }));

/** Live modules: the headline six first (Nexus Menu leads when live), then the "and also" strip. */
export const PLATFORM_MODULES: readonly PlatformModule[] = withNumbers([
  ...(QR_MENU_LIVE ? [NEXUS_MENU_LIVE] : []),
  ...CORE_MODULES,
  ...ALSO_MODULES,
]);

/** Roadmap cards. Muted, tagged COMING SOON, never priced as value. */
export const COMING_SOON_MODULES: readonly PlatformModule[] = [
  ...(QR_MENU_LIVE ? [] : [NEXUS_MENU_SOON]),
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
      text: 'One platform. Switch on only what you need today.',
      accent: 'need',
    },
    subhead: 'A core with modules. Start small and grow without a migration.',
  },
  headlineIds: [...(QR_MENU_LIVE ? ['nexus-menu'] : []), 'kos', 'floor', 'checkout', 'bills', 'reports'],
  alsoTitle: 'And also, in every workspace',
  modules: PLATFORM_MODULES,
  comingSoonTitle: 'Coming soon',
  comingSoonTag: 'COMING SOON',
  comingSoon: COMING_SOON_MODULES,
  comingSoonNote: 'In design or in the engine. We won’t charge for what isn’t here.',
  liveTag: 'LIVE',
};

export const ALL_PLATFORM_MODULES: readonly PlatformModule[] = [
  ...PLATFORM_MODULES,
  ...COMING_SOON_MODULES,
];
