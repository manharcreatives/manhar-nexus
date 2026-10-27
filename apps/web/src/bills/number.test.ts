import { describe, expect, it } from 'vitest';
import { formatBillNumber, locationPrefix } from './number';

const main = { code: null, name: 'Main Location' };

describe('formatBillNumber', () => {
  it('gives a bare number its location prefix and padding', () => {
    expect(formatBillNumber('377', main)).toBe('ML-0377');
    expect(formatBillNumber('12345', main)).toBe('ML-12345');
  });
  it('leaves an already-prefixed number exactly as issued', () => {
    expect(formatBillNumber('RV-0307', { code: null, name: 'Riverside' })).toBe('RV-0307');
  });
  it('prefers the location code and handles unknown locations and drafts', () => {
    expect(formatBillNumber('7', { code: 'bnd', name: 'Bandra' })).toBe('BND-0007');
    expect(formatBillNumber('7', undefined)).toBe('0007');
    expect(formatBillNumber(null, main)).toBeNull();
  });
  it('derives short prefixes from names', () => {
    expect(locationPrefix({ code: null, name: 'Riverside' })).toBe('RI');
    expect(locationPrefix({ code: '  ', name: 'Old Town Cafe' })).toBe('OTC');
  });
});
