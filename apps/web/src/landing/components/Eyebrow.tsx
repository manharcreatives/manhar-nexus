import type { ElementType, HTMLAttributes } from 'react';
import { cx } from './cx';

export interface EyebrowProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
}

/** JetBrains Mono uppercase label (max ~6 words). Colour follows the surface (Forest on light, soft on dark). */
export function Eyebrow({ as: Tag = 'p', className, ...rest }: EyebrowProps) {
  return <Tag className={cx('lp-eyebrow', className)} {...rest} />;
}
