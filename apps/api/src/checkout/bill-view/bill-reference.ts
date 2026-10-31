/**
 * Customer-facing bill reference. Mirrors apps/web/src/bills/number.ts so the number a
 * waiter shows the guest is exactly the number the cashier sees on the Bills page:
 * numbers that already carry a prefix ("RV-0307") are shown as issued; a bare number
 * ("377") gets its location prefix and 4-digit padding. Display only.
 */
export function locationPrefix(loc: { code: string | null; name: string } | null | undefined): string | null {
  if (!loc) return null;
  const code = loc.code?.trim();
  if (code) return code.toUpperCase();
  const words = loc.name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  const letters = words.length > 1 ? words.map((w) => w[0]).join('') : words[0].slice(0, 2);
  return letters.toUpperCase();
}

export function billReference(
  invoiceNumber: string | null,
  loc: { code: string | null; name: string } | null | undefined,
): string | null {
  if (invoiceNumber === null) return null;
  if (!/^\d+$/.test(invoiceNumber)) return invoiceNumber;
  const prefix = locationPrefix(loc);
  const digits = invoiceNumber.padStart(4, '0');
  return prefix ? `${prefix}-${digits}` : digits;
}
