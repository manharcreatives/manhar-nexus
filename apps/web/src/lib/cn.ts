/** Joins truthy class names. Tailwind v4 tokens keep conflicts rare, so no merge step. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
