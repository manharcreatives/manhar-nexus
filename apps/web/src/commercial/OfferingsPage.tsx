import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { listOfferings, createOffering, updateOffering, type Offering, type OfferingType } from './api';

const TYPE_LABELS: Record<OfferingType, string> = {
  SETUP_FEE: 'Setup Fee',
  RECURRING: 'Recurring',
  ONE_TIME: 'One-Time',
  TRIAL: 'Trial',
};

export function OfferingsPage() {
  const { t } = useTranslation();
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ key: '', name: '', type: 'SETUP_FEE' as OfferingType, moduleKeys: '' });

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setOfferings(await listOfferings());
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
      await createOffering({
        key: form.key,
        name: form.name,
        type: form.type,
        moduleKeys: form.moduleKeys ? form.moduleKeys.split(',').map((k) => k.trim()) : [],
      });
      setShowForm(false);
      setForm({ key: '', name: '', type: 'SETUP_FEE', moduleKeys: '' });
      await load();
    } catch {
      setError(t('commercial.errors.saveFailed'));
    }
  }

  async function toggleActive(o: Offering) {
    try {
      await updateOffering(o.id, { isActive: !o.isActive });
      await load();
    } catch {
      setError(t('commercial.errors.saveFailed'));
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-medium text-slate-900">{t('commercial.offerings.title')}</h2>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="text-sm rounded-md bg-blue-600 px-3 py-1.5 text-white hover:bg-blue-700"
        >
          {t('commercial.offerings.add')}
        </button>
      </div>

      {showForm && (
        <form onSubmit={(e) => void submit(e)} className="mb-6 rounded-lg border border-slate-200 p-4 space-y-3">
          <h3 className="font-medium text-sm">{t('commercial.offerings.addTitle')}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-600 mb-1">{t('commercial.offerings.key')}</label>
              <input
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                placeholder="e.g. restaurant-setup"
                value={form.key}
                onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">{t('commercial.offerings.name')}</label>
              <input
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                placeholder="e.g. Restaurant Setup"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-600 mb-1">{t('commercial.offerings.type')}</label>
              <select
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as OfferingType }))}
              >
                {(Object.keys(TYPE_LABELS) as OfferingType[]).map((k) => (
                  <option key={k} value={k}>{TYPE_LABELS[k]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">{t('commercial.offerings.moduleKeys')}</label>
              <input
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                placeholder="restaurant,catalog"
                value={form.moduleKeys}
                onChange={(e) => setForm((f) => ({ ...f, moduleKeys: e.target.value }))}
              />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" className="text-sm rounded-md bg-blue-600 px-3 py-1.5 text-white hover:bg-blue-700">
              {t('commercial.save')}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="text-sm rounded-md border border-slate-300 px-3 py-1.5 text-slate-600 hover:bg-slate-50">
              {t('commercial.cancel')}
            </button>
          </div>
        </form>
      )}

      {error && !showForm && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-slate-500">{t('commercial.loading')}</p>
      ) : offerings.length === 0 ? (
        <p className="text-sm text-slate-500">{t('commercial.offerings.empty')}</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Key</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Name</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Type</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Modules</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Status</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {offerings.map((o) => (
                <tr key={o.id} className={o.isActive ? '' : 'opacity-50'}>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{o.key}</td>
                  <td className="px-4 py-3 font-medium">{o.name}</td>
                  <td className="px-4 py-3 text-slate-500">{TYPE_LABELS[o.type]}</td>
                  <td className="px-4 py-3 text-slate-500">{o.moduleKeys.join(', ') || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${o.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                      {o.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => void toggleActive(o)}
                      className="text-xs text-slate-500 hover:text-slate-800"
                    >
                      {o.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
