import { cn } from '../lib/cn';

const TONES = {
  ok: 'text-ok',
  accent: 'text-accent',
  ink: 'text-ink',
} as const;

export interface StampProps {
  /** The word on the stamp ("Paid", "Sent", "Approved"). It is real text. */
  label: string;
  tone?: keyof typeof TONES;
  size?: 'md' | 'lg';
  className?: string;
}

/**
 * Signature move: the stamp. A rubber-stamp mark that lands once (≤280ms,
 * reduced-motion aware) on the moment something becomes final: payment
 * received, order sent, expense approved.
 */
export function Stamp({ label, tone = 'ok', size = 'md', className }: StampProps) {
  return (
    <span
      className={cn(
        'nx-stamp inline-flex items-center gap-2 rounded-[0.625rem] border-[3px] border-double border-current',
        size === 'lg' ? 'px-5 py-2.5 text-xl' : 'px-3 py-1.5 text-sm',
        'font-ui font-bold tracking-[0.16em] uppercase',
        TONES[tone],
        className,
      )}
    >
      <StampCheck className={size === 'lg' ? 'size-8' : 'size-5'} />
      {label}
    </span>
  );
}

/** The check inside a ring; the stroke draws itself after the stamp lands. Decorative. */
export function StampCheck({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 20 20" fill="none" className={className}>
      <circle cx="10" cy="10" r="8.5" stroke="currentColor" strokeWidth="1.5" />
      <path className="nx-check-path" d="M6 10.4l2.6 2.6L14.2 7.4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
