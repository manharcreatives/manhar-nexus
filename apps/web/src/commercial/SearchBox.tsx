import { useId } from 'react';
import { cn } from '../lib/cn';
import { controlBox } from '../ui/controlBox';

/**
 * A search input for lists the operator scans all day. The label is visually hidden (the placeholder says what to
 * type) but still read by screen readers; the clear button gives a 44px target.
 */
export function SearchBox({
  value,
  onChange,
  label,
  placeholder,
  clearLabel,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder: string;
  clearLabel: string;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn('relative w-full sm:w-80', className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        enterKeyHint="search"
        className={cn(
          'min-h-11 w-full rounded-control border bg-white/[0.035] pl-3 pr-11 text-base text-ink placeholder:text-muted [&::-webkit-search-cancel-button]:hidden',
          controlBox(false),
        )}
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label={clearLabel}
          className="absolute inset-y-0 right-0 flex min-w-11 items-center justify-center text-lg text-muted hover:text-ink"
        >
          <span aria-hidden>×</span>
        </button>
      ) : null}
    </div>
  );
}
