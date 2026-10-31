import { useEffect, useState } from 'react';
import { cx } from '../components';

export interface TocItem {
  id: string;
  label: string;
}

export interface TocProps {
  title: string;
  items: readonly TocItem[];
  /** Extra class on the root (page-specific spacing). */
  className?: string;
}

/**
 * In-page table of contents. ONE <nav>: below 1360 px it is a collapsible card at the top of the document; from
 * 1360 px CSS lifts it into the right margin as a sticky list that is always open. The link for the section
 * currently on screen gets aria-current="location".
 */
export function Toc({ title, items, className }: TocProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const targets = items.map((i) => document.getElementById(i.id)).filter((el): el is HTMLElement => el !== null);
    if (targets.length === 0) return;
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        const first = items.find((i) => visible.has(i.id));
        if (first) setActive(first.id);
      },
      { rootMargin: '-72px 0px -65% 0px' },
    );
    targets.forEach((t) => observer.observe(t));
    return () => observer.disconnect();
  }, [items]);

  if (items.length < 2) return null;
  const listId = 'lp-toc-list';
  return (
    <nav className={cx('lp-toc', className)} aria-label={title} data-open={open ? 'true' : 'false'}>
      <div className="lp-toc__inner">
        <button type="button" className="lp-toc__toggle" aria-expanded={open} aria-controls={listId} onClick={() => setOpen((o) => !o)}>
          <span>{title}</span>
          <span className="lp-toc__count">{items.length}</span>
          <span className="lp-toc__chev" aria-hidden="true" />
        </button>
        <p className="lp-toc__title" aria-hidden="true">
          {title}
        </p>
        <ol id={listId} className="lp-toc__list">
          {items.map((item) => (
            <li key={item.id}>
              <a href={`#${item.id}`} aria-current={active === item.id ? 'location' : undefined} onClick={() => setOpen(false)}>
                {item.label}
              </a>
            </li>
          ))}
        </ol>
      </div>
    </nav>
  );
}
