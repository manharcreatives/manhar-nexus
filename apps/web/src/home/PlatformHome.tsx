import { useCallback, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { listClients, listActivationRequests, type ClientSummary } from '../commercial/api';
import { listOnboardings } from '../onboarding/api';
import { InlineBar } from '../charts/InlineBar';
import { Skeleton } from '../ui/states';
import { SectionHeader } from '../ui/SectionHeader';
import * as Icons from '../ui/icons';
import { COMMERCIAL_ORDER, clientsByStatus, isOpenActivation, onboardingInProgress } from './derive';
import { useWidget, type WidgetState } from './useWidget';
import { InlineError } from './InlineError';

const PAGE = 200;
const MAX_PAGES = 5;
/** Activation requests are only listed per client, so look at the clients that have any, up to this many. */
const MAX_CLIENTS_CHECKED = 25;

async function loadClients(): Promise<{ clients: ClientSummary[]; complete: boolean }> {
  const all: ClientSummary[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const rows = await listClients({ skip: page * PAGE, take: PAGE });
    all.push(...rows);
    if (rows.length < PAGE) return { clients: all, complete: true };
  }
  return { clients: all, complete: false };
}

async function loadPending(): Promise<{ count: number; clients: string[]; complete: boolean }> {
  const { clients } = await loadClients();
  const withRequests = clients.filter((c) => c._count.activationRequests > 0);
  const checked = withRequests.slice(0, MAX_CLIENTS_CHECKED);
  const lists = await Promise.all(
    checked.map((c) => listActivationRequests(c.id).then((r) => ({ c, open: r.filter((x) => isOpenActivation(x.status)).length }))),
  );
  const waiting = lists.filter((l) => l.open > 0);
  return {
    count: waiting.reduce((s, l) => s + l.open, 0),
    clients: waiting.map((l) => l.c.name),
    complete: withRequests.length <= MAX_CLIENTS_CHECKED,
  };
}

function Block<T>({
  id,
  title,
  state,
  link,
  className,
  children,
}: {
  id: string;
  title: string;
  state: WidgetState<T>;
  link: { to: string; label: string };
  className?: string;
  children: (data: T) => ReactNode;
}) {
  const { t } = useTranslation();
  if (state.hidden) return null;
  return (
    <section aria-labelledby={id} className={className}>
      <SectionHeader
        as="h2"
        size="sm"
        id={id}
        title={title}
        action={
          <Link to={link.to} className="group -my-2 inline-flex min-h-11 items-center gap-0.5 text-sm font-medium text-accent hover:text-accent-strong">
            {link.label}
            <Icons.ChevronRight aria-hidden className="size-4 transition-transform duration-(--duration-micro) group-hover:translate-x-0.5" />
          </Link>
        }
      />
      {state.loading && state.data === null && (
        <div aria-hidden className="mt-4 space-y-2">
          <Skeleton className="h-12 w-28" />
          <Skeleton className="h-4 w-56" />
        </div>
      )}
      {state.error && state.data === null && <InlineError title={t('platformHome.loadError')} onRetry={state.reload} className="mt-4" />}
      {state.data !== null && <div className="mt-4">{children(state.data)}</div>}
    </section>
  );
}

function Figure({ value, suffix }: { value: number | string; suffix?: string }) {
  return (
    <p className="tabular font-display text-[3.25rem] leading-none font-semibold tracking-[-0.02em]">
      {value}
      {suffix && <span className="ml-2 font-sans text-lg font-normal tracking-normal text-muted">{suffix}</span>}
    </p>
  );
}

/** Platform realm home: real counts from the commercial and onboarding APIs, each block loading on its own. */
export function PlatformHome() {
  const { t } = useTranslation();
  const clients = useWidget(useCallback(loadClients, []), 5 * 60_000);
  const onboarding = useWidget(
    useCallback(() => listOnboardings({ completed: false }).then((rows) => onboardingInProgress(rows)), []),
    5 * 60_000,
  );
  const pending = useWidget(useCallback(loadPending, []), 5 * 60_000);

  return (
    <div className="grid grid-cols-1 gap-x-14 gap-y-12 lg:grid-cols-12">
      <Block
        id="ph-clients"
        title={t('platformHome.clients.title')}
        state={clients}
        link={{ to: '/commercial', label: t('platformHome.clients.link') }}
        className="min-w-0 lg:col-span-7"
      >
        {({ clients: rows, complete }) => {
          const { total, counts } = clientsByStatus(rows);
          return (
            <>
              <Figure value={complete ? total : `${total}+`} suffix={t('platformHome.clients.unit', { count: total })} />
              <ul className="mt-6 divide-y divide-line border-y border-line">
                {COMMERCIAL_ORDER.map((s) => (
                  <li key={s} className="grid grid-cols-[6rem_1fr_3rem] items-center gap-4 py-3 text-sm">
                    <span className="font-medium">{t(`commercial.status.${s}`)}</span>
                    <InlineBar value={counts[s]} max={total} highlight={s === 'ACTIVE'} />
                    <span className="tabular text-right font-medium">{counts[s]}</span>
                  </li>
                ))}
              </ul>
              {!complete && <p className="mt-2 text-xs text-muted">{t('platformHome.clients.partial', { count: total })}</p>}
            </>
          );
        }}
      </Block>

      <div className="min-w-0 space-y-12 lg:col-span-5 lg:border-l lg:border-line lg:pl-10">
        <Block id="ph-onboarding" title={t('platformHome.onboarding.title')} state={onboarding} link={{ to: '/onboarding', label: t('platformHome.onboarding.link') }}>
          {({ open, started }) => (
            <>
              <Figure value={open} />
              <p className="mt-2 text-sm text-muted">{open === 0 ? t('platformHome.onboarding.none') : t('platformHome.onboarding.of', { open, started })}</p>
            </>
          )}
        </Block>

        <Block id="ph-pending" title={t('platformHome.pending.title')} state={pending} link={{ to: '/commercial', label: t('platformHome.pending.link') }}>
          {({ count, clients: names, complete }) => (
            <>
              <Figure value={complete ? count : `${count}+`} />
              <p className="mt-2 text-sm text-muted">
                {count === 0 ? t('platformHome.pending.none') : t('platformHome.pending.waiting', { names: names.slice(0, 3).join(', ') + (names.length > 3 ? `, +${names.length - 3} more` : '') })}
              </p>
              {!complete && <p className="mt-1 text-xs text-muted">{t('platformHome.pending.partial', { count: MAX_CLIENTS_CHECKED })}</p>}
            </>
          )}
        </Block>
      </div>
    </div>
  );
}
