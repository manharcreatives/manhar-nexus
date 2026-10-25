import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

export interface KbdProps {
  children: ReactNode;
  className?: string;
}

/** A single key cap, e.g. <Kbd>Ctrl</Kbd><Kbd>K</Kbd>. Purely presentational. */
export function Kbd({ children, className }: KbdProps) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-[0.3125rem] border border-b-2 border-line bg-surface px-1.5',
        'font-ui text-[0.6875rem] leading-none font-medium text-muted',
        className,
      )}
    >
      {children}
    </kbd>
  );
}

/** A sequence or chord of keys with an accessible label, e.g. keys={['g','t']}. */
export function KeyCombo({ keys, label, joiner }: { keys: string[]; label?: string; joiner?: string }) {
  return (
    <span className="inline-flex items-center gap-1" aria-label={label}>
      {keys.map((k, i) => (
        <span key={`${k}-${i}`} className="inline-flex items-center gap-1" aria-hidden={label ? true : undefined}>
          {i > 0 && joiner && <span className="text-xs text-muted">{joiner}</span>}
          <Kbd>{k}</Kbd>
        </span>
      ))}
    </span>
  );
}
