import { useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ClientSummary } from '../commercial/api';
import { cn } from '../lib/cn';

export interface BusinessPickerProps {
  clients: ClientSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Business ids that cannot be chosen, with the reason shown beside the name. */
  disabledReasons?: Map<string, string>;
  error?: string | null;
}

/** Type-to-filter list of client accounts. Shows names, never ids. */
export function BusinessPicker({ clients, selectedId, onSelect, disabledReasons, error }: BusinessPickerProps) {
  const { t } = useTranslation();
  const id = useId();
  const [query, setQuery] = useState('');

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c) => c.name.toLowerCase().includes(q) || c.businessType.name.toLowerCase().includes(q),
    );
  }, [clients, query]);

  return (
    <div className="space-y-1.5">
      <label htmlFor={`${id}-q`} className="block text-sm font-medium">
        {t('onboarding.picker.label')}
      </label>
      <input
        id={`${id}-q`}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('onboarding.picker.placeholder')}
        autoComplete="off"
        aria-describedby={`${id}-count`}
        className="min-h-11 w-full rounded-control border border-line bg-surface px-3 text-base hover:border-muted"
      />
      <p id={`${id}-count`} aria-live="polite" className="text-sm text-muted">
        {t('onboarding.picker.count', { count: matches.length })}
      </p>
      <ul
        role="listbox"
        aria-label={t('onboarding.picker.label')}
        aria-invalid={error ? true : undefined}
        className={cn(
          'max-h-60 divide-y divide-line/60 overflow-y-auto rounded-control border bg-surface',
          error ? 'border-bad' : 'border-line',
        )}
      >
        {matches.length === 0 ? (
          <li className="px-3 py-4 text-sm text-muted">{t('onboarding.picker.none')}</li>
        ) : (
          matches.map((c) => {
            const reason = disabledReasons?.get(c.id);
            const selected = c.id === selectedId;
            return (
              <li key={c.id} role="option" aria-selected={selected} aria-disabled={!!reason || undefined}>
                <button
                  type="button"
                  disabled={!!reason}
                  onClick={() => onSelect(c.id)}
                  className={cn(
                    'flex min-h-12 w-full items-center justify-between gap-3 px-3 py-2 text-left disabled:cursor-not-allowed disabled:opacity-60',
                    selected ? 'bg-accent-soft' : 'hover:bg-sunken',
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{c.name}</span>
                    <span className="block truncate text-xs text-muted">{c.businessType.name}</span>
                  </span>
                  <span className="shrink-0 text-xs font-medium text-muted">
                    {reason ?? (selected ? t('onboarding.picker.selected') : '')}
                  </span>
                </button>
              </li>
            );
          })
        )}
      </ul>
      {error && (
        <p role="alert" className="text-sm text-bad">
          {error}
        </p>
      )}
    </div>
  );
}
