import type { ElementType, HTMLAttributes } from 'react';
import { cx } from './cx';

export interface ContainerProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  /** 'default' 1200px, 'narrow' 760px (prose / forms), 'wide' 1360px */
  size?: 'default' | 'narrow' | 'wide';
}

/** Centered max-width wrapper with the page gutters. */
export function Container({ as: Tag = 'div', size = 'default', className, ...rest }: ContainerProps) {
  return <Tag className={cx('lp-container', size !== 'default' && `lp-container--${size}`, className)} {...rest} />;
}
