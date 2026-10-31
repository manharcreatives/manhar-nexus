import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Flame, Minus, Plus, Trash2, X } from 'lucide-react';
import { T } from '../strings';
import type { Veg } from '../types';

// ───────────── Veg / non-veg mark: shape + colour, never colour alone ─────────────
export function VegMark({ kind, className = '' }: { kind?: Veg | null; className?: string }) {
  if (!kind) return null;
  return (
    <span className={`gm-veg ${className}`} data-kind={kind} role="img" aria-label={T.veg[kind]} title={T.veg[kind]}>
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <rect x="1" y="1" width="14" height="14" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
        {kind === 'nonveg' ? <path d="M8 4.2 12 11H4z" fill="currentColor" /> : <circle cx="8" cy="8" r={kind === 'egg' ? 2.6 : 3.4} fill={kind === 'egg' ? 'none' : 'currentColor'} stroke="currentColor" strokeWidth={kind === 'egg' ? 1.8 : 0} />}
      </svg>
    </span>
  );
}

export function Spice({ level }: { level?: number | null }) {
  const n = Math.max(0, Math.min(3, Math.round(level ?? 0)));
  if (!n) return null;
  return (
    <span className="gm-spice" role="img" aria-label={T.spice[n]} title={T.spice[n]}>
      {Array.from({ length: n }, (_, i) => (
        <Flame key={i} size={13} strokeWidth={2} fill="currentColor" aria-hidden="true" />
      ))}
    </span>
  );
}

// ───────────── Blur-up image ─────────────
export function BlurImage({ src, blur, alt = '', priority = false, className = '', width, height }: { src?: string | null; blur?: string | null; alt?: string; priority?: boolean; className?: string; width?: number; height?: number }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    if (ref.current?.complete && ref.current.naturalWidth > 0) setLoaded(true);
  }, [src]);
  return (
    <span className={`gm-img ${className}`} data-loaded={loaded || undefined} style={blur ? { backgroundImage: `url("${blur}")` } : undefined}>
      {src && !failed ? (
        <img
          ref={ref}
          src={src}
          alt={alt}
          width={width}
          height={height}
          decoding="async"
          loading={priority ? 'eager' : 'lazy'}
          {...(priority ? { fetchPriority: 'high' as const } : {})}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      ) : null}
    </span>
  );
}

// ───────────── Quantity stepper ─────────────
export function Stepper({ qty, onChange, min = 0, max = 20, label, size = 'md', removeIcon = false }: { qty: number; onChange: (n: number) => void; min?: number; max?: number; label: string; size?: 'md' | 'sm'; removeIcon?: boolean }) {
  return (
    <div className="gm-stepper" data-size={size} role="group" aria-label={label}>
      <button type="button" className="gm-press" aria-label={qty <= 1 && min === 0 ? `${T.remove} ${label}` : T.decrease} onClick={() => onChange(Math.max(min, qty - 1))} disabled={qty <= min}>
        {removeIcon && qty <= 1 ? <Trash2 size={15} aria-hidden="true" /> : <Minus size={15} aria-hidden="true" />}
      </button>
      <output aria-live="polite">{qty}</output>
      <button type="button" className="gm-press" aria-label={T.increase} onClick={() => onChange(Math.min(max, qty + 1))} disabled={qty >= max}>
        <Plus size={15} aria-hidden="true" />
      </button>
    </div>
  );
}

// ───────────── Bottom sheet ─────────────
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Keeps the sheet mounted for the exit animation. */
function usePresence(open: boolean, ms = 280) {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
      return;
    }
    if (!mounted) return;
    setClosing(true);
    const t = setTimeout(() => {
      setMounted(false);
      setClosing(false);
    }, ms);
    return () => clearTimeout(t);
  }, [open, ms]);
  return { mounted, closing };
}

let lockCount = 0;
function lockScroll(lock: boolean) {
  const root = document.documentElement;
  if (lock) {
    lockCount += 1;
    root.style.overflow = 'hidden';
  } else {
    lockCount = Math.max(0, lockCount - 1);
    if (!lockCount) root.style.removeProperty('overflow');
  }
}

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Hide the visible title (the dialog is still labelled). */
  hideTitle?: boolean;
  footer?: ReactNode;
  children: ReactNode;
  tall?: boolean;
  className?: string;
  /** Rendered above the scroll area (image header). */
  hero?: ReactNode;
}

export function Sheet({ open, onClose, title, hideTitle, footer, children, tall, className = '', hero }: SheetProps) {
  const { mounted, closing } = usePresence(open);
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  const down = useRef(false);
  const returnTo = useRef<HTMLElement | null>(null);
  const drag = useRef<{ y0: number; t0: number; dy: number; id: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    returnTo.current = document.activeElement as HTMLElement | null;
    lockScroll(true);
    const t = setTimeout(() => {
      const el = panel.current?.querySelector<HTMLElement>('[data-autofocus]') ?? panel.current?.querySelector<HTMLElement>('.gm-sheet__close');
      el?.focus({ preventScroll: true });
    }, 30);
    return () => {
      clearTimeout(t);
      lockScroll(false);
      const r = returnTo.current;
      if (r && document.contains(r)) r.focus({ preventScroll: true });
    };
  }, [open]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== 'Tab' || !panel.current) return;
    const els = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null || el === document.activeElement);
    if (!els.length) return;
    const first = els[0]!;
    const last = els[els.length - 1]!;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  // Drag the grabber/header down to dismiss.
  const onDragStart = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    drag.current = { y0: e.clientY, t0: performance.now(), dy: 0, id: e.pointerId };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    panel.current?.style.setProperty('transition', 'none');
  }, []);
  const onDragMove = useCallback((e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || !panel.current) return;
    d.dy = Math.max(0, e.clientY - d.y0);
    panel.current.style.transform = `translate3d(0, ${d.dy}px, 0)`;
  }, []);
  const onDragEnd = useCallback(() => {
    const d = drag.current;
    drag.current = null;
    const p = panel.current;
    if (!d || !p) return;
    p.style.removeProperty('transition');
    const v = d.dy / Math.max(1, performance.now() - d.t0);
    if (d.dy > 110 || (v > 0.55 && d.dy > 30)) {
      p.style.removeProperty('transform');
      onClose();
    } else p.style.removeProperty('transform');
  }, [onClose]);

  if (!mounted) return null;
  return (
    <div className="gm-sheet-root" data-closing={closing || undefined}>
      <div
        className="gm-backdrop"
        onPointerDown={() => { down.current = true; }}
        onClick={() => {
          // Only a press that STARTED on the backdrop closes it (a text-selection drag ending here must not).
          if (down.current) onClose();
          down.current = false;
        }}
        aria-hidden="true"
      />
      <div
        ref={panel}
        className={`gm-sheet ${tall ? 'gm-sheet--tall' : ''} ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-t`}
        onKeyDown={onKeyDown}
        onPointerDown={() => { down.current = false; }}
      >
        <div className="gm-sheet__head" onPointerDown={onDragStart} onPointerMove={onDragMove} onPointerUp={onDragEnd} onPointerCancel={onDragEnd}>
          <span className="gm-grabber" aria-hidden="true" />
          <div className="gm-sheet__bar">
            <h2 id={`${id}-t`} className={hideTitle ? 'gm-sr' : 'gm-sheet__title'}>{title}</h2>
            <button type="button" className="gm-sheet__close gm-press" onClick={onClose} aria-label={T.closeLabel}>
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
        {hero}
        <div className="gm-sheet__body">{children}</div>
        {footer ? <div className="gm-sheet__foot">{footer}</div> : null}
      </div>
    </div>
  );
}
