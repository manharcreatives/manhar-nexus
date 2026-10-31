import { useState } from 'react';
import '../styles/cta.css';
import { Button, Reveal, Section, SectionButton } from '../components';
import { CONTACT, CTA_BANNER } from '../content';
import { setRegistrationIntent } from '../hooks/useRegistrationIntent';
import { foundingState, foundingAwareText } from '../pricing/pricingMath';
import { headlineNode } from './_b/headline';

/** Closing banner: one large sentence, one primary action, on a lit-edge glass panel. */
export default function CtaBanner() {
  const [now] = useState(() => new Date());
  const finePrint = foundingAwareText(CTA_BANNER.finePrint, foundingState(now));
  return (
    <Section id="cta" tone="ink" labelledBy="cta-title" className="lp-edge-green lp-band">
      <span className="lp-orb lp-band__orb" aria-hidden="true" />
      <Reveal className="lp-band__inner lp-glass">
        <p className="lp-eyebrow lp-band__eyebrow">{CTA_BANNER.eyebrow}</p>
        <h2 id="cta-title" className="lp-h2 lp-band__title">
          {headlineNode(CTA_BANNER.headline)}
        </h2>
        <p className="lp-lede lp-band__body">{CTA_BANNER.body}</p>
        <div className="lp-band__actions">
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
        <p className="lp-band__fine">{finePrint}</p>
      </Reveal>
    </Section>
  );
}
