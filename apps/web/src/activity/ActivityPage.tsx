import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { activityApi, type AuditEvent, type AuditFilters } from './api';

const PAGE_SIZE = 25;

function EventRow({ event }: { event: AuditEvent }) {
  const [expanded, setExpanded] = useState(false);
  const meta = Object.keys(event.metadata).length > 0 ? event.metadata : null;

  return (
    <>
      <tr
        className="border-t border-slate-100 cursor-pointer hover:bg-slate-50"
        onClick={() => meta && setExpanded((e) => !e)}
      >
        <td className="px-4 py-2 font-mono text-xs text-slate-500">{event.sequence}</td>
        <td className="px-4 py-2 text-xs text-slate-500 whitespace-nowrap">
          {new Date(event.createdAt).toLocaleString()}
        </td>
        <td className="px-4 py-2 text-sm">
          <span className="inline-block rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-700">
            {event.action}
          </span>
        </td>
        <td className="px-4 py-2 text-sm text-slate-700">{event.resourceType}</td>
        <td className="px-4 py-2 font-mono text-xs text-slate-500">{event.resourceId ?? '—'}</td>
        <td className="px-4 py-2 text-sm text-slate-700">
          {event.actorLabel ?? event.actorId ?? event.actorType}
        </td>
        {meta && (
          <td className="px-4 py-2 text-xs text-blue-600">{expanded ? '▲' : '▼'}</td>
        )}
        {!meta && <td className="px-4 py-2" />}
      </tr>
      {expanded && meta && (
        <tr className="border-t border-slate-50 bg-slate-50">
          <td colSpan={7} className="px-4 py-3">
            <pre className="overflow-x-auto rounded bg-slate-100 p-3 font-mono text-xs text-slate-800">
              {JSON.stringify(meta, null, 2)}
            </pre>
          </td>
        </tr>
      )}
    </>
  );
}

export function ActivityPage() {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<AuditFilters>({ take: PAGE_SIZE, skip: 0 });
  const [draftAction, setDraftAction] = useState('');
  const [draftResourceType, setDraftResourceType] = useState('');
  const [draftFrom, setDraftFrom] = useState('');
  const [draftTo, setDraftTo] = useState('');
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chainStatus, setChainStatus] = useState<{ valid: boolean; count: number } | null>(null);
  const [verifying, setVerifying] = useState(false);

  const fetchPage = useCallback((f: AuditFilters) => {
    setLoading(true);
    setError(null);
    activityApi.list(f)
      .then((r) => { setEvents(r.events); setTotal(r.total); })
      .catch((e: Error) => { setError(e.message); })
      .finally(() => { setLoading(false); });
  }, []);

  const applyFilters = () => {
    const f: AuditFilters = {
      take: PAGE_SIZE,
      skip: 0,
      action: draftAction || undefined,
      resourceType: draftResourceType || undefined,
      from: draftFrom || undefined,
      to: draftTo || undefined,
    };
    setFilters(f);
    fetchPage(f);
  };

  const changePage = (direction: 1 | -1) => {
    const skip = Math.max(0, (filters.skip ?? 0) + direction * PAGE_SIZE);
    const f = { ...filters, skip };
    setFilters(f);
    fetchPage(f);
  };

  const verifyChain = () => {
    setVerifying(true);
    activityApi.verify()
      .then((r) => { setChainStatus({ valid: r.valid, count: r.count }); })
      .catch(() => { setChainStatus({ valid: false, count: 0 }); })
      .finally(() => { setVerifying(false); });
  };

  const currentPage = Math.floor((filters.skip ?? 0) / PAGE_SIZE) + 1;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('activity.title')}</h1>
          <p className="mt-1 text-sm text-slate-600">{t('activity.subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={verifyChain}
          disabled={verifying}
          className="shrink-0 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {verifying ? t('activity.verifying') : t('activity.verifyChain')}
        </button>
      </div>

      {chainStatus && (
        <div
          className={`rounded-md border px-4 py-3 text-sm ${
            chainStatus.valid
              ? 'border-green-200 bg-green-50 text-green-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {chainStatus.valid
            ? t('activity.chainValid', { count: chainStatus.count })
            : t('activity.chainInvalid')}
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">{t('activity.filterAction')}</label>
            <input
              type="text"
              value={draftAction}
              onChange={(e) => setDraftAction(e.target.value)}
              placeholder="e.g. invoice.paid"
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">{t('activity.filterResourceType')}</label>
            <input
              type="text"
              value={draftResourceType}
              onChange={(e) => setDraftResourceType(e.target.value)}
              placeholder="e.g. Invoice"
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">{t('activity.filterFrom')}</label>
            <input
              type="date"
              value={draftFrom}
              onChange={(e) => setDraftFrom(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">{t('activity.filterTo')}</label>
            <input
              type="date"
              value={draftTo}
              onChange={(e) => setDraftTo(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={applyFilters}
            disabled={loading}
            className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? t('activity.loading') : t('activity.search')}
          </button>
          <button
            type="button"
            onClick={() => {
              setDraftAction(''); setDraftResourceType(''); setDraftFrom(''); setDraftTo('');
              const f: AuditFilters = { take: PAGE_SIZE, skip: 0 };
              setFilters(f);
              fetchPage(f);
            }}
            className="rounded-md border border-slate-300 px-4 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            {t('activity.clearFilters')}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {events.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-600">
              <tr>
                <th className="px-4 py-2 text-left">{t('activity.colSeq')}</th>
                <th className="px-4 py-2 text-left">{t('activity.colTime')}</th>
                <th className="px-4 py-2 text-left">{t('activity.colAction')}</th>
                <th className="px-4 py-2 text-left">{t('activity.colResource')}</th>
                <th className="px-4 py-2 text-left">{t('activity.colResourceId')}</th>
                <th className="px-4 py-2 text-left">{t('activity.colActor')}</th>
                <th className="px-4 py-2 w-6" />
              </tr>
            </thead>
            <tbody>
              {events.map((e) => <EventRow key={e.id} event={e} />)}
            </tbody>
          </table>
        </div>
      )}

      {events.length === 0 && !loading && (
        <p className="text-sm text-slate-500 text-center py-8">{t('activity.empty')}</p>
      )}

      {total > 0 && (
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>{t('activity.pageInfo', { page: currentPage, total: totalPages, count: total })}</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => changePage(-1)}
              disabled={(filters.skip ?? 0) === 0 || loading}
              className="rounded-md border border-slate-300 px-3 py-1 hover:bg-slate-50 disabled:opacity-40"
            >
              {t('activity.prev')}
            </button>
            <button
              type="button"
              onClick={() => changePage(1)}
              disabled={currentPage >= totalPages || loading}
              className="rounded-md border border-slate-300 px-3 py-1 hover:bg-slate-50 disabled:opacity-40"
            >
              {t('activity.next')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
