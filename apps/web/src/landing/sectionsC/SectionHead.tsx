import type { ReactNode } from 'react';
import { Eyebrow, Heading } from '../components';

export interface SectionHeadProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  titleId: string;
  lede?: ReactNode;
}

/**
 * Same look as the Foundation SectionHeader (.lp-section-header) but a <div>: a <header> inside a <section>
 * is matched as an extra "banner" landmark by testing tools (App.test uses getByRole('banner')).
 */
export function SectionHead({ eyebrow, title, titleId, lede }: SectionHeadProps) {
  return (
    <div className="lp-section-header">
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <Heading level={2} id={titleId}>
        {title}
      </Heading>
      {lede ? <p className="lp-lede">{lede}</p> : null}
    </div>
  );
}
