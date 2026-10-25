import { useTranslation } from 'react-i18next';
import { cn } from '../lib/cn';
import { sharePercents } from './scale';
import { useElementWidth } from './useElementWidth';
import './charts.css';

export interface ShareSegment {
  key: string;
  label: string;
  value: number;
  /** Optional extra text in the legend ("12 payments"). */
  detail?: string;
}

export interface ShareBarProps {
  segments: ShareSegment[];
  /** Accessible name of the legend list. */
  title: string;
  formatValue: (v: number) => string;
  className?: string;
}

/**
 * Fixed categorical order (never cycled): three token hues, then everything
 * else folds into a recessive "Other". Identity is never color alone — every
 * segment is named in the legend with its exact value and share.
 */
const FILLS = ['fill-accent', 'fill-info', 'fill-warn'] as const;
const SWATCH = ['bg-accent', 'bg-info', 'bg-warn'] as const;
const OTHER_FILL = 'fill-muted/40';
const OTHER_SWATCH = 'bg-muted/40';
const MAX_NAMED = FILLS.length;

export function foldSegments(segments: ShareSegment[], otherLabel: string): ShareSegment[] {
  const positive = segments.filter((s) => s.value > 0).sort((a, b) => b.value - a.value);
  if (positive.length <= MAX_NAMED + 1) return positive;
  const named = positive.slice(0, MAX_NAMED);
  const rest = positive.slice(MAX_NAMED);
  return [...named, { key: '__other', label: otherLabel, value: rest.reduce((s, x) => s + x.value, 0) }];
}

/** Horizontal part-to-whole bar with a 2px surface gap between segments and a full legend. */
export function ShareBar({ segments, title, formatValue, className }: ShareBarProps) {
  const { t } = useTranslation();
  const { ref, width } = useElementWidth<HTMLDivElement>();
  const rows = foldSegments(segments, t('charts.other'));
  const pct = sharePercents(rows.map((r) => r.value));
  const total = rows.reduce((s, r) => s + r.value, 0);
  const H = 14;
  const GAP = 2;
  const usable = Math.max(0, width - GAP * Math.max(0, rows.length - 1));
  let x = 0;
  const color = (i: number, key: string) => (key === '__other' || i >= MAX_NAMED ? OTHER_FILL : FILLS[i]);
  const swatch = (i: number, key: string) => (key === '__other' || i >= MAX_NAMED ? OTHER_SWATCH : SWATCH[i]);

  return (
    <div className={className}>
      <div ref={ref} className="w-full">
        <svg width={width} height={H} viewBox={`0 0 ${width} ${H}`} className="block max-w-full" aria-hidden>
          {total === 0 ? (
            <rect x={0} y={0} width={width} height={H} rx={4} className="fill-sunken" />
          ) : (
            rows.map((r, i) => {
              const w = (r.value / total) * usable;
              const rect = (
                <rect key={r.key} x={x} y={0} width={Math.max(0, w)} height={H} rx={3} className={cn('nx-grow-x', color(i, r.key))}>
                  <title>{`${r.label}: ${formatValue(r.value)} (${pct[i]}%)`}</title>
                </rect>
              );
              x += w + GAP;
              return rect;
            })
          )}
        </svg>
      </div>
      <ul aria-label={title} className="mt-3 space-y-2 text-sm">
        {rows.map((r, i) => (
          <li key={r.key} className="flex items-baseline gap-3">
            <span aria-hidden className={cn('inline-block size-2.5 shrink-0 translate-y-px rounded-sm', swatch(i, r.key))} />
            <span className="min-w-0 flex-1 truncate">
              {r.label}
              {r.detail && <span className="text-muted"> · {r.detail}</span>}
            </span>
            <span className="tabular text-muted">{pct[i]}%</span>
            <span className="tabular w-28 text-right font-medium">{formatValue(r.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
