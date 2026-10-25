import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { cn } from '../lib/cn';

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
  return (
    <Ctx.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4"
      >
        {items.map((i) => (
          <div
            key={i.id}
            className={cn(
              'pointer-events-auto rounded-control px-4 py-3 text-sm font-medium shadow-lg',
              i.tone === 'ok' && 'bg-ink text-paper',
              i.tone === 'bad' && 'bg-bad text-surface',
              i.tone === 'info' && 'bg-info text-surface',
            )}
          >
            {i.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
