import { cn } from '../lib/cn';
import { sparklinePoints } from './scale';
import './charts.css';

export interface SparklineProps {
  values: number[];
  /** Accessible summary ("Net revenue, last 7 days: ..."). Omit to hide from assistive tech. */
  label?: string;
  width?: number;
  height?: number;
  className?: string;
}

/**
 * A word-sized trend line: 2px ink line, soft area, the last point marked in
 * the accent. Drawn at a fixed pixel size so the end dot stays round.
 */
export function Sparkline({ values, label, width = 120, height = 32, className }: SparklineProps) {
  const pts = sparklinePoints(values, width, height, 3);
  if (pts.length === 0) return null;
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `M${pts[0][0].toFixed(1)},${height} L${line.replace(/ /g, ' L')} L${pts[pts.length - 1][0].toFixed(1)},${height} Z`;
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn('block max-w-full overflow-visible', className)}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <path d={area} className="nx-fade fill-accent-soft" />
      <polyline
        points={line}
        className="nx-fade fill-none stroke-ink/70"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={lx} cy={ly} r={3} className="fill-accent stroke-surface" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
