import { cn } from '../lib/cn';

export interface TabItem {
  key: string;
  label: string;
}

/** Simple tablist; the caller renders the active panel and gives it role="tabpanel". */
export function Tabs({
  items,
  active,
  onChange,
  label,
}: {
  items: TabItem[];
  active: string;
  onChange: (key: string) => void;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="mb-5 flex gap-1 overflow-x-auto border-b border-line">
      {items.map((it) => (
        <button
          key={it.key}
          role="tab"
          type="button"
          aria-selected={active === it.key}
          onClick={() => onChange(it.key)}
          className={cn(
            'min-h-11 shrink-0 border-b-2 px-4 text-sm font-medium transition-colors',
            active === it.key ? 'border-accent text-accent-strong' : 'border-transparent text-muted hover:text-ink',
          )}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}
