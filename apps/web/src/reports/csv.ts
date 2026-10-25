/** Minimal RFC 4180 CSV builder for client-side report export. */
export type CsvCell = string | number | null | undefined;

/** Minor units -> decimal major units with 2 places (no currency symbol). */
export function minorToMajor(minor: number): string {
  const sign = minor < 0 ? '-' : '';
  const abs = Math.abs(Math.round(minor));
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

export function escapeCell(value: CsvCell): string {
  if (value === null || value === undefined) return '';
  let s = String(value);
  // Neutralise spreadsheet formula injection for text cells (numbers are passed as numbers).
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: CsvCell[][]): string {
  return rows.map((r) => r.map(escapeCell).join(',')).join('\r\n') + '\r\n';
}

export function downloadCsv(filename: string, rows: CsvCell[][]): void {
  // BOM so Excel reads UTF-8 correctly.
  const blob = new Blob(['﻿', toCsv(rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
