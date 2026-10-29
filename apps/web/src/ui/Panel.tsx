import type { HTMLAttributes } from 'react';
import { cn } from '../lib/cn';

export function Panel({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div {...rest} className={cn('nx-glass rounded-panel p-5', className)} />;
}
