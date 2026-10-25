/** Local-calendar date helpers (YYYY-MM-DD strings, no UTC shifting). */
const pad = (n: number) => String(n).padStart(2, '0');

export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayIso(now: Date = new Date()): string {
  return toIsoDate(now);
}

function addDays(d: Date, n: number): Date {
  const c = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  c.setDate(c.getDate() + n);
  return c;
}

export type PresetKey = 'today' | 'yesterday' | 'last7' | 'month';

export function presetRange(key: PresetKey, now: Date = new Date()): { from: string; to: string } {
  switch (key) {
    case 'today':
      return { from: toIsoDate(now), to: toIsoDate(now) };
    case 'yesterday': {
      const y = toIsoDate(addDays(now, -1));
      return { from: y, to: y };
    }
    case 'last7':
      return { from: toIsoDate(addDays(now, -6)), to: toIsoDate(now) };
    case 'month':
      return { from: toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1)), to: toIsoDate(now) };
  }
}

function parseIsoDate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

/** Shifts a YYYY-MM-DD string by whole calendar days. */
export function addDaysIso(iso: string, n: number): string {
  const d = parseIsoDate(iso);
  return d ? toIsoDate(addDays(d, n)) : iso;
}

/** Inclusive number of calendar days between two YYYY-MM-DD strings. */
export function daysBetweenInclusive(from: string, to: string): number {
  const a = parseIsoDate(from);
  const b = parseIsoDate(to);
  if (!a || !b) return 0;
  return Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86_400_000) + 1;
}

/** Short axis label: weekday for a week ("Mon"), day of month for longer ranges ("20"). */
export function axisDayLabel(iso: string, style: 'weekday' | 'day'): string {
  const d = parseIsoDate(iso);
  if (!d) return iso;
  return style === 'weekday' ? d.toLocaleDateString(undefined, { weekday: 'short' }) : String(d.getDate());
}

/** "Mon, 20 Oct 2026" — the full label for tooltips and tables. */
export function formatDayLong(iso: string): string {
  const d = parseIsoDate(iso);
  if (!d) return iso;
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

/** Localized weekday name ("Saturday"). */
export function weekdayName(iso: string): string {
  const d = parseIsoDate(iso);
  return d ? d.toLocaleDateString(undefined, { weekday: 'long' }) : iso;
}

/** Localized display of a YYYY-MM-DD string or ISO timestamp. */
export function formatDate(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
