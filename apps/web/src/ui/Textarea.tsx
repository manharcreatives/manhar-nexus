import { useId, type TextareaHTMLAttributes } from 'react';
import { cn } from '../lib/cn';
import { controlBox } from './controlBox';

export interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  label: string;
  error?: string | null;
}

export function Textarea({ label, error, className, ...rest }: TextareaProps) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <textarea
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-err` : undefined}
        rows={3}
        {...rest}
        className={cn(
          'w-full rounded-control border bg-white/[0.035] px-3 py-2 text-base text-ink placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-60',
          controlBox(!!error),
          className,
        )}
      />
      {error && (
        <p id={`${id}-err`} className="text-sm text-bad">
          {error}
        </p>
      )}
    </div>
  );
}
