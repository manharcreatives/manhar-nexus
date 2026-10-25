import { Fragment, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { activityApi, type AuditEvent, type AuditListResponse, type ChainVerification } from './api';
import { formatDateTime } from '../reports/dates';
import { useAsync } from '../reports/useAsync';
import { PageHeader } from '../ui/PageHeader';
import { Panel } from '../ui/Panel';
import { Field } from '../ui/Field';
import { Button } from '../ui/Button';
import { StatusPill } from '../ui/StatusPill';
import { Table, Th, Td } from '../ui/Table';
import { EmptyState, ErrorState, Skeleton } from '../ui/states';

const PAGE_SIZE = 25;

interface Filters {
  action: string;
  resourceType: string;
  from: string;
  to: string;
}
const NO_FILTERS: Filters = { action: '', resourceType: '', from: '', to: '' };

function EventRow({ event }: { event: AuditEvent }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const hasMeta = Object.keys(event.metadata).length > 0;
  const who = event.actorLabel ?? event.actorId ?? event.actorType;
  return (
    <Fragment>
      <tr>
        <Td className="whitespace-nowrap text-muted">{formatDateTime(event.createdAt)}</Td>
        <Td>{who}</Td>
        <Td>
          <code className="rounded-control bg-sunken px-1.5 py-0.5 font-mono text-xs">{event.action}</code>
        </Td>
        <Td>
          {event.resourceType}
          {event.resourceId && <span className="block max-w-40 truncate font-mono text-xs text-muted" title={event.resourceId}>{event.resourceId}</span>}
        </Td>
        <Td numeric className="font-mono text-xs text-muted">
          {event.sequence}
        </Td>
        <Td className="text-right">
          <Button
            variant="ghost"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            aria-label={`${open ? t('activity.hideDetails') : t('activity.showDetails')}: ${event.action} #${event.sequence}`}
          >
            {open ? t('activity.hideDetails') : t('activity.showDetails')}
          </Button>
        </Td>
      </tr>
      {open && (
        <tr>
          <td colSpan={6} className="border-b border-line/60 bg-sunken/50 px-4 py-3">
            <dl className="grid gap-x-6 gap-y-2 text-xs sm:grid-cols-[auto_1fr]">
              <dt className="text-muted">{t('activity.hash')}</dt>
              <dd className="break-all font-mono">{event.hash}</dd>
              <dt className="text-muted">{t('activity.prevHash')}</dt>
              <dd className="break-all font-mono">{event.prevHash ?? t('activity.firstEntry')}</dd>
            </dl>
            {hasMeta ? (
              <pre className="mt-3 max-h-64 overflow-auto rounded-control bg-surface p-3 font-mono text-xs">{JSON.stringify(event.metadata, null, 2)}</pre>
            ) : (
              <p className="mt-3 text-xs text-muted">{t('activity.noMetadata')}</p>
            )}
          </td>
        </tr>
      )}
    </Fragment>
  );
}

function IntegrityPanel() {
  const { t } = useTranslation();
  const [result, setResult] = useState<ChainVerification | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const verify = () => {
    if (busy) return;
    setBusy(true);
    setFailed(null);
    activityApi
      .verify()
      .then(setResult)
      .catch((e: unknown) => {
        setResult(null);
        setFailed(e instanceof Error ? e.message : String(e));
      })
      .finally(() => setBusy(false));
  };

  return (
    <Panel className="flex flex-wrap items-center justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold">{t('activity.integrityTitle')}</h2>
        <p className="mt-1 max-w-prose text-sm text-muted">{t('activity.integrityBody')}</p>
        <div role="status" aria-live="polite" className="mt-3">
          {busy && <span className="text-sm text-muted">{t('activity.verifying')}</span>}
          {!busy && !result && !failed && <StatusPill>{t('activity.notVerified')}</StatusPill>}
          {!busy && result?.valid && <StatusPill tone="ok">{t('activity.chainValid', { count: result.count })}</StatusPill>}
          {!busy && result && !result.valid && (
            <div className="space-y-1">
              <StatusPill tone="bad">{t('activity.chainInvalid')}</StatusPill>
              <p className="text-sm">
                {result.brokenAtSequence !== undefined && t('activity.brokenAt', { seq: result.brokenAtSequence })}
                {result.reason ? ` ${result.reason}` : ''}
              </p>
            </div>
          )}
          {!busy && failed && (
            <div className="space-y-1">
              <StatusPill tone="warn">{t('activity.verifyFailed')}</StatusPill>
              <p className="text-sm text-muted">{failed}</p>
            </div>
          )}
        </div>
      </div>
      <Button variant="secondary" onClick={verify} loading={busy}>
        {result || failed ? t('activity.verifyAgain') : t('activity.verifyChain')}
      </Button>
    </Panel>
  );
}

export function ActivityPage() {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<Filters>(NO_FILTERS);
  const [applied, setApplied] = useState<Filters>(NO_FILTERS);
  const [skip, setSkip] = useState(0);

  const dateError = draft.from && draft.to && draft.from > draft.to ? t('activity.dateOrder') : null;

  const fn = useCallback(
    () =>
      activityApi.list({
        take: PAGE_SIZE,
        skip,
        action: applied.action || undefined,
        resourceType: applied.resourceType || undefined,
        from: applied.from || undefined,
        to: applied.to || undefined,
      }),
    [applied, skip],
  );
  const { data, loading, error, reload } = useAsync<AuditListResponse>(fn);

  const search = (e: React.FormEvent) => {
    e.preventDefault();
    if (dateError) return;
    setSkip(0);
    setApplied({ ...draft, action: draft.action.trim(), resourceType: draft.resourceType.trim() });
  };
  const clear = () => {
    setDraft(NO_FILTERS);
    setApplied(NO_FILTERS);
    setSkip(0);
  };

  const total = data?.total ?? 0;
  const page = Math.floor(skip / PAGE_SIZE) + 1;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = Object.values(applied).some(Boolean);

  return (
    <>
      <PageHeader title={t('activity.title')} description={t('activity.subtitle')} />
      <div className="space-y-6">
        <IntegrityPanel />

        <Panel>
          <form onSubmit={search} noValidate aria-label={t('activity.filters')} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label={t('activity.filterAction')} value={draft.action} onChange={(e) => setDraft((d) => ({ ...d, action: e.target.value }))} placeholder={t('activity.actionPh')} />
              <Field label={t('activity.filterResourceType')} value={draft.resourceType} onChange={(e) => setDraft((d) => ({ ...d, resourceType: e.target.value }))} placeholder={t('activity.resourcePh')} />
              <Field label={t('activity.filterFrom')} type="date" value={draft.from} onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))} />
              <Field label={t('activity.filterTo')} type="date" value={draft.to} onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))} error={dateError} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" loading={loading} disabled={!!dateError}>
                {t('activity.search')}
              </Button>
              <Button variant="secondary" onClick={clear} disabled={loading}>
                {t('activity.clearFilters')}
              </Button>
            </div>
          </form>
        </Panel>

        <div role="status" aria-live="polite" className="sr-only">
          {loading ? t('activity.loading') : data ? t('activity.resultsCount', { count: total }) : ''}
        </div>

        {error && <ErrorState title={t('activity.loadError')} body={error} onRetry={reload} retryLabel={t('activity.retry')} />}
        {loading && !data && (
          <div aria-hidden className="space-y-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        )}
        {data && !error && data.events.length === 0 && (
          <EmptyState title={filtered ? t('activity.emptyFilteredTitle') : t('activity.emptyTitle')} body={filtered ? t('activity.emptyFilteredBody') : t('activity.emptyBody')} />
        )}
        {data && data.events.length > 0 && (
          <>
            <Table>
              <caption className="sr-only">{t('activity.title')}</caption>
              <thead>
                <tr>
                  <Th>{t('activity.colTime')}</Th>
                  <Th>{t('activity.colActor')}</Th>
                  <Th>{t('activity.colAction')}</Th>
                  <Th>{t('activity.colResource')}</Th>
                  <Th numeric>{t('activity.colSeq')}</Th>
                  <Th>
                    <span className="sr-only">{t('activity.colDetails')}</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {data.events.map((e) => (
                  <EventRow key={e.id} event={e} />
                ))}
              </tbody>
            </Table>
            <nav aria-label={t('activity.pagination')} className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <span className="tabular text-muted">{t('activity.pageInfo', { page, total: pages, count: total })}</span>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setSkip(Math.max(0, skip - PAGE_SIZE))} disabled={skip === 0 || loading}>
                  {t('activity.prev')}
                </Button>
                <Button variant="secondary" onClick={() => setSkip(skip + PAGE_SIZE)} disabled={page >= pages || loading}>
                  {t('activity.next')}
                </Button>
              </div>
            </nav>
          </>
        )}
      </div>
    </>
  );
}
