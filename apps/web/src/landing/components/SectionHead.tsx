import type { ReactNode } from 'react';
import { cx } from './cx';
import { Heading } from './Heading';

export interface SectionHeadProps {
  /** Mono label (max ~6 words). */
  eyebrow: ReactNode;
  /** The h2 content; wrap ONE word in <AccentWord>. */
  title: ReactNode;
  titleId: string;
  /** One short sentence. */
  lede?: ReactNode;
  align?: 'left' | 'center';
  className?: string;
}

/**
 * THE section header: auto-numbered index (CSS counter) + hairline + eyebrow, one h2, one lede. Every section on the home page uses this
 * (a <div>, not a <header>: a <header> inside <section> reads as a second "banner" landmark).
 */
export function SectionHead({ eyebrow, title, titleId, lede, align = 'left', className }: SectionHeadProps) {
  return (
    <div className={cx('lp-section-header', align === 'center' && 'lp-section-header--center', className)}>
      <p className="lp-eyebrow lp-sh__top">
        <span className="lp-sh__no" aria-hidden="true" />
        <span className="lp-sh__rule" aria-hidden="true" />
        <span>{eyebrow}</span>
      </p>
      <Heading level={2} id={titleId}>
        {title}
      </Heading>
      {lede ? <p className="lp-lede">{lede}</p> : null}
    </div>
  );
}
