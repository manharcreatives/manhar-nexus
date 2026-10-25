import { Skeleton } from '../ui/states';

export function ListSkeleton({ rows = 4, label }: { rows?: number; label: string }) {
  return (
    <div role="status" aria-live="polite" aria-label={label} className="space-y-2">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  return (
    <div aria-live="polite">
      {message && (
        <p role="alert" className="rounded-control bg-bad-soft px-3 py-2 text-sm text-bad">
          {message}
        </p>
      )}
    </div>
  );
}
