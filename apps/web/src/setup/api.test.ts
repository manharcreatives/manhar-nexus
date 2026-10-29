import { describe, expect, it } from 'vitest';
import { bulkCodes } from './api';

describe('bulkCodes', () => {
  it('numbers tables from the start value with the prefix', () => {
    expect(bulkCodes('T', 1, 3)).toEqual(['T1', 'T2', 'T3']);
    expect(bulkCodes(' R-', 10, 2)).toEqual(['R-10', 'R-11']);
  });
  it('allows an empty prefix for plain numbers', () => {
    expect(bulkCodes('', 5, 2)).toEqual(['5', '6']);
  });
});
