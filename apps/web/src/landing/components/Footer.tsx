import { Link } from 'react-router-dom';
import { POLICY_ROUTES } from '../paths';
import { SITE, whatsappUrl } from '../site';
import { SectionButton } from './Button';
import { ImageSlot } from './ImageSlot';
import { NexusLockup } from './NexusMark';
import { SectionLink } from './SectionLink';

const PRODUCT = [
  { id: 'platform', label: 'Platform' },
  { id: 'nexus-menu', label: 'Nexus Menu' },
  { id: 'why', label: 'Why Nexus' },
  { id: 'how', label: 'How it works' },
  { id: 'builtfor', label: 'Built for' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'insights', label: 'Insights' },
  { id: 'faq', label: 'FAQ' },
] as const;

/** Dark footer: brand, three link columns, contact, one offer line. */
export function Footer() {
  return (
    <footer className="lp-footer lp-on-dark" aria-labelledby="lp-footer-title">
      <div className="lp-container">
        <h2 id="lp-footer-title" className="lp-visually-hidden">
          Manhar Nexus footer
        </h2>
        <div className="lp-footer__grid">
          <div className="lp-footer__brand">
            <Link to="/" aria-label="Manhar Nexus, home" className="lp-footer__lockup">
              <NexusLockup tone="dark" size={36} />
            </Link>
            <p className="lp-footer__blurb">A restaurant operations platform by Manhar Creatives.</p>
            <a href={SITE.studioUrl} target="_blank" rel="noopener noreferrer" className="lp-footer__by" aria-label="Manhar Creatives (opens manharcreatives.com)">
              <span className="lp-footer__by-label">A product of</span>
              <ImageSlot
                src="/landing/brand/manhar-creatives-on-ink.jpg"
                alt="Manhar Creatives"
                width={610}
                height={540}
                fit="contain"
                className="lp-footer__logo"
                fallback="ink"
                fallbackLabel="Manhar Creatives"
              />
            </a>
            <p className="lp-footer__tagline">
              We Design, We Build, <span className="lp-footer__grow">You Grow.</span>
            </p>
          </div>

          <nav className="lp-footer__col" aria-label="Product">
            <h3 className="lp-footer__head">Product</h3>
            <ul>
              {PRODUCT.map((p) => (
                <li key={p.id}>
                  <SectionLink to={p.id}>{p.label}</SectionLink>
                </li>
              ))}
            </ul>
          </nav>

          <nav className="lp-footer__col" aria-label="Company">
            <h3 className="lp-footer__head">Company</h3>
            <ul>
              <li>
                <SectionLink to="about">About</SectionLink>
              </li>
              <li>
                <a href={SITE.studioUrl} target="_blank" rel="noopener noreferrer">
                  Manhar Creatives
                </a>
              </li>
              <li>
                <SectionLink to="register">Contact</SectionLink>
              </li>
              <li>
                <SectionLink to="register?begin=demo">Book a demo</SectionLink>
              </li>
              <li>
                <Link to="/login">Sign in</Link>
              </li>
              <li>
                <SectionLink to="register">Register your restaurant</SectionLink>
              </li>
            </ul>
          </nav>

          <nav className="lp-footer__col" aria-label="Legal">
            <h3 className="lp-footer__head">Legal</h3>
            <ul>
              {POLICY_ROUTES.map((r) => (
                <li key={r.path}>
                  <Link to={r.path}>{r.label}</Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="lp-footer__col lp-footer__contact">
            <h3 className="lp-footer__head">Contact</h3>
            <ul>
              <li>
                <a href={`mailto:${SITE.email}`}>{SITE.email}</a>
              </li>
              <li>
                <a href={`tel:${SITE.phoneTel}`}>{SITE.phoneDisplay}</a>
              </li>
              <li>
                <a href={whatsappUrl()} target="_blank" rel="noopener noreferrer">
                  WhatsApp us
                </a>
              </li>
            </ul>
            <address className="lp-footer__address">
              {SITE.addressLines.map((l) => (
                <span key={l}>{l}</span>
              ))}
            </address>
            <p className="lp-footer__area">{SITE.serviceArea}</p>
            <p className="lp-footer__social">
              <a href={SITE.linkedin} target="_blank" rel="noopener noreferrer">
                LinkedIn
              </a>
              <a href={SITE.instagram} target="_blank" rel="noopener noreferrer">
                Instagram
              </a>
            </p>
          </div>
        </div>

        <div className="lp-footer__chip-row">
          <span className="lp-tag lp-tag--dark">Onboarding new restaurants now</span>
          <span className="lp-footer__chip-note">Founding Restaurants offer until 31 Jan 2027.</span>
          <SectionButton section="register" size="sm" variant="secondary" tone="dark" arrow>
            Register
          </SectionButton>
        </div>

        <p className="lp-footer__payments">Subscriptions are processed securely by Cashfree Payments.</p>

        <div className="lp-footer__bar">
          <p>
            &copy; {SITE.year} Manhar Creatives. Manhar Nexus is a product of Manhar Creatives.
          </p>
          <ul className="lp-footer__legal" aria-label="Footer shortcuts">
            <li>
              <Link to="/privacy">Privacy</Link>
            </li>
            <li>
              <Link to="/terms">Terms</Link>
            </li>
            <li>
              <a href="/sitemap.xml">Sitemap</a>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
