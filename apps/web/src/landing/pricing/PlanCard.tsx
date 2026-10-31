import { Icon, SectionButton, Tag, cx } from '../components';
import { PRICING, type BillingCycle, type Plan } from '../content';
import { Check } from '../sectionsC/icons';
import { money, priceLabel, priceView, visibleFeatures, type FoundingState } from './pricingMath';

export interface PlanCardProps {
  plan: Plan;
  cycle: BillingCycle;
  /** Show prices with 18% GST added. */
  inclusive: boolean;
  state: FoundingState;
  onChoose: (plan: Plan) => void;
}

/**
 * One plan. The price block always has the same four rows (list price, price, equivalent, GST) so the card
 * never changes height when the visitor flips Monthly/Yearly or the GST switch.
 */
export function PlanCard({ plan, cycle, inclusive, state, onChoose }: PlanCardProps) {
  const founding = state === 'open';
  const view = priceView(plan, cycle, { inclusive, founding });
  const yearlyView = priceView(plan, 'yearly', { inclusive, founding: false });
  const nameId = `plan-${plan.key}-name`;

  return (
    <article
      className={cx('lp-plan', plan.highlight && 'lp-plan--featured lp-on-dark', plan.enquiryOnly && 'lp-plan--enquiry')}
      aria-labelledby={nameId}
      data-plan={plan.key}
    >
      <div className="lp-plan__head">
        <div className="lp-plan__labels">
          <p className="lp-eyebrow">{plan.eyebrow}</p>
          <Tag tone={plan.highlight ? 'dark' : 'mint'}>{plan.badge}</Tag>
        </div>
        <h3 id={nameId} className="lp-plan__name">
          {plan.name}
        </h3>
        <p className="lp-plan__tagline">{plan.tagline}</p>
      </div>

      <div className="lp-plan__price" data-cycle={cycle}>
        {view ? (
          <>
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
                  {yearlyView?.saving ? (
                    <span>
                      Yearly saves {money(yearlyView.saving)}
                    </span>
                  ) : null}
                </>
              )}
            </p>
            <p className="lp-plan__gst">
              {inclusive
                ? `${PRICING.gstInclusiveHint} · ${money(view.otherMode)} + GST`
                : `${PRICING.gstNote} · ${money(view.otherMode)} with GST`}
            </p>
          </>
        ) : (
          <>
            <p className="lp-plan__was">
              <span aria-hidden="true">&nbsp;</span>
            </p>
            <p className="lp-plan__amount">
              <span className="lp-plan__figure lp-plan__figure--text">{PRICING.letsTalk}</span>
            </p>
            <p className="lp-plan__equiv">
              <span>Quoted around your outlets and what you need.</span>
              <span>&nbsp;</span>
            </p>
            <p className="lp-plan__gst">Quote + GST</p>
          </>
        )}
      </div>

      <p className="lp-plan__for">{plan.forLine}</p>

      <ul className="lp-plan__features">
        {visibleFeatures(plan, state).map((feature) => (
          <li key={feature}>
            <Icon icon={Check} size={16} strokeWidth={2.5} />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      {plan.note ? <p className="lp-plan__note">{plan.note}</p> : null}

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
