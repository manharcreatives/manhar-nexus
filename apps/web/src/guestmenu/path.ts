/**
 * Route helpers for the public QR menu. Imported by App.tsx (the entry bundle):
 * keep this file tiny and dependency-free (no React, no router, nothing from ./index).
 */

/** "/m/abc123" or "/m/abc123/" -> "abc123"; null for every other path. */
export function guestMenuToken(pathname: string): string | null {
  const m = /^\/m\/([^/?#]+)\/?$/.exec(pathname.split(/[?#]/)[0] ?? '');
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]!);
  } catch {
    return null;
  }
}

/** True for "/m" and everything below it: the customer panel never shows the app or the website. */
export function isGuestMenuPath(pathname: string): boolean {
  const p = pathname.split(/[?#]/)[0] ?? '';
  return p === '/m' || p.startsWith('/m/');
}

/** Mock mode: `?mock=1` (optionally `&mode=closed|off|auto`) or VITE_MENU_MOCK=1 at build time. */
export function isMockMode(search: string, env: string | undefined): boolean {
  if (env === '1') return true;
  const q = new URLSearchParams(search);
  return q.get('mock') === '1';
}
