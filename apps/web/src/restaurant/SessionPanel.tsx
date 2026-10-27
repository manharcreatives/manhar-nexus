import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { cn } from '../lib/cn';
import { EmptyState, ErrorState, Skeleton } from '../ui/states';
import { Textarea } from '../ui/Textarea';
import { useToast } from '../ui/Toast';
import { CheckoutDialog } from './CheckoutDialog';
import { EmptyOrderArt } from '../brand/illustrations';
import { OrderBuilder } from './OrderBuilder';
import { OrderStatusPill } from './StatusPills';
import { describeError } from './errors';
import { useSingleFlight } from './hooks';
import { useRestaurantCaps } from './permissions';
import { useLiveRefresh } from '../realtime/RealtimeProvider';
import {
  type CatalogCategory,
  type CatalogItem,
  type DiningTable,
  type GuestSession,
  type ServiceRequest,
  formatMinorUnits,
  orderApi,
  sessionApi,
  timeAgo,
} from './api';

const ACTIVE = ['DRAFT', 'SENT', 'ACCEPTED', 'PREPARING', 'READY'];

function orderTitle(order: ServiceRequest, t: (k: string, o?: Record<string, unknown>) => string): string {
  const round = t('restaurant.session.round', { n: order.roundNumber });
  return order.requestNumber ? `${round} - ${t('restaurant.session.ticketNumber', { number: order.requestNumber })}` : round;
}

function OrderCard({
  order,
  canManage,
  onChanged,
  onRequestCancel,
}: {
  order: ServiceRequest;
  /** restaurant.order.manage: cancel and serve are hidden for roles that would get a 403. */
  canManage: boolean;
  onChanged: (o: ServiceRequest) => void;
  onRequestCancel: (o: ServiceRequest) => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const serving = useSingleFlight();
  const canCancel = canManage && (order.status === 'DRAFT' || order.status === 'SENT');

  async function serve() {
    await serving.run(async () => {
      try {
        onChanged(await orderApi.serve(order.id));
      } catch (err) {
        toast.show(describeError(err, t, 'restaurant.errors.generic'), 'bad');
      }
    });
  }

  return (
    <article className={cn('nx-stub rounded-panel border border-line bg-surface', order.status === 'CANCELLED' && 'opacity-70')}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3.5 pb-3">
        <h3 className="flex items-baseline gap-2.5">
          <span className="font-display text-lg font-semibold">{t('restaurant.session.round', { n: order.roundNumber })}</span>
          {order.requestNumber && (
            <span className="ticket-no text-xs font-normal text-muted">{t('restaurant.session.ticketNumber', { number: order.requestNumber })}</span>
          )}
        </h3>
        <OrderStatusPill status={order.status} />
      </div>
      <div className="nx-tear" />
      <ul className="space-y-1.5 px-4 pt-3 pb-4">
        {order.lines
          .filter((l) => l.status !== 'CANCELLED')
          .map((line) => (
            <li key={line.id} className="flex items-baseline gap-2 text-base">
              <span className="tabular w-7 shrink-0 font-semibold">{line.quantity}×</span>
              <span className="min-w-0">{line.itemNameSnapshot}</span>
              <span aria-hidden className="mb-1 min-w-4 flex-1 border-b border-dotted border-muted/45" />
              <span className="tabular shrink-0 text-muted">{formatMinorUnits(line.unitPriceMinorUnits * line.quantity)}</span>
            </li>
          ))}
      </ul>
      {(canCancel || (canManage && order.status === 'READY')) && (
        <div className="flex flex-wrap justify-end gap-2 px-4 pb-4">
          {canCancel && (
            <Button variant="secondary" onClick={() => onRequestCancel(order)} className="min-h-11">
              {t('restaurant.session.cancelOrder')}
            </Button>
          )}
          {canManage && order.status === 'READY' && (
            <Button loading={serving.busy} onClick={() => void serve()} className="min-h-11">
              {t('restaurant.session.markServed')}
            </Button>
          )}
        </div>
      )}
    </article>
  );
}

export function SessionPanel({
  session,
  table,
  categories,
  items,
  onClose,
  onRefresh,
}: {
  session: GuestSession;
  table: DiningTable;
  categories: CatalogCategory[];
  items: CatalogItem[];
  onClose: () => void;
  onRefresh: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [orders, setOrders] = useState<ServiceRequest[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [showOrder, setShowOrder] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<ServiceRequest | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelReasonError, setCancelReasonError] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const closer = useSingleFlight();
  const canceller = useSingleFlight();

  const caps = useRestaurantCaps();
  const sessionId = session.id;
  const loadSeq = useRef(0);
  const haveOrders = useRef(false);
  const loadOrders = useCallback(async () => {
    const id = ++loadSeq.current; // the latest request wins, whatever order responses arrive in
    try {
      const data = await orderApi.list({ sessionId });
      if (id !== loadSeq.current) return;
      haveOrders.current = true;
      setOrders(data);
      setLoadError('');
    } catch (err) {
      if (id !== loadSeq.current) return;
      // A failed refresh keeps the orders already on screen.
      if (!haveOrders.current) setLoadError(describeError(err, t, 'restaurant.errors.loadOrders'));
    }
  }, [sessionId, t]);

  useEffect(() => {
    haveOrders.current = false;
    void loadOrders();
  }, [loadOrders]);

  // Live: a ticket moving through the kitchen (or another waiter's change) updates the list in place.
  useLiveRefresh(['orders', 'kitchen'], loadOrders);

  const replaceOrder = (updated: ServiceRequest) =>
    setOrders((prev) => (prev ? prev.map((o) => (o.id === updated.id ? updated : o)) : prev));

  async function closeSession() {
    setActionError('');
    await closer.run(async () => {
      try {
        await sessionApi.close(sessionId);
        toast.show(t('restaurant.session.closedToast', { code: table.code }));
        setShowClose(false);
        onRefresh();
        onClose();
      } catch (err) {
        setShowClose(false);
        setActionError(describeError(err, t, 'restaurant.errors.closeSession'));
      }
    });
  }

  async function confirmCancel() {
    if (!cancelTarget) return;
    const reason = cancelReason.trim();
    if (!reason) {
      setCancelReasonError(t('restaurant.session.cancelReasonRequired'));
      return;
    }
    await canceller.run(async () => {
      try {
        replaceOrder(await orderApi.cancel(cancelTarget.id, reason));
        toast.show(t('restaurant.session.cancelledToast'));
        setCancelTarget(null);
        setCancelReason('');
      } catch (err) {
        setCancelReasonError(describeError(err, t, 'restaurant.errors.cancelOrder'));
      }
    });
  }

  const list = orders ?? [];
  const hasActiveOrders = list.some((o) => ACTIVE.includes(o.status));
  const hasBillable = list.some((o) => o.status !== 'CANCELLED' && o.status !== 'DRAFT');
  const guests = t('restaurant.tables.guests', { count: session.partySize });

  return (
    <>
      <Dialog
        open
        onClose={onClose}
        title={t('restaurant.session.title', { code: table.code })}
        className="w-[min(40rem,calc(100vw-1rem))]!"
        footer={
          caps.canManageSessions || caps.canCheckout || caps.canManageOrders ? (
          <>
            {caps.canManageSessions && (
              <Button variant="secondary" size="lg" disabled={hasActiveOrders || closer.busy} onClick={() => setShowClose(true)}>
                {t('restaurant.session.closeSession')}
              </Button>
            )}
            {caps.canCheckout && (
              <Button variant="secondary" size="lg" disabled={!hasBillable} onClick={() => setShowCheckout(true)}>
                {t('restaurant.session.checkout')}
              </Button>
            )}
            {caps.canManageOrders && (
              <Button size="lg" data-autofocus onClick={() => setShowOrder(true)}>
                {t('restaurant.session.newOrder')}
              </Button>
            )}
          </>
          ) : undefined
        }
      >
        <p className="-mt-2 mb-4 text-sm text-muted">{t('restaurant.session.meta', { guests, time: timeAgo(session.openedAt) })}</p>

        <div className="max-h-[50dvh] space-y-3 overflow-y-auto pr-1" aria-live="polite">
          {orders === null && !loadError && (
            <div role="status" aria-label={t('restaurant.session.ordersHeading')} className="space-y-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          )}
          {loadError && (
            <ErrorState
              title={t('restaurant.session.loadErrorTitle')}
              body={loadError}
              onRetry={() => void loadOrders()}
              retryLabel={t('restaurant.common.retry')}
            />
          )}
          {orders !== null && list.length === 0 && (
            <EmptyState illustration={<EmptyOrderArt />} title={t('restaurant.session.noOrdersTitle')} body={t('restaurant.session.noOrdersBody')} />
          )}
          {list.map((order) => (
            <OrderCard key={order.id} order={order} canManage={caps.canManageOrders} onChanged={replaceOrder} onRequestCancel={(o) => setCancelTarget(o)} />
          ))}
        </div>

        {hasActiveOrders && <p className="mt-3 text-sm text-muted">{t('restaurant.session.closeBlocked')}</p>}
        <p role="alert" className="mt-2 text-sm text-bad">
          {actionError}
        </p>
      </Dialog>

      {showOrder && (
        <OrderBuilder
          sessionId={sessionId}
          tableCode={table.code}
          categories={categories}
          items={items}
          onSent={(order) => {
            setOrders((prev) => [order, ...(prev ?? [])]);
            setShowOrder(false);
            toast.show(t('restaurant.builder.sentToast'));
          }}
          onCancel={() => setShowOrder(false)}
        />
      )}

      {showCheckout && (
        <CheckoutDialog
          session={session}
          tableCode={table.code}
          onCancel={() => {
            setShowCheckout(false);
            void loadOrders();
          }}
          onDone={(closeTable) => {
            setShowCheckout(false);
            void loadOrders();
            if (closeTable) setShowClose(true);
          }}
        />
      )}

      <Dialog
        open={showClose}
        onClose={() => setShowClose(false)}
        title={t('restaurant.session.closeDialogTitle', { code: table.code })}
        footer={
          <>
            <Button variant="secondary" size="lg" onClick={() => setShowClose(false)} disabled={closer.busy}>
              {t('restaurant.common.cancel')}
            </Button>
            <Button variant="danger" size="lg" loading={closer.busy} onClick={() => void closeSession()}>
              {closer.busy ? t('restaurant.session.closing') : t('restaurant.session.closeConfirm')}
            </Button>
          </>
        }
      >
        <p>{t('restaurant.session.closeDialogBody')}</p>
      </Dialog>

      <Dialog
        open={cancelTarget !== null}
        onClose={() => {
          setCancelTarget(null);
          setCancelReason('');
          setCancelReasonError(null);
        }}
        title={t('restaurant.session.cancelDialogTitle')}
        footer={
          <>
            <Button
              variant="secondary"
              size="lg"
              disabled={canceller.busy}
              onClick={() => {
                setCancelTarget(null);
                setCancelReason('');
                setCancelReasonError(null);
              }}
            >
              {t('restaurant.common.keep')}
            </Button>
            <Button variant="danger" size="lg" loading={canceller.busy} onClick={() => void confirmCancel()}>
              {canceller.busy ? t('restaurant.session.cancelling') : t('restaurant.session.cancelConfirm')}
            </Button>
          </>
        }
      >
        <p className="mb-3">{t('restaurant.session.cancelDialogBody', { summary: cancelTarget ? orderTitle(cancelTarget, t) : '' })}</p>
        <Textarea
          label={t('restaurant.session.cancelReason')}
          value={cancelReason}
          placeholder={t('restaurant.session.cancelReasonPlaceholder')}
          onChange={(e) => {
            setCancelReason(e.target.value);
            setCancelReasonError(null);
          }}
          error={cancelReasonError}
        />
      </Dialog>
    </>
  );
}
