import { useId, useMemo, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Table, Th, Td } from '../ui/Table';
import { cn } from '../lib/cn';
import { bandLayout, barPath, labelStride, linearScale, niceTicks } from './scale';
import { useElementWidth } from './useElementWidth';
import './charts.css';

export interface BarDatum {
  /** Stable identity (e.g. the ISO date). */
  key: string;
  /** Short axis label ("Mon", "20"). */
  label: string;
  /** Full label for tooltip, aria and table ("Mon, 20 Oct 2026"). */
  fullLabel: string;
  value: number;
  /** Optional second line in the tooltip and an extra table column. */
  detail?: string;
}

export interface BarTrendProps {
  data: BarDatum[];
  /** Accessible name of the chart and caption of its table. */
  title: string;
  /** What the bars measure ("Net revenue"); also the table's value header. */
  valueLabel: string;
  /** Unit shown on the axis caption ("INR"). */
  unit: string;
  /** Header for the category column of the table ("Day"). */
  categoryLabel: string;
  /** Header for the detail column, when data carries `detail`. */
  detailLabel?: string;
  formatValue: (v: number) => string;
  formatTick: (v: number) => string;
  /** Key of the bar drawn in the accent (e.g. today). Others are recessive. */
  highlightKey?: string;
  height?: number;
  /** Render the "show as table" alternative (default true). */
  table?: boolean;
  className?: string;
}

const M = { top: 12, right: 8, bottom: 26, left: 56 };

/**
 * Single-series vertical bars over a labeled zero-based axis. Hand-built SVG:
 * the viewBox tracks the real width so text stays 11px on any screen. One tab
 * stop; arrow keys / Home / End move between bars; hover or focus shows the
 * exact value. A table alternative carries the same numbers.
 */
export function BarTrend({
  data,
  title,
  valueLabel,
  unit,
  categoryLabel,
  detailLabel,
  formatValue,
  formatTick,
  highlightKey,
  height = 200,
  table = true,
  className,
}: BarTrendProps) {
  const { t } = useTranslation();
  const uid = useId();
  const { ref, width } = useElementWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const [focused, setFocused] = useState(false);
  const [rove, setRove] = useState(() => Math.max(0, data.length - 1));

  const geo = useMemo(() => {
    const innerW = Math.max(40, width - M.left - M.right);
    const innerH = Math.max(40, height - M.top - M.bottom);
    const max = Math.max(0, ...data.map((d) => d.value));
    const { ticks, top } = niceTicks(max, innerH < 120 ? 2 : 4);
    const y = linearScale([0, top], [innerH, 0]);
    const gap = data.length > 20 ? 0.2 : 0.35;
    const bands = bandLayout(data.length, innerW, gap);
    const band = Math.min(bands.band, 48);
    const x = (i: number) => bands.x(i) + (bands.band - band) / 2;
    const stride = labelStride(data.length, Math.floor(innerW / 44));
    return { innerW, innerH, ticks, y, band, x, slot: innerW / Math.max(1, data.length), stride };
  }, [data, width, height]);

  const roveIndex = Math.min(rove, Math.max(0, data.length - 1));
  const shown = active ?? (focused ? roveIndex : null);
  const shownDatum = shown !== null ? data[shown] : undefined;

  const onKey = (e: KeyboardEvent<SVGGElement>) => {
    const last = data.length - 1;
    const next =
      e.key === 'ArrowRight' || e.key === 'ArrowUp'
        ? Math.min(last, roveIndex + 1)
        : e.key === 'ArrowLeft' || e.key === 'ArrowDown'
          ? Math.max(0, roveIndex - 1)
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? last
              : null;
    if (next === null) return;
    e.preventDefault();
    setRove(next);
    setActive(null);
    const el = (e.currentTarget.ownerSVGElement ?? e.currentTarget).querySelector<SVGGElement>(`[data-bar="${next}"]`);
    el?.focus();
  };

  const tipX = shown !== null ? M.left + geo.x(shown) + geo.band / 2 : 0;
  const tipY = shownDatum ? M.top + geo.y(Math.max(0, shownDatum.value)) : 0;
  const tipLeft = Math.min(Math.max(tipX, 72), Math.max(72, width - 72));

  return (
    <figure className={cn('m-0', className)}>
      <p className="mb-1 text-xs text-muted" id={`${uid}-unit`}>
        {valueLabel} ({unit})
      </p>
      <div ref={ref} className="relative w-full" onMouseLeave={() => setActive(null)}>
        <svg
          role="group"
          aria-label={title}
          aria-describedby={`${uid}-unit`}
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="block max-w-full overflow-visible"
        >
          <g transform={`translate(${M.left},${M.top})`}>
            {geo.ticks.map((tick) => (
              <g key={tick} aria-hidden>
                <line
                  x1={0}
                  x2={geo.innerW}
                  y1={geo.y(tick)}
                  y2={geo.y(tick)}
                  className={tick === 0 ? 'stroke-muted/60' : 'stroke-line'}
                  strokeWidth={1}
                  shapeRendering="crispEdges"
                />
                <text x={-8} y={geo.y(tick)} dy="0.32em" textAnchor="end" className="tabular fill-muted text-[11px]">
                  {formatTick(tick)}
                </text>
              </g>
            ))}
            {data.map((d, i) => {
              const v = Math.max(0, d.value);
              const top = geo.y(v);
              const h = geo.innerH - top;
              const isHi = d.key === highlightKey;
              const isShown = shown === i;
              return (
                <g
                  key={d.key}
                  data-bar={i}
                  role="img"
                  tabIndex={i === roveIndex ? 0 : -1}
                  aria-label={`${d.fullLabel}: ${formatValue(d.value)}${d.detail ? `, ${d.detail}` : ''}`}
                  className="nx-chart-focus cursor-default outline-none"
                  onKeyDown={onKey}
                  onFocus={() => {
                    setFocused(true);
                    setRove(i);
                  }}
                  onBlur={() => setFocused(false)}
                  onMouseEnter={() => setActive(i)}
                >
                  {/* Hit target spans the full slot height, larger than the mark. */}
                  <rect x={i * geo.slot} y={0} width={geo.slot} height={geo.innerH} className="fill-transparent" />
                  {isShown && (
                    <rect x={i * geo.slot} y={0} width={geo.slot} height={geo.innerH} rx={4} className="fill-white/5" />
                  )}
                  <path
                    d={barPath(geo.x(i), top, geo.band, h, 4)}
                    className={cn('nx-grow-y', isHi ? 'fill-accent' : isShown ? 'fill-accent/60' : 'fill-accent/25')}
                  />
                  {v === 0 && (
                    <line
                      x1={geo.x(i)}
                      x2={geo.x(i) + geo.band}
                      y1={geo.innerH - 1}
                      y2={geo.innerH - 1}
                      className="stroke-muted/50"
                      strokeWidth={2}
                    />
                  )}
                  {focused && i === roveIndex && (
                    <rect
                      x={i * geo.slot + 1}
                      y={1}
                      width={Math.max(0, geo.slot - 2)}
                      height={geo.innerH - 2}
                      rx={4}
                      className="fill-none stroke-accent"
                      strokeWidth={2}
                    />
                  )}
                  {/* Labels are thinned from the most recent bar backwards. */}
                  {(data.length - 1 - i) % geo.stride === 0 && (
                    <text
                      x={geo.x(i) + geo.band / 2}
                      y={geo.innerH + 17}
                      textAnchor="middle"
                      aria-hidden
                      className={cn('text-[11px]', isHi ? 'fill-ink font-semibold' : 'fill-muted')}
                    >
                      {d.label}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
        {shownDatum && (
          <div
            aria-hidden
            className="nx-fade pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full nx-pop rounded-control px-3 py-2 text-xs"
            style={{ left: tipLeft, top: Math.max(0, tipY - 8) }}
          >
            <p className="whitespace-nowrap text-muted">{shownDatum.fullLabel}</p>
            <p className="tabular whitespace-nowrap font-display text-base font-semibold text-ink">{formatValue(shownDatum.value)}</p>
            {shownDatum.detail && <p className="whitespace-nowrap text-muted">{shownDatum.detail}</p>}
          </div>
        )}
      </div>
      {table && (
        <details className="mt-3 text-sm">
          <summary className="inline-flex min-h-10 cursor-pointer items-center font-medium text-muted hover:text-ink">
            {t('charts.showTable')}
          </summary>
          <div className="mt-2">
            <Table>
              <caption className="sr-only">{title}</caption>
              <thead>
                <tr>
                  <Th>{categoryLabel}</Th>
                  <Th numeric>{valueLabel}</Th>
                  {detailLabel && <Th numeric>{detailLabel}</Th>}
                </tr>
              </thead>
              <tbody>
                {data.map((d) => (
                  <tr key={d.key}>
                    <Td>{d.fullLabel}</Td>
                    <Td numeric>{formatValue(d.value)}</Td>
                    {detailLabel && <Td numeric>{d.detail ?? ''}</Td>}
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </details>
      )}
    </figure>
  );
}
