import { lazy, type ReactElement } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { PATH_ALIASES, POLICY_ROUTES } from './paths';

/**
 * Route table for everything except the home page ("/" is LandingPage, handled by LandingApp).
 * Legal and article pages are lazy chunks, so the home route stays light; LandingApp wraps the routes in
 * <Suspense fallback={null}>. Paths are the public, indexable URLs listed in paths.ts, sitemap.xml and the footer.
 */
export interface LandingRoute {
  path: string;
  element: ReactElement;
}

const LegalPage = lazy(() => import('./pages/LegalPage'));
const ArticlePage = lazy(() => import('./pages/ArticlePage'));

/** /blog/:slug is accepted (older copy used it) and redirected to the canonical /insights/:slug. */
function BlogRedirect() {
  const { slug = '' } = useParams();
  return <Navigate to={`/insights/${slug}`} replace />;
}

export const LANDING_ROUTES: LandingRoute[] = [
  ...POLICY_ROUTES.map((r) => ({ path: r.path as string, element: <LegalPage path={r.path} /> })),
  { path: '/insights/:slug', element: <ArticlePage /> },
  { path: '/blog/:slug', element: <BlogRedirect /> },
  ...Object.entries(PATH_ALIASES).map(([from, to]) => ({ path: from, element: <Navigate to={to} replace /> })),
];
