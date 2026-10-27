import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../lib/cn';
import { Spinner } from './Spinner';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-surface shadow-[inset_0_1px_0_rgb(255_255_255/0.14),0_1px_2px_rgb(143_45_7/0.25)] hover:bg-accent-strong',
  secondary: 'border border-line bg-surface text-ink hover:border-ink/25 hover:bg-paper',
  ghost: 'text-ink hover:bg-sunken/70',
  danger: 'bg-bad text-surface shadow-[inset_0_1px_0_rgb(255_255_255/0.12)] hover:brightness-90',
};
const sizes: Record<Size, string> = {
  md: 'min-h-11 px-4 text-sm', // 44px minimum target
  lg: 'min-h-12 px-5 text-base', // 48px touch target for POS/KDS
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export function Button({ variant = 'primary', size = 'md', loading, disabled, className, children, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'nx-press inline-flex items-center justify-center gap-2 rounded-control font-medium transition-colors duration-(--duration-micro) disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}
