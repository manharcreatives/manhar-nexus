import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { cn } from '../lib/cn';
import { StampCheck } from './Stamp';

type Tone = 'ok' | 'bad' | 'info';
export interface ToastOptions {
  /** An action the person can take right now (typically Undo). Keyboard reachable; closes the toast when used. */
  action?: { label: string; onClick: () => void };
  /** How long it stays, in ms. Default: 4.5s, errors 8s, a toast with an action 8s. */
  duration?: number;
}
interface ToastItem {
  id: number;
  tone: Tone;
  text: string;
  action?: ToastOptions['action'];
}
interface ToastApi {
  show: (text: string, tone?: Tone, options?: ToastOptions) => void;
}

const Ctx = createContext<ToastApi>({ show: () => {} });
export const useToast = (): ToastApi => useContext(Ctx);

let seq = 0;

/** A message that asks for action or reports a problem stays long enough to read in a hurry. */
export function toastDuration(tone: Tone, options?: ToastOptions): number {
  return options?.duration ?? (tone === 'bad' || options?.action ? 8000 : 4500);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const dismiss = useCallback((id: number) => setItems((l) => l.filter((i) => i.id !== id)), []);
  const show = useCallback(
    (text: string, tone: Tone = 'ok', options?: ToastOptions) => {
      const id = ++seq;
      setItems((l) => [...l, { id, tone, text, action: options?.action }]);
      setTimeout(() => dismiss(id), toastDuration(tone, options));
    },
    [dismiss],
  );
  const api = useMemo(() => ({ show }), [show]);
  const layer = useRef<HTMLDivElement>(null);

  // Toasts live in the top layer (manual popover) so they sit above open
  // modal dialogs — "Payment recorded" must not hide behind the checkout.
  // Re-showing on each change raises the layer above a dialog opened since.
  useLayoutEffect(() => {
    const el = layer.current as (HTMLDivElement & { showPopover?: () => void; hidePopover?: () => void }) | null;
    if (!el || typeof el.showPopover !== 'function' || items.length === 0) return;
    try {
      if (el.matches(':popover-open')) el.hidePopover?.();
      el.showPopover();
    } catch {
      /* popover unsupported: the fixed layer still shows below dialogs */
    }
  }, [items]);

  return (
    <Ctx.Provider value={api}>
      {children}
      {/*
        Each toast is its own live region (status for good news, alert for a problem), so it is announced once and
        its Undo button stays reachable by keyboard. On a phone the stack sits at the TOP, below the notch, so it never
        covers the Save/Pay buttons at the bottom; on a desktop it sits bottom-centre.
      */}
      <div
        ref={layer}
        {...{ popover: 'manual' }}
        className="pointer-events-none fixed inset-x-0 top-[max(1rem,env(safe-area-inset-top))] bottom-auto z-50 sm:top-auto sm:bottom-4 m-0 flex h-auto w-full max-w-none flex-col items-center gap-2 overflow-visible border-0 bg-transparent p-0 px-4"
      >
        {items.map((i) => (
          <div
            key={i.id}
            role={i.tone === 'bad' ? 'alert' : 'status'}
            className={cn(
              'nx-toast pointer-events-auto flex max-w-md items-center gap-3 rounded-[0.75rem] py-3 pr-4 pl-3.5 text-sm font-medium break-words shadow-[0_16px_40px_-16px_rgb(0_0_0/0.7)]',
              i.tone === 'ok' && 'bg-accent text-on-accent',
              i.tone === 'bad' && 'bg-bad text-surface',
              i.tone === 'info' && 'bg-info text-surface',
            )}
          >
            {i.tone === 'ok' ? (
              <StampCheck className="nx-stamp size-5 shrink-0 text-on-accent" />
            ) : (
              <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-current" />
            )}
            <span className="min-w-0">{i.text}</span>
            {i.action && (
              <button
                type="button"
                data-compact
                className="-my-1 -mr-1 ml-1 min-h-11 shrink-0 rounded-control px-3 text-sm font-semibold underline underline-offset-2 hover:bg-black/10"
                onClick={() => {
                  i.action?.onClick();
                  dismiss(i.id);
                }}
              >
                {i.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
