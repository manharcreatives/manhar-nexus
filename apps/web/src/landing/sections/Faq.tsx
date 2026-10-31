import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import '../styles/w2-base.css';
import '../styles/faq.css';
import { Button, Section } from '../components';
import { SectionHead } from '../sectionsC/SectionHead';
import { CONTACT, FAQS, FAQ_FEATURED_IDS, FAQ_HEADER, type Faq as FaqItem } from '../content';
import { useJsonLd } from '../hooks/useDocumentMeta';
import { Accordion, toggleId } from '../faq/Accordion';
import { faqIdFromHash, publishableFaqJsonLd } from '../faq/faqLogic';
import { renderHeadline } from '../sectionsC/headline';

/** The curated first five, in the order they are listed in content/faq.ts. */
function pickFeatured(): readonly FaqItem[] {
  const out: FaqItem[] = [];
  for (const id of FAQ_FEATURED_IDS) {
    const faq = FAQS.find((f) => f.id === id);
    if (faq) out.push(faq);
  }
  return out;
}

/**
 * FAQ: five questions up front, the rest behind “More questions”. Accessible accordion, `#faq-<id>` deep links
 * (which open the “more” list when the target lives there) and FAQPage JSON-LD for every question.
 */
export default function Faq() {
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
  const [showMore, setShowMore] = useState(false);

  const jsonLd = useMemo(() => publishableFaqJsonLd(), []);
  useJsonLd('faq', jsonLd);

  const featured = useMemo(pickFeatured, []);
  const rest = useMemo(() => FAQS.filter((f) => !featured.includes(f)), [featured]);
  const items = showMore ? [...featured, ...rest] : featured;

  /** Open the question named by `#faq-<id>` (on load and when the hash changes), revealing “more” if needed. */
  const openFromHash = useCallback(() => {
    const id = faqIdFromHash(window.location.hash);
    if (!id) return;
    if (rest.some((f) => f.id === id)) setShowMore(true);
    setOpen((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
    window.requestAnimationFrame(() => {
      document.getElementById(`faq-${id}`)?.scrollIntoView?.({ block: 'start' });
    });
  }, [rest]);

  useEffect(() => {
    openFromHash();
    window.addEventListener('hashchange', openFromHash);
    window.addEventListener('popstate', openFromHash);
    return () => {
      window.removeEventListener('hashchange', openFromHash);
      window.removeEventListener('popstate', openFromHash);
    };
  }, [openFromHash]);

  return (
    <Section id="faq" tone="canvas" labelledBy="faq-title" className="lp-faq">
      <div className="lp-faq__grid">
        <div className="lp-faq__lead">
          <SectionHead eyebrow={FAQ_HEADER.eyebrow} title={renderHeadline(FAQ_HEADER.headline)} titleId="faq-title" lede={FAQ_HEADER.subhead} />
          <div className="lp-faq__ask">
            <p>Not on the list?</p>
            <Button href={CONTACT.whatsappUrl} variant="ghost" arrow external>
              Ask us on WhatsApp<span className="lp-visually-hidden"> (opens in a new tab)</span>
            </Button>
          </div>
        </div>

        <div className="lp-faq__main">
          <div id="faq-list" className="lp-faq__list">
            <Accordion items={items} idPrefix="faq" openIds={open} onToggle={(id) => setOpen((prev) => toggleId(prev, id))} />
          </div>
          {rest.length > 0 ? (
            <button type="button" className="lp-faq__morebtn" aria-expanded={showMore} aria-controls="faq-list" onClick={() => setShowMore((v) => !v)}>
              <span>{showMore ? 'Show fewer questions' : `More questions (${rest.length})`}</span>
              <span className="lp-faq__morechev" aria-hidden="true" />
            </button>
          ) : null}
          <p className="lp-faq__policies">
            How we handle money and data, in full:{' '}
            <Link to="/billing-policy" className="lp-link">
              Billing
            </Link>
            ,{' '}
            <Link to="/refund-policy" className="lp-link">
              Refunds
            </Link>{' '}
            and{' '}
            <Link to="/privacy" className="lp-link">
              Privacy
            </Link>
            .
          </p>
        </div>
      </div>
    </Section>
  );
}
