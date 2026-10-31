import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Container } from './Container';
import { Eyebrow } from './Eyebrow';
import { Footer } from './Footer';
import { Header } from './Header';

export interface PolicyLayoutProps {
  /** Mono label above the title, e.g. 'LEGAL' or 'INSIGHTS'. */
  eyebrow?: string;
  /** The page's single h1. */
  title: string;
  /** Short line under the title (e.g. 'Last updated 31 Oct 2026'). */
  meta?: ReactNode;
  /** Optional lead paragraph. */
  lede?: ReactNode;
  /** Optional back link (default: back to the home page). */
  back?: { to: string; label: string };
  children: ReactNode;
}

/**
 * Shell for legal / article pages: Header + <main id="main"> with prose styles (`.lp-prose`) + Footer.
 * Children are plain semantic HTML (h2, h3, p, ul, ol, table, blockquote, a): the prose class styles them.
 */
export function PolicyLayout({ eyebrow, title, meta, lede, back = { to: '/', label: 'Back to Manhar Nexus' }, children }: PolicyLayoutProps) {
  return (
    <>
      <Header />
      <main id="main" className="lp-policy">
        <div className="lp-policy__hero">
          <Container size="narrow">
            <Link to={back.to} className="lp-back">
              <span aria-hidden="true">&larr;</span> {back.label}
            </Link>
            {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
            <h1 className="lp-h1 lp-policy__title">{title}</h1>
            {meta ? <p className="lp-policy__meta">{meta}</p> : null}
            {lede ? <p className="lp-lede">{lede}</p> : null}
          </Container>
        </div>
        <Container size="narrow">
          <div className="lp-prose">{children}</div>
        </Container>
      </main>
      <Footer />
    </>
  );
}
