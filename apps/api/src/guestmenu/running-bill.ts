import { toBillTaxLines, type BillTaxLine } from '../checkout/bill-view/tax-lines';

/**
 * The bill a guest sees BEFORE the cashier finalises the invoice: same arithmetic as InvoiceService.computeTotals
 * (per-line tax = round(lineSubtotal x rate), grouped by "<category>:<rate>"), so the running total equals the
 * invoice the cashier will generate from the same lines. An e2e test locks this equality.
 */
export interface BillableLine {
  unitPriceMinorUnits: number;
  quantity: number;
  taxRateSnapshot: number;
  taxCategoryNameSnapshot: string | null;
}

export interface RunningTotals {
  subtotalMinor: number;
  taxMinor: number;
  totalMinor: number;
  taxLines: BillTaxLine[];
}

export function computeRunningBill(lines: BillableLine[]): RunningTotals {
  let subtotal = 0;
  let tax = 0;
  const groups = new Map<string, { name: string; rate: number; taxableAmountMinorUnits: number; taxAmountMinorUnits: number }>();
  for (const l of lines) {
    const lineSubtotal = l.unitPriceMinorUnits * l.quantity;
    const lineTax = Math.round(lineSubtotal * l.taxRateSnapshot);
    subtotal += lineSubtotal;
    tax += lineTax;
    const name = l.taxCategoryNameSnapshot ?? 'No Tax';
    const key = `${name}:${l.taxRateSnapshot}`;
    const g = groups.get(key);
    if (g) {
      g.taxableAmountMinorUnits += lineSubtotal;
      g.taxAmountMinorUnits += lineTax;
    } else {
      groups.set(key, { name, rate: l.taxRateSnapshot, taxableAmountMinorUnits: lineSubtotal, taxAmountMinorUnits: lineTax });
    }
  }
  return { subtotalMinor: subtotal, taxMinor: tax, totalMinor: subtotal + tax, taxLines: toBillTaxLines([...groups.values()]) };
}

export interface WireTaxLine {
  name: string;
  label: string;
  ratePercent: number;
  amountMinor: number;
}

/** Flattens tax groups into display rows; a plain "GST" group becomes CGST + SGST halves that sum to the stored tax. */
export function toWireTaxLines(lines: BillTaxLine[]): WireTaxLine[] {
  const out: WireTaxLine[] = [];
  for (const t of lines) {
    if (t.taxMinorUnits <= 0 && t.ratePercent <= 0) continue; // untaxed items do not need a "0%" row
    if (t.components.length > 0) {
      for (const c of t.components) out.push({ name: `${c.label} ${c.ratePercent}%`, label: c.label, ratePercent: c.ratePercent, amountMinor: c.taxMinorUnits });
    } else {
      out.push({ name: t.label, label: t.label, ratePercent: t.ratePercent, amountMinor: t.taxMinorUnits });
    }
  }
  return out;
}
