import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { listClients, type ClientSummary } from '../commercial/api';
import { COMMERCIAL_TONE, errorMessage } from '../commercial/helpers';
import { FormError, ListSkeleton } from '../commercial/Shared';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { PageHeader } from '../ui/PageHeader';
import { StatusPill } from '../ui/StatusPill';
import { Tabs } from '../ui/Tabs';
import { Textarea } from '../ui/Textarea';
import { EmptyState, ErrorState, Skeleton } from '../ui/states';
import { useToast } from '../ui/Toast';
import { initializeOnboarding, listOnboardings, ONBOARDING_STEPS, type OnboardingProgress } from './api';
import { BusinessPicker } from './BusinessPicker';
import { OnboardingWizard } from './OnboardingWizard';

type Filter = 'progress' | 'completed' | 'all';
const FILTER_VALUE: Record<Filter, boolean | undefined> = { progress: false, completed: true, all: undefined };
const START_FORM = 'onboarding-start-form';

export function OnboardingPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const [onboardings, setOnboardings] = useState<OnboardingProgress[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [filter, setFilter] = useState<Filter>('progress');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [startOpen, setStartOpen] = useState(false);
  const [clients, setClients] = useState<ClientSummary[] | null>(null);
  const [clientsFailed, setClientsFailed] = useState(false);
  const [existing, setExisting] = useState<Set<string>>(new Set());
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadFailed(false);
    setOnboardings(null);
    try {
      setOnboardings(await listOnboardings({ completed: FILTER_VALUE[filter] }));
    } catch {
      setLoadFailed(true);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadPickerData = useCallback(async () => {
    setClientsFailed(false);
    setClients(null);
    try {
      const [c, all] = await Promise.all([listClients({ take: 200 }), listOnboardings()]);
      setClients(c);
      setExisting(new Set(all.map((o) => o.businessId)));
    } catch {
      setClientsFailed(true);
    }
  }, []);

  function openStart() {
    setPickedId(null);
    setNotes('');
    setSubmitted(false);
    setStartError(null);
    setStartOpen(true);
    void loadPickerData();
  }

  async function submitStart(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (!pickedId || starting) return;
    setStarting(true);
    setStartError(null);
    try {
      await initializeOnboarding(pickedId, notes.trim() || undefined);
      const name = clients?.find((c) => c.id === pickedId)?.name ?? '';
      toast.show(t('onboarding.started', { name }));
      setStartOpen(false);
      setSelectedId(pickedId);
    } catch (err) {
      setStartError(errorMessage(err, t('onboarding.errors.initFailed')));
    } finally {
      setStarting(false);
    }
  }

  if (selectedId) {
    return (
      <OnboardingWizard
        businessId={selectedId}
        onBack={() => {
          setSelectedId(null);
          void load();
        }}
      />
    );
  }

  const disabledReasons = new Map([...existing].map((id) => [id, t('onboarding.picker.alreadyStarted')]));

  return (
    <div>
      <PageHeader
        title={t('onboarding.title')}
        description={t('onboarding.subtitle')}
        actions={<Button onClick={openStart}>{t('onboarding.startNew')}</Button>}
      />

      <Tabs
        label={t('onboarding.filterLabel')}
        active={filter}
        onChange={(k) => setFilter(k as Filter)}
        items={[
          { key: 'progress', label: t('onboarding.filterInProgress') },
          { key: 'completed', label: t('onboarding.filterCompleted') },
          { key: 'all', label: t('onboarding.filterAll') },
        ]}
      />

      <div role="tabpanel">
        {loadFailed ? (
          <ErrorState
            title={t('onboarding.errors.loadTitle')}
            body={t('onboarding.errors.loadFailed')}
            onRetry={() => void load()}
            retryLabel={t('commercial.retry')}
          />
        ) : onboardings === null ? (
          <ListSkeleton label={t('onboarding.loading')} />
        ) : onboardings.length === 0 ? (
          <EmptyState
            title={t(filter === 'progress' ? 'onboarding.emptyProgressTitle' : 'onboarding.emptyTitle')}
            body={t(filter === 'progress' ? 'onboarding.emptyProgress' : 'onboarding.empty')}
            action={<Button onClick={openStart}>{t('onboarding.startNew')}</Button>}
          />
        ) : (
          <ul className="space-y-3">
            {onboardings.map((o) => {
              const done = o.completedSteps.length;
              const pct = Math.round((done / ONBOARDING_STEPS.length) * 100);
              return (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(o.businessId)}
                    className="block w-full rounded-panel border border-line bg-surface p-4 text-left transition-colors hover:border-accent"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-lg font-semibold">{o.business.name}</p>
                        <p className="text-sm text-muted">
                          {o.completedAt
                            ? t('onboarding.liveSince')
                            : t('onboarding.nextStep', { step: t(`onboarding.steps.${o.currentStep}.label`) })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusPill tone={COMMERCIAL_TONE[o.business.commercialStatus as keyof typeof COMMERCIAL_TONE] ?? 'neutral'}>
                          {t(`commercial.status.${o.business.commercialStatus}`, { defaultValue: o.business.commercialStatus })}
                        </StatusPill>
                        {o.completedAt && <StatusPill tone="ok">{t('onboarding.completed')}</StatusPill>}
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <div
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={pct}
                        aria-label={t('onboarding.wizard.progress')}
                        className="h-2 flex-1 rounded-full bg-sunken"
                      >
                        <div
                          className={`h-2 rounded-full ${o.completedAt ? 'bg-ok' : 'bg-accent'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="tabular shrink-0 text-sm text-muted">
                        {t('onboarding.stepsDone', { done, total: ONBOARDING_STEPS.length })}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Dialog
        open={startOpen}
        onClose={() => !starting && setStartOpen(false)}
        title={t('onboarding.initTitle')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setStartOpen(false)} disabled={starting}>
              {t('onboarding.cancel')}
            </Button>
            <Button type="submit" form={START_FORM} loading={starting} disabled={clientsFailed || clients === null}>
              {starting ? t('onboarding.starting') : t('onboarding.start')}
            </Button>
          </>
        }
      >
        <form id={START_FORM} onSubmit={(e) => void submitStart(e)} noValidate className="space-y-4">
          <p className="text-sm text-muted">{t('onboarding.initHelp')}</p>
          {clientsFailed ? (
            <ErrorState
              title={t('onboarding.errors.clientsTitle')}
              body={t('onboarding.errors.clientsFailed')}
              onRetry={() => void loadPickerData()}
              retryLabel={t('commercial.retry')}
            />
          ) : clients === null ? (
            <Skeleton className="h-48 w-full" />
          ) : clients.length === 0 ? (
            <p className="rounded-control bg-sunken px-3 py-4 text-sm">{t('onboarding.picker.noClients')}</p>
          ) : (
            <BusinessPicker
              clients={clients}
              selectedId={pickedId}
              onSelect={setPickedId}
              disabledReasons={disabledReasons}
              error={submitted && !pickedId ? t('onboarding.picker.required') : null}
            />
          )}
          <Textarea
            label={t('onboarding.initNotes')}
            value={notes}
            maxLength={2000}
            onChange={(e) => setNotes(e.target.value)}
          />
          <FormError message={startError} />
        </form>
      </Dialog>
    </div>
  );
}
