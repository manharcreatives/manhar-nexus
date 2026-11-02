import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { cn } from '../lib/cn';
import { EmptyState, ErrorState, Skeleton } from '../ui/states';
import { Textarea } from '../ui/Textarea';
import { useToast } from '../ui/Toast';
import { CheckoutDialog } from './CheckoutDialog';
import { BillShowActions } from './bill-show/BillShowActions';
import { EmptyOrderArt } from '../brand/illustrations';
import { OrderBuilder } from './OrderBuilder';
import { OrderStatusPill } from './StatusPills';
import { describeError } from './errors';
import { useSingleFlight } from './hooks';
import { useRestaurantCaps } from './permissions';
import { useLiveRefresh } from '../realtime/RealtimeProvider';
import { OrderEditDialog } from './order/OrderEditDialog';
import { clientLockReason, showsEditButton } from './order/editRules';
import {
  type BillPreview,
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
  canEdit,
  onChanged,
  onRequestCancel,
  onRequestEdit,
}: {
  order: ServiceRequest;
  /** restaurant.order.manage: cancel and serve are hidden for roles that would get a 403. */
  canManage: boolean;
  /** restaurant.order.edit: "Edit order" is offered (enabled before the kitchen starts, otherwise disabled with the reason). */
  canEdit: boolean;
  onChanged: (o: ServiceRequest) => void;
  onRequestCancel: (o: ServiceRequest) => void;
  onRequestEdit: (o: ServiceRequest) => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const serving = useSingleFlight();
  const reasonId = useId();
  const canCancel = canManage && (order.status === 'DRAFT' || order.status === 'SENT');
  const showEdit = canEdit && showsEditButton(order);
  const lockReason = showEdit ? clientLockReason(order) : null;

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
    <article className={cn('nx-stub nx-glass rounded-panel', order.status === 'CANCELLED' && 'opacity-70')}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3.5 pb-3">
        <h3 className="flex items-baseline gap-2.5">
          <span className="font-display text-lg font-semibold">{t('restaurant.session.round', { n: order.roundNumber })}</span>
          {order.requestNumber && (
            <span className="ticket-no text-xs font-normal text-muted">{t('restaurant.session.ticketNumber', { number: order.requestNumber })}</span>
          )}
        </h3>
        <span className="flex flex-wrap items-center justify-end gap-2">
          {(order.editCount ?? 0) > 0 && (
            <span className="eyebrow rounded-full border border-warn/40 px-2 py-0.5 text-warn" title={t('restaurant.orderEdit.editedTimes', { count: order.editCount })}>
              {t('restaurant.orderEdit.edited')}
            </span>
          )}
          <OrderStatusPill status={order.status} />
        </span>
      </div>
      <div className="nx-tear" />
      <ul className="space-y-1.5 px-4 pt-3 pb-4">
        {order.lines
          .filter((l) => l.status !== 'CANCELLED')
          .map((line) => (
            <li key={line.id} className="text-base">
              <div className="flex items-baseline gap-2">
                <span className="tabular w-7 shrink-0 font-semibold">{line.quantity}×</span>
                <span className="min-w-0">
                  {line.itemNameSnapshot}
                  {line.editKind && (
                    <span className="eyebrow ml-2 text-warn">{line.editKind === 'ADDED' ? t('restaurant.orderEdit.lineAdded') : t('restaurant.orderEdit.lineChanged')}</span>
                  )}
                </span>
                <span aria-hidden className="mb-1 min-w-4 flex-1 border-b border-dotted border-muted/45" />
                <span className="tabular shrink-0 text-muted">{formatMinorUnits(line.unitPriceMinorUnits * line.quantity)}</span>
              </div>
              {line.notes && (
                <p className="ml-9 text-sm text-muted">
                  {t('restaurant.builder.notePrefix')} {line.notes}
                </p>
              )}
            </li>
          ))}
      </ul>
      {(canCancel || showEdit || (canManage && order.status === 'READY')) && (
        <div className="flex flex-wrap justify-end gap-2 px-4 pb-4">
          {showEdit && (
            <Button
              variant="secondary"
              className="min-h-11"
              disabled={lockReason !== null}
              aria-describedby={lockReason ? reasonId : undefined}
              aria-label={t('restaurant.orderEdit.buttonLabel', { round: t('restaurant.session.round', { n: order.roundNumber }) })}
              onClick={() => onRequestEdit(order)}
            >
              {t('restaurant.orderEdit.button')}
            </Button>
          )}
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
      {lockReason && (
        <p id={reasonId} className="px-4 pb-4 text-right text-sm text-muted">
          {t(`restaurant.orderEdit.lock.${lockReason}`)}
        </p>
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
  const [bill, setBill] = useState<BillPreview | null>(null);
  const [billError, setBillError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [showOrder, setShowOrder] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<ServiceRequest | null>(null);
  const [editTarget, setEditTarget] = useState<ServiceRequest | null>(null);
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

  const billSeq = useRef(0);
  const haveBill = useRef(false);
  const loadBill = useCallback(async () => {
    const id = ++billSeq.current;
    try {
      const data = await sessionApi.billPreview(sessionId);
      if (id !== billSeq.current) return;
      haveBill.current = true;
      setBill(data);
      setBillError('');
    } catch (err) {
      if (id !== billSeq.current) return;
      // A failed refresh keeps the last total on screen; the bill card stays hidden until we have one.
      if (!haveBill.current) setBillError(describeError(err, t, 'restaurant.errors.loadBill'));
    }
  }, [sessionId, t]);

  useEffect(() => {
    haveOrders.current = false;
    haveBill.current = false;
    void loadOrders();
    void loadBill();
  }, [loadOrders, loadBill]);

  // Live: tickets and checkout changes update both the order list and the running bill.
  useLiveRefresh(['orders', 'kitchen', 'invoices', 'payments'], loadOrders);
  useLiveRefresh(['orders', 'kitchen', 'invoices', 'payments'], loadBill);

  const replaceOrder = (updated: ServiceRequest) => {
    setOrders((prev) => (prev ? prev.map((o) => (o.id === updated.id ? updated : o)) : prev));
    void loadBill();
  };

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
            <BillShowActions
              session={session}
              tableCode={table.code}
              disabled={!hasBillable}
              onPaymentDone={(closeTable) => {
                void loadOrders();
                if (closeTable) setShowClose(true);
              }}
            />
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
            <OrderCard
              key={order.id}
              order={order}
              canManage={caps.canManageOrders}
              canEdit={caps.canEditOrders}
              onChanged={replaceOrder}
              onRequestCancel={(o) => setCancelTarget(o)}
              onRequestEdit={(o) => setEditTarget(o)}
            />
          ))}
        </div>

        {bill && bill.itemCount > 0 && (
          <section aria-labelledby="session-bill" className="mt-4 rounded-panel border border-line bg-white/[0.03] px-4 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h3 id="session-bill" className="eyebrow">
                {t('restaurant.session.bill.title')}
              </h3>
              <span className="text-sm text-muted">{t('restaurant.session.bill.items', { count: bill.itemCount })}</span>
            </div>
            <dl className="tabular mt-2 space-y-1 text-sm">
              <div className="flex justify-between text-muted">
                <dt>{t('restaurant.session.bill.subtotal')}</dt>
                <dd>{formatMinorUnits(bill.subtotalMinorUnits)}</dd>
              </div>
              <div className="flex justify-between text-muted">
                <dt>{t('restaurant.session.bill.tax')}</dt>
                <dd>{formatMinorUnits(bill.totalTaxMinorUnits)}</dd>
              </div>
              <div className="flex items-end justify-between gap-4 pt-1">
                <dt className="font-medium">{t('restaurant.session.bill.total')}</dt>
                <dd className="font-display text-xl font-semibold">{formatMinorUnits(bill.grandTotalMinorUnits)}</dd>
              </div>
            </dl>
            {bill.invoice && (
              <p className="mt-2 text-xs text-muted">
                {t('restaurant.session.bill.invoiceStatus', {
                  status: t(`restaurant.session.bill.status.${bill.invoice.status}`, { defaultValue: bill.invoice.status }),
                  amount: formatMinorUnits(bill.invoice.grandTotalMinorUnits),
                })}
              </p>
            )}
            {bill.invoice && bill.uninvoiced.itemCount > 0 && (
              <p className="mt-1 text-xs font-medium text-warn">
                {t('restaurant.session.bill.uninvoiced', { amount: formatMinorUnits(bill.uninvoiced.grandTotalMinorUnits) })}
              </p>
            )}
          </section>
        )}
        {billError && <p className="mt-2 text-sm text-muted">{billError}</p>}

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
            void loadBill();
            setShowOrder(false);
            toast.show(t('restaurant.builder.sentToast'));
          }}
          onCancel={() => setShowOrder(false)}
        />
      )}

      {editTarget && (
        <OrderEditDialog
          order={editTarget}
          tableCode={table.code}
          categories={categories}
          items={items}
          onSaved={(saved) => {
            replaceOrder(saved);
            setEditTarget(null);
            void loadOrders();
          }}
          onClose={() => {
            setEditTarget(null);
            void loadOrders();
          }}
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
        {hasBillable && (bill?.invoice?.status !== 'PAID' || (bill?.uninvoiced.itemCount ?? 0) > 0) && (
          <p role="alert" className="mt-3 text-sm font-medium text-warn">
            {t('restaurant.session.closeUnpaidWarning')}
          </p>
        )}
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
