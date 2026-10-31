import { PRICING, type BillingCycle } from '../content';

const CYCLES: readonly BillingCycle[] = ['monthly', 'yearly'];

export interface BillingToggleProps {
  cycle: BillingCycle;
  onChange: (cycle: BillingCycle) => void;
}

/** 'Yearly — 2 months free' -> ['Yearly', '2 months free'] so the saving can sit in a small chip. */
function splitLabel(label: string): [string, string | null] {
  const at = label.indexOf(' — ');
  return at < 0 ? [label, null] : [label.slice(0, at), label.slice(at + 3)];
}

/**
 * Monthly / Yearly segmented control. Built on two native radio inputs inside one radiogroup, so the browser
 * provides arrow-key movement, focus and checked state; the sliding pill is pure CSS driven by data-v.
 */
export function BillingToggle({ cycle, onChange }: BillingToggleProps) {
  return (
    <div role="radiogroup" aria-label={PRICING.toggle.ariaLabel} className="lp-seg" data-v={cycle}>
      {CYCLES.map((c) => {
        const [main, chip] = splitLabel(PRICING.toggle[c]);
        return (
          <label key={c} className="lp-seg__opt">
            <input
              type="radio"
              className="lp-seg__input"
              name="pricing-cycle"
              value={c}
              checked={cycle === c}
              onChange={() => onChange(c)}
            />
            <span className="lp-seg__label">
              {main}
              {chip ? <span className="lp-seg__chip"> {chip}</span> : null}
            </span>
          </label>
        );
      })}
    </div>
  );
}
