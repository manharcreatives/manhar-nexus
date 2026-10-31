import type { CtaBannerContent } from './types';

/** Final Ink banner with a 1 px green top edge. */
export const CTA_BANNER: CtaBannerContent = {
  // Shortened from “READY TO CLOSE THE NIGHT WITH ONE TRUTH?” to keep the mono label within six words.
  eyebrow: 'READY TO CLOSE WITH ONE TRUTH?',
  headline: {
    text: 'Let your next Saturday end with numbers that agree.',
    accent: 'agree',
  },
  body: 'Register your restaurant today. We’ll reply within one working day with your plan, your payment link and a date to set up your Business Workspace.',
  primaryCta: { label: 'Register your restaurant', href: '/#register' },
  secondaryCta: { label: 'Book a live demo', href: '/#register?begin=demo' },
  finePrint:
    '14-day money-back guarantee · Prices exclude 18% GST · Founding Restaurants offer until 31 Jan 2027.',
};
