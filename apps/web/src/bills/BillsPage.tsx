import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { billsApi, type BillList, type InvoiceStatus } from './api';
import { BillDetailDialog } from './BillDetailDialog';
import { StatusBadge } from './StatusBadge';
import { dayEndIso, dayStartIso } from './helpers';
import { useAsync } from '../reports/useAsync';
import { presetRange, todayIso } from '../reports/dates';
import { formatMoney } from '../lib/money';
import { PageHeader } from '../ui/PageHeader';
import { Panel } from '../ui/Panel';
import { Field } from '../ui/Field';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { Table, Td, Th } from '../ui/Table';
import { EmptyState, ErrorState, Skeleton } from '../ui/states';

const PAGE_SIZE = 25;
type StatusFilter = '' | InvoiceStatus;

export function BillsPage() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<StatusFilter>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [skip, setSkip] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);

  const fn = useCallback(
    () =>
      billsApi.list({
        status: status || undefined,
        from: from ? dayStartIso(from) : undefined,
        to: to ? dayEndIso(to) : undefined,
        skip,
        take: PAGE_SIZE,
      }),
    [status, from, to, skip],
  );
  const { data, loading, error, reload } = useAsync<BillList>(fn);

  const changeFilter = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setSkip(0);
  };
  const applyPreset = (key: 'today' | 'last7' | 'month') => {
    const r = presetRange(key);
    setFrom(r.from);
    setTo(r.to);
    setSkip(0);
  };
  const clearDates = () => {
    setFrom('');
    setTo('');
    setSkip(0);
  };

  const total = data?.total ?? 0;
  const items = data?.items ?? [];
  const firstShown = total === 0 ? 0 : skip + 1;
  const lastShown = Math.min(skip + items.length, total);
  const dateInvalid = from !== '' && to !== '' && from > to;

  const methodsOf = (b: (typeof items)[number]) => {
    const used = b.payments.filter((p) => p.status === 'CAPTURED' || p.status === 'PENDING');
    return used.length === 0
      ? t('bills.noPayment')
      : Array.from(new Set(used.map((p) => t(`bills.method.${p.method}`, { defaultValue: p.method })))).join(', ');
  };

  return (
    <div>
      <PageHeader title={t('bills.title')} description={t('bills.description')} />

      <Panel className="mb-6 space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Select label={t('bills.filter.status')} value={status} onChange={(e) => changeFilter(setStatus)(e.target.value as StatusFilter)}>
            <option value="">{t('bills.filter.all')}</option>
            <option value="PAID">{t('bills.status.PAID')}</option>
            <option value="FINALISED">{t('bills.status.FINALISED')}</option>
            <option value="VOIDED">{t('bills.status.VOIDED')}</option>
          </Select>
          <Field label={t('bills.filter.from')} type="date" value={from} max={todayIso()} onChange={(e) => changeFilter(setFrom)(e.target.value)} />
          <Field
            label={t('bills.filter.to')}
            type="date"
            value={to}
            max={todayIso()}
            error={dateInvalid ? t('bills.filter.rangeInvalid') : null}
            onChange={(e) => changeFilter(setTo)(e.target.value)}
          />
        </div>
        <div role="group" aria-label={t('bills.filter.presets')} className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => applyPreset('today')}>{t('bills.filter.today')}</Button>
          <Button variant="secondary" onClick={() => applyPreset('last7')}>{t('bills.filter.last7')}</Button>
          <Button variant="secondary" onClick={() => applyPreset('month')}>{t('bills.filter.month')}</Button>
          {(from || to) && <Button variant="ghost" onClick={clearDates}>{t('bills.filter.clearDates')}</Button>}
        </div>
      </Panel>

      <div role="status" aria-live="polite" className="sr-only">{loading ? t('bills.loading') : ''}</div>

      {error && !data ? (
        <ErrorState title={t('bills.loadError')} body={error} onRetry={reload} retryLabel={t('bills.retry')} />
      ) : loading && !data ? (
        <div aria-hidden className="space-y-2">
          {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-12" />)}
        </div>
      ) : items.length === 0 ? (
        <EmptyState title={t('bills.empty.title')} body={t('bills.empty.body')} />
      ) : (
        <div className={loading ? 'opacity-60 transition-opacity' : undefined}>
          {error && (
            <p role="alert" className="mb-2 text-sm text-bad">
              {t('bills.loadError')} <Button variant="ghost" onClick={reload}>{t('bills.retry')}</Button>
            </p>
          )}
          <Table>
            <thead>
              <tr>
                <Th>{t('bills.col.bill')}</Th>
                <Th>{t('bills.col.table')}</Th>
                <Th numeric>{t('bills.col.total')}</Th>
                <Th>{t('bills.col.status')}</Th>
                <Th>{t('bills.col.paid')}</Th>
                <Th>{t('bills.col.methods')}</Th>
                <Th><span className="sr-only">{t('bills.col.actions')}</span></Th>
              </tr>
            </thead>
            <tbody>
              {items.map((b) => (
                <tr key={b.id}>
                  <Td className="whitespace-nowrap font-medium">{b.invoiceNumber ?? t('bills.draft')}</Td>
                  <Td className="whitespace-nowrap">{b.tableCode ?? t('bills.noTable')}</Td>
                  <Td numeric className="whitespace-nowrap">{formatMoney(b.grandTotalMinorUnits, b.currencyCode)}</Td>
                  <Td><StatusBadge status={b.status} /></Td>
                  <Td className="whitespace-nowrap">{b.paidAt ? new Date(b.paidAt).toLocaleString() : t('bills.notPaid')}</Td>
                  <Td>{methodsOf(b)}</Td>
                  <Td className="text-right">
                    <Button variant="secondary" onClick={() => setOpenId(b.id)} aria-label={t('bills.openBill', { number: b.invoiceNumber ?? t('bills.draft') })}>
                      {t('bills.open')}
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">{t('bills.showing', { from: firstShown, to: lastShown, total })}</p>
            <div className="flex gap-2">
              <Button variant="secondary" disabled={skip === 0 || loading} onClick={() => setSkip(Math.max(0, skip - PAGE_SIZE))}>
                {t('bills.prev')}
              </Button>
              <Button variant="secondary" disabled={skip + PAGE_SIZE >= total || loading} onClick={() => setSkip(skip + PAGE_SIZE)}>
                {t('bills.next')}
              </Button>
            </div>
          </div>
        </div>
      )}

      <BillDetailDialog invoiceId={openId} onClose={() => setOpenId(null)} onChanged={reload} />
    </div>
  );
}
