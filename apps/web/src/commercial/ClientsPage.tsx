import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  listClients,
  getClient,
  updateClient,
  listActivationRequests,
  createActivationRequest,
  transitionActivationRequest,
  type ClientSummary,
  type ClientDetail,
  type ActivationRequest,
  type CommercialStatus,
  type ActivationStatus,
} from './api';

const STATUS_COLORS: Record<CommercialStatus, string> = {
  PROSPECT: 'bg-slate-100 text-slate-700',
  TRIAL: 'bg-yellow-100 text-yellow-700',
  ACTIVE: 'bg-green-100 text-green-700',
  SUSPENDED: 'bg-orange-100 text-orange-700',
  CHURNED: 'bg-red-100 text-red-700',
};

const ACTIVATION_COLORS: Record<ActivationStatus, string> = {
  REQUESTED: 'bg-blue-50 text-blue-700',
  QUOTED: 'bg-yellow-50 text-yellow-700',
  APPROVED: 'bg-teal-50 text-teal-700',
  PENDING_SETUP: 'bg-purple-50 text-purple-700',
  ACTIVE: 'bg-green-50 text-green-700',
  SUSPENDED: 'bg-orange-50 text-orange-700',
  REMOVED: 'bg-slate-50 text-slate-500',
};

const VALID_NEXT: Record<ActivationStatus, ActivationStatus[]> = {
  REQUESTED: ['QUOTED', 'REMOVED'],
  QUOTED: ['APPROVED', 'REQUESTED', 'REMOVED'],
  APPROVED: ['PENDING_SETUP', 'QUOTED', 'REMOVED'],
  PENDING_SETUP: ['ACTIVE', 'REMOVED'],
  ACTIVE: ['SUSPENDED', 'REMOVED'],
  SUSPENDED: ['ACTIVE', 'REMOVED'],
  REMOVED: [],
};

export function ClientsPage() {
  const { t } = useTranslation();
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [selected, setSelected] = useState<ClientDetail | null>(null);
  const [activations, setActivations] = useState<ActivationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<CommercialStatus | ''>('');

  useEffect(() => {
    void load();
  }, [filterStatus]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await listClients(filterStatus ? { commercialStatus: filterStatus } : undefined);
      setClients(data);
    } catch {
      setError(t('commercial.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }

  async function openClient(client: ClientSummary) {
    try {
      const [detail, reqs] = await Promise.all([
        getClient(client.id),
        listActivationRequests(client.id),
      ]);
      setSelected(detail);
      setActivations(reqs);
    } catch {
      setError(t('commercial.errors.loadFailed'));
    }
  }

  async function setCommercialStatus(status: CommercialStatus) {
    if (!selected) return;
    try {
      await updateClient(selected.id, { commercialStatus: status });
      const updated = await getClient(selected.id);
      setSelected(updated);
      await load();
    } catch {
      setError(t('commercial.errors.saveFailed'));
    }
  }

  async function createNewActivation() {
    if (!selected) return;
    const moduleKeys = window.prompt(t('commercial.activation.promptModuleKeys'), 'restaurant,catalog');
    if (!moduleKeys) return;
    try {
      await createActivationRequest(selected.id, {
        moduleKeys: moduleKeys.split(',').map((k) => k.trim()),
      });
      const reqs = await listActivationRequests(selected.id);
      setActivations(reqs);
    } catch {
      setError(t('commercial.errors.saveFailed'));
    }
  }

  async function handleTransition(req: ActivationRequest, toStatus: ActivationStatus) {
    if (!selected) return;
    try {
      await transitionActivationRequest(selected.id, req.id, { toStatus });
      const reqs = await listActivationRequests(selected.id);
      setActivations(reqs);
    } catch {
      setError(t('commercial.errors.saveFailed'));
    }
  }

  if (selected) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setSelected(null)}
          className="mb-4 text-sm text-blue-600 hover:underline"
        >
          {t('commercial.back')}
        </button>

        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">{selected.name}</h2>
            <p className="text-sm text-slate-500">
              {selected.businessType.name} · {selected.locations.length} {t('commercial.locations')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[selected.commercialStatus]}`}>
              {selected.commercialStatus}
            </span>
            <select
              value={selected.commercialStatus}
              onChange={(e) => void setCommercialStatus(e.target.value as CommercialStatus)}
              className="text-sm rounded-md border border-slate-300 px-2 py-1"
            >
              {(['PROSPECT', 'TRIAL', 'ACTIVE', 'SUSPENDED', 'CHURNED'] as CommercialStatus[]).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium">{t('commercial.activation.title')}</h3>
            <button
              type="button"
              onClick={() => void createNewActivation()}
              className="text-sm rounded-md bg-blue-600 px-3 py-1.5 text-white hover:bg-blue-700"
            >
              {t('commercial.activation.create')}
            </button>
          </div>
          {activations.length === 0 ? (
            <p className="text-sm text-slate-500">{t('commercial.activation.empty')}</p>
          ) : (
            <div className="space-y-3">
              {activations.map((req) => (
                <div key={req.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ACTIVATION_COLORS[req.status]}`}>
                        {req.status}
                      </span>
                      <span className="text-sm text-slate-600">
                        {req.bundle?.name ?? req.moduleKeys.join(', ')}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400">
                      {new Date(req.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  {VALID_NEXT[req.status].length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {VALID_NEXT[req.status].map((next) => (
                        <button
                          key={next}
                          type="button"
                          onClick={() => void handleTransition(req, next)}
                          className="text-xs rounded border border-slate-200 px-2 py-0.5 text-slate-600 hover:bg-slate-50"
                        >
                          → {next}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as CommercialStatus | '')}
          className="text-sm rounded-md border border-slate-300 px-2 py-1.5"
        >
          <option value="">{t('commercial.allStatuses')}</option>
          {(['PROSPECT', 'TRIAL', 'ACTIVE', 'SUSPENDED', 'CHURNED'] as CommercialStatus[]).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <span className="text-sm text-slate-500">{clients.length} {t('commercial.clientCount')}</span>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-slate-500">{t('commercial.loading')}</p>
      ) : clients.length === 0 ? (
        <p className="text-sm text-slate-500">{t('commercial.noClients')}</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">{t('commercial.col.name')}</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">{t('commercial.col.type')}</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">{t('commercial.col.status')}</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">{t('commercial.col.locations')}</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">{t('commercial.col.assignedTo')}</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {clients.map((client) => (
                <tr key={client.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{client.name}</td>
                  <td className="px-4 py-3 text-slate-500">{client.businessType.name}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[client.commercialStatus]}`}>
                      {client.commercialStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{client._count.locations}</td>
                  <td className="px-4 py-3 text-slate-500">{client.assignedTo ?? '—'}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => void openClient(client)}
                      className="text-blue-600 hover:underline"
                    >
                      {t('commercial.view')}
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
