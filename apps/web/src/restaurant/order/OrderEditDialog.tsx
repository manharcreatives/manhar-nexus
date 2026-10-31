import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { LedgerFigure } from '../../ui/LedgerFigure';
import { Skeleton } from '../../ui/states';
import { useToast } from '../../ui/Toast';
import { useLiveRefresh } from '../../realtime/RealtimeProvider';
import { type CatalogCategory, type CatalogItem, type ServiceRequest, formatMinorUnits, orderApi } from '../api';
import { buildLine, itemGroups } from '../cart';
import { describeError } from '../errors';
import { useSingleFlight } from '../hooks';
import { ItemConfigDialog } from '../ItemConfigDialog';
import {
  type DraftLine,
  type EditDraft,
  addCartLine,
  adjustQuantity,
  changeCount,
  draftTotal,
  draftUnits,
  fromOrder,
  fromServerLine,
  hasChanges,
  noteForSave,
  qtyForItem,
  rebase,
  removeLine,
  restoreLine,
  setNote,
  setOrderNote,
  signature,
  toOps,
  wouldEmpty,
} from './editDraft';
import { type EditableState, type EditedOrder, errorCode, orderEditApi } from './orderEditApi';
import { MenuPane } from './MenuPane';
import { OrderPane, type PaneLine } from './OrderPane';
import { OrderZones, type ZoneView } from './OrderZones';
import { useModifierGroups } from './useModifierGroups';

type Phase = 'loading' | 'ready' | 'locked' | 'error';
type Notice = { kind: 'conflict' | 'live' | 'lockedMidEdit'; dropped: number };
type LoadMode = 'initial' | 'live' | 'conflict' | 'locked';

function toPaneLine(l: DraftLine, t: (k: string) => string): PaneLine {
  return {
    id: l.id,
    name: l.itemName,
    detail: l.detail,
    note: l.note,
    quantity: l.quantity,
    unitMinor: l.unitPriceMinorUnits,
    chip: l.chip,
    removed: l.removed,
    ...(l.editKind ? { tag: l.editKind === 'ADDED' ? t('restaurant.orderEdit.lineAdded') : t('restaurant.orderEdit.lineChanged') } : {}),
  };
}

/**
 * Edit an order before the kitchen starts it (update round 2, A2). Add / remove / change quantity / notes, saved as
 * one append-only, audited edit:
 *  - idempotency: one key per distinct edit; a retry after a dropped connection reuses it, so it can never apply twice;
 *  - optimistic concurrency: the order `version` the screen was built from travels with the save;
 *  - 409 VERSION_CONFLICT: the latest order is reloaded and the user's changes are kept where they still apply;
 *  - 409 ORDER_EDIT_LOCKED (the kitchen got there first): the dialog switches to a read-only view with the reason;
 *  - realtime: while open it follows the order live (SSE topics orders + kitchen, 15 s safety poll).
 */
export function OrderEditDialog({
  order,
  tableCode,
  categories,
  items,
  onSaved,
  onClose,
}: {
  order: ServiceRequest;
  tableCode: string;
  categories: CatalogCategory[];
  items: CatalogItem[];
  onSaved: (order: ServiceRequest) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const saver = useSingleFlight();
  const { groupsById, groupsState } = useModifierGroups(items);

  const [phase, setPhase] = useState<Phase>('loading');
  const [base, setBase] = useState<ServiceRequest | null>(null);
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const [lock, setLock] = useState<EditableState | null>(null);
  const [history, setHistory] = useState(0);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [error, setError] = useState('');
  const [reason, setReason] = useState('');
  const [view, setView] = useState<ZoneView>('menu');
  const [configItem, setConfigItem] = useState<CatalogItem | null>(null);

  // Latest values for async callbacks (a live refresh must see what the user typed a moment ago).
  const baseRef = useRef<ServiceRequest | null>(null);
  const draftRef = useRef<EditDraft | null>(null);
  const loadSeq = useRef(0);
  const attempt = useRef<{ sig: string; key: string } | null>(null);

  const commitDraft = useCallback((next: EditDraft | null) => {
    draftRef.current = next;
    setDraft(next);
  }, []);
  const update = (f: (d: EditDraft) => EditDraft) => {
    if (!draftRef.current) return;
    setError('');
    commitDraft(f(draftRef.current));
  };

  const load = useCallback(
    async (mode: LoadMode) => {
      const seq = ++loadSeq.current;
      try {
        const [fresh, st] = await Promise.all([orderApi.get(order.id), orderEditApi.state(order.id)]);
        if (seq !== loadSeq.current) return; // a newer load wins
        setHistory(st.edits.length);
        const prevBase = baseRef.current;
        const prevDraft = draftRef.current;
        baseRef.current = fresh;
        setBase(fresh);

        if (!st.editable.allowed) {
          setLock(st.editable);
          setPhase('locked');
          if (prevDraft && hasChanges(prevDraft)) setNotice({ kind: 'lockedMidEdit', dropped: 0 });
          return;
        }
        setLock(null);
        setPhase('ready');
        if (mode === 'locked') setError(t('restaurant.orderEdit.notice.lockedMidEdit'));

        if (!prevBase || !prevDraft) {
          commitDraft(fromOrder(fresh));
          return;
        }
        if (fresh.version === prevBase.version && fresh.status === prevBase.status) return; // nothing new
        if (!hasChanges(prevDraft)) {
          commitDraft(fromOrder(fresh));
          if (mode !== 'initial') setNotice({ kind: 'live', dropped: 0 });
          return;
        }
        const r = rebase(prevDraft, fresh);
        commitDraft(r.draft);
        setNotice({ kind: mode === 'conflict' ? 'conflict' : 'live', dropped: r.dropped });
      } catch (err) {
        if (seq !== loadSeq.current) return;
        if (mode === 'initial' || !baseRef.current) {
          setError(describeError(err, t, 'restaurant.orderEdit.errors.refresh'));
          setPhase('error');
        } else {
          setError(t('restaurant.orderEdit.errors.refresh'));
        }
      }
    },
    [order.id, t, commitDraft],
  );

  useEffect(() => {
    void load('initial');
    return () => {
      loadSeq.current += 1; // ignore a response that lands after unmount
    };
  }, [load]);

  // Follow the order live while editing; never while a save is in flight.
  const saving = useRef(false);
  useLiveRefresh(['orders', 'kitchen'], () => (saving.current || phase === 'loading' ? undefined : load('live')), phase === 'ready' || phase === 'locked');

  async function save() {
    const d = draftRef.current;
    const b = baseRef.current;
    if (!d || !b || !hasChanges(d) || wouldEmpty(d)) return;
    const version = b.version ?? 1;
    const sig = signature(version, d, reason);
    if (attempt.current?.sig !== sig) attempt.current = { sig, key: crypto.randomUUID() };
    const key = attempt.current.key;
    const notes = noteForSave(d);
    const why = reason.trim();
    setError('');
    saving.current = true;
    await saver.run(async () => {
      try {
        const saved: EditedOrder = await orderEditApi.edit(b.id, {
          idempotencyKey: key,
          expectedVersion: version,
          ...(why ? { reason: why } : {}),
          ...(notes !== undefined ? { notes } : {}),
          ops: toOps(d),
        });
        toast.show(saved.edit.replayed ? t('restaurant.orderEdit.replayedToast') : t('restaurant.orderEdit.savedToast'));
        onSaved(saved);
      } catch (err) {
        await onSaveError(err);
      } finally {
        saving.current = false;
      }
    });
  }

  async function onSaveError(err: unknown) {
    const code = errorCode(err);
    if (code === 'VERSION_CONFLICT') {
      attempt.current = null; // the version moved: this is a new edit against a new base
      await load('conflict');
      return;
    }
    if (code === 'ORDER_EDIT_LOCKED') {
      attempt.current = null;
      await load('locked');
      return;
    }
    if (code === 'CONFLICT') {
      attempt.current = null;
      setError(t('restaurant.orderEdit.errors.keyReused'));
      return;
    }
    // Network drops and 5xx keep the attempt (same key) so pressing Save again cannot apply it twice.
    setError(describeError(err, t, 'restaurant.orderEdit.errors.save'));
  }

  const round = t('restaurant.session.round', { n: order.roundNumber });
  const title = t('restaurant.orderEdit.title', { round, code: tableCode });
  const lockText = lock?.reason ? t(`restaurant.orderEdit.lock.${lock.reason}`, { defaultValue: lock.message ?? '' }) : t('restaurant.orderEdit.lock.unknown');

  // ── Locked / error / loading bodies ──────────────────────────────────────────
  if (phase !== 'ready' || !draft || !base) {
    const readOnlyLines: PaneLine[] = base?.lines.filter((l) => l.status !== 'CANCELLED').map((l) => toPaneLine(fromServerLine(base, l), t)) ?? [];
    return (
      <Dialog
        open
        onClose={onClose}
        title={title}
        footer={
          <Button variant="secondary" size="lg" data-autofocus onClick={onClose}>
            {t('restaurant.orderEdit.close')}
          </Button>
        }
      >
        {phase === 'loading' && (
          <div role="status" aria-label={t('restaurant.orderEdit.loading')} className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        )}
        {phase === 'error' && (
          <div role="alert" className="rounded-panel border border-bad/30 bg-bad-soft px-5 py-6 text-center">
            <h3 className="text-lg font-semibold text-bad">{t('restaurant.orderEdit.loadErrorTitle')}</h3>
            <p className="mt-1 text-sm">{error}</p>
            <Button variant="secondary" className="mt-4" onClick={() => void load('initial')}>
              {t('restaurant.common.retry')}
            </Button>
          </div>
        )}
        {phase === 'locked' && (
          <>
            <div role="alert" className="mb-4 rounded-panel border border-warn/40 bg-warn-soft px-4 py-3">
              <h3 className="text-base font-semibold text-warn">{t('restaurant.orderEdit.lock.heading')}</h3>
              <p className="mt-1 text-sm text-ink">{lockText}</p>
              {notice?.kind === 'lockedMidEdit' && <p className="mt-2 text-sm text-ink">{t('restaurant.orderEdit.notice.lockedMidEdit')}</p>}
            </div>
            <div className="flex h-[min(46dvh,26rem)] flex-col">
              <OrderPane lines={readOnlyLines} locked readOnly onAdjust={noop} onRemove={noop} onNote={noop} />
            </div>
          </>
        )}
      </Dialog>
    );
  }

  // ── Ready ────────────────────────────────────────────────────────────────────
  const total = draftTotal(draft);
  const wasTotal = base.lines.filter((l) => l.status !== 'CANCELLED').reduce((s, l) => s + l.unitPriceMinorUnits * l.quantity, 0);
  const changes = changeCount(draft);
  const empty = wouldEmpty(draft);
  const dirty = hasChanges(draft);
  const lines = draft.lines.map((l) => toPaneLine(l, t));

  return (
    <Dialog
      open
      onClose={onClose}
      title={title}
      className="w-[min(72rem,calc(100vw-1rem))]!"
      footer={
        <>
          <div className="mr-auto" aria-live="polite">
            <span className="eyebrow block">{changes > 0 ? t('restaurant.orderEdit.changes', { count: changes }) : t('restaurant.orderEdit.noChanges')}</span>
            <span className="flex items-baseline gap-2">
              <LedgerFigure minor={total} className="mt-1 text-[1.75rem]" />
              {total !== wasTotal && <span className="tabular text-sm text-muted">{t('restaurant.orderEdit.totalWas', { amount: formatMinorUnits(wasTotal) })}</span>}
            </span>
          </div>
          <Button variant="secondary" size="lg" onClick={onClose} disabled={saver.busy}>
            {dirty ? t('restaurant.orderEdit.cancel') : t('restaurant.orderEdit.close')}
          </Button>
          <Button size="lg" loading={saver.busy} disabled={!dirty || empty} onClick={() => void save()}>
            {saver.busy ? t('restaurant.orderEdit.saving') : t('restaurant.orderEdit.save')}
          </Button>
        </>
      }
    >
      <p className="-mt-2 mb-3 text-sm text-muted">
        {t(base.status === 'DRAFT' ? 'restaurant.orderEdit.intro.DRAFT' : 'restaurant.orderEdit.intro.SENT')}
        {history > 0 && <> {t('restaurant.orderEdit.history', { count: history })}</>}
      </p>

      <OrderZones
        count={draftUnits(draft)}
        view={view}
        onView={setView}
        menu={
          <MenuPane
            categories={categories}
            items={items}
            qtyFor={(id) => qtyForItem(draft, id)}
            locked={saver.busy}
            groupsState={groupsState}
            onAddPlain={(item) => update((d) => addCartLine(d, buildLine(item, [], { variantId: null, options: {} }, '', 1)))}
            onConfigure={setConfigItem}
          />
        }
        order={
          <OrderPane
            lines={lines}
            locked={saver.busy}
            onAdjust={(id, delta) => update((d) => adjustQuantity(d, id, delta))}
            onRemove={(id) => update((d) => removeLine(d, id))}
            onRestore={(id) => update((d) => restoreLine(d, id, base))}
            onNote={(id, note) => update((d) => setNote(d, id, note))}
            notice={
              notice ? (
                <div role="alert" className="border-b border-warn/30 bg-warn-soft px-4 py-2.5 text-sm text-ink">
                  <p>{notice.kind === 'conflict' ? t('restaurant.orderEdit.notice.conflict') : t('restaurant.orderEdit.notice.live')}</p>
                  {notice.dropped > 0 && <p className="mt-1">{t('restaurant.orderEdit.notice.dropped', { count: notice.dropped })}</p>}
                </div>
              ) : undefined
            }
            footer={
              <details className="border-t border-line px-3" open={draft.orderNote !== '' || undefined}>
                <summary className="flex min-h-12 cursor-pointer items-center text-sm font-medium text-muted hover:text-ink">{t('restaurant.orderEdit.details')}</summary>
                <div className="space-y-3 pb-3">
                  <label className="block text-sm font-medium">
                    {t('restaurant.orderEdit.orderNote')}
                    <input
                      type="text"
                      maxLength={500}
                      value={draft.orderNote}
                      placeholder={t('restaurant.orderEdit.orderNotePlaceholder')}
                      onChange={(e) => update((d) => setOrderNote(d, e.target.value))}
                      className="mt-1 min-h-12 w-full rounded-control border border-line bg-surface px-3 text-base font-normal"
                    />
                  </label>
                  <label className="block text-sm font-medium">
                    {t('restaurant.orderEdit.reason')}
                    <input
                      type="text"
                      maxLength={300}
                      value={reason}
                      placeholder={t('restaurant.orderEdit.reasonPlaceholder')}
                      onChange={(e) => setReason(e.target.value)}
                      className="mt-1 min-h-12 w-full rounded-control border border-line bg-surface px-3 text-base font-normal"
                    />
                  </label>
                </div>
              </details>
            }
          />
        }
      />

      {empty && (
        <p role="status" className="mt-3 text-sm text-warn">
          {t('restaurant.orderEdit.emptyBlocked')}
        </p>
      )}
      <p role="alert" className="mt-3 min-h-5 text-sm text-bad">
        {error}
      </p>

      {configItem && (
        <ItemConfigDialog
          item={configItem}
          groups={itemGroups(configItem, groupsById)}
          onClose={() => setConfigItem(null)}
          onAdd={(line) => {
            update((d) => addCartLine(d, line));
            setConfigItem(null);
          }}
        />
      )}
    </Dialog>
  );
}

function noop() {
  /* read-only list: no controls call these */
}
