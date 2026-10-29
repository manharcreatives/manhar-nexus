import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '../lib/cn';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

/** Modal built on the native <dialog>: focus trap, Esc and backdrop come from the platform. */
export function Dialog({ open, onClose, title, children, footer, className }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      // A dialog can name its safest primary action: <Button data-autofocus>.
      el.querySelector<HTMLElement>('[data-autofocus]')?.focus();
      // Chromium can auto-focus a scrollable container (e.g. a tab strip);
      // in that case start from the dialog itself so focus lands somewhere meaningful.
      const active = document.activeElement;
      if (active instanceof HTMLElement && el.contains(active) && !active.matches('input, select, textarea, button, a[href], [tabindex]')) {
        el.focus();
      }
    }
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      tabIndex={-1}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        'nx-dialog m-auto focus:outline-none w-[min(32rem,calc(100vw-2rem))] nx-pop rounded-panel p-0 text-ink',
        className,
      )}
    >
      {open && (
        <div className="[--stub-bg:var(--color-surface)]">
          <div className="px-6 pt-6">
            <h2 className="rule-tick pb-3 text-[1.375rem] leading-tight font-semibold">{title}</h2>
          </div>
          <div className="px-6 pt-4 pb-6">{children}</div>
          {footer && (
            <div className="flex flex-wrap items-center justify-end gap-2 rounded-b-panel border-t border-white/[0.07] bg-white/[0.02] px-6 py-4">{footer}</div>
          )}
        </div>
      )}
    </dialog>
  );
}
