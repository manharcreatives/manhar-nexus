import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../lib/cn';
import { controlBox } from './controlBox';

export interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  hint?: string;
  error?: string | null;
  /** Rendered inside the input's right edge (e.g. a visibility toggle). */
  adornment?: ReactNode;
}

export function Field({ label, hint, error, adornment, className, ...rest }: FieldProps) {
  const id = useId();
  // An error replaces the hint visually, but the hint stays linked for screen readers when both exist.
  const describedBy = [error ? `${id}-err` : null, hint ? `${id}-hint` : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...rest}
          className={cn(
            'min-h-11 w-full rounded-control border bg-white/[0.035] px-3 text-base text-ink transition-colors duration-(--duration-micro) placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-60',
            controlBox(!!error),
            adornment ? 'pr-11' : '',
            className,
          )}
        />
        {adornment && <div className="absolute inset-y-0 right-1 flex items-center">{adornment}</div>}
      </div>
      {error ? (
        <p id={`${id}-err`} className="text-sm text-bad">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
