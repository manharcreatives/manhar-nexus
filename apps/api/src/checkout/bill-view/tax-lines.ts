export interface StoredTaxGroup {
  name?: unknown;
  rate?: unknown;
  taxableAmountMinorUnits?: unknown;
  taxAmountMinorUnits?: unknown;
}

export interface BillTaxComponent {
  label: string;
  ratePercent: number;
  taxMinorUnits: number;
}

export interface BillTaxLine {
  /** Tax category as configured, e.g. "GST 5%". */
  label: string;
  ratePercent: number;
  taxableMinorUnits: number;
  taxMinorUnits: number;
  /** CGST + SGST halves for plain "GST" categories (dine-in is an intra-state supply); empty otherwise. */
  components: BillTaxComponent[];
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** 0.05 -> 5, 0.025 -> 2.5, 0.18 -> 18 (no float noise). */
export function ratePercent(rate: number): number {
  return Math.round(rate * 10000) / 100;
}

/** A plain GST category (not already an explicit CGST/SGST/IGST/VAT one) is shown as two equal halves. */
function isSplittableGst(name: string): boolean {
  return /\bgst\b/i.test(name) && !/\b(cgst|sgst|igst|utgst)\b/i.test(name);
}

/**
 * Turns the immutable invoice `taxBreakdown` snapshot into customer-facing GST lines.
 * The two halves always add up to the stored tax exactly (the odd paisa goes to SGST).
 */
export function toBillTaxLines(raw: unknown): BillTaxLine[] {
  if (!Array.isArray(raw)) return [];
  return (raw as StoredTaxGroup[])
    .map((g): BillTaxLine => {
      const label = typeof g.name === 'string' && g.name.trim() ? g.name.trim() : 'Tax';
      const rate = num(g.rate);
      const tax = num(g.taxAmountMinorUnits);
      const pct = ratePercent(rate);
      let components: BillTaxComponent[] = [];
      if (rate > 0 && tax > 0 && isSplittableGst(label)) {
        const cgst = Math.floor(tax / 2);
        components = [
          { label: 'CGST', ratePercent: pct / 2, taxMinorUnits: cgst },
          { label: 'SGST', ratePercent: pct / 2, taxMinorUnits: tax - cgst },
        ];
      }
      return { label, ratePercent: pct, taxableMinorUnits: num(g.taxableAmountMinorUnits), taxMinorUnits: tax, components };
    })
    .sort((a, b) => a.ratePercent - b.ratePercent);
}
