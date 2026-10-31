import { Suspense, useEffect, useRef } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import './landing.css';
import './styles/ui.css';
import './styles/chrome.css';
import { applyIntentFromHash } from './hooks/useRegistrationIntent';
import LandingPage from './LandingPage';
import { LANDING_ROUTES } from './routes';

/** Mark the document as the dark marketing surface (overscroll/scrollbars/inputs) while mounted. */
function useLandingSurface(): void {
  useEffect(() => {
    const root = document.documentElement;
    const prevSurface = root.dataset.surface;
    const prevScheme = root.style.colorScheme;
    root.dataset.surface = 'landing';
    root.style.colorScheme = 'dark';
    return () => {
      if (prevSurface === undefined) delete root.dataset.surface;
      else root.dataset.surface = prevSurface;
      root.style.colorScheme = prevScheme;
    };
  }, []);
}

/**
 * After in-app navigation: scroll to `#section` (hash may carry `?plan=..` intent params) or back to the top.
 * The browser handles the initial load of a plain `#id` itself, but late-mounting sections need a retry.
 */
function useHashScroll(): void {
  const { pathname, hash } = useLocation();
  const first = useRef(true);
  useEffect(() => {
    const isFirst = first.current;
    first.current = false;
    if (!hash) {
      if (!isFirst) window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      return;
    }
    applyIntentFromHash(hash);
    const id = decodeURIComponent(hash.slice(1).split('?')[0]);
    if (!id) return;
    let tries = 0;
    let raf = 0;
    const go = () => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ block: 'start' });
        return;
      }
      if (tries++ < 30) raf = requestAnimationFrame(go);
    };
    raf = requestAnimationFrame(go);
    return () => cancelAnimationFrame(raf);
  }, [pathname, hash]);
}

/**
 * Root of the public marketing site (lazy-loaded by App.tsx). Wraps everything in `.lp-root`, provides the
 * skip link and the route table: "/" = LandingPage, others come from LANDING_ROUTES (routes.tsx).
 */
export default function LandingApp() {
  useLandingSurface();
  useHashScroll();
  return (
    <div className="lp-root">
      <a
        className="lp-skip"
        href="#main"
        onClick={(e) => {
          const main = document.getElementById('main');
          if (!main) return;
          e.preventDefault();
          main.focus({ preventScroll: true });
          main.scrollIntoView({ block: 'start' });
        }}
      >
        Skip to main content
      </a>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          {LANDING_ROUTES.map((r) => (
            <Route key={r.path} path={r.path} element={r.element} />
          ))}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </div>
  );
}
