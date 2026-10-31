import { Icon, SectionButton, cx } from '../components';
import { PRICING, type BillingCycle, type Plan } from '../content';
import { Check } from '../sectionsC/icons';
import { money, priceLabel, priceView, type FoundingState } from './pricingMath';

export interface PlanCardProps {
  plan: Plan;
  cycle: BillingCycle;
  /** Show prices with 18% GST added. */
  inclusive: boolean;
  state: FoundingState;
  onChoose: (plan: Plan) => void;
}

/** At most five bullets per card, taken from the plan's curated `highlights`. */
const MAX_BULLETS = 5;

/**
 * One priced plan. The price block always has the same four rows (list price, price, equivalent, GST) so the
 * card never changes height when the visitor flips Monthly/Yearly or the GST switch. The featured plan is
 * lifted and carries a hairline brand-gradient border.
 */
export function PlanCard({ plan, cycle, inclusive, state, onChoose }: PlanCardProps) {
  const founding = state === 'open';
  const view = priceView(plan, cycle, { inclusive, founding });
  const yearlyView = priceView(plan, 'yearly', { inclusive, founding: false });
  const nameId = `plan-${plan.key}-name`;

  return (
    <article
      className={cx('lp-plan', plan.highlight && 'lp-plan--featured w2-glow-edge')}
      aria-labelledby={nameId}
      data-plan={plan.key}
    >
      {plan.highlight ? <p className="lp-plan__ribbon">{plan.badge}</p> : null}

      <div className="lp-plan__head">
        <p className="lp-eyebrow lp-plan__eyebrow">{plan.eyebrow}</p>
        <h3 id={nameId} className="lp-plan__name">
          {plan.name}
        </h3>
        <p className="lp-plan__tagline">{plan.tagline}</p>
      </div>

      {view ? (
        <div className="lp-plan__price" data-cycle={cycle}>
          <p className="lp-plan__was">
            {view.listAmount !== null ? (
              <>
                <s>
                  <span className="lp-visually-hidden">{PRICING.strikeLabel} </span>
                  {money(view.listAmount)}
                </s>{' '}
                <span className="lp-plan__was-tag">Founding price</span>
              </>
            ) : (
              <span aria-hidden="true">&nbsp;</span>
            )}
          </p>
          <p className="lp-plan__amount">
            <span className="lp-visually-hidden">{priceLabel(view, inclusive)}</span>
            <span aria-hidden="true">
              <span className="lp-plan__figure">{money(view.amount)}</span>
              <span className="lp-plan__unit">{view.unit === 'year' ? PRICING.perYear : PRICING.perMonth}</span>
            </span>
          </p>
          <p className="lp-plan__equiv">
            {view.perMonth !== null ? (
              <>
                <span>≈ {money(view.perMonth)} a month</span>
                {view.saving !== null ? (
                  <span>
                    {PRICING.savingLabel} {money(view.saving)} against paying monthly
                  </span>
                ) : null}
              </>
            ) : (
              <>
                <span>Billed monthly. Cancel any time.</span>
                {yearlyView?.saving ? <span>Yearly saves {money(yearlyView.saving)}</span> : null}
              </>
            )}
          </p>
          <p className="lp-plan__gst">
            {inclusive
              ? `${PRICING.gstInclusiveHint} · ${money(view.otherMode)} + GST`
              : `${PRICING.gstNote} · ${money(view.otherMode)} with GST`}
          </p>
        </div>
      ) : null}

      <ul className="lp-plan__features">
        {plan.highlights.slice(0, MAX_BULLETS).map((feature) => (
          <li key={feature}>
            <Icon icon={Check} size={16} strokeWidth={2.5} />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <SectionButton
        section="register"
        variant={plan.highlight ? 'primary' : 'secondary'}
        block
        arrow
        className="lp-plan__cta"
        onClick={() => onChoose(plan)}
      >
        {plan.cta.label}
      </SectionButton>
    </article>
  );
}
