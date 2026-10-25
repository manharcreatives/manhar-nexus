import type { HTMLAttributes } from 'react';
import { cn } from '../lib/cn';

export function Panel({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div {...rest} className={cn('rounded-panel border border-line bg-surface p-5', className)} />;
}
