import { QR_MENU_LIVE, QR_MENU_NAME } from '../content';
/**
 * Plan comparison rows. Source: 03b_BUSINESS_MODEL_AND_PRICING.md §1.2 and §1.4 (every row is live in the product
 * per the codebase truth table) plus the coming-soon list in §1.5. Columns: Counter, Floor, Pass, Many Doors.
 * `true` = included, `false` = not included, string = the exact value to print.
 */
export type CompareCell = boolean | string;

export interface CompareRow {
  readonly id: string;
  readonly label: string;
  /** One cell per plan column, in PLAN_COLUMNS order. */
  readonly cells: readonly [CompareCell, CompareCell, CompareCell, CompareCell];
}

export interface CompareGroup {
  readonly id: string;
  readonly title: string;
  readonly rows: readonly CompareRow[];
}

export interface ComingSoonRow {
  readonly id: string;
  readonly label: string;
  readonly note: string;
}

export const PLAN_COLUMNS = ['counter', 'floor', 'pass', 'many-doors'] as const;

const ALL: readonly [true, true, true, true] = [true, true, true, true];
const FROM_FLOOR: readonly [false, true, true, true] = [false, true, true, true];
const AGREED = 'Agreed with you';

export const COMPARE_GROUPS: readonly CompareGroup[] = [
  {
    id: 'capacity',
    title: 'Capacity',
    rows: [
      { id: 'outlets', label: 'Outlets', cells: ['1', '1', 'Up to 3', '4+'] },
      { id: 'logins', label: 'Staff logins', cells: ['Up to 5', 'Up to 15', 'Up to 40', 'Custom'] },
      { id: 'switcher', label: 'Location switcher and location-scoped roles', cells: [false, false, true, true] },
    ],
  },
  {
    id: 'service',
    title: 'Every service',
    rows: [
      { id: 'menu', label: 'Menu with portions, Add-ons and a Sold-Out switch', cells: ALL },
      { id: 'floor', label: 'Floor map with live Dining Table status', cells: ALL },
      { id: 'requests', label: 'Guest Sessions and Service Requests', cells: ALL },
      ...(QR_MENU_LIVE ? [{ id: 'nexus-menu', label: `${QR_MENU_NAME}: QR digital menu and table ordering`, cells: ALL }] : []),
      { id: 'kos', label: 'Kitchen Operations Screen (KOS)', cells: ALL },
      { id: 'checkout', label: 'Checkout with GST by line, cash and UPI', cells: ALL },
      { id: 'refund', label: 'Refund and Void, always with a reason', cells: ALL },
      { id: 'reports', label: 'Daily closing report, sales summary, 14-day trend, CSV', cells: ALL },
      { id: 'today', label: 'Owner “Today” home', cells: ALL },
    ],
  },
  {
    id: 'control',
    title: 'Control and trust',
    rows: [
      { id: 'history', label: 'Activity History with Verify', cells: ALL },
      { id: 'roles', label: 'Standard roles', cells: ALL },
      { id: 'custom-roles', label: 'Custom roles', cells: FROM_FLOOR },
      {
        id: 'alerts',
        label: 'Alerts Center',
        cells: ['Default alerts', 'Rules you can tune', 'Rules you can tune', 'Rules you can tune'],
      },
      { id: 'costs', label: 'Operating Costs with approve / reject', cells: FROM_FLOOR },
    ],
  },
  {
    id: 'support',
    title: 'Support and setup',
    rows: [
      {
        id: 'support',
        label: 'Support',
        cells: ['Email, business hours', 'Email and WhatsApp, business hours', 'Priority queue, named contact', AGREED],
      },
      { id: 'review', label: 'Quarterly review call (30 minutes)', cells: [false, false, true, AGREED] },
      { id: 'launch-pack', label: 'Launch Pack (₹3,499)', cells: ['Optional', 'Optional', 'Included', 'Quoted'] },
    ],
  },
];

/** Not sold and not part of any plan today. Rendered with a “Coming soon” tag across all four columns. */
export const COMING_SOON_ROWS: readonly ComingSoonRow[] = [
  ...(QR_MENU_LIVE ? [] : [{ id: 'qr', label: 'QR Scan Menu', note: 'Planned.' }]),
  { id: 'printing', label: 'Receipt and kitchen-ticket printing', note: 'Built in the engine, not yet validated with real printers.' },
  { id: 'messaging', label: 'WhatsApp / SMS messaging', note: 'Planned; credits will be an add-on.' },
];
