import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { cn } from '../lib/cn';

export function Table({ className, ...rest }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto rounded-panel border border-line bg-surface">
      <table {...rest} className={cn('w-full text-sm [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-paper/60 [&_tbody_tr:last-child>td]:border-b-0', className)} />
    </div>
  );
}

export function Th({ numeric, className, ...rest }: ThHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <th
      scope="col"
      {...rest}
      className={cn(
        'border-b border-line bg-paper/70 px-4 py-3 text-[0.6875rem] font-semibold tracking-[0.1em] text-muted uppercase',
        numeric ? 'text-right' : 'text-left',
        className,
      )}
    />
  );
}

export function Td({ numeric, className, ...rest }: TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return <td {...rest} className={cn('border-b border-line/60 px-4 py-3', numeric && 'tabular text-right', className)} />;
}
