import { Icon, SectionButton } from '../components';
import { PRICING, type Plan } from '../content';
import { Check } from '../sectionsC/icons';

export interface EnquiryCardProps {
  plan: Plan;
  onChoose: (plan: Plan) => void;
}

/** “Many Doors”: groups of 4+ outlets. A refined, wide enquiry card instead of a fourth price card. */
export function EnquiryCard({ plan, onChoose }: EnquiryCardProps) {
  const nameId = `plan-${plan.key}-name`;
  return (
    <article className="lp-plan lp-plan--enquiry" aria-labelledby={nameId} data-plan={plan.key}>
      <div className="lp-enq__main">
        <p className="lp-eyebrow lp-plan__eyebrow">{plan.eyebrow}</p>
        <h3 id={nameId} className="lp-plan__name">
          {plan.name}
        </h3>
        <p className="lp-plan__tagline">{plan.tagline}</p>
      </div>
      <ul className="lp-plan__features lp-enq__list">
        {plan.highlights.map((item) => (
          <li key={item}>
            <Icon icon={Check} size={16} strokeWidth={2.5} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <div className="lp-enq__act">
        <p className="lp-enq__price">{PRICING.letsTalk}</p>
        <p className="lp-enq__sub">Quoted around your outlets · + GST</p>
        <SectionButton section="register" variant="secondary" arrow className="lp-plan__cta" onClick={() => onChoose(plan)}>
          {plan.cta.label}
        </SectionButton>
      </div>
      {plan.note ? <p className="lp-enq__note">{plan.note}</p> : null}
    </article>
  );
}
