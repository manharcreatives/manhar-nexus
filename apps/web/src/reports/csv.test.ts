import { describe, expect, it } from 'vitest';
import { escapeCell, minorToMajor, toCsv } from './csv';

describe('csv', () => {
  it('converts minor units to decimal major units', () => {
    expect(minorToMajor(123456)).toBe('1234.56');
    expect(minorToMajor(5)).toBe('0.05');
    expect(minorToMajor(-250)).toBe('-2.50');
    expect(minorToMajor(0)).toBe('0.00');
  });
  it('escapes quotes, commas and newlines', () => {
    expect(escapeCell('a,b')).toBe('"a,b"');
    expect(escapeCell('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCell('l1\nl2')).toBe('"l1\nl2"');
  });
  it('neutralises formula injection in text but not numbers', () => {
    expect(escapeCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(escapeCell(-5)).toBe('-5');
  });
  it('joins rows with CRLF', () => {
    expect(toCsv([['a', 1], ['b', null]])).toBe('a,1\r\nb,\r\n');
  });
});
