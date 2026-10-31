import { useId } from 'react';
import { cn } from '../lib/cn';

/** Labelled on/off switch (role="switch"); 44px target, status is text-adjacent, not colour alone. */
export function Switch({
  label,
  hint,
  checked,
  onChange,
  disabled,
  onLabel,
  offLabel,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  onLabel?: string;
  offLabel?: string;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <label htmlFor={id} className="block text-sm font-medium text-ink">
          {label}
        </label>
        {hint && <p id={`${id}-hint`} className="mt-0.5 text-sm text-muted">{hint}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {(onLabel || offLabel) && (
          <span aria-hidden className="text-xs font-medium text-muted">
            {checked ? onLabel : offLabel}
          </span>
        )}
        <button
          id={id}
          type="button"
          role="switch"
          aria-checked={checked}
          aria-describedby={hint ? `${id}-hint` : undefined}
          disabled={disabled}
          onClick={() => onChange(!checked)}
          className="group grid min-h-11 min-w-11 place-items-center rounded-full disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span
            className={cn(
              'relative block h-6 w-11 rounded-full border transition-colors duration-(--duration-micro)',
              checked ? 'border-accent/60 bg-accent/30' : 'border-white/15 bg-white/[0.06]',
            )}
          >
            <span
              className={cn(
                'absolute top-0.5 left-0.5 size-5 rounded-full shadow transition-transform duration-(--duration-micro)',
                checked ? 'translate-x-5 bg-accent-strong' : 'bg-muted',
              )}
            />
          </span>
        </button>
      </div>
    </div>
  );
}
