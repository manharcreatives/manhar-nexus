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

/** Status is always text + shape, never color alone. */
export function StatusPill({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium', tones[tone])}>
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}
