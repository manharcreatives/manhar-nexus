import type { KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import '../styles/faq.css';
import { FAQS, type Faq } from '../content';

export interface AccordionProps {
  items: readonly Faq[];
  /** Prefix for element ids: items get `${idPrefix}-${id}` (the deep-link target), buttons `-q-`, panels `-a-`. */
  idPrefix: string;
  openIds: ReadonlySet<string>;
  onToggle: (id: string) => void;
  /** Show the mono 01.. numbers (position in the full FAQ list, stable while filtering). */
  numbered?: boolean;
  /** Heading level of each question: 3 under the section h2, 4 inside a sub-block with its own h3. */
  headingLevel?: 3 | 4;
}

const pad = (n: number): string => String(n).padStart(2, '0');

function AnswerLinks({ links }: { links: NonNullable<Faq['links']> }) {
  return (
    <p className="lp-acc__links">
      {links.map((l, i) => (
        <span key={l.href}>
          {i > 0 ? <span aria-hidden="true"> · </span> : null}
          {l.href.startsWith('/') ? (
            <Link to={l.href} className="lp-link">
              {l.text}
            </Link>
          ) : (
            <a href={l.href} className="lp-link" target="_blank" rel="noopener noreferrer">
              {l.text}
              <span className="lp-visually-hidden"> (opens in a new tab)</span>
            </a>
          )}
        </span>
      ))}
    </p>
  );
}

/**
 * Accessible accordion: each question is a <button aria-expanded aria-controls> inside a heading, each answer a
 * labelled region. Several items can be open at once. Arrow Up/Down, Home and End move between questions.
 * Closed answers are hidden with `visibility` (not display) so the open/close can animate; they are out of the
 * accessibility tree and the tab order while closed.
 */
export function Accordion({ items, idPrefix, openIds, onToggle, numbered = false, headingLevel = 3 }: AccordionProps) {
  const Heading = `h${headingLevel}` as 'h3' | 'h4';

  const onKeyDown = (e: KeyboardEvent<HTMLOListElement>): void => {
    const target = e.target as HTMLElement;
    if (!target.classList.contains('lp-acc__btn')) return;
    const buttons = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('button.lp-acc__btn'));
    const at = buttons.indexOf(target as HTMLButtonElement);
    let next = -1;
    if (e.key === 'ArrowDown') next = (at + 1) % buttons.length;
    else if (e.key === 'ArrowUp') next = (at - 1 + buttons.length) % buttons.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = buttons.length - 1;
    if (next < 0) return;
    e.preventDefault();
    buttons[next]?.focus();
  };

  return (
    <ol className="lp-acc" onKeyDown={onKeyDown}>
      {items.map((faq) => {
        const open = openIds.has(faq.id);
        const itemId = `${idPrefix}-${faq.id}`;
        const buttonId = `${idPrefix}-q-${faq.id}`;
        const panelId = `${idPrefix}-a-${faq.id}`;
        const n = numbered ? FAQS.findIndex((f) => f.id === faq.id) + 1 : 0;
        return (
          <li key={faq.id} id={itemId} className="lp-acc__item" data-open={open ? 'true' : 'false'}>
            <Heading className="lp-acc__q">
              <button
                type="button"
                id={buttonId}
                className="lp-acc__btn"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => onToggle(faq.id)}
              >
                {numbered && n > 0 ? (
                  <span className="lp-acc__num" aria-hidden="true">
                    {pad(n)}
                  </span>
                ) : null}
                <span className="lp-acc__text">{faq.question}</span>
                <span className="lp-acc__icon" aria-hidden="true" />
              </button>
            </Heading>
            <div id={panelId} role="region" aria-labelledby={buttonId} className="lp-acc__panel" data-open={open ? 'true' : 'false'}>
              <div className="lp-acc__inner">
                <p>{faq.answer}</p>
                {faq.links && faq.links.length > 0 ? <AnswerLinks links={faq.links} /> : null}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Immutable toggle for a Set of open ids. */
export function toggleId(set: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}
