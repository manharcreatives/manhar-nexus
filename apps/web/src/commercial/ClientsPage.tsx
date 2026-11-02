import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { formatMoney } from '../lib/money';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { Dialog } from '../ui/Dialog';
import { Field } from '../ui/Field';
import { Panel } from '../ui/Panel';
import { Select } from '../ui/Select';
import { StatusPill } from '../ui/StatusPill';
import { Table, Td, Th } from '../ui/Table';
import { Textarea } from '../ui/Textarea';
import { EmptyState, ErrorState, Skeleton } from '../ui/states';
import { useToast } from '../ui/Toast';
import {
  createActivationRequest,
  deleteClient,
  getClient,
  listActivationRequests,
  listBundles,
  listClients,
  listModuleOptions,
  transitionActivationRequest,
  updateClient,
  type ActivationRequest,
  type ActivationStatus,
  type Bundle,
  type ClientDetail,
  type ClientSummary,
  type CommercialStatus,
  type ModuleOption,
} from './api';
import {
  ACTIVATION_NEXT,
  ACTIVATION_TONE,
  COMMERCIAL_STATUSES,
  COMMERCIAL_TONE,
  errorMessage,
  formatDate,
  toMinorUnits,
} from './helpers';
import { FormError, ListSkeleton } from './Shared';

const REQUEST_FORM = 'activation-request-form';
const TRANSITION_FORM = 'activation-transition-form';
const MODULE_KEY_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;
const DELETE_CONFIRMATION = 'delete this restaurant';

// ─── List ────────────────────────────────────────────────────────────────────

export function ClientsPage() {
  const { t } = useTranslation();
  const [clients, setClients] = useState<ClientSummary[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [filterStatus, setFilterStatus] = useState<CommercialStatus | ''>('');
  const [selected, setSelected] = useState<ClientSummary | null>(null);

  const load = useCallback(async () => {
    setLoadFailed(false);
    setClients(null);
    try {
      setClients(await listClients(filterStatus ? { commercialStatus: filterStatus } : undefined));
    } catch {
      setLoadFailed(true);
    }
  }, [filterStatus]);

  useEffect(() => {
    void load();
  }, [load]);

  if (selected) {
    return (
      <ClientDetailView
        summary={selected}
        onBack={() => {
          setSelected(null);
          void load();
        }}
      />
    );
  }

  return (
    <section aria-labelledby="clients-h" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="clients-h" className="text-xl font-semibold">
            {t('commercial.clients.title')}
          </h2>
          <p className="text-sm text-muted" aria-live="polite">
            {clients ? t('commercial.clients.count', { count: clients.length }) : t('commercial.loading')}
          </p>
        </div>
        <div className="w-full sm:w-56">
          <Select
            label={t('commercial.clients.filter')}
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as CommercialStatus | '')}
          >
            <option value="">{t('commercial.allStatuses')}</option>
            {COMMERCIAL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`commercial.status.${s}`)}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {loadFailed ? (
        <ErrorState
          title={t('commercial.errors.loadTitle')}
          body={t('commercial.errors.loadFailed')}
          onRetry={() => void load()}
          retryLabel={t('commercial.retry')}
        />
      ) : clients === null ? (
        <ListSkeleton label={t('commercial.loading')} />
      ) : clients.length === 0 ? (
        <EmptyState
          title={t('commercial.clients.emptyTitle')}
          body={filterStatus ? t('commercial.clients.emptyFiltered') : t('commercial.noClients')}
          action={
            filterStatus ? (
              <Button variant="secondary" onClick={() => setFilterStatus('')}>
                {t('commercial.clients.clearFilter')}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Table aria-label={t('commercial.clients.title')}>
          <thead>
            <tr>
              <Th>{t('commercial.col.name')}</Th>
              <Th>{t('commercial.col.type')}</Th>
              <Th>{t('commercial.col.status')}</Th>
              <Th numeric>{t('commercial.col.locations')}</Th>
              <Th>{t('commercial.col.assignedTo')}</Th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.id} className="hover:bg-sunken/40">
                <Td>
                  <button
                    type="button"
                    onClick={() => setSelected(c)}
                    className="min-h-11 text-left font-medium text-accent-strong underline-offset-2 hover:underline"
                  >
                    {c.name}
                  </button>
                </Td>
                <Td>{c.businessType.name}</Td>
                <Td>
                  <StatusPill tone={COMMERCIAL_TONE[c.commercialStatus]}>
                    {t(`commercial.status.${c.commercialStatus}`)}
                  </StatusPill>
                </Td>
                <Td numeric>{c._count.locations}</Td>
                <Td>{c.assignedTo ?? <span className="text-muted">{t('commercial.clients.unassigned')}</span>}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </section>
  );
}

// ─── Detail ──────────────────────────────────────────────────────────────────

function ClientDetailView({ summary, onBack }: { summary: ClientSummary; onBack: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [detail, setDetail] = useState<ClientDetail | null>(null);
  const [activations, setActivations] = useState<ActivationRequest[]>([]);
  const [modules, setModules] = useState<ModuleOption[] | null>(null);
  const [modulesFailed, setModulesFailed] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  const [pendingStatus, setPendingStatus] = useState<CommercialStatus | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);

  const [requestOpen, setRequestOpen] = useState(false);
  const [transition, setTransition] = useState<{ req: ActivationRequest; to: ActivationStatus } | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTyped, setDeleteTyped] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(async () => {
    setLoadFailed(false);
    try {
      const [d, reqs] = await Promise.all([getClient(summary.id), listActivationRequests(summary.id)]);
      setDetail(d);
      setActivations(reqs);
    } catch {
      setLoadFailed(true);
    }
  }, [summary.id]);

  useEffect(() => {
    void load();
    listModuleOptions(summary.id)
      .then(setModules)
      .catch(() => setModulesFailed(true));
  }, [load, summary.id]);

  const moduleName = useMemo(() => new Map((modules ?? []).map((m) => [m.key, m.name])), [modules]);

  async function applyStatus(status: CommercialStatus) {
    setStatusBusy(true);
    try {
      await updateClient(summary.id, { commercialStatus: status });
      toast.show(t('commercial.clients.statusChanged', { status: t(`commercial.status.${status}`) }));
      setPendingStatus(null);
      await load();
    } catch (err) {
      toast.show(errorMessage(err, t('commercial.errors.saveFailed')), 'bad');
    } finally {
      setStatusBusy(false);
    }
  }

  function onStatusPick(status: CommercialStatus) {
    if (!detail || status === detail.commercialStatus) return;
    if (status === 'SUSPENDED' || status === 'CHURNED') setPendingStatus(status);
    else void applyStatus(status);
  }

  async function applyDelete() {
    if (deleteTyped.trim() !== DELETE_CONFIRMATION || deleteBusy) return;
    setDeleteBusy(true);
    try {
      await deleteClient(summary.id);
      toast.show(t('commercial.clients.deleted'));
      setDeleteOpen(false);
      onBack();
    } catch (err) {
      toast.show(errorMessage(err, t('commercial.errors.deleteFailed')), 'bad');
    } finally {
      setDeleteBusy(false);
    }
  }

  const backButton = (
    <Button variant="ghost" onClick={onBack} className="mb-3 -ml-3">
      {t('commercial.back')}
    </Button>
  );

  if (loadFailed) {
    return (
      <div>
        {backButton}
        <ErrorState
          title={t('commercial.errors.loadTitle')}
          body={t('commercial.errors.loadFailed')}
          onRetry={() => void load()}
          retryLabel={t('commercial.retry')}
        />
      </div>
    );
  }

  if (!detail) {
    return (
      <div>
        {backButton}
        <div role="status" aria-label={t('commercial.loading')} className="space-y-3">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        {backButton}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-2xl font-semibold">{detail.name}</h2>
            <p className="mt-1 text-sm text-muted">
              {detail.businessType.name} · {t('commercial.clients.locationCount', { count: detail.locations.length })}
            </p>
          </div>
          <div className="flex items-end gap-3">
            <StatusPill tone={COMMERCIAL_TONE[detail.commercialStatus]}>
              {t(`commercial.status.${detail.commercialStatus}`)}
            </StatusPill>
            <div className="w-44">
              <Select
                label={t('commercial.clients.changeStatus')}
                value={detail.commercialStatus}
                disabled={statusBusy}
                onChange={(e) => onStatusPick(e.target.value as CommercialStatus)}
              >
                {COMMERCIAL_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(`commercial.status.${s}`)}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </div>
      </div>

      <section aria-labelledby="act-h" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 id="act-h" className="text-lg font-semibold">
              {t('commercial.activation.title')}
            </h3>
            <p className="text-sm text-muted">{t('commercial.activation.help')}</p>
          </div>
          <Button onClick={() => setRequestOpen(true)}>{t('commercial.activation.create')}</Button>
        </div>

        {activations.length === 0 ? (
          <EmptyState
            title={t('commercial.activation.emptyTitle')}
            body={t('commercial.activation.empty')}
            action={<Button onClick={() => setRequestOpen(true)}>{t('commercial.activation.create')}</Button>}
          />
        ) : (
          <ul className="space-y-3">
            {activations.map((req) => (
              <li key={req.id}>
                <Panel>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill tone={ACTIVATION_TONE[req.status]}>
                        {t(`commercial.activationStatus.${req.status}`)}
                      </StatusPill>
                      {req.bundle && <span className="font-medium">{req.bundle.name}</span>}
                    </div>
                    <span className="text-xs text-muted">
                      {t('commercial.activation.requestedOn', { date: formatDate(req.createdAt) })}
                    </span>
                  </div>
                  {req.moduleKeys.length > 0 && (
                    <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={t('commercial.activation.modules')}>
                      {req.moduleKeys.map((k) => (
                        <li key={k} className="rounded-full bg-sunken px-2.5 py-0.5 text-xs">
                          {moduleName.get(k) ?? k}
                        </li>
                      ))}
                    </ul>
                  )}
                  {req.quotedAmount !== null && (
                    <p className="mt-2 text-sm">
                      {t('commercial.activation.quoted', { amount: formatMoney(req.quotedAmount, req.currencyCode) })}
                    </p>
                  )}
                  {req.notes && <p className="mt-2 text-sm text-muted">{req.notes}</p>}
                  {ACTIVATION_NEXT[req.status].length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {ACTIVATION_NEXT[req.status].map((next) => (
                        <Button
                          key={next}
                          variant={next === 'REMOVED' ? 'ghost' : 'secondary'}
                          onClick={() => setTransition({ req, to: next })}
                        >
                          {t(`commercial.activation.action.${next}`)}
                        </Button>
                      ))}
                    </div>
                  )}
                </Panel>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="danger-h" className="border-t border-line pt-6">
        <h3 id="danger-h" className="text-lg font-semibold text-bad">
          {t('commercial.clients.dangerZone')}
        </h3>
        <p className="mt-1 max-w-2xl text-sm text-muted">{t('commercial.clients.deleteHelp')}</p>
        <Button
          variant="danger"
          className="mt-3"
          onClick={() => {
            setDeleteTyped('');
            setDeleteOpen(true);
          }}
        >
          {t('commercial.clients.deleteRestaurant')}
        </Button>
      </section>

      <Dialog
        open={deleteOpen}
        onClose={() => !deleteBusy && setDeleteOpen(false)}
        title={t('commercial.clients.deleteTitle')}
        footer={
          <>
            <Button variant="secondary" disabled={deleteBusy} onClick={() => setDeleteOpen(false)}>
              {t('commercial.cancel')}
            </Button>
            <Button
              variant="danger"
              loading={deleteBusy}
              disabled={deleteTyped.trim() !== DELETE_CONFIRMATION}
              onClick={() => void applyDelete()}
            >
              {t('commercial.clients.deletePermanently')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-bad">
            {t('commercial.clients.deleteWarning', { name: detail.name })}
          </p>
          <div>
            <p className="text-sm">
              {t('commercial.clients.typeToConfirm')}{' '}
              <code className="rounded bg-sunken px-1.5 py-0.5 font-mono text-xs">{DELETE_CONFIRMATION}</code>
            </p>
            <Field
              label={t('commercial.clients.deleteConfirmationLabel')}
              value={deleteTyped}
              onChange={(e) => setDeleteTyped(e.target.value)}
              autoComplete="off"
              autoFocus
            />
          </div>
        </div>
      </Dialog>

      <Dialog
        open={!!pendingStatus}
        onClose={() => !statusBusy && setPendingStatus(null)}
        title={t('commercial.clients.confirmStatusTitle')}
        footer={
          <>
            <Button variant="secondary" disabled={statusBusy} onClick={() => setPendingStatus(null)}>
              {t('commercial.cancel')}
            </Button>
            <Button
              variant="danger"
              loading={statusBusy}
              onClick={() => pendingStatus && void applyStatus(pendingStatus)}
            >
              {t('commercial.clients.confirmStatus', {
                status: pendingStatus ? t(`commercial.status.${pendingStatus}`) : '',
              })}
            </Button>
          </>
        }
      >
        <p className="text-sm">
          {t(pendingStatus === 'CHURNED' ? 'commercial.clients.confirmChurn' : 'commercial.clients.confirmSuspend', {
            name: detail.name,
          })}
        </p>
      </Dialog>

      <NewRequestDialog
        open={requestOpen}
        businessId={summary.id}
        modules={modules}
        modulesFailed={modulesFailed}
        onClose={() => setRequestOpen(false)}
        onCreated={async () => {
          setRequestOpen(false);
          toast.show(t('commercial.activation.created'));
          await load();
        }}
      />

      <TransitionDialog
        value={transition}
        businessId={summary.id}
        onClose={() => setTransition(null)}
        onDone={async (to) => {
          setTransition(null);
          toast.show(t('commercial.activation.moved', { status: t(`commercial.activationStatus.${to}`) }));
          await load();
        }}
      />
    </div>
  );
}

// ─── New activation request ──────────────────────────────────────────────────

function NewRequestDialog({
  open,
  businessId,
  modules,
  modulesFailed,
  onClose,
  onCreated,
}: {
  open: boolean;
  businessId: string;
  modules: ModuleOption[] | null;
  modulesFailed: boolean;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [typed, setTyped] = useState('');
  const [bundleId, setBundleId] = useState('');
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPicked(new Set());
    setTyped('');
    setBundleId('');
    setNotes('');
    setSubmitted(false);
    setError(null);
    listBundles()
      .then((b) => setBundles(b.filter((x) => x.isActive)))
      .catch(() => setBundles([]));
  }, [open]);

  // With a module list we use checkboxes; if the list is unavailable, a validated text field.
  const useText = modulesFailed || (modules !== null && modules.length === 0);
  const typedKeys = Array.from(new Set(typed.split(',').map((k) => k.trim()).filter(Boolean)));
  const keys = useText ? typedKeys : Array.from(picked);
  const keyFormatBad = useText && typedKeys.some((k) => !MODULE_KEY_PATTERN.test(k));
  const selectionError =
    keys.length === 0 && !bundleId
      ? t('commercial.activation.errors.needSelection')
      : keyFormatBad
        ? t('commercial.activation.errors.keyFormat')
        : null;

  function toggle(key: string, on: boolean) {
    setPicked((s) => {
      const n = new Set(s);
      if (on) n.add(key);
      else n.delete(key);
      return n;
    });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (selectionError || saving) return;
    setSaving(true);
    setError(null);
    try {
      await createActivationRequest(businessId, {
        bundleId: bundleId || undefined,
        moduleKeys: keys,
        notes: notes.trim() || undefined,
      });
      await onCreated();
    } catch (err) {
      setError(errorMessage(err, t('commercial.errors.saveFailed')));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={() => !saving && onClose()}
      title={t('commercial.activation.newTitle')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            {t('commercial.cancel')}
          </Button>
          <Button type="submit" form={REQUEST_FORM} loading={saving}>
            {saving ? t('commercial.saving') : t('commercial.activation.submit')}
          </Button>
        </>
      }
    >
      <form id={REQUEST_FORM} onSubmit={(e) => void submit(e)} noValidate className="space-y-4">
        {bundles.length > 0 && (
          <Select label={t('commercial.activation.bundle')} value={bundleId} onChange={(e) => setBundleId(e.target.value)}>
            <option value="">{t('commercial.activation.noBundle')}</option>
            {bundles.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        )}

        {modules === null && !modulesFailed ? (
          <Skeleton className="h-32 w-full" />
        ) : useText ? (
          <Field
            label={t('commercial.activation.moduleKeys')}
            hint={t('commercial.activation.moduleKeysHint')}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="restaurant, catalog"
            error={submitted ? selectionError : null}
            autoComplete="off"
          />
        ) : (
          <fieldset>
            <legend className="text-sm font-medium">{t('commercial.activation.modulesLegend')}</legend>
            <p className="text-sm text-muted">{t('commercial.activation.modulesHelp')}</p>
            <div className="mt-1 max-h-64 overflow-y-auto rounded-control border border-line px-3">
              {(modules ?? []).map((m) => (
                <div key={m.key} className="border-b border-line/60 py-0.5 last:border-b-0">
                  <Checkbox label={m.name} checked={picked.has(m.key)} onChange={(e) => toggle(m.key, e.target.checked)} />
                  {m.description && <p className="-mt-2 mb-2 pl-8 text-xs text-muted">{m.description}</p>}
                </div>
              ))}
            </div>
            <div aria-live="polite">
              {submitted && selectionError && <p className="mt-1.5 text-sm text-bad">{selectionError}</p>}
            </div>
          </fieldset>
        )}

        <Textarea
          label={t('commercial.activation.notes')}
          value={notes}
          maxLength={2000}
          onChange={(e) => setNotes(e.target.value)}
        />
        <FormError message={error} />
      </form>
    </Dialog>
  );
}

// ─── Move an activation request to its next state ────────────────────────────

function TransitionDialog({
  value,
  businessId,
  onClose,
  onDone,
}: {
  value: { req: ActivationRequest; to: ActivationStatus } | null;
  businessId: string;
  onClose: () => void;
  onDone: (to: ActivationStatus) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [note, setNote] = useState('');
  const [amount, setAmount] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reqId = value?.req.id;
  useEffect(() => {
    setNote('');
    setAmount('');
    setSubmitted(false);
    setError(null);
  }, [reqId, value?.to]);

  const to = value?.to;
  const isQuote = to === 'QUOTED';
  const currency = value?.req.currencyCode ?? 'INR';
  const minor = amount.trim() === '' ? null : toMinorUnits(amount);
  const amountError = isQuote && amount.trim() !== '' && minor === null ? t('commercial.activation.errors.amount') : null;
  const destructive = to === 'REMOVED';

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (!value || amountError || saving) return;
    setSaving(true);
    setError(null);
    try {
      await transitionActivationRequest(businessId, value.req.id, {
        toStatus: value.to,
        note: note.trim() || undefined,
        quotedAmount: isQuote && minor !== null ? minor : undefined,
        currencyCode: isQuote && minor !== null ? currency : undefined,
      });
      await onDone(value.to);
    } catch (err) {
      setError(errorMessage(err, t('commercial.errors.saveFailed')));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={!!value}
      onClose={() => !saving && onClose()}
      title={to ? t(`commercial.activation.action.${to}`) : ''}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            {t('commercial.cancel')}
          </Button>
          <Button type="submit" form={TRANSITION_FORM} variant={destructive ? 'danger' : 'primary'} loading={saving}>
            {t('commercial.confirm')}
          </Button>
        </>
      }
    >
      <form id={TRANSITION_FORM} onSubmit={(e) => void submit(e)} noValidate className="space-y-4">
        <p className="text-sm">
          {to ? t(`commercial.activation.explain.${to}`) : ''}
        </p>
        {isQuote && (
          <Field
            label={t('commercial.activation.quoteAmount', { currency })}
            hint={minor !== null ? t('commercial.priceBooks.willShowAs', { value: formatMoney(minor, currency) }) : t('commercial.activation.quoteHint')}
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            error={submitted ? amountError : null}
            autoComplete="off"
          />
        )}
        <Textarea label={t('commercial.activation.note')} value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} />
        <FormError message={error} />
      </form>
    </Dialog>
  );
}
