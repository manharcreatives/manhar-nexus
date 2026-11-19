import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { ClientSummary } from '../commercial/api';
import { renewalState } from '../commercial/helpers';
import { getAttention, listRegistrations } from '../registrations/api';
import { Skeleton } from '../ui/states';
import { InlineError } from './InlineError';
import { useWidget, type WidgetState } from './useWidget';

interface Needs {
  newRequests: number;
  paidNoAccount: number;
  mismatch: number;
  failed: number;
  closedPaid: number;
}

async function loadNeeds(): Promise<Needs> {
  const [fresh, attention] = await Promise.all([listRegistrations({ status: 'NEW', take: 1 }), getAttention()]);
  return {
    newRequests: fresh.total,
    paidNoAccount: attention.paidNotConverted.length,
    mismatch: attention.mismatch?.length ?? 0,
    failed: attention.failedProvisioning.length,
    closedPaid: attention.paidClosed?.length ?? 0,
  };
}

type Tone = 'bad' | 'accent' | 'info' | 'warn';
const TONE: Record<Tone, string> = {
  bad: 'text-bad',
  accent: 'text-accent-strong',
  info: 'text-info',
  warn: 'text-warn',
};

interface Tile {
  key: string;
  count: number;
  tone: Tone;
  to: string;
}

/**
 * "Who needs me now": the first thing the operator sees on Home. Only the things that have something waiting show
 * up, most urgent first (money problems, then new requests, then renewals); a calm line says so when nothing waits.
 */
export function NeedsYouNow({ clients }: { clients: WidgetState<{ clients: ClientSummary[]; complete: boolean }> }) {
  const { t } = useTranslation();
  const needs = useWidget(useCallback(loadNeeds, []), 60_000);
  if (needs.hidden) return null;

  const renewals = (clients.data?.clients ?? []).reduce(
    (acc, c) => {
      // Only clients that are meant to be paying count (a churned or suspended client is not "due").
      if (c.commercialStatus === 'CHURNED' || c.commercialStatus === 'SUSPENDED') return acc;
      const s = renewalState(c.paidUntil);
      if (s === 'overdue') acc.overdue += 1;
      if (s === 'soon') acc.soon += 1;
      return acc;
    },
    { overdue: 0, soon: 0 },
  );

  const d = needs.data;
  const tiles: Tile[] = d
    ? [
        { key: 'mismatch', count: d.mismatch, tone: 'bad', to: '/registrations' },
        { key: 'failed', count: d.failed, tone: 'bad', to: '/registrations' },
        { key: 'closedPaid', count: d.closedPaid, tone: 'bad', to: '/registrations' },
        { key: 'paidNoAccount', count: d.paidNoAccount, tone: 'accent', to: '/registrations' },
        { key: 'newRequests', count: d.newRequests, tone: 'info', to: '/registrations' },
        { key: 'renewalsOverdue', count: renewals.overdue, tone: 'bad', to: '/commercial' },
        { key: 'renewalsSoon', count: renewals.soon, tone: 'warn', to: '/commercial' },
      ].filter((x) => x.count > 0) as Tile[]
    : [];

  return (
    <section aria-labelledby="ph-needs" className="lg:col-span-12">
      <h2 id="ph-needs" className="font-display text-xl font-semibold">
        {t('platformHome.needs.title')}
      </h2>
      {needs.loading && !d ? (
        <div aria-hidden className="mt-4 flex gap-3">
          <Skeleton className="h-24 w-48" />
          <Skeleton className="h-24 w-48" />
        </div>
      ) : null}
      {needs.error && !d ? <InlineError title={t('platformHome.needs.loadError')} onRetry={needs.reload} className="mt-4" /> : null}
      {d && tiles.length === 0 ? <p className="mt-3 rounded-control bg-white/[0.04] px-4 py-3 text-sm text-muted">{t('platformHome.needs.allClear')}</p> : null}
      {d && tiles.length > 0 ? (
        <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {tiles.map((tile) => (
            <li key={tile.key}>
              <Link
                to={tile.to}
                className="nx-glass flex min-h-11 items-center gap-4 rounded-panel px-4 py-3 transition-colors hover:border-accent/40"
              >
                <span className={`tabular font-display text-4xl leading-none font-semibold ${TONE[tile.tone]}`}>{tile.count}</span>
                <span className="min-w-0 flex-1 text-sm">{t(`platformHome.needs.${tile.key}`, { count: tile.count })}</span>
                <span className="text-sm font-medium text-accent">{t('platformHome.needs.open')} ›</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
