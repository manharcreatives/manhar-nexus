import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useWorkLocation } from '../context/LocationContext';
import { cn } from '../lib/cn';
import * as Icons from '../ui/icons';
import { useDismiss } from './useDismiss';

interface Option {
  id: string | null;
  label: string;
  detail?: string | null;
}

/**
 * Header "where am I working" control: business name + current location.
 * With more than one location it is a listbox button (arrows, Home/End,
 * type-ahead, Enter/Space, Esc returns focus); otherwise a quiet static label.
 */
export function ContextSwitcher({ isPlatform }: { isPlatform: boolean }) {
  const { t } = useTranslation();
  const { locations, location, locationId, setLocationId, canChoose, businessName } = useWorkLocation();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const uid = useId();
  const listId = `${uid}-list`;
  const labelId = `${uid}-label`;

  useDismiss(open, [wrapRef], () => setOpen(false));

  const options: Option[] = [
    { id: null, label: t('shell.allLocations'), detail: t('shell.allLocationsDetail', { count: locations.length }) },
    ...locations.map((l) => ({ id: l.id, label: l.name, detail: l.code })),
  ];
  const selectedIndex = Math.max(0, options.findIndex((o) => o.id === locationId));
  const currentLabel = location?.name ?? t('shell.allLocations');

  useEffect(() => {
    if (open) listRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (open) document.getElementById(`${uid}-opt-${active}`)?.scrollIntoView?.({ block: 'nearest' });
  }, [open, active, uid]);

  if (isPlatform) {
    return (
      <div className="flex min-w-0 items-center gap-2 text-sm">
        <Icons.Building2 className="size-4 shrink-0 text-muted" aria-hidden />
        <span className="truncate font-medium">{t('shell.platformRealm')}</span>
      </div>
    );
  }

  const businessLine = businessName && (
    <span id={`${uid}-biz`} className="block truncate text-[0.6875rem] leading-4 font-medium tracking-wide text-muted uppercase">
      {businessName}
    </span>
  );

  if (!canChoose) {
    if (!businessName && !location) return null;
    return (
      <div className="min-w-0 px-1 leading-tight">
        {businessLine}
        {location && (
          <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
            <Icons.MapPin className="size-3.5 shrink-0 text-muted" aria-hidden />
            <span className="truncate">{location.name}</span>
          </span>
        )}
      </div>
    );
  }

  const openAt = (index: number) => {
    setActive(index);
    setOpen(true);
  };
  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };
  const choose = (index: number) => {
    setLocationId(options[index].id);
    close();
  };

  const onButtonKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      openAt(selectedIndex);
    }
  };

  const onListKey = (e: KeyboardEvent<HTMLUListElement>) => {
    const last = options.length - 1;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActive((i) => Math.min(last, i + 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActive((i) => Math.max(0, i - 1));
        break;
      case 'Home':
        e.preventDefault();
        setActive(0);
        break;
      case 'End':
        e.preventDefault();
        setActive(last);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        choose(active);
        break;
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        close();
        break;
      case 'Tab':
        e.preventDefault();
        close();
        break;
      default:
        if (e.key.length === 1 && /\S/.test(e.key)) {
          // Type-ahead: jump to the next option starting with that letter.
          const ch = e.key.toLowerCase();
          for (let step = 1; step <= options.length; step += 1) {
            const i = (active + step) % options.length;
            if (options[i].label.toLowerCase().startsWith(ch)) {
              setActive(i);
              break;
            }
          }
        }
    }
  };

  return (
    <div ref={wrapRef} className="relative min-w-0">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => (open ? setOpen(false) : openAt(selectedIndex))}
        onKeyDown={onButtonKey}
        className={cn(
          'flex min-h-11 max-w-full min-w-0 items-center gap-2 rounded-control px-2 text-left transition-colors duration-(--duration-micro) hover:bg-sunken',
          open && 'bg-sunken',
        )}
      >
        {/* Name comes from the content (no aria-label override), so it always contains the visible text (WCAG 2.5.3). */}
        <span id={labelId} className="sr-only">
          {t('shell.locationSelector')}
        </span>
        <span className="min-w-0 leading-tight">
          {businessLine}
          <span id={`${uid}-value`} className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
            <Icons.MapPin className="size-3.5 shrink-0 text-accent" aria-hidden />
            <span className="truncate">{currentLabel}</span>
          </span>
        </span>
        <Icons.ChevronsUpDown className="size-4 shrink-0 text-muted" aria-hidden />
      </button>

      {open && (
        <div
          className={cn(
            'z-50 overflow-hidden rounded-panel border border-line bg-surface',
            'max-sm:fixed max-sm:inset-x-4 max-sm:top-15 sm:absolute sm:top-full sm:left-0 sm:mt-1.5 sm:w-72',
          )}
        >
          <p className="border-b border-line px-3 py-2 text-xs font-medium tracking-wider text-muted uppercase">
            {t('shell.switchLocation')}
          </p>
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            tabIndex={-1}
            aria-labelledby={labelId}
            aria-activedescendant={`${uid}-opt-${active}`}
            onKeyDown={onListKey}
            className="group max-h-[min(22rem,60vh)] overflow-y-auto p-1.5 outline-none"
          >
            {options.map((o, i) => {
              const selected = o.id === locationId;
              return (
                <li
                  key={o.id ?? 'all'}
                  id={`${uid}-opt-${i}`}
                  role="option"
                  aria-selected={selected}
                  onMouseMove={() => setActive(i)}
                  onClick={() => choose(i)}
                  className={cn(
                    'flex min-h-11 cursor-pointer items-center gap-3 rounded-control px-2.5 text-sm',
                    i === active && 'bg-sunken group-focus:outline-2 group-focus:-outline-offset-2 group-focus:outline-accent',
                    i === 0 && 'mb-1',
                  )}
                >
                  <span className={cn('grid size-4 shrink-0 place-items-center', selected ? 'text-accent' : 'text-transparent')}>
                    <Icons.Check className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn('block truncate', selected && 'font-medium')}>{o.label}</span>
                    {o.detail && <span className="block truncate text-xs text-muted">{o.detail}</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
