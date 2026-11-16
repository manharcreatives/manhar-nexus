import { useId, type InputHTMLAttributes } from 'react';
import { cn } from '../lib/cn';

/** The whole row is the tap target (44px tall); the box itself is 20px with the accent colour (8.7:1 on the page). */
export function Checkbox({
  label,
  className,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'id'> & { label: string }) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex min-h-11 cursor-pointer items-center gap-3 py-1 text-sm has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60">
      <input id={id} type="checkbox" {...rest} className={cn('size-5 shrink-0 accent-(--color-accent)', className)} />
      <span className="min-w-0 break-words">{label}</span>
    </label>
  );
}
