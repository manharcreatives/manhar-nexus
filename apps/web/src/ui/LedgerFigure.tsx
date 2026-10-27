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
  className?: string;
}

/**
 * Signature move: the ledger figure. Every hero amount is set in Fraunces
 * tabular figures with a small raised currency and fraction, so the whole
 * number carries the weight. Screen readers and text search get the exact
 * formatMoney text; the typeset parts are presentational.
 */
export function LedgerFigure({ minor, currency, rule, reveal, className }: LedgerFigureProps) {
  const p = moneyParts(minor, currency);
  return (
    <span className={cn('nx-ledger', className)} data-rule={rule} data-reveal={reveal || undefined}>
      <span className="sr-only select-none">{p.text}</span>
      <span aria-hidden>
        {p.sign && <span data-part="sign">{p.sign}</span>}
        <span data-part="cur">{p.currency}</span>
        <span data-part="whole">{p.whole}</span>
        {p.fraction && <span data-part="frac">{p.fraction}</span>}
      </span>
    </span>
  );
}
