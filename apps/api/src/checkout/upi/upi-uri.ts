/**
 * UPI deep-link / QR payload builder (NPCI "UPI Linking Specification").
 *
 *   upi://pay?pa=<vpa>&pn=<payee>&am=<amount>&cu=INR&tn=<note>&tr=<ref>
 *
 * Pure and dependency-free so the same builder can serve the staff "payment QR"
 * (checkout) and, later, the guest menu's pay intent. Money is integer paise
 * (ADR-015); the decimal `am` string is produced with integer arithmetic only.
 */

/**
 * Virtual payment address: `handle@psp`. Handle 2-64 chars (letters, digits, `.`, `_`, `-`),
 * PSP 2-32 letters/digits (okhdfcbank, ybl, paytm, upi ...). Case-insensitive.
 */
export const UPI_VPA_REGEX = /^[a-z0-9][a-z0-9._-]{1,63}@[a-z][a-z0-9]{1,31}$/i;

export function isValidVpa(value: string): boolean {
  return UPI_VPA_REGEX.test(value);
}

export interface UpiUriInput {
  vpa: string;
  payeeName: string;
  /** Exact payable amount in integer paise. */
  amountMinorUnits: number;
  /** Short note shown in the customer's UPI app (max 80 chars after cleaning). */
  note?: string;
  /** Merchant transaction reference (alphanumeric, max 35). */
  reference?: string;
  currency?: 'INR';
}

/** Letters (any script), digits and a few harmless separators; everything else is dropped. */
function cleanText(value: string, max: number): string {
  const cleaned = value
    .replace(/[^\p{L}\p{N} .,_\-/#()']/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return Array.from(cleaned).slice(0, max).join('').trim();
}

/** Alphanumeric reference, max 35 chars (NPCI `tr`). */
export function cleanTransactionRef(value: string): string {
  return value.replace(/[^A-Za-z0-9]/g, '').slice(0, 35);
}

/** 1050 -> "10.50" using integers only. */
export function formatUpiAmount(amountMinorUnits: number): string {
  if (!Number.isSafeInteger(amountMinorUnits) || amountMinorUnits <= 0) {
    throw new RangeError('UPI amount must be a positive integer number of paise');
  }
  const whole = Math.floor(amountMinorUnits / 100);
  const frac = amountMinorUnits % 100;
  return `${whole}.${String(frac).padStart(2, '0')}`;
}

export function buildUpiUri(input: UpiUriInput): string {
  const vpa = input.vpa.trim();
  if (!isValidVpa(vpa)) throw new RangeError('Invalid UPI VPA');
  const payee = cleanText(input.payeeName, 60);
  if (!payee) throw new RangeError('UPI payee name is required');
  const parts = [
    `pa=${vpa}`,
    `pn=${encodeURIComponent(payee)}`,
    `am=${formatUpiAmount(input.amountMinorUnits)}`,
    `cu=${input.currency ?? 'INR'}`,
  ];
  const note = input.note ? cleanText(input.note, 80) : '';
  if (note) parts.push(`tn=${encodeURIComponent(note)}`);
  const ref = input.reference ? cleanTransactionRef(input.reference) : '';
  if (ref) parts.push(`tr=${ref}`);
  return `upi://pay?${parts.join('&')}`;
}
