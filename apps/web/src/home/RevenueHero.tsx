import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { reportsApi, type DailyClosingReport, type DailySeriesPoint } from '../reports/api';
import { addDaysIso, axisDayLabel, formatDayLong, todayIso, weekdayName } from '../reports/dates';
import { formatMoney, formatMoneyCompact } from '../lib/money';
import { BarTrend } from '../charts/BarTrend';
import { Skeleton } from '../ui/states';
import { cn } from '../lib/cn';
import { LedgerFigure } from '../ui/LedgerFigure';
import { averageBill, shareOfTotal, type DayFigures, type RevenueToday } from './derive';
import { useWidget } from './useWidget';
import { InlineError } from './InlineError';
import { SectionHeader } from '../ui/SectionHeader';

const fromPoint = (p: DailySeriesPoint): DayFigures => ({
  date: p.date,
  netMinor: p.netRevenueMinorUnits,
  revenueMinor: p.totalRevenueMinorUnits,
  paidCount: p.paidInvoiceCount,
});
const fromDaily = (r: DailyClosingReport): DayFigures => ({
  date: r.date,
  netMinor: r.netRevenueMinorUnits,
  revenueMinor: r.totalRevenueMinorUnits,
  paidCount: r.paidInvoiceCount,
});

/** One series request (8 days) when allowed; otherwise three daily reports. */
const REVENUE_TOPICS = ['invoices', 'payments'] as const;

async function loadRevenue(withSeries: boolean, locationId?: string): Promise<RevenueToday> {
  const today = todayIso();
  const lastWeekDate = addDaysIso(today, -7);
  if (withSeries) {
    const s = await reportsApi.dailySeries(lastWeekDate, today, locationId);
    const byDate = new Map(s.days.map((d) => [d.date, fromPoint(d)]));
    const get = (date: string): DayFigures => byDate.get(date) ?? { date, netMinor: 0, revenueMinor: 0, paidCount: 0 };
    return {
      today: get(today),
      yesterday: get(addDaysIso(today, -1)),
      lastWeek: get(lastWeekDate),
      strip: Array.from({ length: 7 }, (_, i) => get(addDaysIso(today, i - 6))),
    };
  }
  const [t, y, w] = await Promise.all([
    reportsApi.daily(today, locationId),
    reportsApi.daily(addDaysIso(today, -1), locationId),
    reportsApi.daily(lastWeekDate, locationId),
  ]);
  return { today: fromDaily(t), yesterday: fromDaily(y), lastWeek: fromDaily(w), strip: null };
}

type Basis = 'lastWeek' | 'yesterday';

/**
 * Today is a part-day, so it is never ranked against a full day (no up/down, no red).
 * We show the comparison day's full total as a neutral reference and how far today
 * has got toward it.
 */
function Reference({ current, base, baseLabel }: { current: number; base: number; baseLabel: string }) {
  const { t } = useTranslation();
  const share = shareOfTotal(current, base);
  return (
    <div className="max-w-md">
      <p className="text-sm text-muted">
        {t('home.reference.total', { label: baseLabel })} <span className="tabular font-semibold text-ink">{formatMoney(base)}</span>
      </p>
      {share !== null ? (
        <>
          <div
            role="meter"
            aria-label={t('home.reference.meter', { label: baseLabel })}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.min(share, 100)}
            aria-valuetext={t('home.reference.progress', { pct: share })}
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-line"
          >
            <div className="h-full rounded-full bg-ink/60" style={{ width: `${Math.min(share, 100)}%` }} />
          </div>
          <p className="mt-1.5 text-xs text-muted">{t('home.reference.progress', { pct: share })}</p>
        </>
      ) : (
        <p className="mt-1 text-xs text-muted">{t('home.reference.none')}</p>
      )}
    </div>
  );
}

export function RevenueHero({ withSeries, locationId }: { withSeries: boolean; locationId: string | null }) {
  const { t } = useTranslation();
  const fn = useCallback(() => loadRevenue(withSeries, locationId ?? undefined), [withSeries, locationId]);
  const w = useWidget(fn, undefined, REVENUE_TOPICS);
  const [basis, setBasis] = useState<Basis>('lastWeek');
  const r = w.data;

  const bars = useMemo(
    () =>
      r?.strip?.map((d) => ({
        key: d.date,
        label: axisDayLabel(d.date, 'weekday'),
        fullLabel: formatDayLong(d.date),
        value: d.netMinor,
        detail: t('reports.billsCount', { count: d.paidCount }),
      })) ?? [],
    [r, t],
  );

  if (w.hidden) return null;

  const base = r ? (basis === 'lastWeek' ? r.lastWeek : r.yesterday) : null;
  const baseLabel = r
    ? basis === 'lastWeek'
      ? t('home.basis.lastWeekday', { weekday: weekdayName(r.lastWeek.date) })
      : t('home.basis.yesterday')
    : '';
  const avg = r ? averageBill(r.today) : null;

  return (
    <section aria-labelledby="rev-h" className="min-w-0">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="rev-h" className="eyebrow">
          {t('home.netRevenueToday')}
        </h2>
        {r && (
          <div role="group" aria-label={t('home.basis.label')} className="inline-flex rounded-control border border-line bg-surface p-0.5 text-xs">
            {(['lastWeek', 'yesterday'] as const).map((b) => (
              <button
                key={b}
                type="button"
                aria-pressed={basis === b}
                onClick={() => setBasis(b)}
                className={cn(
                  'min-h-8 rounded-[0.375rem] px-2.5 font-medium transition-colors duration-(--duration-micro)',
                  basis === b ? 'bg-sunken font-semibold text-ink' : 'text-muted hover:text-ink',
                )}
              >
                {b === 'lastWeek' ? t('home.basis.lastWeekday', { weekday: weekdayName(r.lastWeek.date) }) : t('home.basis.yesterday')}
              </button>
            ))}
          </div>
        )}
      </div>

      <div role="status" aria-live="polite" className="sr-only">
        {w.loading ? t('home.loading') : ''}
      </div>

      {w.loading && !r && (
        <div aria-hidden className="mt-3 space-y-3">
          <Skeleton className="h-16 w-3/4 max-w-sm" />
          <Skeleton className="h-4 w-2/3 max-w-xs" />
          <Skeleton className="mt-6 h-36" />
        </div>
      )}
      {w.error && !r && <InlineError title={t('home.loadError')} onRetry={w.reload} className="mt-3" />}

      {r && base && (
        <>
          <p className="mt-4">
            <LedgerFigure minor={r.today.netMinor} rule="double" reveal className="text-[3.25rem] sm:text-[4.5rem] lg:text-[5.5rem]" />
          </p>
          <div className="mt-4">
            <Reference current={r.today.netMinor} base={base.netMinor} baseLabel={baseLabel} />
            <p className="mt-3 text-xs text-muted">{t('home.soFarNote')}</p>
          </div>

          <dl className="mt-8 grid grid-cols-2 border-t border-line sm:max-w-md">
            <div className="py-4 pr-6">
              <dt className="eyebrow">{t('home.paidBills')}</dt>
              <dd className="tabular mt-1.5 font-display text-[2rem] leading-none font-semibold">{r.today.paidCount}</dd>
              <dd className="mt-1 text-xs text-muted">{t('home.thenCount', { count: base.paidCount })}</dd>
            </div>
            <div className="border-l border-line py-4 pl-6">
              <dt className="eyebrow">{t('home.averageBill')}</dt>
              <dd className="mt-1.5 text-[2rem] leading-none">{avg === null ? '—' : <LedgerFigure minor={avg} />}</dd>
              <dd className="text-xs text-muted">
                {averageBill(base) === null ? t('home.noBillsThen') : t('home.thenAmount', { amount: formatMoney(averageBill(base) ?? 0) })}
              </dd>
            </div>
          </dl>

          {r.strip && (
            <div className="mt-10">
              <SectionHeader as="h3" size="sm" title={t('home.last7')} className="mb-4" />
              <BarTrend
                data={bars}
                title={t('home.last7Title')}
                valueLabel={t('reports.netRevenue')}
                unit="INR"
                categoryLabel={t('reports.colDay')}
                detailLabel={t('reports.paidInvoices')}
                formatValue={(v) => formatMoney(v)}
                formatTick={(v) => formatMoneyCompact(v)}
                highlightKey={r.today.date}
                height={160}
              />
            </div>
          )}
          {w.error && <InlineError title={t('home.refreshError')} onRetry={w.reload} className="mt-3" />}
        </>
      )}
    </section>
  );
}
