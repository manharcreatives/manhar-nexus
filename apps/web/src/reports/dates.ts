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
