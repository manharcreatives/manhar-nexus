import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { cn } from '../lib/cn';
import { StampCheck } from './Stamp';

type Tone = 'ok' | 'bad' | 'info';
interface ToastItem {
  id: number;
  tone: Tone;
  text: string;
}
interface ToastApi {
  show: (text: string, tone?: Tone) => void;
}

const Ctx = createContext<ToastApi>({ show: () => {} });
export const useToast = (): ToastApi => useContext(Ctx);

let seq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const show = useCallback((text: string, tone: Tone = 'ok') => {
    const id = ++seq;
    setItems((l) => [...l, { id, tone, text }]);
    setTimeout(() => setItems((l) => l.filter((i) => i.id !== id)), 4500);
  }, []);
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
      {/* Announcements: an always-present live region, independent of the visual layer. */}
      <div aria-live="polite" className="sr-only">
        {items.map((i) => (
          <p key={i.id}>{i.text}</p>
        ))}
      </div>
      <div
        ref={layer}
        aria-hidden
        {...{ popover: 'manual' }}
        className="pointer-events-none fixed inset-x-0 top-auto bottom-4 z-50 m-0 flex h-auto w-full max-w-none flex-col items-center gap-2 overflow-visible border-0 bg-transparent p-0 px-4"
      >
        {items.map((i) => (
          <div
            key={i.id}
            className={cn(
              'nx-toast pointer-events-auto flex max-w-md items-center gap-3 rounded-[0.75rem] py-3 pr-5 pl-3.5 text-sm font-medium shadow-[0_16px_40px_-16px_rgb(27_26_23/0.6)]',
              i.tone === 'ok' && 'bg-accent text-[#04120a]',
              i.tone === 'bad' && 'bg-bad text-surface',
              i.tone === 'info' && 'bg-info text-surface',
            )}
          >
            {i.tone === 'ok' ? (
              <StampCheck className="nx-stamp size-5 shrink-0 text-ember-glow" />
            ) : (
              <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-current" />
            )}
            {i.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
