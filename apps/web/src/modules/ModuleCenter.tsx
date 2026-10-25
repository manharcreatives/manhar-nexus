import { useCallback, useEffect, useReducer, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type ApiError } from '../auth/api';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { PageHeader } from '../ui/PageHeader';
import { Panel } from '../ui/Panel';
import { EmptyState, ErrorState, Skeleton } from '../ui/states';
import { StatusPill } from '../ui/StatusPill';
import { useToast } from '../ui/Toast';
import { modulesApi, type ModuleStatus, type ModuleView } from './api';

type State =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; modules: ModuleView[] };

type Action =
  | { type: 'loading' }
  | { type: 'loaded'; modules: ModuleView[] }
  | { type: 'error'; message: string }
  | { type: 'update'; module: ModuleView };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'loading':
      return { phase: 'loading' };
    case 'loaded':
      return { phase: 'ready', modules: action.modules };
    case 'error':
      return { phase: 'error', message: action.message };
    case 'update':
      if (state.phase !== 'ready') return state;
      return {
        phase: 'ready',
        modules: state.modules.map((m) => (m.key === action.module.key ? action.module : m)),
      };
  }
}

type ModuleAction = 'activate' | 'completeSetup' | 'disable' | 'resume';

const TONE: Record<ModuleStatus, 'ok' | 'warn' | 'bad' | 'info' | 'neutral'> = {
  AVAILABLE: 'neutral',
  PENDING_SETUP: 'warn',
  ACTIVE: 'ok',
  DISABLED: 'neutral',
  SUSPENDED: 'bad',
  ARCHIVED: 'neutral',
  TRIAL: 'info',
};

const isOn = (m: ModuleView | undefined) => m?.status === 'ACTIVE' || m?.status === 'TRIAL';

function ModuleCard({
  mod,
  all,
  onRequest,
}: {
  mod: ModuleView;
  all: ModuleView[];
  onRequest: (mod: ModuleView, action: ModuleAction) => void;
}) {
  const { t, i18n } = useTranslation();
  const byKey = new Map(all.map((m) => [m.key, m]));
  const depName = (k: string) => byKey.get(k)?.name ?? k;
  const unmet = mod.dependencies.filter((k) => !isOn(byKey.get(k)));
  const blocked = (mod.status === 'AVAILABLE' || mod.status === 'DISABLED') && unmet.length > 0;
  const titleId = `mod-${mod.key}`;

  return (
    <li className="rounded-panel border border-line bg-surface p-5" aria-labelledby={titleId}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 id={titleId} className="text-lg font-semibold">
              {mod.name}
            </h3>
            <StatusPill tone={TONE[mod.status]}>{t(`modules.status.${mod.status}`)}</StatusPill>
          </div>
          <p className="mt-1 max-w-prose text-sm text-muted">{mod.description}</p>
          {mod.status === 'ACTIVE' && mod.activatedAt && (
            <p className="mt-1 text-xs text-muted">
              {t('modules.activeSince', { date: new Date(mod.activatedAt).toLocaleDateString(i18n.language) })}
            </p>
          )}

          {mod.dependencies.length > 0 && (
            <div className="mt-3 text-sm">
              <span className="font-medium">{t('modules.requires')}: </span>
              <ul className="inline">
                {mod.dependencies.map((k, i) => (
                  <li key={k} className="inline">
                    {depName(k)}{' '}
                    <span className={unmet.includes(k) ? 'text-warn' : 'text-ok'}>
                      ({unmet.includes(k) ? t('modules.requiresUnmet') : t('modules.requiresMet')})
                    </span>
                    {i < mod.dependencies.length - 1 ? ', ' : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {blocked && (
            <p role="note" className="mt-3 rounded-control bg-warn-soft px-3 py-2 text-sm text-warn">
              {t('modules.blockedReason', { names: unmet.map(depName).join(', '), name: mod.name })}
            </p>
          )}

          {mod.status === 'PENDING_SETUP' && (
            <div className="mt-3 rounded-control bg-warn-soft px-3 py-3">
              <p className="text-sm font-semibold text-warn">{t('modules.setupTitle')}</p>
              {mod.setupSteps.length > 0 && (
                <ul className="mt-2 space-y-1.5">
                  {mod.setupSteps.map((step) => (
                    <li key={step.key} className="text-sm text-ink">
                      <span className="font-medium">{step.label}</span>{' '}
                      <span className="text-xs text-muted">
                        ({step.required ? t('modules.setupRequired') : t('modules.setupOptional')})
                      </span>
                      {step.description && <span className="block text-muted">{step.description}</span>}
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-xs text-muted">{t('modules.setupNote')}</p>
            </div>
          )}

          {(mod.status === 'SUSPENDED' || mod.status === 'ARCHIVED') && (
            <p className="mt-3 text-sm text-muted">{t('modules.platformAction')}</p>
          )}
        </div>

        <div className="shrink-0">
          {mod.status === 'AVAILABLE' && (
            <Button disabled={blocked} onClick={() => onRequest(mod, 'activate')}>
              {t('modules.activate')}
            </Button>
          )}
          {mod.status === 'PENDING_SETUP' && (
            <Button onClick={() => onRequest(mod, 'completeSetup')}>{t('modules.completeSetup')}</Button>
          )}
          {(mod.status === 'ACTIVE' || mod.status === 'TRIAL') && (
            <Button variant="secondary" onClick={() => onRequest(mod, 'disable')}>
              {t('modules.disable')}
            </Button>
          )}
          {mod.status === 'DISABLED' && (
            <Button disabled={blocked} onClick={() => onRequest(mod, 'resume')}>
              {t('modules.resume')}
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}

function Section({ title, body, children }: { title: string; body: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mb-3 text-sm text-muted">{body}</p>
      <ul className="space-y-3">{children}</ul>
    </section>
  );
}

export function ModuleCenter() {
  const { t } = useTranslation();
  const toast = useToast();
  const [state, dispatch] = useReducer(reducer, { phase: 'loading' });
  const [pending, setPending] = useState<{ mod: ModuleView; action: ModuleAction } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    dispatch({ type: 'loading' });
    try {
      dispatch({ type: 'loaded', modules: await modulesApi.list() });
    } catch (e) {
      dispatch({ type: 'error', message: (e as ApiError).message ?? t('modules.loadError') });
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  function request(mod: ModuleView, action: ModuleAction) {
    setErr(null);
    setPending({ mod, action });
  }

  async function confirm() {
    if (!pending || busy) return;
    const { mod, action } = pending;
    setBusy(true);
    setErr(null);
    try {
      const updated =
        action === 'activate'
          ? await modulesApi.activate(mod.key)
          : action === 'completeSetup'
            ? await modulesApi.completeSetup(mod.key)
            : action === 'disable'
              ? await modulesApi.disable(mod.key)
              : await modulesApi.resume(mod.key);
      dispatch({ type: 'update', module: updated });
      toast.show(t(`modules.done.${action}`, { name: mod.name }));
      setPending(null);
    } catch (e) {
      setErr((e as ApiError).message ?? t('modules.actionFailed'));
    } finally {
      setBusy(false);
    }
  }

  if (state.phase === 'loading') {
    return (
      <div>
        <PageHeader title={t('modules.title')} description={t('modules.subtitle')} />
        <div role="status" aria-label={t('modules.loading')} className="space-y-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      </div>
    );
  }

  if (state.phase === 'error') {
    return (
      <div>
        <PageHeader title={t('modules.title')} description={t('modules.subtitle')} />
        <ErrorState
          title={t('modules.loadError')}
          body={state.message || t('modules.loadErrorBody')}
          onRetry={() => void load()}
          retryLabel={t('modules.retry')}
        />
      </div>
    );
  }

  const mods = state.modules;
  const active = mods.filter((m) => m.status === 'ACTIVE' || m.status === 'TRIAL');
  const attention = mods.filter((m) => m.status === 'SUSPENDED' || m.status === 'ARCHIVED');
  const available = mods.filter((m) => !active.includes(m) && !attention.includes(m));

  const dependents =
    pending?.action === 'disable'
      ? mods.filter((m) => isOn(m) && m.dependencies.includes(pending.mod.key)).map((m) => m.name)
      : [];

  return (
    <div>
      <PageHeader title={t('modules.title')} description={t('modules.subtitle')} />

      {mods.length === 0 ? (
        <EmptyState title={t('modules.empty')} />
      ) : (
        <div className="space-y-8">
          {active.length > 0 && (
            <Section title={t('modules.sectionActive')} body={t('modules.sectionActiveBody')}>
              {active.map((m) => (
                <ModuleCard key={m.key} mod={m} all={mods} onRequest={request} />
              ))}
            </Section>
          )}
          {available.length > 0 && (
            <Section title={t('modules.sectionAvailable')} body={t('modules.sectionAvailableBody')}>
              {available.map((m) => (
                <ModuleCard key={m.key} mod={m} all={mods} onRequest={request} />
              ))}
            </Section>
          )}
          {attention.length > 0 && (
            <Section title={t('modules.sectionAttention')} body={t('modules.sectionAttentionBody')}>
              {attention.map((m) => (
                <ModuleCard key={m.key} mod={m} all={mods} onRequest={request} />
              ))}
            </Section>
          )}
        </div>
      )}

      <Dialog
        open={pending !== null}
        onClose={() => {
          if (!busy) setPending(null);
        }}
        title={pending ? t(`modules.dialog.${pending.action}Title`, { name: pending.mod.name }) : ''}
        footer={
          <>
            <Button variant="secondary" disabled={busy} onClick={() => setPending(null)}>
              {t('modules.dialog.cancel')}
            </Button>
            <Button
              variant={pending?.action === 'disable' ? 'danger' : 'primary'}
              loading={busy}
              onClick={() => void confirm()}
            >
              {busy
                ? t('modules.working')
                : pending
                  ? t(`modules.${pending.action}`)
                  : ''}
            </Button>
          </>
        }
      >
        {pending && (
          <div className="space-y-3 text-sm">
            <p>{t(`modules.dialog.${pending.action}Body`, { name: pending.mod.name })}</p>
            {dependents.length > 0 && (
              <Panel className="border-warn/40 bg-warn-soft p-3 text-warn">
                {t('modules.dialog.disableDependents', { name: pending.mod.name, names: dependents.join(', ') })}
              </Panel>
            )}
            {err && (
              <p role="alert" className="text-bad">
                {err}
              </p>
            )}
          </div>
        )}
      </Dialog>
    </div>
  );
}
