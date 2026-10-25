import { useId, type InputHTMLAttributes } from 'react';

export function Checkbox({
  label,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'id'> & { label: string }) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
      <input id={id} type="checkbox" {...rest} className="size-5 accent-(--color-accent)" />
      {label}
    </label>
  );
}
