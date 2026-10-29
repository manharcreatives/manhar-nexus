import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../lib/cn';
import { Spinner } from './Spinner';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary: 'nx-primary text-on-accent font-semibold',
  secondary: 'border border-white/10 bg-white/[0.04] text-ink hover:border-accent/40 hover:bg-white/[0.07]',
  ghost: 'text-ink hover:bg-white/[0.06]',
  danger: 'bg-bad/90 text-[#1a0606] font-semibold shadow-[inset_0_1px_0_rgb(255_255_255/0.2)] hover:bg-bad',
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
