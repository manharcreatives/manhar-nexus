import type { ReactNode } from 'react';

/**
 * Page masthead: optional small-caps eyebrow, Fraunces title at display
 * optical size, a hairline with the ember tick (signature) under it.
 */
export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <header className="rule-tick mb-7 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 pb-5">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="text-[2rem] leading-[1.05] font-semibold tracking-[-0.025em] sm:text-[2.5rem]">{title}</h1>
        {description && <p className="mt-2 max-w-prose text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
