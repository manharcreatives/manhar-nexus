import { Link } from 'react-router-dom';
import '../styles/pages.css';
import { PolicyLayout } from '../components';
import { LEGAL_NAV, LEGAL_UI, getLegalDocumentByPath, seoForPath } from '../content';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { LegalBlockView } from './LegalBody';
import { Toc } from './Toc';

export interface LegalPageProps {
  /** Route path of the document, e.g. '/terms'. */
  path: string;
}

function LegalMissing({ path }: { path: string }) {
  useDocumentMeta({ title: 'Page not found – Manhar Nexus', description: 'This page does not exist.', path, robots: 'noindex,follow' });
  return (
    <PolicyLayout eyebrow="LEGAL" title="We couldn’t find that page">
      <p>
        That policy page doesn’t exist. You can find all of them in the footer, or go{' '}
        <Link to="/">back to Manhar Nexus</Link>.
      </p>
    </PolicyLayout>
  );
}

/**
 * A legal document from content/legal.ts: title, “Last updated”, summary, sticky in-page contents, one anchored
 * section per clause group and links to the other policies. Owner placeholders ([…]) are highlighted;
 * `internalNote` is never rendered.
 */
export default function LegalPage({ path }: LegalPageProps) {
  const doc = getLegalDocumentByPath(path);
  const seo = seoForPath(path);
  useDocumentMeta({
    title: seo?.title ?? (doc ? `${doc.title} – Manhar Nexus` : 'Manhar Nexus'),
    description: seo?.description ?? doc?.summary ?? '',
    path,
  });

  if (!doc) return <LegalMissing path={path} />;

  const tocItems = doc.sections.map((s) => ({ id: s.id, label: s.heading }));

  return (
    <PolicyLayout
      eyebrow="LEGAL"
      title={doc.title}
      meta={
        <>
          {LEGAL_UI.lastUpdatedLabel} <time dateTime={doc.lastUpdatedISO}>{doc.lastUpdated}</time>
        </>
      }
      lede={doc.summary}
    >
      <div className="lp-legal">
        <Toc title={LEGAL_UI.onThisPage} items={tocItems} />
        <div className="lp-legal__body">
          {doc.intro.map((block, i) => (
            <LegalBlockView key={i} block={block} />
          ))}
          {doc.sections.map((section) => (
            <section key={section.id} id={section.id} aria-labelledby={`${section.id}-heading`} className="lp-legal__section">
              <h2 id={`${section.id}-heading`}>{section.heading}</h2>
              {section.blocks.map((block, i) => (
                <LegalBlockView key={i} block={block} />
              ))}
            </section>
          ))}
        </div>
        <nav className="lp-legal__others" aria-label={LEGAL_UI.otherPolicies}>
          <h2>{LEGAL_UI.otherPolicies}</h2>
          <ul>
            {LEGAL_NAV.filter((n) => n.slug !== doc.slug).map((n) => (
              <li key={n.slug}>
                <Link to={n.path}>{n.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </PolicyLayout>
  );
}
