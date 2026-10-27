import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

export interface SectionHeaderProps {
  /** Small-caps label above the heading ("Live", "Today"). */
  eyebrow?: ReactNode;
  title: ReactNode;
  /** id for aria-labelledby on the owning section. */
  id?: string;
  /** Right-aligned link or control. */
  action?: ReactNode;
  as?: 'h2' | 'h3';
  /** Heading size: "md" for page sections, "sm" for panel sections. */
  size?: 'md' | 'sm';
  /** Hairline with the ember tick under the header (default true). */
  rule?: boolean;
  className?: string;
}

/** Signature move: editorial section header — small-caps eyebrow, Fraunces heading, hairline with an ember tick. */
export function SectionHeader({ eyebrow, title, id, action, as: H = 'h2', size = 'md', rule = true, className }: SectionHeaderProps) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-x-4 gap-y-1', rule && 'rule-tick pb-2.5', className)}>
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-1 flex items-center gap-1.5">{eyebrow}</p>}
        <H id={id} className={cn('font-semibold leading-tight', size === 'md' ? 'text-xl' : 'text-lg')}>
          {title}
        </H>
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}
