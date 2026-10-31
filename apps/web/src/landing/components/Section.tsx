import type { HTMLAttributes, ReactNode } from 'react';
import { Container } from './Container';
import { cx } from './cx';

export type SectionTone = 'canvas' | 'light' | 'alt' | 'ink' | 'night';

export interface SectionProps extends Omit<HTMLAttributes<HTMLElement>, 'id'> {
  /** The anchor id (hero, intro, about, why, platform, how, builtfor, trust, pricing, register, faq, insights, cta). */
  id: string;
  /** canvas = Soft White (default) · light = White · alt = Light Grey · ink = Ink (dark) · night = Night Panel (dark) */
  tone?: SectionTone;
  /** id of the heading that names this section (-> aria-labelledby). */
  labelledBy?: string;
  /** Vertical rhythm: 'default' | 'tight' | 'none' (no padding, e.g. for pinned/sticky scenes). */
  pad?: 'default' | 'tight' | 'none';
  /** Skip the Container wrapper (full-bleed layouts, sticky stages). Default false. */
  bleed?: boolean;
  /** Container width when not bleeding. */
  size?: 'default' | 'narrow' | 'wide';
  children: ReactNode;
}

/** <section id class="lp-section lp-section--{tone}"> with the standard rhythm. */
export function Section({ id, tone = 'canvas', labelledBy, pad = 'default', bleed = false, size = 'default', className, children, ...rest }: SectionProps) {
  const dark = tone === 'ink' || tone === 'night';
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={cx('lp-section', `lp-section--${tone}`, pad !== 'default' && `lp-section--pad-${pad}`, dark && 'lp-on-dark', className)}
      {...rest}
    >
      {bleed ? children : <Container size={size}>{children}</Container>}
    </section>
  );
}
