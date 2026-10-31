import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useScrollLock } from '../hooks/useScrollLock';
import { isHomePath } from '../paths';
import { NAV_ITEMS } from '../site';
import { SectionButton } from './Button';
import { MobileMenu } from './MobileMenu';
import { NexusLockup } from './NexusMark';
import { SectionLink } from './SectionLink';
import { cx } from './cx';

const MENU_ID = 'lp-mobile-menu';
const DESKTOP_QUERY = '(min-width: 1160px)';

/** Observe the home sections and report the one crossing a band near the top third of the viewport. */
function useActiveSection(enabled: boolean): string | null {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled || typeof IntersectionObserver === 'undefined') {
      setActive(null);
      return;
    }
    const targets = NAV_ITEMS.map((n) => document.getElementById(n.id)).filter((el): el is HTMLElement => !!el);
    if (targets.length === 0) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      { rootMargin: '-35% 0px -60% 0px' },
    );
    targets.forEach((t) => io.observe(t));
    const onScroll = () => {
      if (window.scrollY < 160) setActive(null);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener('scroll', onScroll);
    };
  }, [enabled]);
  return active;
}

/** White sticky header: lockup, anchors, Sign in, primary CTA, accessible mobile menu. */
export function Header() {
  const { pathname } = useLocation();
  const home = isHomePath(pathname);
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLElement>(null);
  const active = useActiveSection(home);

  const close = useCallback(() => setOpen(false), []);
  useFocusTrap(rootRef, open, close);
  useScrollLock(open);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close the menu when the route changes or the viewport becomes desktop-wide.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const m = window.matchMedia(DESKTOP_QUERY);
    const onChange = () => m.matches && setOpen(false);
    m.addEventListener('change', onChange);
    return () => m.removeEventListener('change', onChange);
  }, []);

  return (
    <header ref={rootRef} className={cx('lp-header', scrolled && 'is-scrolled', open && 'is-open')}>
      <div className="lp-container lp-header__bar">
        <Link to="/" className="lp-brand" aria-label="Manhar Nexus, home" onClick={() => home && window.scrollTo({ top: 0 })}>
          <NexusLockup size={34} />
          <span className="lp-brand__by">A Manhar Creatives product</span>
        </Link>

        <nav className="lp-nav" aria-label="Primary">
          <ul>
            {NAV_ITEMS.map((item) => (
              <li key={item.id}>
                <SectionLink to={item.id} className="lp-nav__link" aria-current={active === item.id ? 'location' : undefined}>
                  {item.label}
                </SectionLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="lp-header__actions">
          <Link to="/login" className="lp-link lp-header__signin">
            Sign in
          </Link>
          <SectionButton section="register" size="sm" className="lp-header__cta">
            Register your restaurant
          </SectionButton>
          <button
            type="button"
            className="lp-menu-btn"
            aria-expanded={open}
            aria-controls={MENU_ID}
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((v) => !v)}
          >
            <span className="lp-menu-btn__bars" aria-hidden="true" />
          </button>
        </div>
      </div>
      <MobileMenu id={MENU_ID} open={open} activeId={active} onNavigate={close} />
    </header>
  );
}
