/** Short, stable prefix for a location: its code, else the initials of its name ("Main Location" -> "ML"). */
export function locationPrefix(loc: { code: string | null; name: string } | undefined): string | null {
  if (!loc) return null;
  const code = loc.code?.trim();
  if (code) return code.toUpperCase();
  const words = loc.name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  const letters = words.length > 1 ? words.map((w) => w[0]).join('') : words[0].slice(0, 2);
  return letters.toUpperCase();
}

/**
 * One consistent bill-number format for the owner: "<LOCATION>-<0000>".
 * Numbers that already carry a prefix (RV-0307) are shown exactly as issued; a bare
 * number (377) gets its location's prefix and 4-digit padding. Display only: the
 * stored number is never changed.
 */
export function formatBillNumber(raw: string | null, loc: { code: string | null; name: string } | undefined): string | null {
  if (raw === null) return null;
  if (!/^\d+$/.test(raw)) return raw;
  const prefix = locationPrefix(loc);
  const digits = raw.padStart(4, '0');
  return prefix ? `${prefix}-${digits}` : digits;
}
