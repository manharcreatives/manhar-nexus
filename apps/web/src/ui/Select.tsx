import { useId, type ReactNode, type SelectHTMLAttributes } from 'react';
import { cn } from '../lib/cn';
import { controlBox } from './controlBox';

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
        aria-describedby={error ? `${id}-err` : undefined}
        {...rest}
        className={cn(
          'min-h-11 w-full rounded-control border bg-white/[0.035] px-3 text-base text-ink disabled:cursor-not-allowed disabled:opacity-60',
          controlBox(!!error),
          className,
        )}
      >
        {children}
      </select>
      {error && (
        <p id={`${id}-err`} className="text-sm text-bad">
          {error}
        </p>
      )}
    </div>
  );
}
