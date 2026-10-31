import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';
import { Eyebrow } from './Eyebrow';

/** Exactly ONE green accent word per headline: Forest on light surfaces, #1DBA3C on dark ones (CSS decides). */
export function AccentWord({ children }: { children: ReactNode }) {
  return <span className="lp-accent">{children}</span>;
}

export interface HeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  level?: 1 | 2 | 3 | 4;
  /** Visual size, independent of the semantic level. Default = same as level (h4 -> h3 look). */
  size?: 'h1' | 'h2' | 'h3';
}

/** Semantic heading with the brand scale (H1 64 / H2 40 / H3 24 desktop, fluid on mobile). */
export function Heading({ level = 2, size, className, ...rest }: HeadingProps) {
  const Tag = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4';
  const look = size ?? (level >= 3 ? 'h3' : (`h${level}` as 'h1' | 'h2'));
  return <Tag className={cx(`lp-${look}`, className)} {...rest} />;
}

export interface SectionHeaderProps {
  /** Mono label above the title. */
  eyebrow?: ReactNode;
  /** The heading content; wrap one word in <AccentWord>. */
  title: ReactNode;
  /** id for the heading (so the section can use aria-labelledby). */
  titleId?: string;
  /** Paragraph under the title. */
  lede?: ReactNode;
  level?: 1 | 2 | 3;
  align?: 'left' | 'center';
  className?: string;
}

/** Eyebrow + heading + lede stack used at the top of most sections. */
export function SectionHeader({ eyebrow, title, titleId, lede, level = 2, align = 'left', className }: SectionHeaderProps) {
  return (
    <header className={cx('lp-section-header', align === 'center' && 'lp-section-header--center', className)}>
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <Heading level={level} id={titleId}>
        {title}
      </Heading>
      {lede ? <p className="lp-lede">{lede}</p> : null}
    </header>
  );
}
