import type { CSSProperties, ElementType, HTMLAttributes } from 'react';
import { useReveal } from '../hooks/useInView';
import { cx } from './cx';

export interface RevealProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  /** Stagger in ms (0-600). Sets transition-delay. */
  delay?: number;
  /** 'up' (default) | 'fade' | 'scale' */
  effect?: 'up' | 'fade' | 'scale';
}

/** Fades/slides its children in once when scrolled into view. Final state under reduced motion. */
export function Reveal({ as: Tag = 'div', delay = 0, effect = 'up', className, style, ...rest }: RevealProps) {
  const ref = useReveal<HTMLElement>();
  const merged: CSSProperties | undefined = delay ? { ...style, transitionDelay: `${delay}ms` } : style;
  return <Tag ref={ref} className={cx('lp-reveal', effect !== 'up' && `lp-reveal--${effect}`, className)} style={merged} {...rest} />;
}
