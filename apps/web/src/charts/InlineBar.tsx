import { cn } from '../lib/cn';
import './charts.css';

/**
 * A proportional bar for a table cell (value / max). Decorative: the exact
 * number always sits in its own cell next to it.
 */
export function InlineBar({ value, max, highlight, className }: { value: number; max: number; highlight?: boolean; className?: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <svg aria-hidden viewBox="0 0 100 8" preserveAspectRatio="none" className={cn('block h-2 w-full', className)}>
      <rect x={0} y={0} width={100} height={8} rx={2} className="fill-sunken" />
      {pct > 0 && <rect x={0} y={0} width={pct} height={8} rx={2} className={cn('nx-grow-x', highlight ? 'fill-accent' : 'fill-ink/45')} />}
    </svg>
  );
}
