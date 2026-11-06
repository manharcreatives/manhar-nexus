/**
 * Route helpers for the owner's AutoPay authorisation page. Imported by App.tsx (the entry bundle): keep this file
 * tiny and dependency-free (no React, no router).
 */

/** "/pay/autopay/abc123" -> "abc123"; null for every other path. */
export function autopayToken(pathname: string): string | null {
  const m = /^\/pay\/autopay\/([A-Za-z0-9_-]{8,128})\/?$/.exec(pathname.split(/[?#]/)[0] ?? '');
  return m ? (m[1] ?? null) : null;
}

/** True for "/pay/autopay" and everything below it: the owner sees only this page, never the app or the website. */
export function isAutopayPath(pathname: string): boolean {
  const p = pathname.split(/[?#]/)[0] ?? '';
  return p === '/pay/autopay' || p.startsWith('/pay/autopay/');
}
