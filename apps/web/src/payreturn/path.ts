/**
 * Route helpers for the page the owner lands on after paying (/pay/return?code=NX-XXXXXX). Imported by App.tsx (the
 * entry bundle): keep this file tiny and dependency-free (no React, no router).
 */

/** True for "/pay/return" (and a trailing slash): the owner sees only this page, never the app or the website. */
export function isPayReturnPath(pathname: string): boolean {
  const p = (pathname.split(/[?#]/)[0] ?? '').replace(/\/+$/, '');
  return p === '/pay/return';
}

/** The reference code from "?code=NX-ABC123", or null when it is missing or not a sensible code. */
export function referenceCodeFromSearch(search: string): string | null {
  const raw = new URLSearchParams(search).get('code');
  return raw && /^[A-Za-z0-9-]{4,32}$/.test(raw) ? raw.toUpperCase() : null;
}
