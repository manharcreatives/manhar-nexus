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

export interface MoneyParts {
  /** Leading sign ("-") or "". */
  sign: string;
  /** Currency symbol as the locale prints it ("₹"). */
  currency: string;
  /** Whole units with grouping ("25,052"). */
  whole: string;
  /** Decimal separator plus fraction (".50"), or "". */
  fraction: string;
  /** The exact text formatMoney returns, for screen readers and tests. */
  text: string;
}

/** The same text as formatMoney, split for typographic setting (ledger figures). */
export function moneyParts(minorUnits: number, currency: string = DEFAULT_CURRENCY): MoneyParts {
  const f = formatterFor(currency);
  const parts = f.formatToParts(minorUnits / 100);
  let sign = '';
  let cur = '';
  let whole = '';
  let fraction = '';
  for (const p of parts) {
    if (p.type === 'minusSign') sign += p.value;
    else if (p.type === 'currency') cur += p.value;
    else if (p.type === 'integer' || p.type === 'group') whole += p.value;
    else if (p.type === 'decimal' || p.type === 'fraction') fraction += p.value;
  }
  return { sign, currency: cur, whole, fraction, text: f.format(minorUnits / 100) };
}

const compactFormatters = new Map<string, Intl.NumberFormat>();

/**
 * Short currency text for chart axes and tight labels ("₹12K", "₹1.2L").
 * Never use it where the exact amount matters; pair it with formatMoney.
 */
export function formatMoneyCompact(minorUnits: number, currency: string = DEFAULT_CURRENCY): string {
  let f = compactFormatters.get(currency);
  if (!f) {
    f = new Intl.NumberFormat('en-IN', { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 });
    compactFormatters.set(currency, f);
  }
  return f.format(minorUnits / 100);
}

/** Parses typed major-unit text ("12", "12.5", "1,200.00") to minor units; null if invalid. */
export function parseMoney(text: string): number | null {
  const clean = text.replace(/,/g, '').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  const [whole, frac = ''] = clean.split('.');
  return Number(whole) * 100 + Number(frac.padEnd(2, '0'));
}
