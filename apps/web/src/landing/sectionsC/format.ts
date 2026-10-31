/**
 * Small, timezone-proof date helpers for ISO strings coming from the content files.
 * (Intl would shift dates by the viewer's zone; these strings are already the calendar dates we want.)
 */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** '2026-10-31' (or '2027-01-31T23:59:00+05:30') -> '31 Oct 2026'. Returns the input when it is not an ISO date. */
export function formatIsoDay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const month = MONTHS[Number(m[2]) - 1];
  if (!month) return iso;
  return `${Number(m[3])} ${month} ${m[1]}`;
}

/** '2027-01-31T23:59:00+05:30' -> '11:59 pm IST' (reads the clock part as written, which is already IST). */
export function formatIstClock(iso: string): string {
  const m = /T(\d{2}):(\d{2})/.exec(iso);
  if (!m) return '';
  const h24 = Number(m[1]);
  const suffix = h24 >= 12 ? 'pm' : 'am';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${m[2]} ${suffix} IST`;
}

/** A URL/anchor-safe slug. 'What you pay, & when' -> 'what-you-pay-when'. */
export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[’']/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'section'
  );
}

/** Unique slugs for a list of headings: repeats get -2, -3 ... */
export function uniqueSlugs(texts: readonly string[]): string[] {
  const seen = new Map<string, number>();
  return texts.map((t) => {
    const base = slugify(t);
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base}-${n}`;
  });
}
