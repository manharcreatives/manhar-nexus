/**
 * The only place minor units become display text (ADR-015). Amounts stay
 * integers everywhere else; callers pass the currency explicitly when known.
 */
const DEFAULT_CURRENCY = 'INR';
const formatters = new Map<string, Intl.NumberFormat>();

function formatterFor(currency: string): Intl.NumberFormat {
  let f = formatters.get(currency);
  if (!f) {
    f = new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: 2 });
    formatters.set(currency, f);
  }
  return f;
}

/** Formats an integer minor-unit amount (e.g. paise) as currency text. */
export function formatMoney(minorUnits: number, currency: string = DEFAULT_CURRENCY): string {
  return formatterFor(currency).format(minorUnits / 100);
}

/** Parses typed major-unit text ("12", "12.5", "1,200.00") to minor units; null if invalid. */
export function parseMoney(text: string): number | null {
  const clean = text.replace(/,/g, '').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  const [whole, frac = ''] = clean.split('.');
  return Number(whole) * 100 + Number(frac.padEnd(2, '0'));
}
