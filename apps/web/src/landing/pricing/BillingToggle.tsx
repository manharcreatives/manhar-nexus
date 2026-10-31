import { PRICING, type BillingCycle } from '../content';

const CYCLES: readonly BillingCycle[] = ['monthly', 'yearly'];

export interface BillingToggleProps {
  cycle: BillingCycle;
  onChange: (cycle: BillingCycle) => void;
}

/**
 * Monthly / Yearly segmented control. Built on two native radio inputs inside one radiogroup, so the browser
 * provides arrow-key movement, focus and checked state; the sliding pill is pure CSS driven by data-v.
 */
export function BillingToggle({ cycle, onChange }: BillingToggleProps) {
  return (
    <div role="radiogroup" aria-label={PRICING.toggle.ariaLabel} className="lp-seg" data-v={cycle}>
      {CYCLES.map((c) => (
        <label key={c} className="lp-seg__opt">
          <input
            type="radio"
            className="lp-seg__input"
            name="pricing-cycle"
            value={c}
            checked={cycle === c}
            onChange={() => onChange(c)}
          />
          <span className="lp-seg__label">{PRICING.toggle[c]}</span>
        </label>
      ))}
    </div>
  );
}
