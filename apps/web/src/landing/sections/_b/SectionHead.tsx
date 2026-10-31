import type { ReactNode } from 'react';
import { Eyebrow, Heading } from '../../components';

export interface SectionHeadProps {
  eyebrow: ReactNode;
  title: ReactNode;
  titleId: string;
  lede?: ReactNode;
}

/**
 * Eyebrow + h2 + lede, same look as the Foundation SectionHeader (.lp-section-header) but a <div>, not a <header>:
 * a <header> inside <section> is read as a second "banner" landmark by some tools and by the App test (getByRole('banner')).
 */
export function SectionHead({ eyebrow, title, titleId, lede }: SectionHeadProps) {
  return (
    <div className="lp-section-header">
      <Eyebrow>{eyebrow}</Eyebrow>
      <Heading level={2} id={titleId}>
        {title}
      </Heading>
      {lede ? <p className="lp-lede">{lede}</p> : null}
    </div>
  );
}
