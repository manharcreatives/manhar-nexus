import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

type Tone = 'neutral' | 'ok' | 'warn' | 'bad' | 'info' | 'accent';
const tones: Record<Tone, string> = {
  neutral: 'bg-white/[0.06] text-muted',
  ok: 'bg-ok/12 text-ok',
  warn: 'bg-warn/12 text-warn',
  bad: 'bg-bad/12 text-bad',
  info: 'bg-info/12 text-info',
  accent: 'bg-accent/14 text-accent-strong',
};

/**
 * The marker differs by tone, so the status survives for someone who cannot tell red from green:
 * ok/accent = disc, warn = triangle, bad = square, info = diamond, neutral = ring. The words always come first.
 */
const markers: Record<Tone, string> = {
  neutral: 'rounded-full border border-current',
  ok: 'rounded-full bg-current',
  accent: 'rounded-full bg-current',
  warn: 'bg-current [clip-path:polygon(50%_0,100%_100%,0_100%)]',
  bad: 'rounded-[1px] bg-current',
  info: 'rotate-45 rounded-[1px] bg-current',
};

export function StatusPill({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium', tones[tone])}>
      <span aria-hidden data-marker={tone} className={cn('size-1.5 shrink-0', markers[tone])} />
      {children}
    </span>
  );
}
