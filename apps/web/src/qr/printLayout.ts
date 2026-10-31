import type { QrTable } from './types';

/** Print layouts: two A4 sheet densities and the single 100mm-wide table tent. */
export type PrintLayout = 'sheet6' | 'sheet8' | 'tent';

export const PRINT_LAYOUTS: readonly PrintLayout[] = ['sheet6', 'sheet8', 'tent'];

/** Cards per A4 page for the sheet layouts; the tent is one card per page. */
export const PER_PAGE: Record<PrintLayout, number> = { sheet6: 6, sheet8: 8, tent: 1 };

/** Table tent width in millimetres (owner requirement: 100mm). */
export const TENT_WIDTH_MM = 100;

/** Name of the CSS `@page` each layout prints on (see qr.css). */
export const PAGE_NAME: Record<PrintLayout, 'sheet' | 'tent'> = { sheet6: 'sheet', sheet8: 'sheet', tent: 'tent' };

export function chunk<T>(list: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/** Pages needed for `count` cards in `layout`. */
export function pageCount(count: number, layout: PrintLayout): number {
  return count <= 0 ? 0 : Math.ceil(count / PER_PAGE[layout]);
}

/** CSS class on each printed page (grid density or tent). */
export function pageClass(layout: PrintLayout): string {
  return layout === 'tent' ? 'qr-print-page qr-print-page--tent' : `qr-print-page qr-sheet qr-sheet--${PER_PAGE[layout]}`;
}

/** Tables to print: enabled ones by default (a disabled table's code would lead to a dead menu). */
export function printableTables(tables: readonly QrTable[], includeDisabled: boolean): QrTable[] {
  return tables.filter((t) => t.token && (includeDisabled || t.enabled));
}
