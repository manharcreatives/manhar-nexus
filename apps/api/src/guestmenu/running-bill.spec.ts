import { computeRunningBill, toWireTaxLines } from './running-bill';

const line = (price: number, qty: number, rate: number, name: string | null = 'GST 5%') => ({
  unitPriceMinorUnits: price,
  quantity: qty,
  taxRateSnapshot: rate,
  taxCategoryNameSnapshot: name,
});

describe('computeRunningBill', () => {
  it('mirrors the invoice arithmetic: per-line rounded tax, grouped by category and rate', () => {
    const r = computeRunningBill([line(1000, 2, 0.05), line(333, 3, 0.05), line(250, 1, 0.18, 'GST 18%')]);
    // 2000*5%=100, 999*5%=49.95->50, 250*18%=45
    expect(r.subtotalMinor).toBe(2000 + 999 + 250);
    expect(r.taxMinor).toBe(100 + 50 + 45);
    expect(r.totalMinor).toBe(r.subtotalMinor + r.taxMinor);
    expect(r.taxLines.map((t) => [t.label, t.taxableMinorUnits, t.taxMinorUnits])).toEqual([
      ['GST 5%', 2999, 150],
      ['GST 18%', 250, 45],
    ]);
  });

  it('handles an empty bill and untaxed lines', () => {
    expect(computeRunningBill([])).toMatchObject({ subtotalMinor: 0, taxMinor: 0, totalMinor: 0, taxLines: [] });
    const r = computeRunningBill([line(500, 2, 0, null)]);
    expect(r.totalMinor).toBe(1000);
    expect(toWireTaxLines(r.taxLines)).toEqual([]);
  });
});

describe('toWireTaxLines', () => {
  it('splits plain GST into CGST + SGST halves that add up to the tax (odd paisa to SGST)', () => {
    const r = computeRunningBill([line(1010, 1, 0.05)]); // 50.5 -> 51
    const wire = toWireTaxLines(r.taxLines);
    expect(wire.map((w) => w.label)).toEqual(['CGST', 'SGST']);
    expect(wire.reduce((s, w) => s + w.amountMinor, 0)).toBe(r.taxMinor);
    expect(wire.map((w) => w.amountMinor)).toEqual([25, 26]);
    expect(wire[0]).toMatchObject({ ratePercent: 2.5, name: 'CGST 2.5%' });
  });
  it('keeps non-GST categories as one row', () => {
    const wire = toWireTaxLines(computeRunningBill([line(1000, 1, 0.1, 'Service Charge')]).taxLines);
    expect(wire).toEqual([{ name: 'Service Charge', label: 'Service Charge', ratePercent: 10, amountMinor: 100 }]);
  });
});
