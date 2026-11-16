import { useRef, type KeyboardEvent } from 'react';
import { cn } from '../lib/cn';

export interface TabItem {
  key: string;
  label: string;
}

/**
 * Simple tablist; the caller renders the active panel and gives it role="tabpanel".
 * Keyboard: Left/Right (and Home/End) move between tabs, and only the active tab is in the Tab order (roving tabindex).
 */
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
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    const index = items.findIndex((it) => it.key === active);
    let next = -1;
    if (e.key === 'ArrowRight') next = (index + 1) % items.length;
    else if (e.key === 'ArrowLeft') next = (index - 1 + items.length) % items.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = items.length - 1;
    if (next < 0 || items.length === 0) return;
    e.preventDefault();
    const target = items[next];
    if (!target) return;
    onChange(target.key);
    refs.current[target.key]?.focus();
  }

  return (
    <div role="tablist" aria-label={label} className="mb-5 flex gap-1 overflow-x-auto border-b border-line">
      {items.map((it) => (
        <button
          key={it.key}
          ref={(el) => {
            refs.current[it.key] = el;
          }}
          role="tab"
          type="button"
          aria-selected={active === it.key}
          tabIndex={active === it.key ? 0 : -1}
          onKeyDown={onKeyDown}
          onClick={() => onChange(it.key)}
          className={cn(
            '-mb-px min-h-11 shrink-0 border-b-2 px-4 text-sm font-medium transition-colors duration-(--duration-micro)',
            active === it.key ? 'border-accent text-ink' : 'border-transparent text-muted hover:border-control hover:text-ink',
          )}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}
