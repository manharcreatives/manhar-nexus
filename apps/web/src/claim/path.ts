/**
 * Route helpers for the owner's "set your password" page. Imported by App.tsx (the entry bundle): keep this file tiny
 * and dependency-free (no React, no router).
 */

/** True for "/set-password" (and a trailing slash): the owner sees only this page, never the app or the website. */
export function isClaimPath(pathname: string): boolean {
  const p = (pathname.split(/[?#]/)[0] ?? '').replace(/\/+$/, '');
  return p === '/set-password';
}

/** "#t=abc" -> "abc". The token lives in the fragment so it is never sent to a server or written to an access log. */
export function claimTokenFromHash(hash: string): string | null {
  const m = /^#t=([A-Za-z0-9_-]{16,256})$/.exec(hash);
  return m ? (m[1] ?? null) : null;
}
