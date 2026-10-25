import type { ReactNode } from 'react';
import { Button } from './Button';
import { cn } from '../lib/cn';

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-control bg-sunken', className)} />;
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="rounded-panel border border-dashed border-line px-6 py-12 text-center">
      <h2 className="text-lg font-semibold">{title}</h2>
      {body && <p className="mx-auto mt-1 max-w-prose text-sm text-muted">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ title, body, onRetry, retryLabel }: { title: string; body?: string; onRetry?: () => void; retryLabel?: string }) {
  return (
    <div role="alert" className="rounded-panel border border-bad/30 bg-bad-soft px-6 py-8 text-center">
      <h2 className="text-lg font-semibold text-bad">{title}</h2>
      {body && <p className="mx-auto mt-1 max-w-prose text-sm text-ink">{body}</p>}
      {onRetry && (
        <Button variant="secondary" className="mt-4" onClick={onRetry}>
          {retryLabel ?? 'Try again'}
        </Button>
      )}
    </div>
  );
}
