import { useState } from 'react';
import '../styles/pricing.css';
import '../styles/pricing-lux.css';
import { Reveal, Section, SectionButton } from '../components';
import { SectionHead } from '../sectionsC/SectionHead';
import { PLANS, PRICING, type Plan } from '../content';
import { useRegistrationIntent } from '../hooks/useRegistrationIntent';
import { BillingToggle } from '../pricing/BillingToggle';
import { CompareTable } from '../pricing/CompareTable';
import { FoundingBanner } from '../pricing/FoundingBanner';
import { PaymentFlow, BillingFaq } from '../pricing/PaymentFlow';
import { PlanCard } from '../pricing/PlanCard';
import { AddOnsTable, IncludedList, OnboardingTable, TryBeforePaying } from '../pricing/PricingExtras';
import { foundingState } from '../pricing/pricingMath';
import { renderHeadline } from '../sectionsC/headline';

/**
 * Pricing: Monthly/Yearly radiogroup, GST switch, three priced plans plus the Many Doors enquiry card,
 * the Founding Restaurants banner (time-aware), a comparison table, fees and add-ons, and an honest
 * explanation of how payment works. Choosing a plan writes the visitor's intent (plan + cycle) for the form.
 */
export default function Pricing() {
  const { cycle, setCycle, choosePlan, setBegin } = useRegistrationIntent();
  const [inclusive, setInclusive] = useState(false);
  const [now] = useState(() => new Date());
  const state = foundingState(now);

  const choose = (plan: Plan): void => choosePlan(plan.key, cycle);

  return (
    <Section id="pricing" tone="canvas" labelledBy="pricing-title" className="lp-pricing">
      <SectionHead
        eyebrow={PRICING.header.eyebrow}
        title={renderHeadline(PRICING.header.headline)}
        titleId="pricing-title"
        lede={PRICING.header.subhead}
      />

      <FoundingBanner state={state} />

      <div className="lp-pricing__controls">
        <div className="lp-pricing__toggle">
          <BillingToggle cycle={cycle} onChange={setCycle} />
          <p className="lp-pricing__note">Yearly = 10 months paid. You get all 12.</p>
        </div>
        <label className="lp-switch">
          <input type="checkbox" role="switch" checked={inclusive} onChange={(e) => setInclusive(e.target.checked)} />
          <span className="lp-switch__track" aria-hidden="true" />
          <span className="lp-switch__label">Show prices with 18% GST</span>
        </label>
      </div>

      <div className="lp-plans">
        {PLANS.map((plan, i) => (
          <Reveal key={plan.key} delay={i * 70} className="lp-plans__item">
            <PlanCard plan={plan} cycle={cycle} inclusive={inclusive} state={state} onChoose={choose} />
          </Reveal>
        ))}
      </div>

      <p className="lp-pricing__under">
        <span>{PRICING.underGrid.lead}</span>{' '}
        <SectionButton section="register" variant="ghost" arrow onClick={() => setBegin('demo')}>
          {PRICING.underGrid.label}
        </SectionButton>
      </p>
      <p className="lp-pricing__footnote">{PRICING.footnote}</p>

      <div className="lp-pricing__block">
        <h3 className="lp-extra__title">Compare the plans</h3>
        <CompareTable title="Plan comparison" />
      </div>

      <div className="lp-pricing__block lp-pricing__two">
        <IncludedList />
        <TryBeforePaying />
      </div>

      <div className="lp-pricing__block lp-pricing__two">
        <OnboardingTable state={state} />
        <AddOnsTable />
      </div>

      <div className="lp-pricing__block lp-pricing__two">
        <PaymentFlow />
        <BillingFaq />
      </div>
    </Section>
  );
}
