import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  costsApi,
  listLocations,
  formatMinorUnits,
  type CostSummary,
  type Expense,
  type ExpenseCategory,
  type ExpenseStatus,
  type Location,
} from './api';
import { formatDate, presetRange, todayIso } from '../reports/dates';
import { useAsync } from '../reports/useAsync';
import { PageHeader } from '../ui/PageHeader';
import { Tabs } from '../ui/Tabs';
import { Panel } from '../ui/Panel';
import { Field } from '../ui/Field';
import { Select } from '../ui/Select';
import { Checkbox } from '../ui/Checkbox';
import { Textarea } from '../ui/Textarea';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { StatCard } from '../ui/StatCard';
import { StatusPill } from '../ui/StatusPill';
import { Table, Th, Td } from '../ui/Table';
import { EmptyState, ErrorState, Skeleton } from '../ui/states';
import { useToast } from '../ui/Toast';

type Tab = 'expenses' | 'categories' | 'summary';

function errText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Parses a decimal major-unit string ("12", "12.5", "12.50") into integer minor units, or null. */
function parseMinor(input: string): number | null {
  const s = input.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [whole, frac = ''] = s.split('.');
  const minor = Number(whole) * 100 + Number(frac.padEnd(2, '0'));
  return Number.isSafeInteger(minor) && minor > 0 ? minor : null;
}

function StatusBadge({ status }: { status: ExpenseStatus }) {
  const { t } = useTranslation();
  if (status === 'APPROVED') return <StatusPill tone="ok">{t('costs.status.APPROVED')}</StatusPill>;
  if (status === 'REJECTED') return <StatusPill tone="bad">{t('costs.status.REJECTED')}</StatusPill>;
  return <StatusPill tone="warn">{t('costs.status.PENDING_APPROVAL')}</StatusPill>;
}

function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { t } = useTranslation();
  return <ErrorState title={t('costs.loadError')} body={message} onRetry={onRetry} retryLabel={t('costs.retry')} />;
}

function ListSkeleton() {
  return (
    <div aria-hidden className="space-y-2">
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-12" />
      ))}
    </div>
  );
}

function Live({ busy }: { busy: boolean }) {
  const { t } = useTranslation();
  return (
    <div role="status" aria-live="polite" className="sr-only">
      {busy ? t('costs.loading') : ''}
    </div>
  );
}

// -- Categories ------------------------------------------------------------

function CategoriesTab() {
  const { t } = useTranslation();
  const toast = useToast();
  const { data, loading, error, reload, setData } = useAsync<ExpenseCategory[]>(costsApi.listCategories);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const savingRef = useRef(false);

  const create = (e: React.FormEvent) => {
    e.preventDefault();
    if (savingRef.current) return;
    const trimmed = name.trim();
    if (!trimmed) return setNameError(t('costs.v.categoryName'));
    if ((data ?? []).some((c) => c.name.trim().toLowerCase() === trimmed.toLowerCase())) {
      return setNameError(t('costs.v.categoryDuplicate'));
    }
    setNameError(null);
    savingRef.current = true;
    setSaving(true);
    costsApi
      .createCategory({ name: trimmed, description: description.trim() || undefined, requiresApproval })
      .then((cat) => {
        setData((prev) => [...(prev ?? []), cat]);
        setName('');
        setDescription('');
        setRequiresApproval(false);
        toast.show(t('costs.categoryAdded', { name: cat.name }));
      })
      .catch((err: unknown) => toast.show(errText(err), 'bad'))
      .finally(() => {
        savingRef.current = false;
        setSaving(false);
      });
  };

  const toggle = (cat: ExpenseCategory) => {
    if (busyIds.has(cat.id)) return;
    setBusyIds((s) => new Set(s).add(cat.id));
    costsApi
      .updateCategory(cat.id, { isActive: !cat.isActive })
      .then((u) => setData((prev) => (prev ?? []).map((c) => (c.id === u.id ? u : c))))
      .catch((err: unknown) => toast.show(errText(err), 'bad'))
      .finally(() =>
        setBusyIds((s) => {
          const n = new Set(s);
          n.delete(cat.id);
          return n;
        }),
      );
  };

  return (
    <div className="space-y-6">
      <Live busy={loading} />
      <Panel>
        <form onSubmit={create} noValidate aria-label={t('costs.addCategory')} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto_auto] lg:items-start">
          <Field label={t('costs.categoryName')} value={name} onChange={(e) => setName(e.target.value)} error={nameError} placeholder={t('costs.categoryNamePh')} />
          <Field label={t('costs.description')} value={description} onChange={(e) => setDescription(e.target.value)} hint={t('costs.optional')} />
          <div className="sm:pt-7">
            <Checkbox label={t('costs.requiresApproval')} checked={requiresApproval} onChange={(e) => setRequiresApproval(e.target.checked)} />
          </div>
          <div className="sm:pt-7">
            <Button type="submit" loading={saving}>
              {saving ? t('costs.saving') : t('costs.addCategory')}
            </Button>
          </div>
        </form>
      </Panel>

      {error && <LoadError message={error} onRetry={reload} />}
      {loading && !data && <ListSkeleton />}
      {data && data.length === 0 && <EmptyState title={t('costs.noCategories')} body={t('costs.noCategoriesBody')} />}
      {data && data.length > 0 && (
        <Table>
          <thead>
            <tr>
              <Th>{t('costs.categoryName')}</Th>
              <Th>{t('costs.description')}</Th>
              <Th>{t('costs.approvalRequired')}</Th>
              <Th>{t('costs.colStatus')}</Th>
              <Th>
                <span className="sr-only">{t('costs.colActions')}</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {data.map((cat) => (
              <tr key={cat.id}>
                <Td className="font-medium">{cat.name}</Td>
                <Td className="text-muted">{cat.description ?? '-'}</Td>
                <Td>{cat.requiresApproval ? t('costs.yes') : t('costs.no')}</Td>
                <Td>
                  <StatusPill tone={cat.isActive ? 'ok' : 'neutral'}>{cat.isActive ? t('costs.active') : t('costs.inactive')}</StatusPill>
                </Td>
                <Td className="text-right">
                  <Button variant="ghost" onClick={() => toggle(cat)} loading={busyIds.has(cat.id)} aria-label={`${cat.isActive ? t('costs.deactivate') : t('costs.activate')}: ${cat.name}`}>
                    {cat.isActive ? t('costs.deactivate') : t('costs.activate')}
                  </Button>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}

// -- Expenses ----------------------------------------------------------------

interface ExpenseData {
  expenses: Expense[];
  categories: ExpenseCategory[];
  locations: Location[];
}

const emptyForm = () => ({
  locationId: '',
  expenseCategoryId: '',
  amount: '',
  paidAt: todayIso(),
  description: '',
  vendorName: '',
  isRecurring: false,
});

function ExpensesTab() {
  const { t } = useTranslation();
  const toast = useToast();
  const [filterStatus, setFilterStatus] = useState<ExpenseStatus | ''>('');
  const fn = useCallback(async (): Promise<ExpenseData> => {
    const [expenses, categories, locations] = await Promise.all([
      costsApi.listExpenses(filterStatus ? { status: filterStatus } : {}),
      costsApi.listCategories(),
      listLocations(),
    ]);
    return { expenses, categories: categories.filter((c) => c.isActive), locations: locations.filter((l) => l.isActive) };
  }, [filterStatus]);
  const { data, loading, error, reload } = useAsync<ExpenseData>(fn);

  const [form, setForm] = useState(emptyForm);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  // One idempotency key per logical submission: a double click or retry after a network error reuses it.
  const keyRef = useRef(crypto.randomUUID());

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [rejectIds, setRejectIds] = useState<string[] | null>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);

  const locationId = form.locationId || (data?.locations.length === 1 ? data.locations[0].id : '');
  const amountMinor = parseMinor(form.amount);
  const errors = {
    location: !locationId ? t('costs.v.location') : null,
    category: !form.expenseCategoryId ? t('costs.v.category') : null,
    amount: amountMinor === null ? t('costs.v.amount') : null,
    paidAt: !form.paidAt ? t('costs.v.paidAt') : null,
  };
  const show = (k: keyof typeof errors) => (submitted ? errors[k] : null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (savingRef.current) return;
    setSubmitted(true);
    if (Object.values(errors).some(Boolean) || amountMinor === null) return;
    savingRef.current = true;
    setSaving(true);
    costsApi
      .createExpense({
        locationId,
        expenseCategoryId: form.expenseCategoryId,
        amountMinorUnits: amountMinor,
        paidAt: new Date(`${form.paidAt}T12:00:00`).toISOString(),
        description: form.description.trim() || undefined,
        vendorName: form.vendorName.trim() || undefined,
        isRecurring: form.isRecurring,
        idempotencyKey: keyRef.current,
      })
      .then(() => {
        keyRef.current = crypto.randomUUID();
        setForm(emptyForm());
        setSubmitted(false);
        toast.show(t('costs.expenseRecorded'));
        reload();
      })
      .catch((err: unknown) => toast.show(errText(err), 'bad'))
      .finally(() => {
        savingRef.current = false;
        setSaving(false);
      });
  };

  const markBusy = (ids: string[], on: boolean) =>
    setBusyIds((s) => {
      const n = new Set(s);
      ids.forEach((id) => (on ? n.add(id) : n.delete(id)));
      return n;
    });

  /** Runs an action over ids sequentially, then reports a single summary. */
  const runBatch = async (ids: string[], action: (id: string) => Promise<unknown>, okKey: string) => {
    const todo = ids.filter((id) => !busyIds.has(id));
    if (todo.length === 0) return;
    markBusy(todo, true);
    let ok = 0;
    let firstError: string | null = null;
    const failed: string[] = [];
    for (const id of todo) {
      try {
        await action(id);
        ok += 1;
      } catch (err) {
        failed.push(id);
        firstError ??= errText(err);
      }
    }
    markBusy(todo, false);
    setSelected(new Set(failed));
    if (ok > 0) toast.show(t(okKey, { count: ok }));
    if (failed.length > 0) toast.show(t('costs.someFailed', { count: failed.length, reason: firstError }), 'bad');
    reload();
    return failed.length === 0;
  };

  const approve = (ids: string[]) => runBatch(ids, (id) => costsApi.approveExpense(id), 'costs.approvedCount');

  const approveSelected = async () => {
    setBulkBusy(true);
    await approve([...selected]);
    setBulkBusy(false);
  };

  const openReject = (ids: string[]) => {
    setReason('');
    setReasonError(null);
    setRejectIds(ids);
  };

  const confirmReject = async () => {
    if (!rejectIds || rejecting) return;
    const trimmed = reason.trim();
    if (!trimmed) return setReasonError(t('costs.v.reason'));
    setRejecting(true);
    const allOk = await runBatch(rejectIds, (id) => costsApi.rejectExpense(id, trimmed), 'costs.rejectedCount');
    setRejecting(false);
    if (allOk) setRejectIds(null);
  };

  const pending = (data?.expenses ?? []).filter((x) => x.status === 'PENDING_APPROVAL');
  const allPendingSelected = pending.length > 0 && pending.every((x) => selected.has(x.id));
  const toggleOne = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div className="space-y-6">
      <Live busy={loading || saving} />
      <Panel>
        <form onSubmit={submit} noValidate aria-label={t('costs.recordExpense')} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Select label={t('costs.location')} value={locationId} onChange={(e) => setForm((f) => ({ ...f, locationId: e.target.value }))} error={show('location')}>
              <option value="">{t('costs.selectPh')}</option>
              {(data?.locations ?? []).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
            <Select label={t('costs.category')} value={form.expenseCategoryId} onChange={(e) => setForm((f) => ({ ...f, expenseCategoryId: e.target.value }))} error={show('category')}>
              <option value="">{t('costs.selectPh')}</option>
              {(data?.categories ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Field label={t('costs.amount')} inputMode="decimal" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} error={show('amount')} placeholder="0.00" />
            <Field label={t('costs.paidOn')} type="date" value={form.paidAt} max={todayIso()} onChange={(e) => setForm((f) => ({ ...f, paidAt: e.target.value }))} error={show('paidAt')} />
            <Field label={t('costs.vendor')} value={form.vendorName} onChange={(e) => setForm((f) => ({ ...f, vendorName: e.target.value }))} hint={t('costs.optional')} />
            <Field label={t('costs.description')} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} hint={t('costs.optional')} />
            <div className="sm:pt-7">
              <Checkbox label={t('costs.recurring')} checked={form.isRecurring} onChange={(e) => setForm((f) => ({ ...f, isRecurring: e.target.checked }))} />
            </div>
          </div>
          <Button type="submit" loading={saving}>
            {saving ? t('costs.saving') : t('costs.recordExpense')}
          </Button>
        </form>
      </Panel>

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-56">
          <Select label={t('costs.filterStatus')} value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value as ExpenseStatus | ''); setSelected(new Set()); }}>
            <option value="">{t('costs.all')}</option>
            <option value="PENDING_APPROVAL">{t('costs.status.PENDING_APPROVAL')}</option>
            <option value="APPROVED">{t('costs.status.APPROVED')}</option>
            <option value="REJECTED">{t('costs.status.REJECTED')}</option>
          </Select>
        </div>
        <Button variant="secondary" onClick={reload} loading={loading}>
          {t('costs.refresh')}
        </Button>
        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('costs.bulkActions')}>
            <span className="text-sm text-muted" aria-live="polite">
              {t('costs.selectedCount', { count: selected.size })}
            </span>
            <Button onClick={() => void approveSelected()} loading={bulkBusy}>
              {t('costs.approveSelected')}
            </Button>
            <Button variant="danger" onClick={() => openReject([...selected])} disabled={bulkBusy}>
              {t('costs.rejectSelected')}
            </Button>
          </div>
        )}
      </div>

      {error && <LoadError message={error} onRetry={reload} />}
      {loading && !data && <ListSkeleton />}
      {data && !error && data.expenses.length === 0 && <EmptyState title={t('costs.noExpenses')} body={t('costs.noExpensesBody')} />}
      {data && data.expenses.length > 0 && (
        <Table>
          <thead>
            <tr>
              <Th className="w-10">
                {pending.length > 0 && (
                  <input
                    type="checkbox"
                    className="size-5 accent-(--color-accent)"
                    aria-label={t('costs.selectAllPending')}
                    checked={allPendingSelected}
                    onChange={() => setSelected(allPendingSelected ? new Set() : new Set(pending.map((x) => x.id)))}
                  />
                )}
              </Th>
              <Th>{t('costs.paidOn')}</Th>
              <Th>{t('costs.category')}</Th>
              <Th>{t('costs.vendor')}</Th>
              <Th numeric>{t('costs.amountCol')}</Th>
              <Th>{t('costs.colStatus')}</Th>
              <Th>
                <span className="sr-only">{t('costs.colActions')}</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {data.expenses.map((x) => {
              const isPending = x.status === 'PENDING_APPROVAL';
              const busy = busyIds.has(x.id);
              return (
                <tr key={x.id}>
                  <Td>
                    {isPending && (
                      <input
                        type="checkbox"
                        className="size-5 accent-(--color-accent)"
                        aria-label={t('costs.selectExpense', { vendor: x.vendorName ?? x.category.name, amount: formatMinorUnits(x.amountMinorUnits) })}
                        checked={selected.has(x.id)}
                        onChange={() => toggleOne(x.id)}
                      />
                    )}
                  </Td>
                  <Td className="whitespace-nowrap">{formatDate(x.paidAt)}</Td>
                  <Td>{x.category.name}</Td>
                  <Td className="text-muted">{x.vendorName ?? '-'}</Td>
                  <Td numeric className="font-medium">
                    {formatMinorUnits(x.amountMinorUnits)}
                  </Td>
                  <Td>
                    <StatusBadge status={x.status} />
                    {x.status === 'REJECTED' && x.rejectionReason && <p className="mt-1 max-w-48 text-xs text-muted">{x.rejectionReason}</p>}
                  </Td>
                  <Td className="text-right">
                    {isPending && (
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" onClick={() => void approve([x.id])} loading={busy} disabled={bulkBusy} aria-label={`${t('costs.approve')}: ${x.category.name} ${formatMinorUnits(x.amountMinorUnits)}`}>
                          {t('costs.approve')}
                        </Button>
                        <Button variant="ghost" onClick={() => openReject([x.id])} disabled={busy || bulkBusy} aria-label={`${t('costs.reject')}: ${x.category.name} ${formatMinorUnits(x.amountMinorUnits)}`}>
                          {t('costs.reject')}
                        </Button>
                      </div>
                    )}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}

      <Dialog
        open={rejectIds !== null}
        onClose={() => !rejecting && setRejectIds(null)}
        title={t('costs.rejectTitle', { count: rejectIds?.length ?? 0 })}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRejectIds(null)} disabled={rejecting}>
              {t('costs.cancel')}
            </Button>
            <Button variant="danger" onClick={() => void confirmReject()} loading={rejecting}>
              {t('costs.confirmReject')}
            </Button>
          </>
        }
      >
        <Textarea label={t('costs.rejectReason')} value={reason} onChange={(e) => setReason(e.target.value)} error={reasonError} />
      </Dialog>
    </div>
  );
}

// -- Summary -----------------------------------------------------------------

function SummaryTab() {
  const { t } = useTranslation();
  const [range, setRange] = useState(() => presetRange('month'));
  const rangeError = !range.from || !range.to ? t('costs.v.range') : range.from > range.to ? t('costs.v.rangeOrder') : null;
  const fn = useCallback(
    () => costsApi.getSummary(new Date(`${range.from}T00:00:00`).toISOString(), new Date(`${range.to}T23:59:59`).toISOString()),
    [range.from, range.to],
  );
  const { data, loading, error, reload } = useAsync<CostSummary>(rangeError ? null : fn);

  return (
    <div className="space-y-6">
      <Live busy={loading} />
      <Panel>
        <div className="flex flex-wrap items-start gap-3">
          <div className="grid w-full grid-cols-1 gap-3 sm:w-auto sm:grid-cols-2">
            <Field label={t('costs.from')} type="date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
            <Field label={t('costs.to')} type="date" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} error={rangeError} />
          </div>
          <Button variant="secondary" className="sm:mt-7" onClick={reload} loading={loading} disabled={!!rangeError}>
            {t('costs.refresh')}
          </Button>
        </div>
      </Panel>
      {error && <LoadError message={error} onRetry={reload} />}
      {loading && !data && <ListSkeleton />}
      {data && !error && !rangeError && (
        <div className="space-y-4">
          <p className="text-sm text-muted">{t('costs.summaryPeriod', { from: formatDate(range.from), to: formatDate(range.to) })}</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <StatCard label={t('costs.totalApproved')} value={formatMinorUnits(data.grandTotalMinorUnits)} />
            <StatCard label={t('costs.expenseCount')} value={data.expenseCount} />
          </div>
          {data.byCategory.length === 0 ? (
            <EmptyState title={t('costs.noSummary')} body={t('costs.noSummaryBody')} />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>{t('costs.category')}</Th>
                  <Th numeric>{t('costs.count')}</Th>
                  <Th numeric>{t('costs.total')}</Th>
                </tr>
              </thead>
              <tbody>
                {data.byCategory.map((row) => (
                  <tr key={row.categoryId}>
                    <Td>{row.categoryName}</Td>
                    <Td numeric>{row.count}</Td>
                    <Td numeric className="font-medium">
                      {formatMinorUnits(row.totalMinorUnits)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      )}
    </div>
  );
}

// -- Page --------------------------------------------------------------------

export function CostsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('expenses');
  const items = [
    { key: 'expenses', label: t('costs.tabExpenses') },
    { key: 'categories', label: t('costs.tabCategories') },
    { key: 'summary', label: t('costs.tabSummary') },
  ];
  return (
    <>
      <PageHeader title={t('costs.title')} description={t('costs.subtitle')} />
      <Tabs items={items} active={tab} onChange={(k) => setTab(k as Tab)} label={t('costs.title')} />
      <div role="tabpanel">
        {tab === 'expenses' && <ExpensesTab />}
        {tab === 'categories' && <CategoriesTab />}
        {tab === 'summary' && <SummaryTab />}
      </div>
    </>
  );
}
