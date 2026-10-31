import { Check } from 'lucide-react';
import type { CSSProperties } from 'react';

/** Deterministic "messy" placement for the paper slips (no Math.random: stable between renders and SSR). */
const slipStyle = (k: number): CSSProperties =>
  ({
    '--rot': `${((k * 7) % 11) - 5}deg`,
    '--dx': `${k * 2.1}rem`,
    '--dy': `${((k * 5) % 4) * 0.22}rem`,
  }) as CSSProperties;

/**
 * Left meter: the paper world piles up. One slip per moment that has happened, plus a WhatsApp-style bubble,
 * a crossed-out notebook line and a calculator that shows up when the bill does. Hand-made CSS, decorative only.
 */
export function PaperPile({ current, count }: { current: number; count: number }) {
  return (
    <div className="lp-cs__pile" aria-hidden="true">
      <div className="lp-cs__slips">
        {Array.from({ length: count }, (_, k) => (
          <i key={k} className="lp-cs__slip" data-on={k <= current} style={slipStyle(k)} />
        ))}
      </div>
      <span className="lp-cs__bubble" data-on={current >= 0}>
        Table 4 free??
      </span>
      <span className="lp-cs__strike" data-on={current >= 4}>
        <s>paneer tikka x2</s> ??
      </span>
      <span className="lp-cs__calc" data-on={current >= 5}>
        = ?
      </span>
    </div>
  );
}

/** Right meter: the Nexus world stays tidy. One tick per moment handled. */
export function TidyTicks({ current, count }: { current: number; count: number }) {
  return (
    <div className="lp-cs__tidy" aria-hidden="true">
      <ul className="lp-cs__ticklist">
        {Array.from({ length: count }, (_, k) => (
          <li key={k} data-on={k <= current}>
            <Check size={14} strokeWidth={2.5} />
          </li>
        ))}
      </ul>
      <p className="lp-mono lp-cs__tidy-label">
        {current + 1} of {count} moments handled
      </p>
    </div>
  );
}
