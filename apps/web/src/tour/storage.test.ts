import { beforeEach, describe, expect, it } from 'vitest';
import { readOutcome, writeOutcome } from './storage';

beforeEach(() => window.localStorage.clear());

describe('tour memory', () => {
  it('is remembered per user', () => {
    expect(readOutcome('u1')).toBeNull();
    writeOutcome('u1', 'skipped');
    expect(readOutcome('u1')).toBe('skipped');
  });

  it('is also remembered per device, so a staff member is not asked again on every account', () => {
    writeOutcome('admin-1', 'skipped');
    expect(readOutcome('admin-2')).toBe('skipped');
  });
});
