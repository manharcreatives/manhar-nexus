import { Link } from 'react-router-dom';
import { NAV_ITEMS, SITE, whatsappUrl } from '../site';
import { SectionButton } from './Button';
import { SectionLink } from './SectionLink';

export interface MobileMenuProps {
  id: string;
  open: boolean;
  activeId: string | null;
  onNavigate: () => void;
}

/** Full-width panel under the header bar (rendered inside <header>; focus is trapped by Header while open). */
export function MobileMenu({ id, open, activeId, onNavigate }: MobileMenuProps) {
  return (
    <div id={id} className="lp-mobile" hidden={!open} role="dialog" aria-modal="true" aria-label="Site menu">
      <nav aria-label="Mobile">
        <ul className="lp-mobile__list">
          {NAV_ITEMS.map((item) => (
            <li key={item.id}>
              <SectionLink to={item.id} className="lp-mobile__link" aria-current={activeId === item.id ? 'location' : undefined} onClick={onNavigate}>
                {item.label}
              </SectionLink>
            </li>
          ))}
          <li>
            <Link to="/login" className="lp-mobile__link" onClick={onNavigate}>
              Sign in
            </Link>
          </li>
        </ul>
      </nav>
      <div className="lp-mobile__cta">
        <SectionButton section="register" size="lg" block arrow onClick={onNavigate}>
          Register your restaurant
        </SectionButton>
        <p className="lp-mobile__note">
          Questions?{' '}
          <a href={whatsappUrl()} target="_blank" rel="noopener noreferrer">
            WhatsApp us
          </a>
          {' '}or write to <a href={`mailto:${SITE.email}`}>{SITE.email}</a>.
        </p>
      </div>
    </div>
  );
}
