import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/cn';
import * as Icons from '../ui/icons';
import { Kbd } from '../ui/Kbd';
import { useBackdropDismiss } from '../ui/useBackdropDismiss';
import { filterItems } from './paletteFilter';

export type CommandGroup = 'pages' | 'locations' | 'actions';

export interface Command {
  id: string;
  label: string;
  keywords?: string;
  group: CommandGroup;
  icon: ReactNode;
  /** Right-aligned hint, e.g. a shortcut. */
  hint?: ReactNode;
  /** Marks the current page / location. */
  current?: boolean;
  run: () => void;
}

interface Props {
  open: boolean;
  onClose: () => void;
  commands: Command[];
}

/**
 * Command palette on the native modal <dialog> (page behind is inert, Esc
 * cancels). The input is an ARIA combobox driving a listbox via
 * aria-activedescendant; Tab is kept inside; focus returns to where it was.
 */
export function CommandPalette({ open, onClose, commands }: Props) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const uid = useId();
  const listId = `${uid}-list`;
  const backdrop = useBackdropDismiss(onClose);

  const results = useMemo(() => filterItems(commands, query), [commands, query]);
  const activeIndex = Math.min(active, Math.max(0, results.length - 1));

  const restoreFocus = () => {
    const target = returnTo.current;
    returnTo.current = null;
    if (target?.isConnected) target.focus();
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      returnTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setQuery('');
      setActive(0);
      el.showModal();
      inputRef.current?.focus();
    }
    if (!open) {
      if (el.open) el.close();
      restoreFocus();
    }
  }, [open]);

  useEffect(() => {
    if (open) document.getElementById(`${uid}-opt-${activeIndex}`)?.scrollIntoView?.({ block: 'nearest' });
  }, [open, activeIndex, uid]);

  const run = (cmd: Command | undefined) => {
    if (!cmd) return;
    onClose();
    // Let the dialog close (and focus return) before the command moves focus elsewhere.
    window.setTimeout(cmd.run, 0);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const count = results.length;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (count) setActive((activeIndex + 1) % count);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (count) setActive((activeIndex - 1 + count) % count);
    } else if (e.key === 'PageDown' || (e.key === 'End' && e.ctrlKey)) {
      e.preventDefault();
      setActive(Math.max(0, count - 1));
    } else if (e.key === 'PageUp' || (e.key === 'Home' && e.ctrlKey)) {
      e.preventDefault();
      setActive(0);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      run(results[activeIndex]);
    } else if (e.key === 'Tab') {
      e.preventDefault(); // the input is the only stop; keep focus trapped in the palette
    }
  };

  const groupLabel: Record<CommandGroup, string> = {
    pages: t('shell.palette.groups.pages'),
    locations: t('shell.palette.groups.locations'),
    actions: t('shell.palette.groups.actions'),
  };
  const grouped = query.trim() === '';

  return (
    <dialog
      ref={ref}
      aria-label={t('shell.palette.label')}
      onClose={onClose}
      {...backdrop}
      className={cn(
        'mx-auto mt-[12vh] w-[min(38rem,calc(100vw-2rem))] nx-pop overflow-hidden rounded-panel p-0 text-ink',
        'backdrop:bg-black/60 backdrop:backdrop-blur-sm',
      )}
    >
      {open && (
        <div className="flex max-h-[min(34rem,76vh)] flex-col">
          <div className="flex items-center gap-3 border-b border-line px-4">
            <Icons.Search className="size-5 shrink-0 text-muted" aria-hidden />
            <input
              ref={inputRef}
              type="text"
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={results.length ? `${uid}-opt-${activeIndex}` : undefined}
              aria-label={t('shell.palette.label')}
              placeholder={t('shell.palette.placeholder')}
              autoComplete="off"
              spellCheck={false}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
              className="min-h-14 flex-1 bg-transparent text-base outline-none placeholder:text-muted"
            />
            <span className="hidden sm:inline-flex" aria-hidden>
              <Kbd>Esc</Kbd>
            </span>
          </div>

          <ul id={listId} role="listbox" aria-label={t('shell.palette.results')} className="min-h-0 flex-1 overflow-y-auto p-2">
            {results.map((cmd, i) => {
              const heading = grouped && (i === 0 || results[i - 1].group !== cmd.group);
              return (
                <li key={cmd.id} role="presentation">
                  {heading && (
                    <p
                      role="presentation"
                      className={cn('px-2.5 pb-1 text-xs font-medium tracking-wider text-muted uppercase', i > 0 ? 'pt-3' : 'pt-1')}
                    >
                      {groupLabel[cmd.group]}
                    </p>
                  )}
                  <div
                    id={`${uid}-opt-${i}`}
                    role="option"
                    aria-selected={i === activeIndex}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseMove={() => setActive(i)}
                    onClick={() => run(cmd)}
                    className={cn(
                      'flex min-h-11 cursor-pointer items-center gap-3 rounded-control px-2.5 text-sm',
                      i === activeIndex ? 'bg-accent-soft text-accent-strong' : 'text-ink',
                    )}
                  >
                    <span className={cn('shrink-0', i === activeIndex ? 'text-accent' : 'text-muted')} aria-hidden>
                      {cmd.icon}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{cmd.label}</span>
                    {cmd.current && <span className="text-xs text-muted">{t('shell.palette.current')}</span>}
                    {!grouped && <span className="hidden text-xs text-muted sm:inline">{groupLabel[cmd.group]}</span>}
                    {cmd.hint && <span className="hidden sm:inline-flex" aria-hidden>{cmd.hint}</span>}
                    {i === activeIndex && <Icons.CornerDownLeft className="size-4 shrink-0" aria-hidden />}
                  </div>
                </li>
              );
            })}
          </ul>
          {results.length === 0 && (
            <div className="px-6 pt-2 pb-8 text-center">
              <p className="font-display text-lg font-semibold">{t('shell.palette.emptyTitle', { query: query.trim() })}</p>
              <p className="mt-1 text-sm text-muted">{t('shell.palette.emptyBody')}</p>
            </div>
          )}
          <p className="sr-only" aria-live="polite">
            {t('shell.palette.count', { count: results.length })}
          </p>

          <div className="hidden items-center gap-4 border-t border-white/[0.07] bg-white/[0.02] px-4 py-2.5 text-xs text-muted sm:flex">
            <span className="inline-flex items-center gap-1.5">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd>
              {t('shell.palette.hintMove')}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Kbd>↵</Kbd>
              {t('shell.palette.hintRun')}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Kbd>Esc</Kbd>
              {t('shell.palette.hintClose')}
            </span>
          </div>
        </div>
      )}
    </dialog>
  );
}
