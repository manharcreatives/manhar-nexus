import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/cn';
import { Button } from '../ui/Button';
import { PageHeader } from '../ui/PageHeader';
import { EmptyState, ErrorState, Skeleton } from '../ui/states';
import { StatusPill } from '../ui/StatusPill';
import { useToast } from '../ui/Toast';
import { describeError } from './errors';
import { useNow, useSingleFlight } from './hooks';
import { formatElapsed, minutesSince } from './time';
import { type ServiceRequest, diningApi, kitchenApi, sessionApi } from './api';

type KitchenStatus = 'SENT' | 'ACCEPTED' | 'PREPARING' | 'READY';
type Action = 'accept' | 'prepare' | 'ready';

const COLUMNS: KitchenStatus[] = ['SENT', 'ACCEPTED', 'PREPARING', 'READY'];
const POLL_MS = 15_000;
const LATE_AFTER_MIN = 15;

const NEXT_ACTION: Partial<Record<KitchenStatus, Action>> = {
  SENT: 'accept',
  ACCEPTED: 'prepare',
  PREPARING: 'ready',
};

const EDGE: Record<KitchenStatus, string> = {
  SENT: 'border-l-info',
  ACCEPTED: 'border-l-accent',
  PREPARING: 'border-l-warn',
  READY: 'border-l-ok',
};
const PILL_TONE = { SENT: 'info', ACCEPTED: 'accent', PREPARING: 'warn', READY: 'ok' } as const;

function KitchenTicket({
  order,
  tableCode,
  now,
  onAction,
}: {
  order: ServiceRequest;
  tableCode: string | undefined;
  now: number;
  onAction: (order: ServiceRequest, action: Action) => Promise<void>;
}) {
  const { t } = useTranslation();
  const { busy, run } = useSingleFlight();
  const status = order.status as KitchenStatus;
  const action = NEXT_ACTION[status];
  const mins = minutesSince(order.sentAt, now);
  const late = status !== 'READY' && mins >= LATE_AFTER_MIN;
  const ticket = order.requestNumber ? t('restaurant.kitchen.ticket', { number: order.requestNumber }) : t('restaurant.kitchen.round', { n: order.roundNumber });
  const heading = tableCode ? t('restaurant.kitchen.table', { code: tableCode }) : ticket;

  return (
    <article
      aria-label={`${heading} - ${t(`restaurant.kitchen.columns.${status}`)}`}
      className={cn('flex flex-col gap-4 rounded-panel border border-line border-l-8 bg-surface p-5', EDGE[status])}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-3xl font-semibold leading-tight">{heading}</h3>
          {tableCode && <p className="text-base text-muted">{ticket}</p>}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <StatusPill tone={PILL_TONE[status]}>{t(`restaurant.kitchen.columns.${status}`)}</StatusPill>
          <p className={cn('tabular text-xl font-semibold', late && 'text-bad')}>
            {formatElapsed(mins, t)}
          </p>
          {late && <StatusPill tone="bad">{t('restaurant.kitchen.late')}</StatusPill>}
        </div>
      </header>

      <ul className="space-y-2">
        {order.lines
          .filter((l) => l.status !== 'CANCELLED')
          .map((line) => (
            <li key={line.id} className="flex items-baseline gap-3">
              <span className="tabular min-w-10 font-display text-3xl font-semibold">{line.quantity}x</span>
              <div className="min-w-0">
                <p className="text-xl font-semibold leading-snug">{line.itemNameSnapshot}</p>
                {line.variantNameSnapshot && <p className="text-base text-muted">{line.variantNameSnapshot}</p>}
                {line.modifiers.map((m) => (
                  <p key={m.id} className="text-base text-muted">
                    + {m.optionNameSnapshot}
                  </p>
                ))}
                {line.notes && <p className="text-base font-medium italic">{line.notes}</p>}
              </div>
            </li>
          ))}
      </ul>

      {order.notes && (
        <p className="rounded-control border border-warn/40 bg-warn-soft px-3 py-2 text-base font-medium">
          <span className="font-semibold">{t('restaurant.kitchen.note')}:</span> {order.notes}
        </p>
      )}

      {action ? (
        <Button
          size="lg"
          className="min-h-14 w-full text-lg"
          loading={busy}
          aria-label={t('restaurant.kitchen.actionLabel', { action: t(`restaurant.kitchen.actions.${action}`), ticket: heading })}
          onClick={() => void run(() => onAction(order, action))}
        >
          {t(`restaurant.kitchen.actions.${action}`)}
        </Button>
      ) : (
        <p className="text-lg font-semibold text-ok">{t('restaurant.kitchen.waitingPickup')}</p>
      )}
    </article>
  );
}

export function KitchenPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const [queue, setQueue] = useState<ServiceRequest[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [tableBySession, setTableBySession] = useState<Map<string, string>>(new Map());
  const [announce, setAnnounce] = useState('');
  const tableCodes = useRef<Map<string, string> | null>(null);
  const loadInFlight = useRef(false);
  const now = useNow(30_000);

  // Table names are best effort: a kitchen-only role may not be allowed to
  // list sessions/tables, in which case tickets fall back to their number.
  const loadTableNames = useCallback(async () => {
    try {
      if (!tableCodes.current) {
        const tables = await diningApi.listTables();
        tableCodes.current = new Map(tables.map((tb) => [tb.id, tb.code]));
      }
      const sessions = await sessionApi.list({ status: 'OPEN' });
      const codes = tableCodes.current;
      const map = new Map<string, string>();
      for (const s of sessions) {
        const code = codes.get(s.diningTableId);
        if (code) map.set(s.id, code);
      }
      setTableBySession(map);
    } catch {
      /* optional enrichment */
    }
  }, []);

  const load = useCallback(async () => {
    if (loadInFlight.current) return;
    loadInFlight.current = true;
    setRefreshing(true);
    try {
      const data = await kitchenApi.queue();
      setQueue(data);
      setLastRefresh(new Date());
      setError('');
      setLoaded(true);
      void loadTableNames();
    } catch (err) {
      setError(describeError(err, t, 'restaurant.errors.loadKitchen'));
    } finally {
      loadInFlight.current = false;
      setRefreshing(false);
    }
  }, [t, loadTableNames]);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  const handleAction = useCallback(
    async (order: ServiceRequest, action: Action) => {
      try {
        const updated =
          action === 'accept' ? await kitchenApi.accept(order.id) : action === 'prepare' ? await kitchenApi.prepare(order.id) : await kitchenApi.ready(order.id);
        setQueue((prev) => prev.map((o) => (o.id === order.id ? updated : o)));
        const ticket = order.requestNumber ?? String(order.roundNumber);
        setAnnounce(t('restaurant.kitchen.ticketUpdated', { ticket, status: t(`restaurant.kitchen.columns.${updated.status}`, updated.status) }));
      } catch (err) {
        toast.show(describeError(err, t, 'restaurant.errors.kitchenAction'), 'bad');
        loadInFlight.current = false;
        await load();
      }
    },
    [load, t, toast],
  );

  const header = (
    <PageHeader
      title={t('restaurant.kitchen.title')}
      description={
        loaded
          ? `${t('restaurant.kitchen.summary', { count: queue.length })} - ${t('restaurant.kitchen.autoRefresh')}${lastRefresh ? ` - ${t('restaurant.common.updatedAt', { time: lastRefresh.toLocaleTimeString() })}` : ''}`
          : undefined
      }
      actions={
        <Button variant="secondary" size="lg" loading={refreshing} onClick={() => void load()}>
          {refreshing ? t('restaurant.common.refreshing') : t('restaurant.common.refresh')}
        </Button>
      }
    />
  );

  if (!loaded && !error) {
    return (
      <div>
        {header}
        <div role="status" aria-label={t('restaurant.common.refreshing')} className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map((c) => (
            <Skeleton key={c} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  if (!loaded) {
    return (
      <div>
        {header}
        <ErrorState title={t('restaurant.kitchen.loadErrorTitle')} body={error} onRetry={() => void load()} retryLabel={t('restaurant.common.retry')} />
      </div>
    );
  }

  const byStatus = (status: KitchenStatus) =>
    queue
      .filter((o) => o.status === status)
      .sort((a, b) => new Date(a.sentAt ?? 0).getTime() - new Date(b.sentAt ?? 0).getTime());

  return (
    <div>
      {header}
      <p className="sr-only" role="status" aria-live="polite">
        {announce}
      </p>

      <p role="alert" className={error ? 'mb-4 rounded-control bg-warn-soft px-4 py-3 text-base text-warn' : 'sr-only'}>
        {error && `${t('restaurant.kitchen.staleError')} ${error}`}
      </p>

      {queue.length === 0 ? (
        <EmptyState title={t('restaurant.kitchen.allClearTitle')} body={t('restaurant.kitchen.allClearBody')} />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map((status) => {
            const tickets = byStatus(status);
            return (
              <section key={status} aria-label={t(`restaurant.kitchen.columns.${status}`)} className="min-w-0">
                <div className="mb-3 flex items-center justify-between border-b-2 border-ink pb-2">
                  <h2 className="text-xl font-semibold">{t(`restaurant.kitchen.columns.${status}`)}</h2>
                  <span className="tabular font-display text-2xl font-semibold">{tickets.length}</span>
                </div>
                <div className="space-y-4">
                  {tickets.map((order) => (
                    <KitchenTicket key={order.id} order={order} tableCode={tableBySession.get(order.sessionId)} now={now} onAction={handleAction} />
                  ))}
                  {tickets.length === 0 && (
                    <p className="rounded-panel border border-dashed border-line py-8 text-center text-base text-muted">{t('restaurant.kitchen.columnEmpty')}</p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
