import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LiveBadge } from '../realtime/LiveBadge';
import { useNow } from '../restaurant/hooks';
import { formatMoney } from '../lib/money';
import { Button } from '../ui/Button';
import { PageHeader } from '../ui/PageHeader';
import { SectionHeader } from '../ui/SectionHeader';
import { EmptyState, ErrorState, Skeleton } from '../ui/states';
import { useToast } from '../ui/Toast';
import { newIdempotencyKey, qrApi } from './api';
import { describeQrError, isGone, isOrderConflict, isOrderingLocked } from './errors';
import { EditOrderDialog } from './EditOrderDialog';
import { GuestOrderCard } from './GuestOrderCard';
import { useGuestOrders } from './GuestOrderProvider';
import * as Icons from './icons';
import { RejectDialog } from './RejectDialog';
import { formatWaiting, waitingMinutes } from './time';
import type { GuestOrder, GuestOrderEdit, WaiterAlert } from './types';

function CallRow({ call, now, busy, onDone }: { call: WaiterAlert; now: number; busy: boolean; onDone: (c: WaiterAlert) => void }) {
  const { t } = useTranslation();
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-control border border-warn/30 bg-warn-soft px-4 py-3">
      <Icons.BellRing className="size-5 shrink-0 text-warn" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">
          <span className="font-display text-base">{call.tableCode}</span> · {t(`qr.alerts.reason.${call.reason}`)}
        </p>
        <p className="tabular text-xs text-muted">{t('qr.orders.waiting', { time: formatWaiting(waitingMinutes(call.at, now), t) })}</p>
      </div>
      <Button variant="secondary" loading={busy} onClick={() => onDone(call)} aria-label={t('qr.alerts.doneAria', { table: call.tableCode })}>
        <Icons.Check className="size-4" aria-hidden />
        {t('qr.alerts.done')}
      </Button>
    </li>
  );
}

export function GuestOrdersPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const g = useGuestOrders();
  const now = useNow(30_000);
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const inFlight = useRef(new Set<string>());
  // Confirm and reject are idempotent on the server (a replay answers the same row). Edit is not a pure replay, so it
  // gets one Idempotency-Key per order until it succeeds, and an order whose edit already went through is not edited twice
  // when the accept that followed it has to be retried.
  const keys = useRef(new Map<string, string>());
  const edited = useRef(new Set<string>());
  const [rejecting, setRejecting] = useState<GuestOrder | null>(null);
  const [editing, setEditing] = useState<GuestOrder | null>(null);

  const mark = useCallback((id: string, on: boolean) => {
    if (on) inFlight.current.add(id);
    else inFlight.current.delete(id);
    setBusy(new Set(inFlight.current));
  }, []);
  const keyFor = useCallback((id: string, action: string) => {
    const k = `${id}:${action}`;
    let v = keys.current.get(k);
    if (!v) {
      v = newIdempotencyKey();
      keys.current.set(k, v);
    }
    return v;
  }, []);

  /** Shared failure handling: someone else may have handled the order already. */
  const fail = useCallback(
    (err: unknown, contextKey: string) => {
      if (isOrderingLocked(err)) {
        // A bill was generated for the table: this order can no longer be added to it.
        toast.show(t('qr.orders.billExists'), 'bad');
        g.refresh();
      } else if (isOrderConflict(err) || isGone(err)) {
        toast.show(t('qr.orders.alreadyHandled'), 'bad');
        g.refresh();
      } else {
        toast.show(describeQrError(err, t, contextKey), 'bad');
      }
    },
    [g, t, toast],
  );

  const accept = useCallback(
    async (o: GuestOrder) => {
      if (inFlight.current.has(o.id)) return;
      mark(o.id, true);
      try {
        await qrApi.confirm(o.id);
        g.dropOrder(o.id);
        toast.show(t('qr.orders.accepted', { table: o.tableCode }));
        g.refresh();
      } catch (err) {
        fail(err, 'qr.orders.acceptFailed');
      } finally {
        mark(o.id, false);
      }
    },
    [fail, g, mark, t, toast],
  );

  const reject = useCallback(
    async (o: GuestOrder, reason: string) => {
      if (inFlight.current.has(o.id)) return;
      mark(o.id, true);
      try {
        await qrApi.reject(o.id, reason);
        g.dropOrder(o.id);
        setRejecting(null);
        toast.show(t('qr.orders.rejected', { table: o.tableCode }));
        g.refresh();
      } catch (err) {
        if (isOrderConflict(err) || isGone(err)) setRejecting(null);
        fail(err, 'qr.orders.rejectFailed');
      } finally {
        mark(o.id, false);
      }
    },
    [fail, g, mark, t, toast],
  );

  const saveAndAccept = useCallback(
    async (o: GuestOrder, edit: GuestOrderEdit | null) => {
      if (inFlight.current.has(o.id)) return;
      mark(o.id, true);
      let step: 'edit' | 'accept' = 'edit';
      try {
        if (edit && !edited.current.has(o.id)) {
          await qrApi.edit(o.id, edit, keyFor(o.id, 'edit'));
          edited.current.add(o.id);
          keys.current.delete(`${o.id}:edit`);
        }
        step = 'accept';
        await qrApi.confirm(o.id);
        edited.current.delete(o.id);
        g.dropOrder(o.id);
        setEditing(null);
        toast.show(t('qr.orders.accepted', { table: o.tableCode }));
        g.refresh();
      } catch (err) {
        const status = (err as { status?: number } | null)?.status;
        if (isOrderConflict(err) || isGone(err)) setEditing(null);
        // A server answer (not a dropped connection) to the edit means the order is not what this dialog was built from
        // (someone edited it, or the first try was applied and its reply was lost): reload it rather than guess.
        if (step === 'edit' && status !== undefined && !isOrderConflict(err) && !isGone(err)) {
          keys.current.delete(`${o.id}:edit`);
          setEditing(null);
          toast.show(t('qr.orders.changedMeanwhile'), 'bad');
          g.refresh();
        } else {
          fail(err, 'qr.orders.editFailed');
        }
      } finally {
        mark(o.id, false);
      }
    },
    [fail, g, keyFor, mark, t, toast],
  );

  const ackCall = useCallback(
    async (c: WaiterAlert) => {
      const id = `call:${c.tableId}`;
      if (inFlight.current.has(id)) return;
      mark(id, true);
      try {
        await qrApi.ackAlert(c.tableId);
        g.dropCall(c.tableId);
      } catch (err) {
        toast.show(describeQrError(err, t, 'qr.alerts.ackFailed'), 'bad');
      } finally {
        mark(id, false);
      }
    },
    [g, mark, t, toast],
  );

  const sound = g.sound;
  const header = (
    <PageHeader
      title={t('qr.orders.title')}
      description={t('qr.orders.description')}
      actions={
        <>
          <LiveBadge />
          <Button
            variant="secondary"
            size="lg"
            aria-pressed={sound.on}
            onClick={() => sound.setOn(!sound.on)}
            aria-label={sound.on ? t('qr.sound.muteAria') : t('qr.sound.unmuteAria')}
          >
            {sound.on ? <Icons.Volume2 className="size-4" aria-hidden /> : <Icons.VolumeX className="size-4" aria-hidden />}
            {sound.on ? t('qr.sound.on') : t('qr.sound.off')}
          </Button>
        </>
      }
    />
  );

  if (!g.loaded && !g.failed) {
    return (
      <div>
        {header}
        <div role="status" aria-label={t('qr.common.loading')} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }
  if (!g.loaded) {
    return (
      <div>
        {header}
        <ErrorState title={t('qr.orders.loadError')} body={t('qr.errors.network')} onRetry={g.refresh} retryLabel={t('qr.common.retry')} />
      </div>
    );
  }

  return (
    <div>
      {header}
      {g.failed && <p role="alert" className="mb-4 rounded-control bg-warn-soft px-4 py-3 text-sm text-warn">{t('qr.orders.stale')}</p>}
      {sound.on && !sound.unlocked && (
        <div role="status" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-panel border border-white/10 bg-white/[0.03] px-4 py-3 text-sm">
          <span className="flex items-center gap-2 text-muted">
            <Icons.VolumeX className="size-4 shrink-0" aria-hidden />
            {t('qr.sound.locked')}
          </span>
          <Button variant="secondary" onClick={sound.test}>
            <Icons.Volume2 className="size-4" aria-hidden />
            {t('qr.sound.enable')}
          </Button>
        </div>
      )}

      {g.calls.length > 0 && (
        <section aria-labelledby="qr-calls" className="mb-8">
          <SectionHeader id="qr-calls" title={t('qr.alerts.title')} size="sm" className="mb-3" action={<span className="tabular text-sm text-muted">{g.calls.length}</span>} />
          <ul className="grid gap-3 md:grid-cols-2">
            {g.calls.map((c) => (
              <CallRow key={`${c.tableId}|${c.at}`} call={c} now={now} busy={busy.has(`call:${c.tableId}`)} onDone={(x) => void ackCall(x)} />
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="qr-awaiting">
        <SectionHeader
          id="qr-awaiting"
          title={t('qr.orders.awaiting')}
          size="sm"
          className="mb-4"
          action={
            g.orders.length > 0 ? (
              <span className="tabular text-sm text-muted">
                {t('qr.orders.count', { count: g.orders.length })} · {formatMoney(g.orders.reduce((s, o) => s + o.totalMinor, 0))}
              </span>
            ) : undefined
          }
        />
        {g.orders.length === 0 ? (
          <EmptyState title={t('qr.orders.emptyTitle')} body={t('qr.orders.emptyBody')} />
        ) : (
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {g.orders.map((o) => (
              <li key={o.id} className="min-w-0">
                <GuestOrderCard order={o} now={now} busy={busy.has(o.id)} onAccept={(x) => void accept(x)} onEdit={setEditing} onReject={setRejecting} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {rejecting && <RejectDialog order={rejecting} busy={busy.has(rejecting.id)} onConfirm={(reason) => void reject(rejecting, reason)} onClose={() => setRejecting(null)} />}
      {editing && <EditOrderDialog order={editing} busy={busy.has(editing.id)} onSave={(edit) => void saveAndAccept(editing, edit)} onClose={() => setEditing(null)} />}
    </div>
  );
}

export default GuestOrdersPage;
