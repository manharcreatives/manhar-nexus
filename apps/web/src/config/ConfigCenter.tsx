import { useCallback, useEffect, useReducer, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { type ApiError } from '../auth/api';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { Field } from '../ui/Field';
import { PageHeader } from '../ui/PageHeader';
import { Panel } from '../ui/Panel';
import { Select } from '../ui/Select';
import { EmptyState, ErrorState, Skeleton } from '../ui/states';
import { StatusPill } from '../ui/StatusPill';
import { Tabs } from '../ui/Tabs';
import { Textarea } from '../ui/Textarea';
import { useToast } from '../ui/Toast';
import { configApi, type AlertRule, type EffectiveSetting, type SettingSchema, type SettingSource } from './api';

// Settings tab

type SettingsState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; schema: SettingSchema[]; values: EffectiveSetting[]; ns: string };

type SettingsAction =
  | { type: 'loading' }
  | { type: 'loaded'; schema: SettingSchema[]; values: EffectiveSetting[]; ns: string }
  | { type: 'error'; message: string }
  | { type: 'update'; value: EffectiveSetting };

function settingsReducer(state: SettingsState, action: SettingsAction): SettingsState {
  switch (action.type) {
    case 'loading':
      return { phase: 'loading' };
    case 'loaded':
      return { phase: 'ready', schema: action.schema, values: action.values, ns: action.ns };
    case 'error':
      return { phase: 'error', message: action.message };
    case 'update':
      if (state.phase !== 'ready') return state;
      return {
        ...state,
        values: state.values.some((v) => v.namespace === action.value.namespace && v.key === action.value.key)
          ? state.values.map((v) =>
              v.namespace === action.value.namespace && v.key === action.value.key ? action.value : v,
            )
          : [...state.values, action.value],
      };
  }
}

const SOURCE_TONE: Record<SettingSource, 'accent' | 'info' | 'neutral'> = {
  location: 'accent',
  business: 'info',
  default: 'neutral',
};

function isConflict(e: unknown): boolean {
  const err = e as Partial<ApiError>;
  return err.status === 409 || err.code === 'VERSION_CONFLICT';
}

function displayText(value: unknown, t: (k: string) => string): string {
  if (value === null || value === undefined || value === '') return t('config.emptyValue');
  if (typeof value === 'boolean') return value ? t('config.yes') : t('config.no');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function SettingRow({
  def,
  effective,
  onSave,
}: {
  def: SettingSchema;
  effective: EffectiveSetting | undefined;
  onSave: (def: SettingSchema, value: unknown, version?: number) => Promise<void>;
}) {
  const { t } = useTranslation();
  const displayValue = effective?.value ?? def.default;
  const source: SettingSource = effective?.source ?? 'default';
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function startEdit() {
    if (def.sensitive) setDraft('');
    else if (def.valueType === 'BOOLEAN') setDraft(displayValue === true ? 'true' : 'false');
    else if (def.valueType === 'JSON') setDraft(JSON.stringify(displayValue ?? null, null, 2));
    else setDraft(displayValue === null || displayValue === undefined ? '' : String(displayValue));
    setErr(null);
    setEditing(true);
  }

  function parse(): { ok: true; value: unknown } | { ok: false; error: string } {
    switch (def.valueType) {
      case 'NUMBER': {
        if (draft.trim() === '') return { ok: false, error: t('config.errors.required') };
        const n = Number(draft);
        return Number.isFinite(n) ? { ok: true, value: n } : { ok: false, error: t('config.errors.number') };
      }
      case 'BOOLEAN':
        return { ok: true, value: draft === 'true' };
      case 'JSON':
        try {
          return { ok: true, value: JSON.parse(draft) as unknown };
        } catch {
          return { ok: false, error: t('config.errors.json') };
        }
      default:
        if (def.sensitive && draft === '') return { ok: false, error: t('config.errors.required') };
        return { ok: true, value: draft };
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const parsed = parse();
    if (!parsed.ok) {
      setErr(parsed.error);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await onSave(def, parsed.value, effective?.version);
      setEditing(false);
    } catch (e2) {
      setErr(isConflict(e2) ? t('config.conflict') : ((e2 as ApiError).message ?? t('config.saveFailed')));
    } finally {
      setBusy(false);
    }
  }

  const name = def.key;

  return (
    <li className="rounded-panel border border-line bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium break-words">{def.description || def.key}</p>
          {def.description && <p className="mt-0.5 text-xs text-muted break-all">{def.key}</p>}
        </div>
        <StatusPill tone={SOURCE_TONE[source]}>{t(`config.source.${source}`)}</StatusPill>
      </div>

      {editing ? (
        <form onSubmit={(e) => void submit(e)} className="mt-3 space-y-3" noValidate>
          {def.valueType === 'BOOLEAN' ? (
            <Select
              label={t('config.valueLabel', { name })}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              error={err}
            >
              <option value="true">{t('config.yes')}</option>
              <option value="false">{t('config.no')}</option>
            </Select>
          ) : def.valueType === 'JSON' ? (
            <Textarea
              label={t('config.valueLabel', { name })}
              value={draft}
              rows={5}
              spellCheck={false}
              className="font-mono text-sm"
              onChange={(e) => setDraft(e.target.value)}
              error={err}
              autoFocus
            />
          ) : (
            <Field
              label={t('config.valueLabel', { name })}
              type={def.valueType === 'NUMBER' ? 'text' : def.sensitive ? 'password' : 'text'}
              inputMode={def.valueType === 'NUMBER' ? 'decimal' : undefined}
              autoComplete="off"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              hint={def.sensitive ? t('config.sensitiveHint') : t(`config.valueTypeHint.${def.valueType}`)}
              error={err}
              autoFocus
            />
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" loading={busy}>
              {busy ? t('config.saving') : t('config.save')}
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => setEditing(false)}>
              {t('config.cancel')}
            </Button>
          </div>
          <p role="status" aria-live="polite" className="sr-only">
            {busy ? t('config.saving') : ''}
          </p>
        </form>
      ) : (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="tabular min-w-0 break-all text-base">
            {def.sensitive ? <span className="text-muted">{t('config.sensitiveValue')}</span> : displayText(displayValue, t)}
          </p>
          <Button variant="secondary" aria-label={t('config.editLabel', { name })} onClick={startEdit}>
            {t('config.edit')}
          </Button>
        </div>
      )}
    </li>
  );
}

function ListSkeleton() {
  const { t } = useTranslation();
  return (
    <div role="status" aria-label={t('config.loading')} className="space-y-3">
      <Skeleton className="h-11 w-full sm:w-64" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

function SettingsTab() {
  const { t } = useTranslation();
  const toast = useToast();
  const [state, dispatch] = useReducer(settingsReducer, { phase: 'loading' });

  const load = useCallback(
    async (requested?: string) => {
      dispatch({ type: 'loading' });
      try {
        const schema = await configApi.getSchema();
        const namespaces = [...new Set(schema.map((s) => s.namespace))].sort();
        const ns =
          requested && namespaces.includes(requested)
            ? requested
            : namespaces.includes('core')
              ? 'core'
              : (namespaces[0] ?? 'core');
        const values = namespaces.length ? await configApi.getEffective(ns) : [];
        dispatch({ type: 'loaded', schema, values, ns });
      } catch (e) {
        dispatch({ type: 'error', message: (e as ApiError).message ?? t('config.loadError') });
      }
    },
    [t],
  );

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSave(def: SettingSchema, value: unknown, version?: number) {
    const updated = await configApi.setSetting(def.namespace, def.key, value, { expectedVersion: version });
    // The PUT returns a raw row without 'source'; a business-scope PUT always yields source 'business'.
    dispatch({
      type: 'update',
      value: {
        namespace: def.namespace,
        key: def.key,
        value: (updated as Partial<EffectiveSetting>).value ?? value,
        valueType: (updated as Partial<EffectiveSetting>).valueType ?? def.valueType,
        source: 'business',
        version: (updated as Partial<EffectiveSetting>).version,
      },
    });
    toast.show(t('config.saved', { name: def.key }));
  }

  if (state.phase === 'loading') return <ListSkeleton />;
  if (state.phase === 'error') {
    return (
      <ErrorState
        title={t('config.loadError')}
        body={state.message || t('config.loadErrorBody')}
        onRetry={() => void load()}
        retryLabel={t('config.retry')}
      />
    );
  }

  const namespaces = [...new Set(state.schema.map((s) => s.namespace))].sort();
  const nsDefs = state.schema.filter((s) => s.namespace === state.ns);
  const valueMap = new Map(state.values.map((v) => [`${v.namespace}.${v.key}`, v]));

  return (
    <div className="space-y-5">
      <Panel className="bg-sunken/40">
        <h2 className="text-base font-semibold">{t('config.precedenceTitle')}</h2>
        <p className="mt-1 max-w-prose text-sm text-muted">{t('config.precedenceBody')}</p>
      </Panel>

      {namespaces.length > 1 && (
        <div className="sm:max-w-xs">
          <Select label={t('config.groupLabel')} value={state.ns} onChange={(e) => void load(e.target.value)}>
            {namespaces.map((ns) => (
              <option key={ns} value={ns}>
                {ns}
              </option>
            ))}
          </Select>
        </div>
      )}

      {nsDefs.length === 0 ? (
        <EmptyState title={t('config.noSettings')} />
      ) : (
        <ul className="space-y-3">
          {nsDefs.map((def) => (
            <SettingRow
              key={`${def.namespace}.${def.key}`}
              def={def}
              effective={valueMap.get(`${def.namespace}.${def.key}`)}
              onSave={handleSave}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

// Alert rules tab

type RulesState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; rules: AlertRule[] };

type RulesAction =
  | { type: 'loading' }
  | { type: 'loaded'; rules: AlertRule[] }
  | { type: 'error'; message: string }
  | { type: 'add'; rule: AlertRule }
  | { type: 'update'; rule: AlertRule }
  | { type: 'remove'; id: string };

function rulesReducer(state: RulesState, action: RulesAction): RulesState {
  switch (action.type) {
    case 'loading':
      return { phase: 'loading' };
    case 'loaded':
      return { phase: 'ready', rules: action.rules };
    case 'error':
      return { phase: 'error', message: action.message };
    case 'add':
      if (state.phase !== 'ready') return state;
      return { ...state, rules: [...state.rules, action.rule] };
    case 'update':
      if (state.phase !== 'ready') return state;
      return { ...state, rules: state.rules.map((r) => (r.id === action.rule.id ? action.rule : r)) };
    case 'remove':
      if (state.phase !== 'ready') return state;
      return { ...state, rules: state.rules.filter((r) => r.id !== action.id) };
  }
}

function AlertRulesTab() {
  const { t } = useTranslation();
  const toast = useToast();
  const [state, dispatch] = useReducer(rulesReducer, { phase: 'loading' });
  const [eventKey, setEventKey] = useState('');
  const [roleKey, setRoleKey] = useState('');
  const [errs, setErrs] = useState<{ event?: string; role?: string; form?: string }>({});
  const [adding, setAdding] = useState(false);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [ruleErrors, setRuleErrors] = useState<Record<string, string>>({});
  const [toDelete, setToDelete] = useState<AlertRule | null>(null);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    dispatch({ type: 'loading' });
    try {
      dispatch({ type: 'loaded', rules: await configApi.listAlertRules() });
    } catch (e) {
      dispatch({ type: 'error', message: (e as ApiError).message ?? t('config.loadError') });
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  function setBusy(id: string, on: boolean) {
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (adding || state.phase !== 'ready') return;
    const ev = eventKey.trim();
    const role = roleKey.trim();
    const next: typeof errs = {};
    if (!ev) next.event = t('config.ruleErrors.required');
    else if (/\s/.test(ev)) next.event = t('config.ruleErrors.event');
    if (!role) next.role = t('config.ruleErrors.required');
    else if (/\s/.test(role)) next.role = t('config.ruleErrors.role');
    if (!next.event && !next.role && state.rules.some((r) => r.eventKey === ev && r.targetRoleKey === role)) {
      next.form = t('config.ruleErrors.duplicate');
    }
    setErrs(next);
    if (next.event || next.role || next.form) return;

    setAdding(true);
    try {
      const rule = await configApi.createAlertRule({
        eventKey: ev,
        targetRoleKey: role,
        channel: 'IN_APP',
        enabled: true,
      });
      dispatch({ type: 'add', rule });
      setEventKey('');
      setRoleKey('');
      toast.show(t('config.ruleAdded'));
    } catch (e2) {
      setErrs({ form: (e2 as ApiError).message ?? t('config.ruleAddFailed') });
    } finally {
      setAdding(false);
    }
  }

  async function handleToggle(rule: AlertRule) {
    if (busyIds.has(rule.id)) return;
    setBusy(rule.id, true);
    setRuleErrors((p) => {
      const n = { ...p };
      delete n[rule.id];
      return n;
    });
    try {
      const updated = await configApi.updateAlertRule(rule.id, {
        enabled: !rule.enabled,
        expectedVersion: rule.version,
      });
      dispatch({ type: 'update', rule: updated });
      toast.show(t(updated.enabled ? 'config.ruleToggled_on' : 'config.ruleToggled_off'));
    } catch (e) {
      setRuleErrors((p) => ({
        ...p,
        [rule.id]: isConflict(e) ? t('config.conflict') : ((e as ApiError).message ?? t('config.ruleToggleFailed')),
      }));
    } finally {
      setBusy(rule.id, false);
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    const rule = toDelete;
    setBusy(rule.id, true);
    setDeleteErr(null);
    try {
      await configApi.deleteAlertRule(rule.id);
      dispatch({ type: 'remove', id: rule.id });
      setToDelete(null);
      toast.show(t('config.ruleDeleted'));
    } catch (e) {
      setDeleteErr((e as ApiError).message ?? t('config.ruleDeleteFailed'));
    } finally {
      setBusy(rule.id, false);
    }
  }

  if (state.phase === 'loading') return <ListSkeleton />;
  if (state.phase === 'error') {
    return (
      <ErrorState
        title={t('config.loadError')}
        body={state.message || t('config.loadErrorBody')}
        onRetry={() => void load()}
        retryLabel={t('config.retry')}
      />
    );
  }

  return (
    <div className="space-y-6">
      <Panel>
        <h2 className="text-base font-semibold">{t('config.addRuleTitle')}</h2>
        <p className="mt-1 text-sm text-muted">{t('config.addRuleBody')}</p>
        <form onSubmit={(e) => void handleCreate(e)} noValidate className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t('config.eventKeyLabel')}
              hint={t('config.eventKeyHint')}
              value={eventKey}
              error={errs.event}
              autoComplete="off"
              onChange={(e) => setEventKey(e.target.value)}
            />
            <Field
              label={t('config.roleKeyLabel')}
              hint={t('config.roleKeyHint')}
              value={roleKey}
              error={errs.role}
              autoComplete="off"
              onChange={(e) => setRoleKey(e.target.value)}
            />
          </div>
          {errs.form && (
            <p role="alert" className="text-sm text-bad">
              {errs.form}
            </p>
          )}
          <Button type="submit" loading={adding}>
            {adding ? t('config.adding') : t('config.addRule')}
          </Button>
        </form>
      </Panel>

      {state.rules.length === 0 ? (
        <EmptyState title={t('config.noRulesTitle')} body={t('config.noRules')} />
      ) : (
        <ul aria-label={t('config.rulesLabel')} className="space-y-3">
          {state.rules.map((rule) => {
            const busy = busyIds.has(rule.id);
            return (
              <li key={rule.id} className="rounded-panel border border-line bg-surface p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium break-words">
                      {t('config.ruleSends', { role: rule.targetRoleKey, event: rule.eventKey })}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">{t('config.channelInApp')}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      loading={busy}
                      aria-pressed={rule.enabled}
                      aria-label={`${t('config.ruleToggleLabel', { event: rule.eventKey, role: rule.targetRoleKey })}: ${rule.enabled ? t('config.ruleOn') : t('config.ruleOff')}`}
                      onClick={() => void handleToggle(rule)}
                    >
                      <StatusPill tone={rule.enabled ? 'ok' : 'neutral'}>
                        {rule.enabled ? t('config.ruleOn') : t('config.ruleOff')}
                      </StatusPill>
                    </Button>
                    <Button
                      variant="ghost"
                      className="text-bad"
                      disabled={busy}
                      aria-label={t('config.deleteRuleLabel', { event: rule.eventKey, role: rule.targetRoleKey })}
                      onClick={() => {
                        setDeleteErr(null);
                        setToDelete(rule);
                      }}
                    >
                      {t('config.deleteRule')}
                    </Button>
                  </div>
                </div>
                {ruleErrors[rule.id] && (
                  <p role="alert" className="mt-2 text-sm text-bad">
                    {ruleErrors[rule.id]}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Dialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        title={t('config.deleteTitle')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setToDelete(null)} disabled={toDelete ? busyIds.has(toDelete.id) : false}>
              {t('config.cancel')}
            </Button>
            <Button variant="danger" loading={toDelete ? busyIds.has(toDelete.id) : false} onClick={() => void confirmDelete()}>
              {toDelete && busyIds.has(toDelete.id) ? t('config.deleting') : t('config.deleteConfirm')}
            </Button>
          </>
        }
      >
        {toDelete && (
          <p className="text-sm">
            {t('config.deleteBody', { role: toDelete.targetRoleKey, event: toDelete.eventKey })}
          </p>
        )}
        {deleteErr && (
          <p role="alert" className="mt-3 text-sm text-bad">
            {deleteErr}
          </p>
        )}
      </Dialog>
    </div>
  );
}

// Main config center

type Tab = 'settings' | 'alerts';

export function ConfigCenter() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('settings');

  return (
    <div>
      <PageHeader title={t('config.title')} description={t('config.subtitle')} />
      <Tabs
        label={t('config.sectionsLabel')}
        active={tab}
        onChange={(k) => setTab(k as Tab)}
        items={[
          { key: 'settings', label: t('config.tabSettings') },
          { key: 'alerts', label: t('config.tabAlerts') },
        ]}
      />
      <div role="tabpanel">
        {tab === 'settings' ? <SettingsTab /> : <AlertRulesTab />}
      </div>
    </div>
  );
}
