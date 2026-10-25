import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { reportsApi, formatMinorUnits, type DailyClosingReport, type SalesSummaryReport, type ItemReport } from './api';
import { downloadCsv, minorToMajor, type CsvCell } from './csv';
import { formatDate, presetRange, todayIso, type PresetKey } from './dates';
import { useAsync } from './useAsync';
import { PageHeader } from '../ui/PageHeader';
import { Tabs } from '../ui/Tabs';
import { Panel } from '../ui/Panel';
import { Field } from '../ui/Field';
import { Button } from '../ui/Button';
import { StatCard } from '../ui/StatCard';
import { Table, Th, Td } from '../ui/Table';
import { EmptyState, ErrorState, Skeleton } from '../ui/states';

type Tab = 'daily' | 'sales' | 'items';

const PRINT_CSS = `
.print-only { display: none; }
@media print {
  aside, nav, .no-print, body > #root header:not(main header) { display: none !important; }
  html, body, #root, #root > div, main { height: auto !important; overflow: visible !important; background: #fff !important; }
  .print-only { display: block !important; }
}
`;

function PresetBar({ keys, onPick }: { keys: PresetKey[]; onPick: (k: PresetKey) => void }) {
  const { t } = useTranslation();
  return (
    <div role="group" aria-label={t('reports.presets')} className="flex flex-wrap gap-2">
      {keys.map((k) => (
        <Button key={k} variant="secondary" onClick={() => onPick(k)}>
          {t(`reports.preset.${k}`)}
        </Button>
      ))}
    </div>
  );
}

function Actions({ onCsv, disabled }: { onCsv: () => void; disabled: boolean }) {
  const { t } = useTranslation();
  return (
    <>
      <Button variant="secondary" onClick={onCsv} disabled={disabled}>
        {t('reports.exportCsv')}
      </Button>
      <Button variant="secondary" onClick={() => window.print()} disabled={disabled}>
        {t('reports.print')}
      </Button>
    </>
  );
}

function KpiSkeleton({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-28" />
      ))}
    </div>
  );
}

/** Announces async progress politely and shows a retryable error. */
function Status({ loading, error, onRetry }: { loading: boolean; error: string | null; onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <>
      <div role="status" aria-live="polite" className="sr-only">
        {loading ? t('reports.loading') : ''}
      </div>
      {error && <ErrorState title={t('reports.loadError')} body={error} onRetry={onRetry} retryLabel={t('reports.retry')} />}
    </>
  );
}

function PaymentTable({ rows }: { rows: { method: string; capturedCount: number; amountMinorUnits: number }[] }) {
  const { t } = useTranslation();
  return (
    <section aria-labelledby="pay-h" className="space-y-2">
      <h2 id="pay-h" className="text-lg font-semibold">
        {t('reports.paymentBreakdown')}
      </h2>
      <Table>
        <thead>
          <tr>
            <Th>{t('reports.colMethod')}</Th>
            <Th numeric>{t('reports.colCount')}</Th>
            <Th numeric>{t('reports.colAmount')}</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.method}>
              <Td>{p.method}</Td>
              <Td numeric>{p.capturedCount}</Td>
              <Td numeric>{formatMinorUnits(p.amountMinorUnits)}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </section>
  );
}

// -- Daily ---------------------------------------------------------------

function DailyReport() {
  const { t } = useTranslation();
  const [date, setDate] = useState(todayIso());
  const fn = useCallback(() => reportsApi.daily(date), [date]);
  const { data: r, loading, error, reload } = useAsync<DailyClosingReport>(date ? fn : null);

  const exportCsv = () => {
    if (!r) return;
    const rows: CsvCell[][] = [
      [t('reports.tabDaily'), r.date],
      [],
      [t('reports.metric'), t('reports.colValue')],
      [t('reports.paidInvoices'), r.paidInvoiceCount],
      [t('reports.grossSales'), minorToMajor(r.grossSalesMinorUnits)],
      [t('reports.totalTax'), minorToMajor(r.totalTaxMinorUnits)],
      [t('reports.totalRevenue'), minorToMajor(r.totalRevenueMinorUnits)],
      [t('reports.refundCountLabel'), r.refundCount],
      [t('reports.refunded'), minorToMajor(r.totalRefundedMinorUnits)],
      [t('reports.netRevenue'), minorToMajor(r.netRevenueMinorUnits)],
      [t('reports.voids'), r.voidedInvoiceCount],
      [t('reports.orders'), r.servedOrderCount],
      [],
      [t('reports.paymentBreakdown')],
      [t('reports.colMethod'), t('reports.colCount'), t('reports.colAmount')],
      ...r.paymentBreakdown.map((p) => [p.method, p.capturedCount, minorToMajor(p.amountMinorUnits)]),
      [],
      [t('reports.taxBreakdown')],
      [t('reports.colTax'), t('reports.colRatePct'), t('reports.colTaxable'), t('reports.colTaxAmount')],
      ...r.taxBreakdown.map((x) => [x.name, (x.rate * 100).toFixed(2), minorToMajor(x.taxableAmountMinorUnits), minorToMajor(x.taxAmountMinorUnits)]),
    ];
    downloadCsv(`daily-closing-${r.date}.csv`, rows);
  };

  const noData = r && r.paidInvoiceCount === 0 && r.refundCount === 0 && r.voidedInvoiceCount === 0 && r.servedOrderCount === 0;

  return (
    <div className="space-y-6">
      <Panel className="no-print space-y-4">
        <PresetBar keys={['today', 'yesterday']} onPick={(k) => setDate(presetRange(k).from)} />
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="w-full sm:w-56">
            <Field label={t('reports.dateLabel')} type="date" value={date} max={todayIso()} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={reload} loading={loading}>
              {t('reports.refresh')}
            </Button>
            <Actions onCsv={exportCsv} disabled={!r || loading} />
          </div>
        </div>
      </Panel>
      <p className="print-only text-lg font-semibold">
        {t('reports.tabDaily')} - {formatDate(date)}
      </p>
      <Status loading={loading} error={error} onRetry={reload} />
      {loading && !r && <KpiSkeleton count={8} />}
      {r &&
        !error &&
        (noData ? (
          <EmptyState title={t('reports.noDataTitle')} body={t('reports.noDataBody', { period: formatDate(r.date) })} />
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label={t('reports.netRevenue')} value={formatMinorUnits(r.netRevenueMinorUnits)} />
              <StatCard label={t('reports.paidInvoices')} value={r.paidInvoiceCount} />
              <StatCard label={t('reports.grossSales')} value={formatMinorUnits(r.grossSalesMinorUnits)} />
              <StatCard label={t('reports.totalTax')} value={formatMinorUnits(r.totalTaxMinorUnits)} />
              <StatCard label={t('reports.totalRevenue')} value={formatMinorUnits(r.totalRevenueMinorUnits)} />
              <StatCard label={t('reports.refunded')} value={formatMinorUnits(r.totalRefundedMinorUnits)} note={t('reports.refundCount', { count: r.refundCount })} />
              <StatCard label={t('reports.voids')} value={r.voidedInvoiceCount} />
              <StatCard label={t('reports.orders')} value={r.servedOrderCount} />
            </div>
            {r.paymentBreakdown.length > 0 && <PaymentTable rows={r.paymentBreakdown} />}
            {r.taxBreakdown.length > 0 && (
              <section aria-labelledby="tax-h" className="space-y-2">
                <h2 id="tax-h" className="text-lg font-semibold">
                  {t('reports.taxBreakdown')}
                </h2>
                <Table>
                  <thead>
                    <tr>
                      <Th>{t('reports.colTax')}</Th>
                      <Th numeric>{t('reports.colRate')}</Th>
                      <Th numeric>{t('reports.colTaxable')}</Th>
                      <Th numeric>{t('reports.colTaxAmount')}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.taxBreakdown.map((x) => (
                      <tr key={`${x.name}:${x.rate}`}>
                        <Td>{x.name}</Td>
                        <Td numeric>{(x.rate * 100).toFixed(2)}%</Td>
                        <Td numeric>{formatMinorUnits(x.taxableAmountMinorUnits)}</Td>
                        <Td numeric>{formatMinorUnits(x.taxAmountMinorUnits)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </section>
            )}
          </div>
        ))}
    </div>
  );
}

// -- Range reports ---------------------------------------------------------

function useRange() {
  const { t } = useTranslation();
  const [range, setRangeState] = useState(() => presetRange('last7'));
  const setRange = (from: string, to: string) => setRangeState({ from, to });
  const rangeError = !range.from || !range.to ? t('reports.rangeRequired') : range.from > range.to ? t('reports.rangeInvalid') : null;
  return { ...range, setRange, rangeError };
}

function RangeBar({
  from,
  to,
  setRange,
  rangeError,
  onRefresh,
  loading,
  onCsv,
  hasData,
}: {
  from: string;
  to: string;
  setRange: (f: string, t: string) => void;
  rangeError: string | null;
  onRefresh: () => void;
  loading: boolean;
  onCsv: () => void;
  hasData: boolean;
}) {
  const { t } = useTranslation();
  return (
    <Panel className="no-print space-y-4">
      <PresetBar
        keys={['today', 'yesterday', 'last7', 'month']}
        onPick={(k) => {
          const r = presetRange(k);
          setRange(r.from, r.to);
        }}
      />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid w-full grid-cols-1 gap-3 sm:w-auto sm:grid-cols-2">
          <Field label={t('reports.fromLabel')} type="date" value={from} max={to || undefined} onChange={(e) => setRange(e.target.value, to)} />
          <Field label={t('reports.toLabel')} type="date" value={to} min={from || undefined} max={todayIso()} onChange={(e) => setRange(from, e.target.value)} error={rangeError} />
        </div>
        <div className="flex flex-wrap gap-2 sm:pt-7">
          <Button variant="secondary" onClick={onRefresh} loading={loading} disabled={!!rangeError}>
            {t('reports.refresh')}
          </Button>
          <Actions onCsv={onCsv} disabled={!hasData || loading} />
        </div>
      </div>
    </Panel>
  );
}

function SalesReport() {
  const { t } = useTranslation();
  const { from, to, setRange, rangeError } = useRange();
  const fn = useCallback(() => reportsApi.sales(from, to), [from, to]);
  const { data: r, loading, error, reload } = useAsync<SalesSummaryReport>(rangeError ? null : fn);
  const period = `${formatDate(from)} - ${formatDate(to)}`;

  const exportCsv = () => {
    if (!r) return;
    downloadCsv(`sales-summary-${from}_${to}.csv`, [
      [t('reports.tabSales'), from, to],
      [],
      [t('reports.metric'), t('reports.colValue')],
      [t('reports.paidInvoices'), r.paidInvoiceCount],
      [t('reports.grossSales'), minorToMajor(r.grossSalesMinorUnits)],
      [t('reports.totalTax'), minorToMajor(r.totalTaxMinorUnits)],
      [t('reports.totalRevenue'), minorToMajor(r.totalRevenueMinorUnits)],
      [t('reports.refunded'), minorToMajor(r.totalRefundedMinorUnits)],
      [t('reports.netRevenue'), minorToMajor(r.netRevenueMinorUnits)],
      [t('reports.avgInvoice'), minorToMajor(r.averageInvoiceMinorUnits)],
      [],
      [t('reports.paymentBreakdown')],
      [t('reports.colMethod'), t('reports.colCount'), t('reports.colAmount')],
      ...r.paymentBreakdown.map((p) => [p.method, p.capturedCount, minorToMajor(p.amountMinorUnits)]),
    ]);
  };

  return (
    <div className="space-y-6">
      <RangeBar from={from} to={to} setRange={setRange} rangeError={rangeError} onRefresh={reload} loading={loading} onCsv={exportCsv} hasData={!!r && !rangeError} />
      <p className="print-only text-lg font-semibold">
        {t('reports.tabSales')} - {period}
      </p>
      <Status loading={loading} error={error} onRetry={reload} />
      {loading && !r && <KpiSkeleton count={4} />}
      {r &&
        !error &&
        !rangeError &&
        (r.paidInvoiceCount === 0 && r.totalRefundedMinorUnits === 0 ? (
          <EmptyState title={t('reports.noDataTitle')} body={t('reports.noDataBody', { period })} />
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label={t('reports.netRevenue')} value={formatMinorUnits(r.netRevenueMinorUnits)} />
              <StatCard label={t('reports.paidInvoices')} value={r.paidInvoiceCount} />
              <StatCard label={t('reports.avgInvoice')} value={formatMinorUnits(r.averageInvoiceMinorUnits)} />
              <StatCard label={t('reports.grossSales')} value={formatMinorUnits(r.grossSalesMinorUnits)} />
              <StatCard label={t('reports.totalTax')} value={formatMinorUnits(r.totalTaxMinorUnits)} />
              <StatCard label={t('reports.totalRevenue')} value={formatMinorUnits(r.totalRevenueMinorUnits)} />
              <StatCard label={t('reports.refunded')} value={formatMinorUnits(r.totalRefundedMinorUnits)} />
            </div>
            {r.paymentBreakdown.length > 0 && <PaymentTable rows={r.paymentBreakdown} />}
          </div>
        ))}
    </div>
  );
}

function ItemsReport() {
  const { t } = useTranslation();
  const { from, to, setRange, rangeError } = useRange();
  const fn = useCallback(() => reportsApi.items(from, to), [from, to]);
  const { data: r, loading, error, reload } = useAsync<ItemReport>(rangeError ? null : fn);
  const items = useMemo(() => r?.items ?? [], [r]);
  const period = `${formatDate(from)} - ${formatDate(to)}`;

  const exportCsv = () => {
    if (!r) return;
    downloadCsv(`top-items-${from}_${to}.csv`, [
      [t('reports.itemName'), t('reports.quantity'), t('reports.revenue')],
      ...items.map((i) => [i.itemName, i.quantity, minorToMajor(i.revenueMinorUnits)]),
    ]);
  };

  return (
    <div className="space-y-6">
      <RangeBar from={from} to={to} setRange={setRange} rangeError={rangeError} onRefresh={reload} loading={loading} onCsv={exportCsv} hasData={items.length > 0 && !rangeError} />
      <p className="print-only text-lg font-semibold">
        {t('reports.tabItems')} - {period}
      </p>
      <Status loading={loading} error={error} onRetry={reload} />
      {loading && !r && <Skeleton className="h-48" />}
      {r &&
        !error &&
        !rangeError &&
        (items.length === 0 ? (
          <EmptyState title={t('reports.noDataTitle')} body={t('reports.noDataBody', { period })} />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>{t('reports.itemName')}</Th>
                <Th numeric>{t('reports.quantity')}</Th>
                <Th numeric>{t('reports.revenue')}</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.itemName}>
                  <Td>{i.itemName}</Td>
                  <Td numeric>{i.quantity}</Td>
                  <Td numeric>{formatMinorUnits(i.revenueMinorUnits)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ))}
    </div>
  );
}

export function ReportsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('daily');
  const items = [
    { key: 'daily', label: t('reports.tabDaily') },
    { key: 'sales', label: t('reports.tabSales') },
    { key: 'items', label: t('reports.tabItems') },
  ];

  return (
    <>
      <style>{PRINT_CSS}</style>
      <PageHeader title={t('reports.title')} description={t('reports.subtitle')} />
      <div className="no-print">
        <Tabs items={items} active={tab} onChange={(k) => setTab(k as Tab)} label={t('reports.title')} />
      </div>
      <div role="tabpanel">
        {tab === 'daily' && <DailyReport />}
        {tab === 'sales' && <SalesReport />}
        {tab === 'items' && <ItemsReport />}
      </div>
    </>
  );
}
