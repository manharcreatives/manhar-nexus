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

/**
 * Mock mode is a development/test aid and is NEVER reachable in a production build:
 *  - `VITE_MENU_MOCK=1` at build time turns it on (a deliberate demo build), otherwise
 *  - `?mock=1` works only when the build is not a production build (`import.meta.env.PROD` false).
 * A production visitor who types `?mock=1` gets the real menu.
 */
export function isMockMode(search: string, env: string | undefined, prod: boolean): boolean {
  if (env === '1') return true;
  if (prod) return false;
  return new URLSearchParams(search).get('mock') === '1';
}
