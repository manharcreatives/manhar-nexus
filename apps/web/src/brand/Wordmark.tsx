import { brand, isDefaultBrand } from '../lib/brand';
import { cn } from '../lib/cn';
import { Monogram } from './Monogram';

export interface WordmarkProps {
  className?: string;
  /** Hide the name below this breakpoint (the shell shows only the mark on phones). */
  nameClassName?: string;
  /** "ink" for paper backgrounds, "paper" for the ink panel. */
  on?: 'paper' | 'ink';
  size?: 'sm' | 'md' | 'lg';
}

const SIZES = {
  sm: { mark: 'size-8', name: 'text-[1.1875rem]' },
  md: { mark: 'size-9', name: 'text-xl' },
  lg: { mark: 'size-11', name: 'text-[1.625rem]' },
} as const;

/**
 * Brand lockup: the monogram plus the name set in Fraunces at display optical
 * size. The default brand sets its second word in italic — the one place the
 * product uses the italic, so it reads as a signature rather than a style.
 */
export function Wordmark({ className, nameClassName, on: _on = 'paper', size = 'sm' }: WordmarkProps) {
  const s = SIZES[size];
  const [first, ...rest] = brand.name.split(' ');
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <Monogram className={s.mark} />
      <span className="sr-only">{brand.name}</span>
      <span
        aria-hidden
        className={cn(
          'font-display leading-none font-semibold tracking-[-0.018em]',
          s.name,
          'text-ink',
          nameClassName,
        )}
              >
        {isDefaultBrand && rest.length > 0 ? (
          <>
            {first}{' '}
            <span className={cn('font-medium', 'text-accent-strong')}>{rest.join(' ')}</span>
          </>
        ) : (
          brand.name
        )}
      </span>
    </span>
  );
}
