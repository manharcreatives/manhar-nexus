/**
 * Public (signed-out) route table helpers.
 *
 * IMPORTANT: this file is imported by App.tsx (the entry bundle). Keep it tiny and
 * dependency-free: never import React, router or anything from ./landing here.
 */

/** The six policy routes (public so payment-gateway KYC reviewers can open them). */
export const POLICY_ROUTES = [
  { path: '/terms', label: 'Terms & Conditions', short: 'Terms' },
  { path: '/privacy', label: 'Privacy Policy', short: 'Privacy' },
  { path: '/refund-policy', label: 'Refund & Cancellation', short: 'Refunds' },
  { path: '/billing-policy', label: 'Billing & Payments', short: 'Billing' },
  { path: '/acceptable-use', label: 'Acceptable Use', short: 'Acceptable use' },
  { path: '/data-processing', label: 'Data Processing Summary', short: 'Data processing' },
] as const;

/** Old/alternative spellings seen in the copy docs; routes.tsx redirects them to the canonical path. */
export const PATH_ALIASES: Readonly<Record<string, string>> = {
  '/refund-cancellation': '/refund-policy',
  '/billing-payments': '/billing-policy',
  '/dpa': '/data-processing',
  '/insights': '/#insights',
};

/** Article routes live under /insights/:slug (/blog/:slug is accepted and redirected). */
export const ARTICLE_PREFIXES = ['/insights/', '/blog/'] as const;

/** Strip a trailing slash (except for "/") and any query/hash. */
export function normalizePath(pathname: string): string {
  const bare = pathname.split(/[?#]/)[0] || '/';
  return bare.length > 1 ? bare.replace(/\/+$/, '') || '/' : '/';
}

export function isHomePath(pathname: string): boolean {
  return normalizePath(pathname) === '/';
}

function isPolicyPath(path: string): boolean {
  return POLICY_ROUTES.some((r) => r.path === path) || path in PATH_ALIASES;
}

function isArticlePath(path: string): boolean {
  return ARTICLE_PREFIXES.some((p) => path.startsWith(p) && path.length > p.length);
}

/** A policy page or an article (anything that is not the home page). Used e.g. to skip the preloader. */
export function isContentPath(pathname: string): boolean {
  const p = normalizePath(pathname);
  return p !== '/' && isPublicPath(p);
}

/**
 * True when a SIGNED-OUT visitor should see the marketing site at this path.
 * Everything else (including /login and unknown paths such as /bills) keeps showing the sign-in
 * screen, which preserves the "return to the view you asked for" behaviour of the app.
 */
export function isPublicPath(pathname: string): boolean {
  const p = normalizePath(pathname);
  return p === '/' || isPolicyPath(p) || isArticlePath(p);
}
