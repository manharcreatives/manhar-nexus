import { useState } from 'react';
import '../styles/insights.css';
import { Button, Reveal, Section, SectionButton } from '../components';
import { CONTACT, CTA_BANNER } from '../content';
import { setRegistrationIntent } from '../hooks/useRegistrationIntent';
import { foundingState, foundingAwareText } from '../pricing/pricingMath';
import { renderHeadline } from '../sectionsC/headline';

/** Closing Ink enquiry banner with a 1px green top edge. */
export default function CtaBanner() {
  const [now] = useState(() => new Date());
  const finePrint = foundingAwareText(CTA_BANNER.finePrint, foundingState(now));
  return (
    <Section id="cta" tone="ink" labelledBy="cta-title" className="lp-edge-green lp-cta">
      <Reveal className="lp-cta__inner">
        <p className="lp-eyebrow">{CTA_BANNER.eyebrow}</p>
        <h2 id="cta-title" className="lp-h2 lp-cta__title">
          {renderHeadline(CTA_BANNER.headline)}
        </h2>
        <p className="lp-lede lp-cta__body">{CTA_BANNER.body}</p>
        <div className="lp-cta__actions">
          <SectionButton section="register" size="lg" arrow onClick={() => setRegistrationIntent({ begin: 'register' })}>
            {CTA_BANNER.primaryCta.label}
          </SectionButton>
          <SectionButton section="register" variant="secondary" size="lg" onClick={() => setRegistrationIntent({ begin: 'demo' })}>
            {CTA_BANNER.secondaryCta.label}
          </SectionButton>
          <Button href={CONTACT.whatsappUrl} variant="ghost" external>
            Or WhatsApp us<span className="lp-visually-hidden"> (opens in a new tab)</span>
          </Button>
        </div>
        <p className="lp-cta__fine">{finePrint}</p>
      </Reveal>
    </Section>
  );
}
