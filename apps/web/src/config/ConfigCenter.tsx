import { useCallback, useEffect, useReducer, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type ApiError } from '../auth/api';
import {
  configApi,
  type AlertRule,
  type EffectiveSetting,
  type SettingSchema,
} from './api';

// ── Settings tab ─────────────────────────────────────────────────────────────

type SettingsState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; schema: SettingSchema[]; values: EffectiveSetting[] };

type SettingsAction =
  | { type: 'loaded'; schema: SettingSchema[]; values: EffectiveSetting[] }
  | { type: 'error'; message: string }
  | { type: 'update'; value: EffectiveSetting };

function settingsReducer(state: SettingsState, action: SettingsAction): SettingsState {
  switch (action.type) {
    case 'loaded':
      return { phase: 'ready', schema: action.schema, values: action.values };
    case 'error':
      return { phase: 'error', message: action.message };
    case 'update':
      if (state.phase !== 'ready') return state;
      return {
        ...state,
        values: state.values.map((v) =>
          v.namespace === action.value.namespace && v.key === action.value.key
            ? action.value
            : v,
        ),
      };
  }
}

const SOURCE_STYLE: Record<string, string> = {
  default: 'text-slate-400',
  business: 'text-blue-600',
  location: 'text-emerald-600',
};
const SOURCE_LABEL: Record<string, string> = {
  default: 'default',
  business: 'business',
  location: 'location',
};

function SettingRow({
  def,
  effective,
  onSave,
}: {
  def: SettingSchema;
  effective: EffectiveSetting | undefined;
  onSave: (namespace: string, key: string, value: unknown, version?: number) => Promise<void>;
}) {
  const displayValue = effective?.value ?? def.default;
  const source = effective?.source ?? 'default';
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function startEdit() {
    setDraft(def.sensitive ? '' : JSON.stringify(displayValue));
    setEditing(true);
    setErr(null);
  }

  function cancelEdit() {
    setEditing(false);
    setErr(null);
  }

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      let parsed: unknown = draft;
      if (def.valueType === 'NUMBER') parsed = Number(draft);
      else if (def.valueType === 'BOOLEAN') parsed = draft === 'true';
      else if (def.valueType === 'JSON') parsed = JSON.parse(draft);
      await onSave(def.namespace, def.key, parsed, effective?.version);
      setEditing(false);
    } catch (e) {
      setErr((e as ApiError).message ?? 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr className="border-t border-slate-100">
      <td className="py-2 pr-4 align-top">
        <div className="text-sm font-medium text-slate-900">{def.key}</div>
        <div className="text-xs text-slate-400">{def.description}</div>
      </td>
      <td className="py-2 pr-4 align-top">
        {editing ? (
          <div className="flex flex-col gap-1">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={def.sensitive ? '(enter new value)' : ''}
              className="rounded border border-slate-300 px-2 py-1 text-sm"
              autoFocus
            />
            {err && <p className="text-xs text-rose-600">{err}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void save()}
                className="rounded bg-blue-700 px-2 py-1 text-xs text-white hover:bg-blue-800 disabled:opacity-50"
              >
                {busy ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={startEdit}
            title="Click to edit"
            className="group text-left"
          >
            <span className="text-sm text-slate-800">
              {def.sensitive ? '••••••' : String(displayValue)}
            </span>
            <span className="ml-2 hidden text-xs text-blue-600 group-hover:inline">Edit</span>
          </button>
        )}
      </td>
      <td className="py-2 align-top">
        <span className={`text-xs font-medium ${SOURCE_STYLE[source]}`}>
          {SOURCE_LABEL[source]}
        </span>
      </td>
    </tr>
  );
}

function SettingsTab() {
  const { t } = useTranslation();
  const [state, dispatch] = useReducer(settingsReducer, { phase: 'loading' });
  const [selectedNs, setSelectedNs] = useState('core');

  const load = useCallback(async () => {
    try {
      const [schema, values] = await Promise.all([
        configApi.getSchema(),
        configApi.getEffective(selectedNs),
      ]);
      dispatch({ type: 'loaded', schema, values });
    } catch (e) {
      dispatch({ type: 'error', message: (e as ApiError).message ?? t('config.loadError') });
    }
  }, [selectedNs, t]);

  useEffect(() => {
    dispatch({ phase: 'loading' } as never);
    void load();
  }, [load]);

  async function handleSave(
    namespace: string,
    key: string,
    value: unknown,
    version?: number,
  ) {
    const updated = await configApi.setSetting(namespace, key, value, {
      expectedVersion: version,
    });
    // The PUT endpoint returns a raw Setting row without a 'source' field.
    // A business-scope PUT always produces source='business'.
    const effective: EffectiveSetting = {
      namespace,
      key,
      value: (updated as EffectiveSetting).value ?? value,
      valueType: (updated as EffectiveSetting).valueType,
      source: 'business',
      version: (updated as EffectiveSetting).version,
    };
    dispatch({ type: 'update', value: effective });
  }

  if (state.phase === 'loading') {
    return <p className="text-sm text-slate-500">{t('config.loading')}</p>;
  }
  if (state.phase === 'error') {
    return (
      <p className="text-sm text-rose-600">
        {state.message}
        <button type="button" onClick={() => void load()} className="ml-2 underline text-rose-600">
          {t('config.retry')}
        </button>
      </p>
    );
  }

  const namespaces = [...new Set(state.schema.map((s) => s.namespace))].sort();
  const nsDefs = state.schema.filter((s) => s.namespace === selectedNs);
  const valueMap = new Map(state.values.map((v) => [`${v.namespace}.${v.key}`, v]));

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {namespaces.map((ns) => (
          <button
            key={ns}
            type="button"
            onClick={() => setSelectedNs(ns)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${
              ns === selectedNs
                ? 'bg-blue-700 text-white'
                : 'border border-slate-300 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {ns}
          </button>
        ))}
      </div>

      <table className="w-full text-left">
        <thead>
          <tr className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            <th className="pb-2 pr-4">{t('config.settingKey')}</th>
            <th className="pb-2 pr-4">{t('config.settingValue')}</th>
            <th className="pb-2">{t('config.settingSource')}</th>
          </tr>
        </thead>
        <tbody>
          {nsDefs.map((def) => (
            <SettingRow
              key={`${def.namespace}.${def.key}`}
              def={def}
              effective={valueMap.get(`${def.namespace}.${def.key}`)}
              onSave={(ns, k, v, ver) => handleSave(ns, k, v, ver)}
            />
          ))}
        </tbody>
      </table>
      {nsDefs.length === 0 && (
        <p className="text-sm text-slate-500">{t('config.noSettings')}</p>
      )}
    </div>
  );
}

// ── Alert rules tab ───────────────────────────────────────────────────────────

type RulesState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; rules: AlertRule[] };

type RulesAction =
  | { type: 'loaded'; rules: AlertRule[] }
  | { type: 'error'; message: string }
  | { type: 'add'; rule: AlertRule }
  | { type: 'update'; rule: AlertRule }
  | { type: 'remove'; id: string };

function rulesReducer(state: RulesState, action: RulesAction): RulesState {
  switch (action.type) {
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
  const [state, dispatch] = useReducer(rulesReducer, { phase: 'loading' });
  const [eventKey, setEventKey] = useState('');
  const [roleKey, setRoleKey] = useState('');
  const [formErr, setFormErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Per-rule inline error messages (keyed by rule id).
  const [ruleErrors, setRuleErrors] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const rules = await configApi.listAlertRules();
      dispatch({ type: 'loaded', rules });
    } catch (e) {
      dispatch({ type: 'error', message: (e as ApiError).message ?? t('config.loadError') });
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate() {
    if (!eventKey.trim() || !roleKey.trim()) {
      setFormErr('Both event key and role key are required');
      return;
    }
    setBusy(true);
    setFormErr(null);
    try {
      const rule = await configApi.createAlertRule({
        eventKey: eventKey.trim(),
        targetRoleKey: roleKey.trim(),
        channel: 'IN_APP',
        enabled: true,
      });
      dispatch({ type: 'add', rule });
      setEventKey('');
      setRoleKey('');
    } catch (e) {
      setFormErr((e as ApiError).message ?? 'Create failed');
    } finally {
      setBusy(false);
    }
  }

  function clearRuleError(id: string) {
    setRuleErrors((prev) => { const next = { ...prev }; delete next[id]; return next; });
  }

  async function handleToggle(rule: AlertRule) {
    clearRuleError(rule.id);
    try {
      const updated = await configApi.updateAlertRule(rule.id, {
        enabled: !rule.enabled,
        expectedVersion: rule.version,
      });
      dispatch({ type: 'update', rule: updated });
    } catch (e) {
      setRuleErrors((prev) => ({
        ...prev,
        [rule.id]: (e as ApiError).message ?? 'Toggle failed',
      }));
    }
  }

  async function handleDelete(rule: AlertRule) {
    clearRuleError(rule.id);
    try {
      await configApi.deleteAlertRule(rule.id);
      dispatch({ type: 'remove', id: rule.id });
    } catch (e) {
      setRuleErrors((prev) => ({
        ...prev,
        [rule.id]: (e as ApiError).message ?? 'Delete failed',
      }));
    }
  }

  if (state.phase === 'loading') {
    return <p className="text-sm text-slate-500">{t('config.loading')}</p>;
  }
  if (state.phase === 'error') {
    return (
      <p className="text-sm text-rose-600">
        {state.message}
        <button type="button" onClick={() => void load()} className="ml-2 underline">
          {t('config.retry')}
        </button>
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">{t('config.addRuleTitle')}</h3>
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            value={eventKey}
            onChange={(e) => setEventKey(e.target.value)}
            placeholder={t('config.eventKeyPlaceholder')}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm"
          />
          <input
            type="text"
            value={roleKey}
            onChange={(e) => setRoleKey(e.target.value)}
            placeholder={t('config.roleKeyPlaceholder')}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleCreate()}
            className="rounded bg-blue-700 px-3 py-1.5 text-sm text-white hover:bg-blue-800 disabled:opacity-50"
          >
            {busy ? 'Creating…' : t('config.addRule')}
          </button>
        </div>
        {formErr && <p className="mt-2 text-xs text-rose-600">{formErr}</p>}
      </div>

      {state.rules.length === 0 && (
        <p className="text-sm text-slate-500">{t('config.noRules')}</p>
      )}

      <div className="space-y-2">
        {state.rules.map((rule) => (
          <div key={rule.id} className="rounded-lg border border-slate-200 bg-white px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-slate-900">{rule.eventKey}</span>
                <span className="mx-2 text-slate-400">→</span>
                <span className="text-sm text-slate-700">{rule.targetRoleKey}</span>
                <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                  {rule.channel}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleToggle(rule)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    rule.enabled
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {rule.enabled ? t('config.ruleEnabled') : t('config.ruleDisabled')}
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(rule)}
                  className="rounded px-2 py-1 text-xs text-rose-600 hover:bg-rose-50"
                >
                  {t('config.deleteRule')}
                </button>
              </div>
            </div>
            {ruleErrors[rule.id] && (
              <p className="mt-1 text-xs text-rose-600">{ruleErrors[rule.id]}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main config center ────────────────────────────────────────────────────────

type Tab = 'settings' | 'alerts';

export function ConfigCenter() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('settings');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('config.title')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('config.subtitle')}</p>
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        {(['settings', 'alerts'] as Tab[]).map((t_) => (
          <button
            key={t_}
            type="button"
            onClick={() => setTab(t_)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              tab === t_
                ? 'border-b-2 border-blue-700 text-blue-700'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t_ === 'settings' ? t('config.tabSettings') : t('config.tabAlerts')}
          </button>
        ))}
      </div>

      <div>{tab === 'settings' ? <SettingsTab /> : <AlertRulesTab />}</div>
    </div>
  );
}
