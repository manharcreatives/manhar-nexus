import { useTranslation } from 'react-i18next';
import { cn } from '../lib/cn';
import { useRealtimeEnabled, useRealtimeStatus } from './RealtimeProvider';
import type { RealtimeStatus } from './client';

const DOT: Record<RealtimeStatus, string> = {
  live: 'bg-ok',
  polling: 'bg-ok',
  connecting: 'bg-warn nx-live-dot',
  reconnecting: 'bg-warn nx-live-dot',
  offline: 'bg-bad',
};
const TEXT: Record<RealtimeStatus, string> = {
  live: 'text-muted',
  polling: 'text-muted',
  connecting: 'text-muted',
  reconnecting: 'text-warn',
  offline: 'text-bad',
};

/**
 * A calm connection cue: a dot and a word. Renders nothing when no stream is
 * wanted (platform realm, signed out, no provider). The pulse (connecting /
 * reconnecting only) comes from nx-live-dot, which is off under reduced motion.
 */
export function LiveBadge({ className, compact = false }: { className?: string; compact?: boolean }) {
  const { t } = useTranslation();
  const enabled = useRealtimeEnabled();
  const status = useRealtimeStatus();
  if (!enabled) return null;
  const label = t(`realtime.status.${status}`);
  return (
    <span
      role="status"
      aria-live="polite"
      data-status={status}
      title={compact ? label : undefined}
      className={cn('inline-flex items-center gap-1.5 text-sm whitespace-nowrap', TEXT[status], className)}
    >
      <span aria-hidden className={cn('size-2 shrink-0 rounded-full', DOT[status])} />
      <span className={compact ? 'sr-only md:not-sr-only' : undefined}>{label}</span>
    </span>
  );
}

/** Shell-facing alias: the compact badge for the top bar. */
export function ConnectionIndicator({ className }: { className?: string }) {
  return <LiveBadge compact className={className} />;
}
