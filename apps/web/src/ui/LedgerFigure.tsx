import { useEffect, useRef, useState } from 'react';
import { moneyParts } from '../lib/money';
import { cn } from '../lib/cn';

export interface LedgerFigureProps {
  /** Integer minor units (paise). */
  minor: number;
  currency?: string;
  /** Accountant's rule under the figure: single (subtotal) or double (grand total). */
  rule?: 'single' | 'double';
  /** Digits rise into place on mount (CSS only; the final value is in the DOM from the first frame). */
  reveal?: boolean;
  /** Count from the previous value (0 on first paint) to `minor` over ~0.9 s. Screen readers always get the final text. */
  countUp?: boolean;
  className?: string;
}

/**
 * Signature move: the ledger figure. Every hero amount is set in Fraunces
 * tabular figures with a small raised currency and fraction, so the whole
 * number carries the weight. Screen readers and text search get the exact
 * formatMoney text; the typeset parts are presentational.
 */
/** Eases a number toward `target`; settles instantly when motion is reduced. */
function useCountUp(target: number, enabled: boolean): number {
  const [shown, setShown] = useState(enabled ? 0 : target);
  const from = useRef(enabled ? 0 : target);
  useEffect(() => {
    if (!enabled) {
      setShown(target);
      return;
    }
    const reduced = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || typeof requestAnimationFrame !== 'function' || from.current === target) {
      from.current = target;
      setShown(target);
      return;
    }
    const start = from.current;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / 900);
      const eased = 1 - Math.pow(1 - k, 4);
      const v = Math.round(start + (target - start) * eased);
      from.current = v;
      setShown(v);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, enabled]);
  return shown;
}

export function LedgerFigure({ minor, currency, rule, reveal, countUp, className }: LedgerFigureProps) {
  const p = moneyParts(minor, currency);
  const shown = useCountUp(minor, !!countUp);
  const v = countUp ? moneyParts(shown, currency) : p;
  return (
    <span className={cn('nx-ledger', className)} data-rule={rule} data-reveal={reveal || undefined}>
      <span className="sr-only select-none">{p.text}</span>
      <span aria-hidden>
        {v.sign && <span data-part="sign">{v.sign}</span>}
        <span data-part="cur">{v.currency}</span>
        <span data-part="whole">{v.whole}</span>
        {v.fraction && <span data-part="frac">{v.fraction}</span>}
      </span>
    </span>
  );
}
