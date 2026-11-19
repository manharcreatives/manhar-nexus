import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { cn } from '../lib/cn';

/**
 * A small "More actions" disclosure for the rarely used buttons on a request card, so the one or two actions that
 * matter now stand out. Pattern: a button with aria-expanded controlling a panel of buttons. Escape closes it and
 * puts focus back on the trigger, a click outside closes it, and choosing an action closes it.
 */
export function MoreMenu({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent | TouchEvent) {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
        trigger.current?.focus();
      }
    }
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={wrap} className={cn('relative w-full sm:w-auto', className)}>
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex min-h-11 items-center gap-1 rounded-control border border-white/10 bg-white/[0.04] px-4 text-sm hover:border-accent/40"
      >
        {label}
        <span aria-hidden className={cn('text-xs transition-transform', open ? 'rotate-180' : '')}>
          ▾
        </span>
      </button>
      {open ? (
        <div
          id={panelId}
          role="group"
          aria-label={label}
          onClick={(e) => {
            // Any action button inside closes the panel (links and plain text inside do not).
            if ((e.target as HTMLElement).closest('button')) setOpen(false);
          }}
          className="mt-2 flex w-full min-w-56 max-w-sm flex-col gap-1 rounded-panel border border-white/10 bg-surface p-2 shadow-pop"
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

/** A full-width row button for inside the menu. */
export function MoreItem({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-11 w-full items-center rounded-control px-3 text-left text-sm hover:bg-white/[0.06] disabled:opacity-50"
    >
      {children}
    </button>
  );
}
