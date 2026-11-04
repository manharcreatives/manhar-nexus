import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorMessage } from '../commercial/helpers';
import { ListSkeleton } from '../commercial/Shared';
import { NewRestaurantDialog } from '../onboarding/NewRestaurantDialog';
import { Button } from '../ui/Button';
import { PageHeader } from '../ui/PageHeader';
import { StatusPill } from '../ui/StatusPill';
import { Tabs } from '../ui/Tabs';
import { EmptyState, ErrorState } from '../ui/states';
import { useToast } from '../ui/Toast';
import {
  NEXT_STATUSES,
  listRegistrations,
  updateRegistration,
  whatsappUrl,
  type RegistrationRequest,
  type RegistrationStatus,
} from './api';

type Filter = 'open' | 'CONVERTED' | 'REJECTED' | 'SPAM';
/** "Open" = everything still waiting on a person: NEW, CONTACTED, QUALIFIED. */
const OPEN: readonly RegistrationStatus[] = ['NEW', 'CONTACTED', 'QUALIFIED'];

const TONE: Record<RegistrationStatus, 'info' | 'warn' | 'accent' | 'ok' | 'bad' | 'neutral'> = {
  NEW: 'info',
  CONTACTED: 'warn',
  QUALIFIED: 'accent',
  CONVERTED: 'ok',
  REJECTED: 'bad',
  SPAM: 'neutral',
};

/** Landing-page requests: the platform admin reads the details and creates the restaurant account in one click. */
export function RegistrationsPage({ onOpenOnboarding }: { onOpenOnboarding?: (businessId: string) => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [filter, setFilter] = useState<Filter>('open');
  const [items, setItems] = useState<RegistrationRequest[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState<RegistrationRequest | null>(null);

  const load = useCallback(async () => {
    setLoadFailed(false);
    setItems(null);
    try {
      if (filter === 'open') {
        const pages = await Promise.all(OPEN.map((status) => listRegistrations({ status })));
        const all = pages.flatMap((p) => p.items);
        all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        setItems(all);
      } else {
        setItems((await listRegistrations({ status: filter })).items);
      }
    } catch {
      setLoadFailed(true);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function move(r: RegistrationRequest, status: RegistrationStatus) {
    setBusyId(r.id);
    try {
      await updateRegistration(r.id, { status });
      toast.show(t('registrations.moved', { status: t(`registrations.status.${status}`) }));
      await load();
    } catch (err) {
      toast.show(errorMessage(err, t('registrations.errors.update')));
    } finally {
      setBusyId(null);
    }
  }

  /** The workspace now exists; link it to the request and mark it converted. */
  async function onCreated(r: RegistrationRequest, businessId: string) {
    try {
      await updateRegistration(r.id, { status: 'CONVERTED', businessId });
      toast.show(t('registrations.converted', { name: r.restaurantName }));
    } catch (err) {
      // The restaurant was created; only the bookkeeping failed. Say so, never hide it.
      toast.show(errorMessage(err, t('registrations.errors.linkFailed')));
    }
    void load();
  }

  const canCreate = (r: RegistrationRequest) => r.status !== 'CONVERTED' && r.status !== 'SPAM';

  return (
    <div>
      <PageHeader title={t('registrations.title')} description={t('registrations.subtitle')} />

      <Tabs
        label={t('registrations.filterLabel')}
        active={filter}
        onChange={(k) => setFilter(k as Filter)}
        items={[
          { key: 'open', label: t('registrations.filter.open') },
          { key: 'CONVERTED', label: t('registrations.filter.CONVERTED') },
          { key: 'REJECTED', label: t('registrations.filter.REJECTED') },
          { key: 'SPAM', label: t('registrations.filter.SPAM') },
        ]}
      />

      <div role="tabpanel">
        {loadFailed ? (
          <ErrorState
            title={t('registrations.errors.loadTitle')}
            body={t('registrations.errors.load')}
            onRetry={() => void load()}
            retryLabel={t('commercial.retry')}
          />
        ) : items === null ? (
          <ListSkeleton label={t('registrations.loading')} />
        ) : items.length === 0 ? (
          <EmptyState title={t('registrations.emptyTitle')} body={t('registrations.empty')} />
        ) : (
          <ul className="space-y-3">
            {items.map((r) => (
              <li key={r.id} className="nx-glass rounded-panel p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-lg font-semibold">{r.restaurantName}</p>
                    <p className="text-sm text-muted">
                      <span className="ticket-no">{r.referenceCode}</span> · {new Date(r.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <StatusPill tone={TONE[r.status]}>{t(`registrations.status.${r.status}`)}</StatusPill>
                </div>

                <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="eyebrow">{t('registrations.field.contact')}</dt>
                    <dd>{r.contactName}</dd>
                  </div>
                  <div>
                    <dt className="eyebrow">{t('registrations.field.phone')}</dt>
                    <dd>
                      <a className="underline" href={`tel:${r.phone}`}>{r.phone}</a>
                    </dd>
                  </div>
                  <div>
                    <dt className="eyebrow">{t('registrations.field.email')}</dt>
                    <dd className="break-all">
                      <a className="underline" href={`mailto:${r.email}`}>{r.email}</a>
                    </dd>
                  </div>
                  <div>
                    <dt className="eyebrow">{t('registrations.field.where')}</dt>
                    <dd>
                      {r.city} · {t(`registrations.kind.${r.businessKind}`, { defaultValue: r.businessKind })} ·{' '}
                      {t('registrations.outlets', { count: r.outlets })}
                    </dd>
                  </div>
                </dl>

                {r.message ? (
                  <p className="mt-3 whitespace-pre-wrap rounded-control bg-white/[0.04] px-3 py-2 text-sm">{r.message}</p>
                ) : null}

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {canCreate(r) ? (
                    <Button onClick={() => setCreating(r)} disabled={busyId === r.id}>
                      {t('registrations.createAccount')}
                    </Button>
                  ) : null}
                  <a
                    className="inline-flex min-h-11 items-center rounded-control border border-white/10 bg-white/[0.04] px-4 text-sm hover:border-accent/40"
                    href={whatsappUrl(r.phone, t('registrations.whatsappText', { name: r.contactName, ref: r.referenceCode }))}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t('registrations.whatsapp')}
                  </a>
                  {r.status === 'NEW' ? (
                    <Button variant="secondary" loading={busyId === r.id} onClick={() => void move(r, 'CONTACTED')}>
                      {t('registrations.markContacted')}
                    </Button>
                  ) : null}
                  {NEXT_STATUSES[r.status].includes('REJECTED') && r.status !== 'REJECTED' ? (
                    <Button variant="ghost" loading={busyId === r.id} onClick={() => void move(r, 'REJECTED')}>
                      {t('registrations.reject')}
                    </Button>
                  ) : null}
                  {NEXT_STATUSES[r.status].includes('SPAM') && r.status !== 'SPAM' ? (
                    <Button variant="ghost" loading={busyId === r.id} onClick={() => void move(r, 'SPAM')}>
                      {t('registrations.spam')}
                    </Button>
                  ) : null}
                  {r.status === 'REJECTED' || r.status === 'SPAM' ? (
                    <Button variant="secondary" loading={busyId === r.id} onClick={() => void move(r, 'NEW')}>
                      {t('registrations.reopen')}
                    </Button>
                  ) : null}
                  {r.status === 'CONVERTED' && r.businessId && onOpenOnboarding ? (
                    <Button variant="secondary" onClick={() => onOpenOnboarding(r.businessId as string)}>
                      {t('registrations.openChecklist')}
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {creating ? (
        <NewRestaurantDialog
          prefill={{
            name: creating.restaurantName,
            ownerName: creating.contactName,
            ownerEmail: creating.email,
            note: t('registrations.prefillNote', { ref: creating.referenceCode }),
          }}
          onCreated={(businessId) => void onCreated(creating, businessId)}
          onClose={() => setCreating(null)}
          onOpenChecklist={() => setCreating(null)}
        />
      ) : null}
    </div>
  );
}
