import type { LegalBlock } from './types';

/** Small constructors shared by the legal-*.ts files. */
export const lp = (text: string): LegalBlock => ({ type: 'p', text });
export const clause = (number: string, text: string): LegalBlock => ({ type: 'clause', number, text });
export const lul = (...items: string[]): LegalBlock => ({ type: 'ul', items });
export const lol = (...items: string[]): LegalBlock => ({ type: 'ol', items });
export const table = (headers: readonly string[], rows: readonly (readonly string[])[]): LegalBlock => ({
  type: 'table',
  headers,
  rows,
});
export const lcallout = (text: string): LegalBlock => ({ type: 'callout', text });

export const LAST_UPDATED = '31 October 2026';
export const LAST_UPDATED_ISO = '2026-10-31';
