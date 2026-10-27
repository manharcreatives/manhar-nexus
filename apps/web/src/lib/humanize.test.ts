import { describe, expect, it } from 'vitest';
import { isUuid, stripAsides, titleCaseKey } from './humanize';

describe('humanize', () => {
  it('title-cases unknown keys safely', () => {
    expect(titleCaseKey('service_request.preparation_started')).toBe('Service request preparation started');
    expect(titleCaseKey('rounding_mode')).toBe('Rounding mode');
    expect(titleCaseKey('')).toBe('');
  });
  it('spots UUIDs', () => {
    expect(isUuid('12161594-f6b9-456e-b160-0123456789ab')).toBe(true);
    expect(isUuid('RV-0307')).toBe(false);
  });
  it('strips engineering asides', () => {
    expect(stripAsides('Display locale (BCP-47 language tag).')).toBe('Display locale');
    expect(stripAsides('Monetary rounding mode applied at defined points (ADR-015).')).toBe('Monetary rounding mode applied at defined points');
  });
});
