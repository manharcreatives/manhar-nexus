import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import '../styles/faq.css';
import { Button, Icon, Reveal, Section, Tag } from '../components';
import { SectionHead } from '../sectionsC/SectionHead';
import { CONTACT, FAQS, FAQ_HEADER } from '../content';
import { useJsonLd } from '../hooks/useDocumentMeta';
import { Accordion, toggleId } from '../faq/Accordion';
import {
  TOPIC_LABELS,
  TOPIC_ORDER,
  faqIdFromHash,
  filterFaqs,
  publishableFaqJsonLd,
  topicCounts,
  type TopicFilter,
} from '../faq/faqLogic';
import { renderHeadline } from '../sectionsC/headline';
import { Search } from '../sectionsC/icons';

/** FAQ: search-as-you-type, topic chips, accessible accordion, `#faq-<id>` deep links and FAQPage JSON-LD. */
export default function Faq() {
  const [query, setQuery] = useState('');
  const [topic, setTopic] = useState<TopicFilter>('all');
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());

  const jsonLd = useMemo(() => publishableFaqJsonLd(), []);
  useJsonLd('faq', jsonLd);

  const counts = useMemo(() => topicCounts(), []);
  const visible = useMemo(() => filterFaqs(FAQS, query, topic), [query, topic]);

  /** Open the question named by `#faq-<id>` (on load and when the hash changes), clearing any filter that hides it. */
  const openFromHash = useCallback(() => {
    const id = faqIdFromHash(window.location.hash);
    if (!id) return;
    setQuery('');
    setTopic('all');
    setOpen((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
    window.requestAnimationFrame(() => {
      document.getElementById(`faq-${id}`)?.scrollIntoView?.({ block: 'start' });
    });
  }, []);

  useEffect(() => {
    openFromHash();
    window.addEventListener('hashchange', openFromHash);
    window.addEventListener('popstate', openFromHash);
    return () => {
      window.removeEventListener('hashchange', openFromHash);
      window.removeEventListener('popstate', openFromHash);
    };
  }, [openFromHash]);

  const allOpen = visible.length > 0 && visible.every((f) => open.has(f.id));
  const toggleAll = (): void => {
    setOpen((prev) => {
      const next = new Set(prev);
      for (const f of visible) {
        if (allOpen) next.delete(f.id);
        else next.add(f.id);
      }
      return next;
    });
  };

  const filtering = query.trim().length > 0 || topic !== 'all';
  const countText =
    visible.length === FAQS.length
      ? `Showing all ${FAQS.length} questions`
      : `Showing ${visible.length} of ${FAQS.length} questions`;

  return (
    <Section id="faq" tone="alt" labelledBy="faq-title" className="lp-faq">
      <SectionHead eyebrow={FAQ_HEADER.eyebrow} title={renderHeadline(FAQ_HEADER.headline)} titleId="faq-title" lede={FAQ_HEADER.subhead} />

      <div className="lp-faq__tools">
        <div className="lp-faq__search">
          <label htmlFor="faq-search" className="lp-label">
            Search the questions
          </label>
          <div className="lp-faq__searchbox">
            <Icon icon={Search} size={18} />
            <input
              id="faq-search"
              type="search"
              className="lp-input"
              placeholder="Try “refund”, “printer” or “GST”"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              aria-controls="faq-list"
            />
          </div>
        </div>
        <div role="group" aria-label="Filter questions by topic" className="lp-faq__chips">
          {TOPIC_ORDER.map((t) => (
            <button
              key={t}
              type="button"
              className="lp-chip"
              aria-pressed={topic === t}
              onClick={() => setTopic(t)}
            >
              {TOPIC_LABELS[t]}
              <span className="lp-chip__n" aria-hidden="true">
                {counts[t]}
              </span>
            </button>
          ))}
        </div>
        <div className="lp-faq__meta">
          <p role="status" aria-live="polite" className="lp-faq__count">
            {countText}
          </p>
          {visible.length > 1 ? (
            <button type="button" className="lp-faq__toggle" onClick={toggleAll}>
              {allOpen ? 'Collapse all' : 'Expand all'}
            </button>
          ) : null}
        </div>
      </div>

      <div id="faq-list" className="lp-faq__list">
        {visible.length > 0 ? (
          <Accordion items={visible} idPrefix="faq" openIds={open} onToggle={(id) => setOpen((prev) => toggleId(prev, id))} numbered />
        ) : (
          <div className="lp-faq__empty">
            <p>
              No question matches {query.trim() ? <>“{query.trim()}”</> : 'that filter'}. Try fewer words, or ask us directly.
            </p>
            <div className="lp-faq__empty-actions">
              {filtering ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setQuery('');
                    setTopic('all');
                  }}
                >
                  Clear search and filter
                </Button>
              ) : null}
              <Button href={CONTACT.whatsappUrl} variant="ghost" size="sm" external>
                Ask on WhatsApp
              </Button>
            </div>
          </div>
        )}
      </div>

      <Reveal className="lp-faq__more">
        <Tag>STILL CURIOUS?</Tag>
        <p>
          The full wording of how we handle money and data lives in the{' '}
          <Link to="/billing-policy" className="lp-link">
            Billing &amp; Payments Policy
          </Link>
          ,{' '}
          <Link to="/refund-policy" className="lp-link">
            Refund &amp; Cancellation Policy
          </Link>{' '}
          and{' '}
          <Link to="/privacy" className="lp-link">
            Privacy Policy
          </Link>
          .
        </p>
      </Reveal>
    </Section>
  );
}
