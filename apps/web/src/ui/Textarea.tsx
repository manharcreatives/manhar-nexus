import { useId, type TextareaHTMLAttributes } from 'react';
import { cn } from '../lib/cn';

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
        rows={3}
        {...rest}
        className={cn(
          'w-full rounded-control border bg-white/[0.035] px-3 py-2 text-base',
          error ? 'border-bad' : 'border-line hover:border-muted/70',
          className,
        )}
      />
      {error && <p className="text-sm text-bad">{error}</p>}
    </div>
  );
}
