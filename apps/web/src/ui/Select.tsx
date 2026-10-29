import { useId, type ReactNode, type SelectHTMLAttributes } from 'react';
import { cn } from '../lib/cn';

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  label: string;
  error?: string | null;
  children: ReactNode;
}

export function Select({ label, error, className, children, ...rest }: SelectProps) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        {...rest}
        className={cn(
          'min-h-11 w-full rounded-control border bg-white/[0.035] px-3 text-base',
          error ? 'border-bad' : 'border-line hover:border-muted/70',
          className,
        )}
      >
        {children}
      </select>
      {error && <p className="text-sm text-bad">{error}</p>}
    </div>
  );
}
