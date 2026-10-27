import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { billsApi, type BillList, type BillListItem, type InvoiceStatus } from './api';
import { BillDetailDialog } from './BillDetailDialog';
import { StatusBadge } from './StatusBadge';
import { dayEndIso, dayStartIso } from './helpers';
import { useAsync } from '../reports/useAsync';
import { useWorkLocation } from '../context/LocationContext';
import { formatDayLong, presetRange, toIsoDate, todayIso, type PresetKey } from '../reports/dates';
import { formatMoney } from '../lib/money';
import { PageHeader } from '../ui/PageHeader';
import { Panel } from '../ui/Panel';
import { LedgerFigure } from '../ui/LedgerFigure';
import * as Icons from '../ui/icons';
import { cn } from '../lib/cn';
import { formatBillNumber } from './number';
import { Field } from '../ui/Field';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { EmptyBillsArt } from '../brand/illustrations';
import { EmptyState, ErrorState, Skeleton } from '../ui/states';

const PAGE_SIZE = 25;
type StatusFilter = '' | InvoiceStatus;
type RangeKey = PresetKey | 'all' | 'custom';
const PRESETS: PresetKey[] = ['today', 'yesterday', 'last7', 'month'];

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export function BillsPage() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<StatusFilter>('');
  const initial = presetRange('today');
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [showCustom, setShowCustom] = useState(false);
  const [skip, setSkip] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const { locationId, locations } = useWorkLocation();
  // A new working location starts again from the first page.
  useEffect(() => setSkip(0), [locationId]);

  const fn = useCallback(
    () =>
      billsApi.list({
        status: status || undefined,
        from: from ? dayStartIso(from) : undefined,
        to: to ? dayEndIso(to) : undefined,
        skip,
        take: PAGE_SIZE,
        locationId: locationId ?? undefined,
      }),
    [status, from, to, skip, locationId],
  );
  const { data, loading, error, reload } = useAsync<BillList>(fn);

  const activeRange: RangeKey = (() => {
    if (!from && !to) return 'all';
    if (showCustom) return 'custom';
    return PRESETS.find((k) => presetRange(k).from === from && presetRange(k).to === to) ?? 'custom';
  })();
  const applyPreset = (key: PresetKey) => {
    const r = presetRange(key);
    setFrom(r.from);
    setTo(r.to);
    setShowCustom(false);
    setSkip(0);
  };
  const allDates = () => {
    setFrom('');
    setTo('');
    setShowCustom(false);
    setSkip(0);
  };
  const changeDate = (set: (v: string) => void) => (v: string) => {
    set(v);
    setSkip(0);
  };

  const total = data?.total ?? 0;
  const items = data?.items ?? [];
  const firstShown = total === 0 ? 0 : skip + 1;
  const lastShown = Math.min(skip + items.length, total);
  const dateInvalid = from !== '' && to !== '' && from > to;

  // A money total is only honest when every bill in the filter is on screen:
  // the list endpoint pages, and there is no aggregate endpoint.
  const complete = !!data && skip === 0 && items.length === total && total > 0;
  const billedMinor = complete ? items.filter((b) => b.status !== 'VOIDED').reduce((sum, b) => sum + b.grandTotalMinorUnits, 0) : null;
  const voidedCount = complete ? items.filter((b) => b.status === 'VOIDED').length : 0;
  const currency = items[0]?.currencyCode;

  const locationOf = (id: string) => locations.find((l) => l.id === id);
  const numberOf = (b: BillListItem) => formatBillNumber(b.invoiceNumber, locationOf(b.locationId)) ?? t('bills.draft');

  const methodsOf = (b: BillListItem) => {
    const used = b.payments.filter((p) => p.status === 'CAPTURED' || p.status === 'PENDING');
    return used.length === 0 ? null : Array.from(new Set(used.map((p) => t(`bills.method.${p.method}`, { defaultValue: p.method })))).join(', ');
  };

  const today = todayIso();
  const yesterday = toIsoDate(new Date(Date.now() - 86_400_000));
  const dayHeading = (iso: string) => (iso === today ? t('bills.day.today') : iso === yesterday ? t('bills.day.yesterday') : formatDayLong(iso));
  const groups: Array<{ day: string; bills: BillListItem[] }> = [];
  for (const b of items) {
    const day = toIsoDate(new Date(b.paidAt ?? b.createdAt));
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.bills.push(b);
    else groups.push({ day, bills: [b] });
  }

  const chip = (on: boolean) => cn(on && 'border-ink bg-sunken font-semibold');
  const openBill = openId ? items.find((x) => x.id === openId) : undefined;

  return (
    <div>
      <PageHeader title={t('bills.title')} description={t('bills.description')} />

      <Panel className="mb-6 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div role="group" aria-label={t('bills.filter.presets')} className="flex flex-wrap gap-2">
            {PRESETS.map((k) => (
              <Button key={k} variant="secondary" aria-pressed={activeRange === k} className={chip(activeRange === k)} onClick={() => applyPreset(k)}>
                {t(`bills.filter.${k}`)}
              </Button>
            ))}
            <Button variant="secondary" aria-pressed={activeRange === 'all'} className={chip(activeRange === 'all')} onClick={allDates}>
              {t('bills.filter.allDates')}
            </Button>
            <Button
              variant="secondary"
              aria-pressed={activeRange === 'custom'}
              aria-expanded={showCustom}
              className={chip(activeRange === 'custom')}
              onClick={() => setShowCustom((v) => !v)}
            >
              {t('bills.filter.pickDates')}
            </Button>
          </div>
          <div className="w-full sm:w-52">
            <Select
              label={t('bills.filter.status')}
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as StatusFilter);
                setSkip(0);
              }}
            >
              <option value="">{t('bills.filter.all')}</option>
              <option value="PAID">{t('bills.status.PAID')}</option>
              <option value="FINALISED">{t('bills.status.FINALISED')}</option>
              <option value="VOIDED">{t('bills.status.VOIDED')}</option>
            </Select>
          </div>
        </div>
        {showCustom && (
          <div className="grid grid-cols-1 gap-4 sm:max-w-lg sm:grid-cols-2">
            <Field label={t('bills.filter.from')} type="date" value={from} max={todayIso()} onChange={(e) => changeDate(setFrom)(e.target.value)} />
            <Field
              label={t('bills.filter.to')}
              type="date"
              value={to}
              max={todayIso()}
              error={dateInvalid ? t('bills.filter.rangeInvalid') : null}
              onChange={(e) => changeDate(setTo)(e.target.value)}
            />
          </div>
        )}
      </Panel>

      {data && total > 0 && (
        <dl className="mb-6 grid grid-cols-2 border-t border-line sm:max-w-md">
          <div className="py-4 pr-6">
            <dt className="eyebrow">{t('bills.summary.bills')}</dt>
            <dd className="tabular mt-1.5 font-display text-[2rem] leading-none font-semibold">{total}</dd>
          </div>
          {billedMinor !== null && (
            <div className="border-l border-line py-4 pl-6">
              <dt className="eyebrow">{t('bills.summary.billed')}</dt>
              <dd className="mt-1.5 text-[2rem] leading-none">
                <LedgerFigure minor={billedMinor} currency={currency} />
              </dd>
              {voidedCount > 0 && <dd className="mt-1 text-xs text-muted">{t('bills.summary.voidedLeftOut', { count: voidedCount })}</dd>}
            </div>
          )}
        </dl>
      )}

      <div role="status" aria-live="polite" className="sr-only">
        {loading ? t('bills.loading') : ''}
      </div>

      {error && !data ? (
        <ErrorState title={t('bills.loadError')} body={error} onRetry={reload} retryLabel={t('bills.retry')} />
      ) : loading && !data ? (
        <div aria-hidden className="space-y-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState illustration={<EmptyBillsArt />} title={t('bills.empty.title')} body={t('bills.empty.body')} />
      ) : (
        <div className={loading ? 'opacity-60 transition-opacity' : undefined}>
          {error && (
            <p role="alert" className="mb-2 text-sm text-bad">
              {t('bills.loadError')}{' '}
              <Button variant="ghost" onClick={reload}>
                {t('bills.retry')}
              </Button>
            </p>
          )}
          {groups.map((g) => (
            <section key={g.day} aria-label={dayHeading(g.day)} className="mb-6">
              <h2 className="eyebrow mb-2">{dayHeading(g.day)}</h2>
              <ul className="divide-y divide-line overflow-hidden rounded-panel border border-line bg-surface">
                {g.bills.map((b) => {
                  const methods = methodsOf(b);
                  const detail = [b.tableCode ?? t('bills.noTable'), timeOf(b.paidAt ?? b.createdAt), methods ?? (b.status === 'PAID' ? null : t('bills.notPaid'))]
                    .filter(Boolean)
                    .join(' · ');
                  return (
                    <li key={b.id}>
                      <button
                        type="button"
                        onClick={() => setOpenId(b.id)}
                        aria-label={t('bills.openBill', { number: numberOf(b) })}
                        className="grid min-h-14 w-full cursor-pointer grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-3 text-left transition-colors duration-(--duration-micro) hover:bg-sunken focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent md:grid-cols-[8rem_1fr_auto_7.5rem_1.25rem]"
                      >
                        <span className="ticket-no col-start-1 row-start-1 font-medium whitespace-nowrap md:col-auto md:row-auto">{numberOf(b)}</span>
                        <span className="col-start-1 row-start-2 min-w-0 truncate text-sm text-muted md:col-auto md:row-auto">{detail}</span>
                        <span className="col-start-2 row-start-2 justify-self-end md:col-auto md:row-auto md:justify-self-start">
                          <StatusBadge status={b.status} />
                        </span>
                        <span className="tabular col-start-2 row-start-1 text-right font-medium whitespace-nowrap md:col-auto md:row-auto">{formatMoney(b.grandTotalMinorUnits, b.currencyCode)}</span>
                        <Icons.ChevronRight aria-hidden className="size-4 text-muted max-md:hidden" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}

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

      <BillDetailDialog invoiceId={openId} numberLabel={openBill ? numberOf(openBill) : undefined} onClose={() => setOpenId(null)} onChanged={reload} />
    </div>
  );
}
