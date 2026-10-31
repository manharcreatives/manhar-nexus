import { billReference, locationPrefix } from './bill-reference';
import { ratePercent, toBillTaxLines } from './tax-lines';

describe('bill reference', () => {
  it('prefixes bare numbers with the location code or initials, pads to 4 digits', () => {
    expect(billReference('377', { code: 'rv', name: 'Riverside' })).toBe('RV-0377');
    expect(billReference('42', { code: null, name: 'Main Location' })).toBe('ML-0042');
    expect(billReference('42', { code: null, name: 'Annex' })).toBe('AN-0042');
    expect(billReference('42', null)).toBe('0042');
  });
  it('leaves already-prefixed numbers and nulls alone', () => {
    expect(billReference('RV-0307', { code: 'XX', name: 'x' })).toBe('RV-0307');
    expect(billReference(null, null)).toBeNull();
    expect(locationPrefix({ code: '  ', name: '  ' })).toBeNull();
  });
});

describe('toBillTaxLines', () => {
  it('splits a plain GST category into CGST + SGST halves that add up exactly', () => {
    const [line] = toBillTaxLines([{ name: 'GST 5%', rate: 0.05, taxableAmountMinorUnits: 10100, taxAmountMinorUnits: 505 }]);
    expect(line.ratePercent).toBe(5);
    expect(line.components.map((c) => [c.label, c.ratePercent])).toEqual([
      ['CGST', 2.5],
      ['SGST', 2.5],
    ]);
    expect(line.components.reduce((s, c) => s + c.taxMinorUnits, 0)).toBe(505);
    expect(line.components[0].taxMinorUnits).toBe(252);
    expect(line.components[1].taxMinorUnits).toBe(253);
  });
  it('does not split explicit CGST/SGST/VAT or zero-rate categories', () => {
    const lines = toBillTaxLines([
      { name: 'CGST 9%', rate: 0.09, taxableAmountMinorUnits: 1000, taxAmountMinorUnits: 90 },
      { name: 'VAT', rate: 0.12, taxableAmountMinorUnits: 1000, taxAmountMinorUnits: 120 },
      { name: 'No Tax', rate: 0, taxableAmountMinorUnits: 1000, taxAmountMinorUnits: 0 },
    ]);
    expect(lines.every((l) => l.components.length === 0)).toBe(true);
  });
  it('sorts by rate, tolerates junk and rounds the percent without float noise', () => {
    expect(ratePercent(0.18)).toBe(18);
    expect(ratePercent(0.075)).toBe(7.5);
    expect(toBillTaxLines(null)).toEqual([]);
    const lines = toBillTaxLines([{ name: 'GST 18%', rate: 0.18, taxableAmountMinorUnits: 100, taxAmountMinorUnits: 18 }, { rate: 'x' }]);
    expect(lines.map((l) => l.label)).toEqual(['Tax', 'GST 18%']);
  });
});
