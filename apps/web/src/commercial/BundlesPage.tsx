import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { listBundles, createBundle, type Bundle } from './api';

export function BundlesPage() {
  const { t } = useTranslation();
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ key: '', name: '', description: '' });

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setBundles(await listBundles());
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
      await createBundle({ key: form.key, name: form.name, description: form.description || undefined });
      setShowForm(false);
      setForm({ key: '', name: '', description: '' });
      await load();
    } catch {
      setError(t('commercial.errors.saveFailed'));
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-medium text-slate-900">{t('commercial.bundles.title')}</h2>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="text-sm rounded-md bg-blue-600 px-3 py-1.5 text-white hover:bg-blue-700"
        >
          {t('commercial.bundles.add')}
        </button>
      </div>

      {showForm && (
        <form onSubmit={(e) => void submit(e)} className="mb-6 rounded-lg border border-slate-200 p-4 space-y-3">
          <h3 className="font-medium text-sm">{t('commercial.bundles.addTitle')}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Key</label>
              <input
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                placeholder="restaurant-starter"
                value={form.key}
                onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Name</label>
              <input
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                placeholder="Restaurant Starter Pack"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Description</label>
            <input
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              placeholder="Optional description"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
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
      ) : bundles.length === 0 ? (
        <p className="text-sm text-slate-500">{t('commercial.bundles.empty')}</p>
      ) : (
        <div className="space-y-4">
          {bundles.map((bundle) => (
            <div key={bundle.id} className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{bundle.name}</span>
                  <span className="font-mono text-xs text-slate-400">{bundle.key}</span>
                  {!bundle.isActive && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">Inactive</span>
                  )}
                </div>
              </div>
              {bundle.description && (
                <p className="text-sm text-slate-500 mb-2">{bundle.description}</p>
              )}
              {bundle.items.length === 0 ? (
                <p className="text-xs text-slate-400">No offerings in this bundle</p>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {bundle.items.map((item) => (
                    <span key={item.offeringId} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                      {item.offering.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
