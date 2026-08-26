import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { reportsApi, formatMinorUnits, type DailyClosingReport, type SalesSummaryReport, type ItemReport } from './api';

type Tab = 'daily' | 'sales' | 'items';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500 uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function DailyReport() {
  const { t } = useTranslation();
  const [date, setDate] = useState(today());
  const [report, setReport] = useState<DailyClosingReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = () => {
    setLoading(true);
    setError(null);
    reportsApi.daily(date)
      .then((r) => { setReport(r); })
      .catch((e: Error) => { setError(e.message); })
      .finally(() => { setLoading(false); });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">{t('reports.dateLabel')}</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          type="button"
          onClick={generate}
          disabled={loading}
          className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? t('reports.loading') : t('reports.generateButton')}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {report && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <Stat label={t('reports.paidInvoices')} value={report.paidInvoiceCount} />
            <Stat label={t('reports.grossSales')} value={formatMinorUnits(report.grossSalesMinorUnits)} />
            <Stat label={t('reports.totalTax')} value={formatMinorUnits(report.totalTaxMinorUnits)} />
            <Stat label={t('reports.totalRevenue')} value={formatMinorUnits(report.totalRevenueMinorUnits)} />
            <Stat label={t('reports.refunds')} value={`${report.refundCount} · ${formatMinorUnits(report.totalRefundedMinorUnits)}`} />
            <Stat label={t('reports.netRevenue')} value={formatMinorUnits(report.netRevenueMinorUnits)} />
            <Stat label={t('reports.voids')} value={report.voidedInvoiceCount} />
            <Stat label={t('reports.orders')} value={report.servedOrderCount} />
          </div>

          {report.paymentBreakdown.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-slate-700 mb-2">{t('reports.paymentBreakdown')}</h3>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                    <tr>
                      <th className="px-4 py-2 text-left">Method</th>
                      <th className="px-4 py-2 text-right">Count</th>
                      <th className="px-4 py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.paymentBreakdown.map((p) => (
                      <tr key={p.method} className="border-t border-slate-100">
                        <td className="px-4 py-2">{p.method}</td>
                        <td className="px-4 py-2 text-right">{p.capturedCount}</td>
                        <td className="px-4 py-2 text-right">{formatMinorUnits(p.amountMinorUnits)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {report.taxBreakdown.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-slate-700 mb-2">{t('reports.taxBreakdown')}</h3>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                    <tr>
                      <th className="px-4 py-2 text-left">Tax</th>
                      <th className="px-4 py-2 text-right">Rate</th>
                      <th className="px-4 py-2 text-right">Taxable</th>
                      <th className="px-4 py-2 text-right">Tax Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.taxBreakdown.map((tx) => (
                      <tr key={`${tx.name}:${tx.rate}`} className="border-t border-slate-100">
                        <td className="px-4 py-2">{tx.name}</td>
                        <td className="px-4 py-2 text-right">{(tx.rate * 100).toFixed(2)}%</td>
                        <td className="px-4 py-2 text-right">{formatMinorUnits(tx.taxableAmountMinorUnits)}</td>
                        <td className="px-4 py-2 text-right">{formatMinorUnits(tx.taxAmountMinorUnits)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function SalesReport() {
  const { t } = useTranslation();
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(today());
  const [report, setReport] = useState<SalesSummaryReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = () => {
    setLoading(true);
    setError(null);
    reportsApi.sales(from, to)
      .then((r) => { setReport(r); })
      .catch((e: Error) => { setError(e.message); })
      .finally(() => { setLoading(false); });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">{t('reports.fromLabel')}</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">{t('reports.toLabel')}</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm" />
        </div>
        <button type="button" onClick={generate} disabled={loading} className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
          {loading ? t('reports.loading') : t('reports.generateButton')}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {report && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <Stat label={t('reports.paidInvoices')} value={report.paidInvoiceCount} />
          <Stat label={t('reports.grossSales')} value={formatMinorUnits(report.grossSalesMinorUnits)} />
          <Stat label={t('reports.totalTax')} value={formatMinorUnits(report.totalTaxMinorUnits)} />
          <Stat label={t('reports.totalRevenue')} value={formatMinorUnits(report.totalRevenueMinorUnits)} />
          <Stat label={t('reports.refunds')} value={formatMinorUnits(report.totalRefundedMinorUnits)} />
          <Stat label={t('reports.netRevenue')} value={formatMinorUnits(report.netRevenueMinorUnits)} />
          <Stat label={t('reports.avgInvoice')} value={formatMinorUnits(report.averageInvoiceMinorUnits)} />
        </div>
      )}
    </div>
  );
}

function ItemsReport() {
  const { t } = useTranslation();
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(today());
  const [report, setReport] = useState<ItemReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = () => {
    setLoading(true);
    setError(null);
    reportsApi.items(from, to)
      .then((r) => { setReport(r); })
      .catch((e: Error) => { setError(e.message); })
      .finally(() => { setLoading(false); });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">{t('reports.fromLabel')}</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">{t('reports.toLabel')}</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm" />
        </div>
        <button type="button" onClick={generate} disabled={loading} className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
          {loading ? t('reports.loading') : t('reports.generateButton')}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {report && (
        report.items.length === 0 ? (
          <p className="text-sm text-slate-500">{t('reports.noData')}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                <tr>
                  <th className="px-4 py-2 text-left">{t('reports.itemName')}</th>
                  <th className="px-4 py-2 text-right">{t('reports.quantity')}</th>
                  <th className="px-4 py-2 text-right">{t('reports.revenue')}</th>
                </tr>
              </thead>
              <tbody>
                {report.items.map((item) => (
                  <tr key={item.itemName} className="border-t border-slate-100">
                    <td className="px-4 py-2">{item.itemName}</td>
                    <td className="px-4 py-2 text-right">{item.quantity}</td>
                    <td className="px-4 py-2 text-right">{formatMinorUnits(item.revenueMinorUnits)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}

export function ReportsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('daily');

  const tabs: { key: Tab; label: string }[] = [
    { key: 'daily', label: t('reports.tabDaily') },
    { key: 'sales', label: t('reports.tabSales') },
    { key: 'items', label: t('reports.tabItems') },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('reports.title')}</h1>
        <p className="mt-1 text-sm text-slate-600">{t('reports.subtitle')}</p>
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === key
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div>
        {tab === 'daily' && <DailyReport />}
        {tab === 'sales' && <SalesReport />}
        {tab === 'items' && <ItemsReport />}
      </div>
    </div>
  );
}
