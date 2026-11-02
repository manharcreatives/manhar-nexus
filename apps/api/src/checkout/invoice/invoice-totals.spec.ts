import { computeInvoiceTotals, type BillableLineInput } from './invoice-totals';

const line = (overrides: Partial<BillableLineInput> = {}): BillableLineInput => ({
  id: 'line-1',
  itemNameSnapshot: 'Burger',
  variantNameSnapshot: null,
  quantity: 1,
  unitPriceMinorUnits: 1000,
  taxRateSnapshot: { toNumber: () => 0.05 },
  taxCategoryNameSnapshot: 'GST 5%',
  modifiers: [],
  ...overrides,
});

describe('computeInvoiceTotals', () => {
  it('computes subtotal, tax, total and invoice-line snapshots', () => {
    const totals = computeInvoiceTotals([line({ quantity: 2 })]);

    expect(totals.subtotalMinorUnits).toBe(2000);
    expect(totals.totalTaxMinorUnits).toBe(100);
    expect(totals.grandTotalMinorUnits).toBe(2100);
    expect(totals.lines).toHaveLength(1);
    expect(totals.lines[0]).toMatchObject({
      serviceRequestLineId: 'line-1',
      quantity: 2,
      unitPriceMinorUnits: 1000,
      lineSubtotalMinorUnits: 2000,
      lineTaxMinorUnits: 100,
      lineTotalMinorUnits: 2100,
      taxRateSnapshot: 0.05,
      taxCategoryName: 'GST 5%',
    });
  });

  it('rounds tax per line and groups the breakdown by category and rate', () => {
    const totals = computeInvoiceTotals([
      line({ id: 'a', quantity: 1, unitPriceMinorUnits: 1010 }),
      line({ id: 'b', quantity: 1, unitPriceMinorUnits: 1010 }),
      line({
        id: 'c',
        quantity: 1,
        unitPriceMinorUnits: 2000,
        taxRateSnapshot: { toNumber: () => 0.12 },
        taxCategoryNameSnapshot: 'GST 12%',
      }),
    ]);

    expect(totals.lines.map((l) => l.lineTaxMinorUnits)).toEqual([51, 51, 240]);
    expect(totals.totalTaxMinorUnits).toBe(342);
    expect(totals.taxBreakdown).toEqual([
      { name: 'GST 5%', rate: 0.05, taxableAmountMinorUnits: 2020, taxAmountMinorUnits: 102 },
      { name: 'GST 12%', rate: 0.12, taxableAmountMinorUnits: 2000, taxAmountMinorUnits: 240 },
    ]);
  });

  it('keeps modifier adjustments on the line for display without adding them again', () => {
    const totals = computeInvoiceTotals([
      line({
        unitPriceMinorUnits: 1250,
        modifiers: [
          { optionNameSnapshot: 'Extra cheese', priceAdjMinorUnits: 150 },
          { optionNameSnapshot: 'No onion', priceAdjMinorUnits: 0 },
        ],
      }),
    ]);

    expect(totals.subtotalMinorUnits).toBe(1250);
    expect(totals.lines[0].modifiersMinorUnits).toBe(150);
    expect(totals.lines[0].modifiersSummary).toBe('Extra cheese, No onion');
  });

  it('uses a no-tax category when none is set', () => {
    const totals = computeInvoiceTotals([
      line({ taxRateSnapshot: { toNumber: () => 0 }, taxCategoryNameSnapshot: null }),
    ]);

    expect(totals.totalTaxMinorUnits).toBe(0);
    expect(totals.grandTotalMinorUnits).toBe(1000);
    expect(totals.taxBreakdown).toEqual([
      { name: 'No Tax', rate: 0, taxableAmountMinorUnits: 1000, taxAmountMinorUnits: 0 },
    ]);
  });

  it('returns zero totals for no lines', () => {
    expect(computeInvoiceTotals([])).toEqual({
      subtotalMinorUnits: 0,
      totalTaxMinorUnits: 0,
      grandTotalMinorUnits: 0,
      taxBreakdown: [],
      lines: [],
    });
  });
});
