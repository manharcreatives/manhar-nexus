import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatMoney } from '../lib/money';
import { listPriceBooks, createPriceBook, type PriceBook } from './api';

const formatMinorUnits = formatMoney;

export function PriceBooksPage() {
  const { t } = useTranslation();
  const [books, setBooks] = useState<PriceBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', currencyCode: 'INR', isDefault: false });

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setBooks(await listPriceBooks());
    } catch {
      setError(t('commercial.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createPriceBook(form);
      setShowForm(false);
      setForm({ name: '', currencyCode: 'INR', isDefault: false });
      await load();
    } catch {
      setError(t('commercial.errors.saveFailed'));
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-medium text-slate-900">{t('commercial.priceBooks.title')}</h2>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="text-sm rounded-md bg-blue-600 px-3 py-1.5 text-white hover:bg-blue-700"
        >
          {t('commercial.priceBooks.add')}
        </button>
      </div>

      {showForm && (
        <form onSubmit={(e) => void submit(e)} className="mb-6 rounded-lg border border-slate-200 p-4 space-y-3">
          <h3 className="font-medium text-sm">{t('commercial.priceBooks.addTitle')}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Name</label>
              <input
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                placeholder="Standard INR 2025"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Currency</label>
              <input
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                value={form.currencyCode}
                maxLength={3}
                onChange={(e) => setForm((f) => ({ ...f, currencyCode: e.target.value.toUpperCase() }))}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
            />
            Set as default price book
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" className="text-sm rounded-md bg-blue-600 px-3 py-1.5 text-white hover:bg-blue-700">
              {t('commercial.save')}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="text-sm rounded-md border border-slate-300 px-3 py-1.5 text-slate-600">
              {t('commercial.cancel')}
            </button>
          </div>
        </form>
      )}

      {error && !showForm && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-slate-500">{t('commercial.loading')}</p>
      ) : books.length === 0 ? (
        <p className="text-sm text-slate-500">{t('commercial.priceBooks.empty')}</p>
      ) : (
        <div className="space-y-4">
          {books.map((book) => (
            <div key={book.id} className={`rounded-lg border p-4 ${book.isDefault ? 'border-blue-300 bg-blue-50/30' : 'border-slate-200'}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{book.name}</span>
                  {book.isDefault && (
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                      Default
                    </span>
                  )}
                  {!book.isActive && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">Inactive</span>
                  )}
                </div>
                <span className="text-sm text-slate-500">{book.currencyCode}</span>
              </div>
              {book.entries.length === 0 ? (
                <p className="text-xs text-slate-400">No price entries yet</p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-slate-500 border-b border-slate-100">
                      <th className="pb-1 pr-4">Offering</th>
                      <th className="pb-1 pr-4">Amount</th>
                      <th className="pb-1">Billing Period</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {book.entries.map((e) => (
                      <tr key={e.id}>
                        <td className="py-1 pr-4 text-slate-700">{e.offering?.name ?? e.offeringId}</td>
                        <td className="py-1 pr-4 font-mono">{formatMinorUnits(e.amountMinorUnits, book.currencyCode)}</td>
                        <td className="py-1 text-slate-500">
                          {e.billingPeriodDays ? `${e.billingPeriodDays}d` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
