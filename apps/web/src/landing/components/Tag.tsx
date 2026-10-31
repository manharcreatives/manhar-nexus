import type { HTMLAttributes } from 'react';
import { cx } from './cx';

export interface TagProps extends HTMLAttributes<HTMLSpanElement> {
  /** mint = Mint Wash + Mint border + Deep text (default) · dark = for Ink surfaces · outline = neutral line */
  tone?: 'mint' | 'dark' | 'outline';
}

/** Small mono pill (status / category / "Coming soon"). */
export function Tag({ tone = 'mint', className, ...rest }: TagProps) {
  return <span className={cx('lp-tag', tone !== 'mint' && `lp-tag--${tone}`, className)} {...rest} />;
}
