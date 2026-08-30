import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { costsApi, listLocations, formatMinorUnits, type ExpenseCategory, type Expense, type ExpenseStatus, type Location } from './api';

type Tab = 'expenses' | 'categories' | 'summary';

// ── Shared helpers ─────────────────────────────────────────────────────────────

function statusBadge(status: ExpenseStatus) {
  const base = 'inline-block rounded-full px-2 py-0.5 text-xs font-medium';
  if (status === 'APPROVED') return <span className={`${base} bg-green-100 text-green-700`}>Approved</span>;
  if (status === 'REJECTED') return <span className={`${base} bg-red-100 text-red-700`}>Rejected</span>;
  return <span className={`${base} bg-amber-100 text-amber-700`}>Pending</span>;
}

function randomUuid(): string {
  return crypto.randomUUID();
}

// ── Categories tab ─────────────────────────────────────────────────────────────

function CategoriesTab() {
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    costsApi.listCategories()
      .then(setCategories)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const createCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    costsApi.createCategory({ name: name.trim(), description: description.trim() || undefined, requiresApproval })
      .then((cat) => {
        setCategories((prev) => [...prev, cat]);
        setName('');
        setDescription('');
        setRequiresApproval(false);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setSaving(false));
  };

  const toggleActive = (cat: ExpenseCategory) => {
    costsApi.updateCategory(cat.id, { isActive: !cat.isActive })
      .then((updated) => setCategories((prev) => prev.map((c) => (c.id === updated.id ? updated : c))))
      .catch((err: Error) => setError(err.message));
  };

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && <p className="text-sm text-slate-500">Loading categories…</p>}

      <form onSubmit={createCategory} className="flex flex-wrap gap-3 items-end rounded-lg border border-slate-200 bg-white p-4">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Category name *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Rent, Utilities"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Description</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={requiresApproval}
            onChange={(e) => setRequiresApproval(e.target.checked)}
          />
          Requires approval
        </label>
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Add category'}
        </button>
      </form>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Name</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Description</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Approval required</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {categories.length === 0 && !loading && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500">
                  No categories yet. Add one above.
                </td>
              </tr>
            )}
            {categories.map((cat) => (
              <tr key={cat.id}>
                <td className="px-4 py-3 font-medium text-slate-900">{cat.name}</td>
                <td className="px-4 py-3 text-slate-600">{cat.description ?? '—'}</td>
                <td className="px-4 py-3">{cat.requiresApproval ? 'Yes' : 'No'}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${cat.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                    {cat.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => toggleActive(cat)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    {cat.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Expenses tab ───────────────────────────────────────────────────────────────

function ExpensesTab() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<ExpenseStatus | ''>('');

  // New expense form
  const [form, setForm] = useState({
    locationId: '',
    expenseCategoryId: '',
    amountRupees: '',
    paidAt: new Date().toISOString().slice(0, 10),
    description: '',
    vendorName: '',
    isRecurring: false,
  });
  const [saving, setSaving] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const loadData = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      costsApi.listExpenses(filterStatus ? { status: filterStatus } : {}),
      costsApi.listCategories(),
      listLocations(),
    ])
      .then(([exp, cats, locs]) => {
        setExpenses(exp);
        setCategories(cats.filter((c) => c.isActive));
        setLocations(locs.filter((l) => l.isActive));
        // Auto-select first location if form is empty and one location available
        if (locs.length === 1) {
          setForm((f) => (f.locationId ? f : { ...f, locationId: locs[0].id }));
        }
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [filterStatus]);

  useEffect(() => { loadData(); }, [loadData]);

  const submitExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const amountMinorUnits = Math.round(parseFloat(form.amountRupees) * 100);
    if (!form.locationId || !form.expenseCategoryId || isNaN(amountMinorUnits) || amountMinorUnits < 1) return;
    setSaving(true);
    costsApi.createExpense({
      locationId: form.locationId,
      expenseCategoryId: form.expenseCategoryId,
      amountMinorUnits,
      paidAt: new Date(form.paidAt).toISOString(),
      description: form.description || undefined,
      vendorName: form.vendorName || undefined,
      isRecurring: form.isRecurring,
      idempotencyKey: randomUuid(),
    })
      .then((exp) => {
        setExpenses((prev) => [exp, ...prev]);
        setForm({ locationId: '', expenseCategoryId: '', amountRupees: '', paidAt: new Date().toISOString().slice(0, 10), description: '', vendorName: '', isRecurring: false });
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setSaving(false));
  };

  const approve = (id: string) => {
    costsApi.approveExpense(id)
      .then((updated) => setExpenses((prev) => prev.map((e) => (e.id === updated.id ? updated : e))))
      .catch((err: Error) => setError(err.message));
  };

  const confirmReject = (id: string) => {
    if (!rejectReason.trim()) return;
    costsApi.rejectExpense(id, rejectReason.trim())
      .then((updated) => {
        setExpenses((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
        setRejectingId(null);
        setRejectReason('');
      })
      .catch((err: Error) => setError(err.message));
  };

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-red-600">{error}</p>}

      <form onSubmit={submitExpense} className="flex flex-wrap gap-3 items-end rounded-lg border border-slate-200 bg-white p-4">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Location *</label>
          <select
            value={form.locationId}
            onChange={(e) => setForm((f) => ({ ...f, locationId: e.target.value }))}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          >
            <option value="">Select location…</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Category *</label>
          <select
            value={form.expenseCategoryId}
            onChange={(e) => setForm((f) => ({ ...f, expenseCategoryId: e.target.value }))}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          >
            <option value="">Select…</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Amount (₹) *</label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={form.amountRupees}
            onChange={(e) => setForm((f) => ({ ...f, amountRupees: e.target.value }))}
            placeholder="0.00"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Paid on *</label>
          <input
            type="date"
            value={form.paidAt}
            onChange={(e) => setForm((f) => ({ ...f, paidAt: e.target.value }))}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Vendor</label>
          <input
            value={form.vendorName}
            onChange={(e) => setForm((f) => ({ ...f, vendorName: e.target.value }))}
            placeholder="Optional"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Description</label>
          <input
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Optional"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.isRecurring}
            onChange={(e) => setForm((f) => ({ ...f, isRecurring: e.target.checked }))}
          />
          Recurring
        </label>
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Record expense'}
        </button>
      </form>

      <div className="flex items-center gap-3">
        <label className="text-sm text-slate-700">Filter:</label>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as ExpenseStatus | '')}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        >
          <option value="">All</option>
          <option value="PENDING_APPROVAL">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>
        <button type="button" onClick={loadData} className="text-sm text-blue-600 hover:underline" disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Paid on</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Category</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Vendor</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Amount</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {expenses.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-500">
                  No expenses found.
                </td>
              </tr>
            )}
            {expenses.map((exp) => (
              <tr key={exp.id}>
                <td className="px-4 py-3 text-slate-900">{exp.paidAt.slice(0, 10)}</td>
                <td className="px-4 py-3 text-slate-700">{exp.category.name}</td>
                <td className="px-4 py-3 text-slate-600">{exp.vendorName ?? '—'}</td>
                <td className="px-4 py-3 font-medium text-slate-900">{formatMinorUnits(exp.amountMinorUnits)}</td>
                <td className="px-4 py-3">{statusBadge(exp.status)}</td>
                <td className="px-4 py-3 text-right">
                  {exp.status === 'PENDING_APPROVAL' && rejectingId === exp.id ? (
                    <div className="flex items-center justify-end gap-2">
                      <input
                        autoFocus
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Reason (required)"
                        className="rounded border border-slate-300 px-2 py-1 text-xs w-40 focus:outline-none focus:ring-1 focus:ring-red-400"
                      />
                      <button
                        type="button"
                        onClick={() => confirmReject(exp.id)}
                        disabled={!rejectReason.trim()}
                        className="text-xs text-red-600 hover:underline disabled:opacity-40"
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        onClick={() => { setRejectingId(null); setRejectReason(''); }}
                        className="text-xs text-slate-500 hover:underline"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : exp.status === 'PENDING_APPROVAL' ? (
                    <div className="flex items-center justify-end gap-2">
                      <button type="button" onClick={() => approve(exp.id)} className="text-xs text-green-600 hover:underline">Approve</button>
                      <button
                        type="button"
                        onClick={() => { setRejectingId(exp.id); setRejectReason(''); }}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Reject
                      </button>
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Summary tab ────────────────────────────────────────────────────────────────

function SummaryTab() {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 7) + '-01';
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [summary, setSummary] = useState<import('./api').CostSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    costsApi.getSummary(new Date(from).toISOString(), new Date(to + 'T23:59:59').toISOString())
      .then(setSummary)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  };

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex flex-wrap gap-3 items-end rounded-lg border border-slate-200 bg-white p-4">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">From</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">To</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm" />
        </div>
        <button type="button" onClick={load} disabled={loading} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
          {loading ? 'Loading…' : 'Generate'}
        </button>
      </div>

      {summary && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Total Approved</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{formatMinorUnits(summary.grandTotalMinorUnits)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Expenses</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{summary.expenseCount}</p>
            </div>
          </div>
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Category</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">Count</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {summary.byCategory.map((row) => (
                  <tr key={row.categoryId}>
                    <td className="px-4 py-3 text-slate-900">{row.categoryName}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{row.count}</td>
                    <td className="px-4 py-3 text-right font-medium text-slate-900">{formatMinorUnits(row.totalMinorUnits)}</td>
                  </tr>
                ))}
                {summary.byCategory.length === 0 && (
                  <tr><td colSpan={3} className="px-4 py-6 text-center text-sm text-slate-500">No approved expenses in this period.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page shell ─────────────────────────────────────────────────────────────────

export function CostsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('expenses');

  const tabs: { key: Tab; label: string }[] = [
    { key: 'expenses', label: t('costs.tabExpenses') },
    { key: 'categories', label: t('costs.tabCategories') },
    { key: 'summary', label: t('costs.tabSummary') },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('costs.title')}</h1>
        <p className="mt-1 text-sm text-slate-600">{t('costs.subtitle')}</p>
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              tab === key
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'expenses' && <ExpensesTab />}
      {tab === 'categories' && <CategoriesTab />}
      {tab === 'summary' && <SummaryTab />}
    </div>
  );
}
