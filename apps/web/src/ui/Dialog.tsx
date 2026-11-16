import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '../lib/cn';
import { useBackdropDismiss } from './useBackdropDismiss';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  /** Close when the backdrop is clicked (default). Escape and the footer buttons always work. */
  closeOnBackdrop?: boolean;
}

/**
 * Modal built on the native <dialog>: focus trap, Esc and return-focus come from the platform; backdrop
 * dismissal uses the shared pointer logic so a text selection that ends outside never closes it.
 *
 * On a phone a long form scrolls INSIDE the dialog while the title stays at the top and the footer (Save) stays at the
 * bottom, clear of the home-indicator (safe-area inset). Height never exceeds the visible screen (100dvh).
 */
export function Dialog({ open, onClose, title, children, footer, className, closeOnBackdrop = true }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  // Closes only when the press AND the release both happened on the backdrop (see useBackdropDismiss).
  const backdrop = useBackdropDismiss(onClose, closeOnBackdrop);

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
      {...backdrop}
      className={cn(
        'nx-dialog m-auto max-h-[calc(100dvh-1rem)] overflow-y-auto focus:outline-none w-[min(32rem,calc(100vw-1rem))] sm:max-h-[calc(100dvh-2rem)] sm:w-[min(32rem,calc(100vw-2rem))] nx-pop rounded-panel p-0 text-ink',
        className,
      )}
    >
      {open && (
        <div className="[--stub-bg:var(--color-surface)]">
          <div className="sticky top-0 z-10 rounded-t-panel bg-surface px-4 pt-5 sm:px-6 sm:pt-6">
            <h2 className="rule-tick pb-3 text-[1.375rem] leading-tight font-semibold break-words">
              {title}
            </h2>
          </div>
          <div className="px-4 pt-4 pb-6 sm:px-6">{children}</div>
          {/* The footer is sticky: on a phone a long form scrolls inside the dialog, and Save must stay in view. */}
          {footer && (
            <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-2 rounded-b-panel border-t border-white/[0.12] bg-surface px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-14px_18px_-14px_rgb(0_0_0/0.6)] sm:px-6">
              {footer}
            </div>
          )}
        </div>
      )}
    </dialog>
  );
}
