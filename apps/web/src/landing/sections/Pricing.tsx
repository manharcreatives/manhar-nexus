import { useState } from 'react';
import '../styles/w2-base.css';
import '../styles/pricing.css';
import '../styles/pricing-lux.css';
import { Reveal, Section, SectionButton } from '../components';
import { SectionHead } from '../sectionsC/SectionHead';
import { PLANS, PRICING, type Plan } from '../content';
import { useRegistrationIntent } from '../hooks/useRegistrationIntent';
import { BillingToggle } from '../pricing/BillingToggle';
import { CompareTable } from '../pricing/CompareTable';
import { Disclosure } from '../pricing/Disclosure';
import { EnquiryCard } from '../pricing/EnquiryCard';
import { FoundingBanner } from '../pricing/FoundingBanner';
import { BillingFaq, PaymentFlow, PaymentStrip } from '../pricing/PaymentFlow';
import { PlanCard } from '../pricing/PlanCard';
import { AddOnsTable, IncludedList, OnboardingTable, TryBeforePaying } from '../pricing/PricingExtras';
import { foundingState } from '../pricing/pricingMath';
import { renderHeadline } from '../sectionsC/headline';

/**
 * Pricing: Monthly/Yearly radiogroup, GST switch, three priced plan cards (the middle one lifted), the Many Doors
 * enquiry card, a slim Founding Restaurants banner (time-aware), and three quiet disclosures (compare plans,
 * setup and add-ons, trying and paying). Choosing a plan writes the visitor's intent (plan + cycle) for the form.
 */
export default function Pricing() {
  const { cycle, setCycle, choosePlan, setBegin } = useRegistrationIntent();
  const [inclusive, setInclusive] = useState(false);
  const [now] = useState(() => new Date());
  const state = foundingState(now);

  const choose = (plan: Plan): void => choosePlan(plan.key, cycle);
  const priced = PLANS.filter((p) => !p.enquiryOnly);
  const enquiry = PLANS.find((p) => p.enquiryOnly);

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
        {priced.map((plan, i) => (
          <Reveal key={plan.key} delay={i * 80} className="lp-plans__item">
            <PlanCard plan={plan} cycle={cycle} inclusive={inclusive} state={state} onChoose={choose} />
          </Reveal>
        ))}
      </div>

      {enquiry ? (
        <Reveal delay={120} className="lp-plans__wide">
          <EnquiryCard plan={enquiry} onChoose={choose} />
        </Reveal>
      ) : null}

      <PaymentStrip />

      <p className="lp-pricing__under">
        <span>{PRICING.underGrid.lead}</span>{' '}
        <SectionButton section="register" variant="ghost" arrow onClick={() => setBegin('demo')}>
          {PRICING.underGrid.label}
        </SectionButton>
      </p>

      <div className="lp-pricing__discs">
        <Disclosure id="compare-plans" title="Compare plans" hint="Every feature, side by side.">
          <IncludedList />
          <div className="lp-pricing__gap">
            <CompareTable title="Plan comparison" />
          </div>
        </Disclosure>
        <Disclosure id="setup-addons" title="Setup and add-ons" hint="One-time onboarding and optional extras. All prices exclude GST.">
          <div className="lp-pricing__two">
            <OnboardingTable state={state} />
            <AddOnsTable />
          </div>
        </Disclosure>
        <Disclosure id="trial-payment" title="Trying it, paying, and billing" hint="Honest ways to start, and how payment works.">
          <TryBeforePaying />
          <div className="lp-pricing__two lp-pricing__gap">
            <PaymentFlow />
            <BillingFaq />
          </div>
        </Disclosure>
      </div>

      <p className="lp-pricing__footnote">{PRICING.footnote}</p>
    </Section>
  );
}
