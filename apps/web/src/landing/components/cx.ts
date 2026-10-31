/** Tiny classnames helper (landing has no dependency on the app's cn/tailwind-merge). */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
