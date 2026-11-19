import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorMessage, formatDate, formatDateTime, matchesQuery, relativeAge } from '../commercial/helpers';
import { SearchBox } from '../commercial/SearchBox';
import { ListSkeleton } from '../commercial/Shared';
import { MoreItem, MoreMenu } from './MoreMenu';
import { AcceptMismatchDialog } from './AcceptMismatchDialog';
import { AttentionStrip } from './AttentionStrip';
import { ConfirmDialog } from './ConfirmDialog';
import { EditContactDialog } from './EditContactDialog';
import { ManualPaymentDialog } from './ManualPaymentDialog';
import { ClaimLinkButtons } from './ClaimLinkButtons';
import { CreateAccountDialog } from './CreateAccountDialog';
import { AutopayDialog } from './AutopayDialog';
import { PaymentLinkDialog } from './PaymentLinkDialog';
import { Button } from '../ui/Button';
import { PageHeader } from '../ui/PageHeader';
import { StatusPill } from '../ui/StatusPill';
import { Tabs } from '../ui/Tabs';
import { EmptyState, ErrorState } from '../ui/states';
import { useToast } from '../ui/Toast';
import {
  NEXT_STATUSES,
  duplicateCount,
  formatRupees,
  isOpenLink,
  isPaid,
  paymentMessage,
  planName,
  refreshPaymentLink,
  splitOfferCode,
  listRegistrations,
  updateRegistration,
  whatsappUrl,
  type PaymentLink,
  type PaymentStatus,
  type RegistrationRequest,
  type RegistrationStatus,
} from './api';

type Filter = 'open' | 'CONVERTED' | 'REJECTED' | 'SPAM';
/** "Open" = everything still waiting on a person: NEW, CONTACTED, QUALIFIED. */
const OPEN: readonly RegistrationStatus[] = ['NEW', 'CONTACTED', 'QUALIFIED'];

const TONE: Record<RegistrationStatus, 'info' | 'warn' | 'accent' | 'ok' | 'bad' | 'neutral'> = {
  NEW: 'info',
  CONTACTED: 'warn',
  QUALIFIED: 'accent',
  CONVERTED: 'ok',
  REJECTED: 'bad',
  SPAM: 'neutral',
};

const PAYMENT_TONE: Record<PaymentStatus, 'info' | 'ok' | 'neutral' | 'bad' | 'warn'> = {
  CREATED: 'info',
  PAID: 'ok',
  EXPIRED: 'neutral',
  CANCELLED: 'neutral',
  AMOUNT_MISMATCH: 'bad',
};

/**
 * How urgently a request needs a person: 0 = money arrived, no account yet; 1 = a wrong amount was paid;
 * 2 = a new request nobody has touched; 3 = everything else that is still open.
 */
export function priorityOf(r: RegistrationRequest): 0 | 1 | 2 | 3 {
  if (r.status !== 'CONVERTED' && isPaid(r)) return 0;
  if (r.payments.some((p) => p.status === 'AMOUNT_MISMATCH')) return 1;
  if (r.status === 'NEW') return 2;
  return 3;
}

const BAR: Record<0 | 1 | 2 | 3, string | null> = { 0: 'bg-accent', 1: 'bg-bad', 2: 'bg-info', 3: null };
const DAY_MS = 86_400_000;

/** Landing-page requests: the platform admin reads the details and creates the restaurant account in one click. */
export function RegistrationsPage({ onOpenOnboarding }: { onOpenOnboarding?: (businessId: string) => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  // A link from the Clients page (#reg-<id>) points at an account that already exists, so start on the converted tab.
  const [filter, setFilter] = useState<Filter>(() => (window.location.hash.startsWith('#reg-') ? 'CONVERTED' : 'open'));
  const [attentionKey, setAttentionKey] = useState(0);
  const pendingAction = useRef<{ kind: 'create' | 'accept' | 'view'; id: string } | null>(null);
  const [query, setQuery] = useState('');
  const [counts, setCounts] = useState<Record<Filter, number> | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [items, setItems] = useState<RegistrationRequest[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState<RegistrationRequest | null>(null);
  const [charging, setCharging] = useState<RegistrationRequest | null>(null);
  const [autopay, setAutopay] = useState<RegistrationRequest | null>(null);
  const [editing, setEditing] = useState<RegistrationRequest | null>(null);
  const [recording, setRecording] = useState<RegistrationRequest | null>(null);
  const [accepting, setAccepting] = useState<{ request: RegistrationRequest; payment: PaymentLink } | null>(null);
  const [confirmMove, setConfirmMove] = useState<{ r: RegistrationRequest; status: RegistrationStatus } | null>(null);
  const [undo, setUndo] = useState<{ id: string; to: RegistrationStatus; name: string } | null>(null);

  /** The attention strip re-checks after anything that can change what needs a person (every dialog close, every payment action). */
  const bump = useCallback(() => setAttentionKey((k) => k + 1), []);

  const load = useCallback(async () => {
    setLoadFailed(false);
    setItems(null);
    try {
      if (filter === 'open') {
        const pages = await Promise.all(OPEN.map((status) => listRegistrations({ status })));
        const all = pages.flatMap((p) => p.items);
        // Triage order: money waiting on an account first, then wrong amounts, then new requests, longest waiting first.
        all.sort((a, b) => priorityOf(a) - priorityOf(b) || a.createdAt.localeCompare(b.createdAt));
        setItems(all);
      } else {
        setItems((await listRegistrations({ status: filter })).items);
      }
    } catch {
      setLoadFailed(true);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  // Tab counts: how many requests wait in each tab, refreshed whenever something that can change them happens.
  useEffect(() => {
    let live = true;
    const statuses: RegistrationStatus[] = [...OPEN, 'CONVERTED', 'REJECTED', 'SPAM'];
    void Promise.all(statuses.map((status) => listRegistrations({ status, take: 1 }).then((p) => p.total)))
      .then((n) => {
        if (live) setCounts({ open: (n[0] ?? 0) + (n[1] ?? 0) + (n[2] ?? 0), CONVERTED: n[3] ?? 0, REJECTED: n[4] ?? 0, SPAM: n[5] ?? 0 });
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [attentionKey]);

  // After a list load: open the dialog the attention strip asked for, or scroll to the request it points at.
  useEffect(() => {
    if (!items) return;
    const wanted = pendingAction.current;
    if (wanted) {
      const hit = items.find((r) => r.id === wanted.id);
      if (hit) {
        pendingAction.current = null;
        if (wanted.kind === 'create') setCreating(hit);
        else if (wanted.kind === 'accept') openAccept(hit);
        else flashRequest(hit.id);
      }
    }
    const target = window.location.hash.startsWith('#reg-') ? document.getElementById(window.location.hash.slice(1)) : null;
    target?.scrollIntoView?.({ block: 'center' });
  }, [items]);

  function openAccept(r: RegistrationRequest) {
    const payment = r.payments.find((p) => p.status === 'AMOUNT_MISMATCH');
    if (payment) setAccepting({ request: r, payment });
    else toast.show(t('registrations.accept.notFound'));
  }

  /** Scroll to a request card and ring it for a moment, so "View" in the strip lands somewhere obvious. */
  function flashRequest(id: string) {
    setQuery('');
    setFlashId(id);
    window.setTimeout(() => {
      document.getElementById(`reg-${id}`)?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    }, 50);
    window.setTimeout(() => setFlashId((cur) => (cur === id ? null : cur)), 3000);
  }

  function fromAttention(kind: 'create' | 'accept' | 'view', registrationId: string) {
    const hit = items?.find((r) => r.id === registrationId);
    if (hit) {
      if (kind === 'create') return setCreating(hit);
      if (kind === 'accept') return openAccept(hit);
      return flashRequest(hit.id);
    }
    pendingAction.current = { kind, id: registrationId };
    if (filter === 'open') void load();
    else setFilter('open');
  }

  async function move(r: RegistrationRequest, status: RegistrationStatus) {
    setBusyId(r.id);
    try {
      await updateRegistration(r.id, { status });
      toast.show(t('registrations.moved', { status: t(`registrations.status.${status}`) }));
      // Undo goes back to where it was when the API allows it from the new status, otherwise to New.
      setUndo({ id: r.id, to: NEXT_STATUSES[status].includes(r.status) ? r.status : 'NEW', name: r.restaurantName });
      bump();
      await load();
    } catch (err) {
      toast.show(errorMessage(err, t('registrations.errors.update')));
    } finally {
      setBusyId(null);
    }
  }

  async function undoMove() {
    if (!undo) return;
    const u = undo;
    setUndo(null);
    try {
      await updateRegistration(u.id, { status: u.to });
      toast.show(t('registrations.moved', { status: t(`registrations.status.${u.to}`) }));
      bump();
      await load();
    } catch (err) {
      toast.show(errorMessage(err, t('registrations.errors.update')));
    }
  }

  /** "Check payment": ask Cashfree directly, for when the webhook is late or could not reach us. */
  async function checkPayment(r: RegistrationRequest, paymentId: string) {
    setBusyId(r.id);
    try {
      const { outcome, payment } = await refreshPaymentLink(r.id, paymentId);
      const key = outcome === 'updated' && payment.status === 'PAID' ? 'paid' : outcome;
      toast.show(t(`registrations.payment.checked.${key}`));
      bump();
      await load();
    } catch (err) {
      const e = err as { status?: number; message?: string } | null;
      toast.show(e && (e.status === 502 || e.status === 503) && e.message ? e.message : t('registrations.payment.checkFailed'));
    } finally {
      setBusyId(null);
    }
  }

  /** The server created the workspace and marked the request converted in its last step. */
  function onAccountCreated(r: RegistrationRequest) {
    toast.show(t('registrations.converted', { name: r.restaurantName }));
    bump();
    void load();
  }

  const tabLabel = (key: Filter) => (counts ? `${t(`registrations.filter.${key}`)} · ${counts[key]}` : t(`registrations.filter.${key}`));
  const visible = (items ?? []).filter((r) =>
    matchesQuery(query, [r.restaurantName, r.contactName, r.email, r.phone, r.referenceCode, r.city, r.planKey]),
  );
  const now = Date.now();

  const canCreate = (r: RegistrationRequest) => r.status !== 'CONVERTED' && r.status !== 'SPAM';
  /** A payment link makes sense for a live lead that has not paid yet. */
  const canCharge = (r: RegistrationRequest) => ['NEW', 'CONTACTED', 'QUALIFIED'].includes(r.status) && !isPaid(r);

  return (
    <div>
      <PageHeader title={t('registrations.title')} description={t('registrations.subtitle')} />

      <Tabs
        label={t('registrations.filterLabel')}
        active={filter}
        onChange={(k) => setFilter(k as Filter)}
        items={[
          { key: 'open', label: tabLabel('open') },
          { key: 'CONVERTED', label: tabLabel('CONVERTED') },
          { key: 'REJECTED', label: tabLabel('REJECTED') },
          { key: 'SPAM', label: tabLabel('SPAM') },
        ]}
      />

      <AttentionStrip
        onCreate={(id) => fromAttention('create', id)}
        onRetry={(id) => fromAttention('create', id)}
        onAccept={(id) => fromAttention('accept', id)}
        onView={(id) => fromAttention('view', id)}
        refreshKey={attentionKey}
      />

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <SearchBox
          value={query}
          onChange={setQuery}
          label={t('registrations.search.label')}
          placeholder={t('registrations.search.placeholder')}
          clearLabel={t('registrations.search.clear')}
        />
        {filter === 'open' && items && items.length > 1 ? <p className="text-xs text-muted">{t('registrations.sortNote')}</p> : null}
      </div>

      {undo ? (
        <div role="status" className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-control border border-white/10 bg-white/[0.05] px-3 py-2 text-sm">
          <span>{t('registrations.undo.done', { name: undo.name })}</span>
          <Button variant="secondary" onClick={() => void undoMove()}>
            {t('registrations.undo.action')}
          </Button>
        </div>
      ) : null}

      <div role="tabpanel">
        {loadFailed ? (
          <ErrorState
            title={t('registrations.errors.loadTitle')}
            body={t('registrations.errors.load')}
            onRetry={() => void load()}
            retryLabel={t('commercial.retry')}
          />
        ) : items === null ? (
          <ListSkeleton label={t('registrations.loading')} />
        ) : items.length === 0 ? (
          <EmptyState title={t('registrations.emptyTitle')} body={t('registrations.empty')} />
        ) : visible.length === 0 ? (
          <EmptyState
            title={t('registrations.search.noneTitle')}
            body={t('registrations.search.none', { query })}
            action={
              <Button variant="secondary" onClick={() => setQuery('')}>
                {t('registrations.search.clear')}
              </Button>
            }
          />
        ) : (
          <ul className="space-y-3">
            {visible.map((r) => {
              const priority = filter === 'open' ? priorityOf(r) : 3;
              const age = relativeAge(r.createdAt, now);
              const stale = (r.status === 'NEW' || r.status === 'CONTACTED') && now - Date.parse(r.createdAt) > DAY_MS;
              const bar = BAR[priority];
              return (
              <li
                key={r.id}
                id={`reg-${r.id}`}
                className={`nx-glass relative rounded-panel p-4 transition-shadow ${flashId === r.id ? 'ring-2 ring-accent' : ''}`}
              >
                {bar ? <span aria-hidden className={`absolute inset-y-0 left-0 w-1 rounded-l-panel ${bar}`} /> : null}
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-lg font-semibold">{r.restaurantName}</p>
                    <p className="text-sm text-muted">
                      <span className="ticket-no">{r.referenceCode}</span> · {formatDateTime(r.createdAt)} ·{' '}
                      <span className={stale ? 'text-warn' : ''}>{t(`registrations.age.${age.key}`, { count: age.count })}</span>
                    </p>
                    {priority === 0 ? <p className="mt-1 text-sm font-medium text-accent-strong">{t('registrations.priority.paid')}</p> : null}
                    {priority === 1 ? <p className="mt-1 text-sm font-medium text-bad">{t('registrations.priority.mismatch')}</p> : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill tone={planName(r.planKey) ? 'accent' : 'neutral'}>
                      {planName(r.planKey) ? `${planName(r.planKey)} · ${t(`registrations.payment.cycle.${r.billingCycle}`, { defaultValue: r.billingCycle })}` : t('registrations.plan.notChosen')}
                    </StatusPill>
                    <StatusPill tone={TONE[r.status]}>{t(`registrations.status.${r.status}`)}</StatusPill>
                  </div>
                </div>

                <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="eyebrow">{t('registrations.field.contact')}</dt>
                    <dd>{r.contactName}</dd>
                  </div>
                  <div>
                    <dt className="eyebrow">{t('registrations.field.phone')}</dt>
                    <dd>
                      <a className="underline" href={`tel:${r.phone}`}>{r.phone}</a>
                    </dd>
                  </div>
                  <div>
                    <dt className="eyebrow">{t('registrations.field.email')}</dt>
                    <dd className="break-all">
                      <a className="underline" href={`mailto:${r.email}`}>{r.email}</a>
                    </dd>
                  </div>
                  <div>
                    <dt className="eyebrow">{t('registrations.field.where')}</dt>
                    <dd>
                      {r.city} · {t(`registrations.kind.${r.businessKind}`, { defaultValue: r.businessKind })} ·{' '}
                      {t('registrations.outlets', { count: r.outlets })}
                    </dd>
                  </div>
                </dl>

                {(() => {
                  const { text, code } = splitOfferCode(r.message);
                  return (
                    <>
                      {text ? <p className="mt-3 whitespace-pre-wrap rounded-control bg-white/[0.04] px-3 py-2 text-sm">{text}</p> : null}
                      {code ? <p className="mt-2 text-xs text-muted">{t('registrations.offerCode', { code })}</p> : null}
                    </>
                  );
                })()}
                {items && duplicateCount(r, items) > 0 ? (
                  <p className="mt-2 text-xs text-warn">{t('registrations.duplicate', { count: duplicateCount(r, items) })}</p>
                ) : null}

                {r.payments.length > 0 ? (
                  <ul className="mt-3 space-y-2" aria-label={t('registrations.payment.listLabel')}>
                    {r.payments.map((p) => (
                      <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-control bg-white/[0.04] px-3 py-2 text-sm">
                        <span>
                          ₹{formatRupees(p.amountPaise)} · {formatDate(p.createdAt)}
                          {p.planKey ? ` · ${planName(p.planKey) ?? p.planKey}${p.billingCycle ? ` ${t(`registrations.payment.cycle.${p.billingCycle}`, { defaultValue: p.billingCycle })}` : ''}` : ''}
                          {p.overrideReason ? ` · ${t('registrations.payment.typedChip', { reason: p.overrideReason })}` : ''}
                          {p.status === 'AMOUNT_MISMATCH' ? (
                            <span className="mt-1 block text-xs text-muted">
                              {t('registrations.payment.mismatchHint', { paid: formatRupees(p.paidAmountPaise ?? 0), expected: formatRupees(p.amountPaise) })}
                            </span>
                          ) : null}
                        </span>
                        <span className="flex flex-wrap items-center gap-2">
                          <StatusPill tone={PAYMENT_TONE[p.status]}>{t(`registrations.payment.status.${p.status}`)}</StatusPill>
                          {p.status === 'AMOUNT_MISMATCH' ? (
                            <Button variant="secondary" onClick={() => setAccepting({ request: r, payment: p })} disabled={busyId === r.id}>
                              {t('registrations.attention.accept')}
                            </Button>
                          ) : null}
                          {p.status === 'CREATED' || p.status === 'AMOUNT_MISMATCH' ? (
                            <button type="button" className="inline-flex min-h-11 items-center underline disabled:opacity-50" disabled={busyId === r.id} onClick={() => void checkPayment(r, p.id)}>
                              {t('registrations.payment.check')}
                            </button>
                          ) : null}
                          {isOpenLink(p) ? (
                            <>
                              <a className="inline-flex min-h-11 items-center underline" href={p.linkUrl} target="_blank" rel="noopener noreferrer">
                                {t('registrations.payment.open')}
                              </a>
                              <a
                                className="inline-flex min-h-11 items-center underline"
                                href={whatsappUrl(r.phone, paymentMessage(r, p))}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {t('registrations.payment.whatsapp')}
                              </a>
                            </>
                          ) : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {r.status === 'CONVERTED' && r.autoProvisioned ? (
                  <p className="mt-2 text-sm text-ok">{t('registrations.autoCreated')}</p>
                ) : null}
                {isPaid(r) && r.status !== 'CONVERTED' ? (
                  <p className="mt-2 text-sm text-ok">{t('registrations.payment.paidHint')}</p>
                ) : null}

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {canCharge(r) ? (
                    <Button variant={r.payments.length > 0 ? 'secondary' : 'primary'} onClick={() => setCharging(r)} disabled={busyId === r.id}>
                      {t(r.payments.length > 0 ? 'registrations.payment.sendAnother' : 'registrations.payment.send')}
                    </Button>
                  ) : null}
                  {canCreate(r) ? (
                    <Button variant={canCharge(r) ? 'secondary' : 'primary'} onClick={() => setCreating(r)} disabled={busyId === r.id}>
                      {t('registrations.createAccount')}
                    </Button>
                  ) : null}
                  <a
                    className="inline-flex min-h-11 items-center rounded-control border border-white/10 bg-white/[0.04] px-4 text-sm hover:border-accent/40"
                    href={whatsappUrl(r.phone, t('registrations.whatsappText', { name: r.contactName, ref: r.referenceCode }))}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t('registrations.whatsapp')}
                  </a>
                  {r.status === 'NEW' ? (
                    <Button variant="secondary" loading={busyId === r.id} onClick={() => void move(r, 'CONTACTED')}>
                      {t('registrations.markContacted')}
                    </Button>
                  ) : null}
                  {(() => {
                    // The rarely used actions live in one menu so the one or two that matter now stand out.
                    const showAutopay = !['CONVERTED', 'SPAM', 'REJECTED'].includes(r.status);
                    const showRecord = canCharge(r);
                    const showEdit = r.status !== 'CONVERTED' && !r.businessId;
                    const showReject = NEXT_STATUSES[r.status].includes('REJECTED') && r.status !== 'REJECTED';
                    const showSpam = NEXT_STATUSES[r.status].includes('SPAM') && r.status !== 'SPAM';
                    if (!showAutopay && !showRecord && !showEdit && !showReject && !showSpam) return null;
                    return (
                      <MoreMenu label={t('registrations.more')}>
                        {showAutopay ? <MoreItem onClick={() => setAutopay(r)} disabled={busyId === r.id}>{t('registrations.autopay.open')}</MoreItem> : null}
                        {showRecord ? <MoreItem onClick={() => setRecording(r)} disabled={busyId === r.id}>{t('registrations.manual.open')}</MoreItem> : null}
                        {showEdit ? <MoreItem onClick={() => setEditing(r)} disabled={busyId === r.id}>{t('registrations.edit.open')}</MoreItem> : null}
                        {showReject ? <MoreItem onClick={() => setConfirmMove({ r, status: 'REJECTED' })} disabled={busyId === r.id}>{t('registrations.reject')}</MoreItem> : null}
                        {showSpam ? <MoreItem onClick={() => setConfirmMove({ r, status: 'SPAM' })} disabled={busyId === r.id}>{t('registrations.spam')}</MoreItem> : null}
                      </MoreMenu>
                    );
                  })()}
                  {r.status === 'REJECTED' || r.status === 'SPAM' ? (
                    <Button variant="secondary" loading={busyId === r.id} onClick={() => void move(r, 'NEW')}>
                      {t('registrations.reopen')}
                    </Button>
                  ) : null}
                  {r.status === 'CONVERTED' && r.businessId ? <ClaimLinkButtons request={r} /> : null}
                  {r.status === 'CONVERTED' && r.businessId && onOpenOnboarding ? (
                    <Button variant="secondary" onClick={() => onOpenOnboarding(r.businessId as string)}>
                      {t('registrations.openChecklist')}
                    </Button>
                  ) : null}
                </div>
              </li>
              );
            })}
          </ul>
        )}
      </div>

      {charging ? (
        <PaymentLinkDialog
          request={charging}
          onClose={() => {
            setCharging(null);
            bump();
          }}
          onCreated={() => {
            toast.show(t('registrations.payment.created', { name: charging.restaurantName }));
            bump();
            void load();
          }}
        />
      ) : null}

      {autopay ? (
        <AutopayDialog
          request={autopay}
          onClose={() => {
            setAutopay(null);
            bump();
          }}
        />
      ) : null}

      {editing ? (
        <EditContactDialog
          request={editing}
          onClose={() => {
            setEditing(null);
            bump();
          }}
          onSaved={() => {
            setEditing(null);
            toast.show(t('registrations.edit.saved'));
            bump();
            void load();
          }}
        />
      ) : null}

      {recording ? (
        <ManualPaymentDialog
          request={recording}
          onClose={() => {
            setRecording(null);
            bump();
          }}
          onDone={() => {
            toast.show(t('registrations.manual.recorded', { name: recording.restaurantName }));
            setRecording(null);
            bump();
            void load();
          }}
        />
      ) : null}

      {accepting ? (
        <AcceptMismatchDialog
          request={accepting.request}
          payment={accepting.payment}
          onClose={() => {
            setAccepting(null);
            bump();
          }}
          onDone={() => {
            toast.show(t('registrations.accept.done', { name: accepting.request.restaurantName }));
            setAccepting(null);
            bump();
            void load();
          }}
        />
      ) : null}

      {confirmMove ? (
        <ConfirmDialog
          title={t(`registrations.confirm.${confirmMove.status}.title`, { name: confirmMove.r.restaurantName })}
          body={t(`registrations.confirm.${confirmMove.status}.body`)}
          confirmLabel={t(confirmMove.status === 'SPAM' ? 'registrations.spam' : 'registrations.reject')}
          onClose={() => setConfirmMove(null)}
          onConfirm={() => {
            const m = confirmMove;
            setConfirmMove(null);
            void move(m.r, m.status);
          }}
        />
      ) : null}

      {creating ? (
        <CreateAccountDialog
          request={creating}
          onDone={() => onAccountCreated(creating)}
          onClose={() => {
            setCreating(null);
            bump();
          }}
          onOpenChecklist={onOpenOnboarding ? (businessId) => { setCreating(null); onOpenOnboarding(businessId); } : undefined}
        />
      ) : null}
    </div>
  );
}
