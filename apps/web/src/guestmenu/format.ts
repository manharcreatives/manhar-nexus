import { formatMoney } from '../lib/money';

const cache = new Map<string, Intl.NumberFormat>();

/** Menu prices: "₹420" when whole rupees, "₹420.50" otherwise. Bills use formatMoney (always 2 decimals). */
export function formatPrice(minor: number, currency = 'INR'): string {
  let whole = cache.get(`w${currency}`);
  if (!whole) {
    whole = new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0, minimumFractionDigits: 0 });
    cache.set(`w${currency}`, whole);
  }
  return minor % 100 === 0 ? whole.format(minor / 100) : formatMoney(minor, currency);
}

export const formatBill = (minor: number, currency = 'INR') => formatMoney(minor, currency);

/** "+₹60" for add-on deltas; "Included" for zero. */
export function formatDelta(minor: number, currency = 'INR'): string {
  return minor === 0 ? 'Included' : `+${formatPrice(minor, currency)}`;
}

const timeFmt = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
export function formatTime(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : timeFmt.format(d).toLowerCase();
}

/** "3 min ago" / "just now". */
export function ago(iso: string | undefined, now = Date.now()): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const m = Math.max(0, Math.round((now - t) / 60000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  return formatTime(iso);
}
