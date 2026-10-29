import { useCallback, useEffect, useRef, useState } from 'react';
import { useWorkLocation } from '../context/LocationContext';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/cn';
import { Button } from '../ui/Button';
import { PageHeader } from '../ui/PageHeader';
import { EmptyState, ErrorState, Skeleton } from '../ui/states';
import { StatusPill } from '../ui/StatusPill';
import { StampCheck } from '../ui/Stamp';
import { AllClearArt } from '../brand/illustrations';
import { useToast } from '../ui/Toast';
import { describeError } from './errors';
import { useNow, useSingleFlight } from './hooks';
import { useRestaurantCaps } from './permissions';
import { LiveBadge } from '../realtime/LiveBadge';
import { useLiveRefresh } from '../realtime/RealtimeProvider';
import { formatElapsed, minutesSince } from './time';
import { type ServiceRequest, diningApi, kitchenApi, sessionApi } from './api';

type KitchenStatus = 'SENT' | 'ACCEPTED' | 'PREPARING' | 'READY';
type Action = 'accept' | 'prepare' | 'ready';

const COLUMNS: KitchenStatus[] = ['SENT', 'ACCEPTED', 'PREPARING', 'READY'];
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
/** How long a newly arrived ticket keeps its ember wash. */
const ARRIVE_MS = 2_000;

/** Signature: the ticket stub — perforated top, a tear line with notches, monospaced ticket number. */
function KitchenTicket({
  order,
  tableCode,
  now,
  arriving,
  canAct,
  onAction,
}: {
  order: ServiceRequest;
  tableCode: string | undefined;
  now: number;
  arriving: boolean;
  /** False for view-only roles (waiters): they follow tickets but cannot move them. */
  canAct: boolean;
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
      data-perforated
      className={cn(
        'nx-stub flex flex-col rounded-b-panel border border-l-[6px] border-line bg-surface [--tear-edge:5px]',
        EDGE[status],
        arriving && 'nx-arrive nx-arriving',
      )}
    >
      <header className="flex flex-col gap-2 px-5 pt-5 pb-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="ticket-no min-w-0 text-sm break-all text-muted">{tableCode ? ticket : '\u00a0'}</p>
          <p className={cn('tabular shrink-0 text-xl font-semibold', late && 'text-bad')}>{formatElapsed(mins, t)}</p>
        </div>
        <h3 className="font-display text-[2rem] leading-[1.05] font-semibold tracking-[-0.02em]">{heading}</h3>
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill tone={PILL_TONE[status]}>{t(`restaurant.kitchen.columns.${status}`)}</StatusPill>
          {late && <StatusPill tone="bad">{t('restaurant.kitchen.late')}</StatusPill>}
        </div>
      </header>

      <div className="nx-tear" />

      <ul className="space-y-2.5 px-5 pt-4 pb-5">
        {order.lines
          .filter((l) => l.status !== 'CANCELLED')
          .map((line) => (
            <li key={line.id} className="flex items-baseline gap-3">
              <span className="tabular min-w-11 font-display text-[1.75rem] leading-none font-semibold">
                {line.quantity}
                <span className="text-[0.7em] text-muted">×</span>
              </span>
              <div className="min-w-0">
                <p className="text-xl leading-snug font-semibold">{line.itemNameSnapshot}</p>
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
        <p className="mx-5 mb-5 rounded-control border border-warn/40 bg-warn-soft px-3 py-2 text-base font-medium">
          <span className="font-semibold">{t('restaurant.kitchen.note')}:</span> {order.notes}
        </p>
      )}

      <div className="mt-auto px-5 pb-5">
        {action && !canAct ? null : action ? (
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
          <p className="flex min-h-14 items-center justify-center gap-2 rounded-control border border-dashed border-ok/40 text-lg font-semibold text-ok">
            <StampCheck className="size-5" />
            {t('restaurant.kitchen.waitingPickup')}
          </p>
        )}
      </div>
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
  // Ticket ids already on screen; anything new after the first load gets the arrival wash.
  const seen = useRef<Set<string> | null>(null);
  const [arriving, setArriving] = useState<ReadonlySet<string>>(new Set());
  const loadInFlight = useRef(false);
  // An event that lands while a load is running must not be lost: run once more afterwards.
  const rerun = useRef(false);
  const now = useNow(30_000);
  const { canManageKitchen } = useRestaurantCaps();

  // Table names are best effort: a kitchen-only role may not be allowed to
  // list sessions/tables, in which case tickets fall back to their number.
  const namesDenied = useRef(false);
  const loadTableNames = useCallback(async () => {
    if (namesDenied.current) return; // this role cannot list tables/sessions: do not ask again on every event
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
    } catch (err) {
      if ((err as { status?: number }).status === 403) namesDenied.current = true;
      /* optional enrichment */
    }
  }, []);

  const { locationId } = useWorkLocation();

  const load = useCallback(async function run(): Promise<void> {
    if (loadInFlight.current) {
      rerun.current = true;
      return;
    }
    loadInFlight.current = true;
    setRefreshing(true);
    try {
      const data = await kitchenApi.queue(locationId ?? undefined);
      if (seen.current === null) {
        seen.current = new Set(data.map((o) => o.id));
      } else {
        const known = seen.current;
        const fresh = data.filter((o) => !known.has(o.id)).map((o) => o.id);
        fresh.forEach((id) => known.add(id));
        if (fresh.length > 0) {
          setArriving(new Set(fresh));
          setAnnounce(t('restaurant.kitchen.newTickets', { count: fresh.length }));
        }
      }
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
      if (rerun.current) {
        rerun.current = false;
        await run();
      }
    }
  }, [t, loadTableNames, locationId]);

  // A new working location is a new queue: nothing on it counts as "arriving".
  // (Declared before the polling effect so the reset runs before the first load.)
  useEffect(() => {
    seen.current = null;
  }, [locationId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Live: refetch on order/kitchen events; the hook also keeps a slow safety-net poll.
  useLiveRefresh(['orders', 'kitchen'], load);

  useEffect(() => {
    if (arriving.size === 0) return;
    const id = window.setTimeout(() => setArriving(new Set()), ARRIVE_MS);
    return () => window.clearTimeout(id);
  }, [arriving]);

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
          ? `${t('restaurant.kitchen.summary', { count: queue.length })}${lastRefresh ? ` - ${t('restaurant.common.updatedAt', { time: lastRefresh.toLocaleTimeString() })}` : ''}`
          : undefined
      }
      actions={
        <>
          <LiveBadge />
          <Button variant="secondary" size="lg" loading={refreshing} onClick={() => void load()}>
            {refreshing ? t('restaurant.common.refreshing') : t('restaurant.common.refresh')}
          </Button>
        </>
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

      {!canManageKitchen && <p className="mb-4 text-sm text-muted">{t('restaurant.kitchen.viewOnly')}</p>}

      <p role="alert" className={error ? 'mb-4 rounded-control bg-warn-soft px-4 py-3 text-base text-warn' : 'sr-only'}>
        {error && `${t('restaurant.kitchen.staleError')} ${error}`}
      </p>

      {queue.length === 0 ? (
        <EmptyState illustration={<AllClearArt />} title={t('restaurant.kitchen.allClearTitle')} body={t('restaurant.kitchen.allClearBody')} />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map((status) => {
            const tickets = byStatus(status);
            return (
              <section key={status} aria-label={t(`restaurant.kitchen.columns.${status}`)} className="min-w-0">
                <div className="mb-4 flex items-center justify-between border-b-2 border-accent/60 pb-2.5">
                  <h2 className="text-xl font-semibold">{t(`restaurant.kitchen.columns.${status}`)}</h2>
                  <span
                    className={cn(
                      'ticket-no grid h-8 min-w-8 place-items-center rounded-control px-2 text-base font-semibold',
                      tickets.length > 0 ? 'bg-accent text-on-accent font-semibold' : 'bg-sunken text-muted',
                    )}
                  >
                    {tickets.length}
                  </span>
                </div>
                <div className="space-y-5">
                  {tickets.map((order) => (
                    <KitchenTicket
                      key={order.id}
                      order={order}
                      tableCode={tableBySession.get(order.sessionId)}
                      now={now}
                      arriving={arriving.has(order.id)}
                      canAct={canManageKitchen}
                      onAction={handleAction}
                    />
                  ))}
                  {tickets.length === 0 && (
                    <p className="rounded-panel border border-dashed border-line py-10 text-center text-base text-muted">{t('restaurant.kitchen.columnEmpty')}</p>
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
