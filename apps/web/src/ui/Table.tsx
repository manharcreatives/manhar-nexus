import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { cn } from '../lib/cn';

export function Table({ className, ...rest }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto rounded-panel border border-line bg-surface">
      <table {...rest} className={cn('w-full text-sm', className)} />
    </div>
  );
}

export function Th({ numeric, className, ...rest }: ThHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <th
      scope="col"
      {...rest}
      className={cn(
        'border-b border-line bg-sunken/60 px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-muted',
        numeric ? 'text-right' : 'text-left',
        className,
      )}
    />
  );
}

export function Td({ numeric, className, ...rest }: TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return <td {...rest} className={cn('border-b border-line/60 px-4 py-3', numeric && 'tabular text-right', className)} />;
}
