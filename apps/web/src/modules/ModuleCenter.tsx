import { useCallback, useEffect, useReducer, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type ApiError } from '../auth/api';
import { modulesApi, type ModuleStatus, type ModuleView } from './api';

type State =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; modules: ModuleView[] };

type Action =
  | { type: 'loaded'; modules: ModuleView[] }
  | { type: 'error'; message: string }
  | { type: 'update'; module: ModuleView };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'loaded':
      return { phase: 'ready', modules: action.modules };
    case 'error':
      return { phase: 'error', message: action.message };
    case 'update':
      if (state.phase !== 'ready') return state;
      return {
        phase: 'ready',
        modules: state.modules.map((m) =>
          m.key === action.module.key ? action.module : m,
        ),
      };
  }
}

const STATUS_LABEL: Record<ModuleStatus, string> = {
  AVAILABLE: 'Available',
  PENDING_SETUP: 'Setup required',
  ACTIVE: 'Active',
  DISABLED: 'Disabled',
  SUSPENDED: 'Suspended',
  ARCHIVED: 'Archived',
  TRIAL: 'Trial',
};

const STATUS_STYLE: Record<ModuleStatus, string> = {
  AVAILABLE: 'bg-slate-100 text-slate-600',
  PENDING_SETUP: 'bg-amber-50 text-amber-700',
  ACTIVE: 'bg-emerald-50 text-emerald-700',
  DISABLED: 'bg-slate-100 text-slate-500',
  SUSPENDED: 'bg-rose-50 text-rose-700',
  ARCHIVED: 'bg-slate-100 text-slate-400',
  TRIAL: 'bg-blue-50 text-blue-700',
};

function StatusBadge({ status }: { status: ModuleStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

function ModuleCard({
  mod,
  onAction,
}: {
  mod: ModuleView;
  onAction: (key: string, action: 'activate' | 'completeSetup' | 'disable' | 'resume') => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function act(action: 'activate' | 'completeSetup' | 'disable' | 'resume') {
    setBusy(true);
    setErr(null);
    try {
      await onAction(mod.key, action);
    } catch (e) {
      setErr((e as ApiError).message ?? 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-900">{mod.name}</h3>
            <StatusBadge status={mod.status} />
          </div>
          <p className="mt-1 text-sm text-slate-500">{mod.description}</p>
          {mod.dependencies.length > 0 && (
            <p className="mt-1 text-xs text-slate-400">
              Requires: {mod.dependencies.join(', ')}
            </p>
          )}
          {mod.status === 'PENDING_SETUP' && mod.setupSteps.length > 0 && (
            <div className="mt-3 rounded-md border border-amber-100 bg-amber-50 px-3 py-2">
              <p className="mb-1.5 text-xs font-semibold text-amber-800">Setup checklist</p>
              <ul className="space-y-1">
                {mod.setupSteps.map((step) => (
                  <li key={step.key} className="flex items-start gap-1.5 text-xs text-amber-700">
                    <span className="mt-0.5 shrink-0">{step.required ? '•' : '◦'}</span>
                    <span>
                      <span className="font-medium">{step.label}</span>
                      {step.description && (
                        <span className="ml-1 text-amber-600">— {step.description}</span>
                      )}
                      {step.required && (
                        <span className="ml-1 font-semibold text-amber-800">(required)</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {err && <p className="mt-2 text-xs text-rose-600">{err}</p>}
        </div>

        <div className="shrink-0">
          {mod.status === 'AVAILABLE' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void act('activate')}
              className="rounded-md bg-blue-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-50"
            >
              {busy ? 'Activating…' : 'Activate'}
            </button>
          )}
          {mod.status === 'PENDING_SETUP' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void act('completeSetup')}
              className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Mark Setup Done'}
            </button>
          )}
          {mod.status === 'ACTIVE' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void act('disable')}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {busy ? 'Disabling…' : 'Disable'}
            </button>
          )}
          {mod.status === 'DISABLED' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void act('resume')}
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {busy ? 'Resuming…' : 'Resume'}
            </button>
          )}
          {(mod.status === 'SUSPENDED' || mod.status === 'ARCHIVED') && (
            <span className="text-xs text-slate-400">Platform action required</span>
          )}
        </div>
      </div>
    </div>
  );
}

export function ModuleCenter() {
  const { t } = useTranslation();
  const [state, dispatch] = useReducer(reducer, { phase: 'loading' });

  const load = useCallback(async () => {
    try {
      const modules = await modulesApi.list();
      dispatch({ type: 'loaded', modules });
    } catch (e) {
      dispatch({ type: 'error', message: (e as ApiError).message ?? t('modules.loadError') });
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleAction(
    key: string,
    action: 'activate' | 'completeSetup' | 'disable' | 'resume',
  ) {
    let updated: ModuleView;
    switch (action) {
      case 'activate':
        updated = await modulesApi.activate(key);
        break;
      case 'completeSetup':
        updated = await modulesApi.completeSetup(key);
        break;
      case 'disable':
        updated = await modulesApi.disable(key);
        break;
      case 'resume':
        updated = await modulesApi.resume(key);
        break;
    }
    dispatch({ type: 'update', module: updated });
  }

  if (state.phase === 'loading') {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-slate-500">
        {t('modules.loading')}
      </div>
    );
  }

  if (state.phase === 'error') {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        {state.message}
        <button
          type="button"
          onClick={() => { dispatch({ type: 'loaded', modules: [] }); void load(); }}
          className="ml-3 underline"
        >
          {t('modules.retry')}
        </button>
      </div>
    );
  }

  const active = state.modules.filter((m) => m.status === 'ACTIVE' || m.status === 'TRIAL');
  const other = state.modules.filter((m) => m.status !== 'ACTIVE' && m.status !== 'TRIAL');

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('modules.title')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('modules.subtitle')}</p>
      </div>

      {active.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
            {t('modules.sectionActive')}
          </h2>
          <div className="space-y-3">
            {active.map((m) => (
              <ModuleCard key={m.key} mod={m} onAction={(k, a) => handleAction(k, a)} />
            ))}
          </div>
        </section>
      )}

      {other.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
            {t('modules.sectionAvailable')}
          </h2>
          <div className="space-y-3">
            {other.map((m) => (
              <ModuleCard key={m.key} mod={m} onAction={(k, a) => handleAction(k, a)} />
            ))}
          </div>
        </section>
      )}

      {state.modules.length === 0 && (
        <p className="text-sm text-slate-500">{t('modules.empty')}</p>
      )}
    </div>
  );
}
