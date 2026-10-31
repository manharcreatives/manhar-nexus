import type { HeroContent } from './types';

export const HERO: HeroContent = {
  eyebrow: 'A RESTAURANT OPERATIONS PLATFORM',
  headline: {
    text: 'Every table, every ticket, every rupee — accounted for.',
    accent: 'accounted',
  },
  altHeadline: {
    text: 'The night ends. Your numbers should agree.',
    accent: 'agree',
  },
  subhead: 'Floor, kitchen and counter in one calm workspace, so closing time brings numbers you can trust.',
  primaryCta: { label: 'Register your restaurant', href: '/#register' },
  secondaryCta: { label: 'See how a night runs ↓', href: '/#why' },
  microcopy: 'Pay online. We set up your workspace by hand. 14-day money-back guarantee.',
  proofPoints: [
    {
      id: 'self-checking-record',
      title: 'A record that checks itself.',
      // Activity History is tamper-evident, not tamper-proof.
      body: 'Sensitive actions are logged, and Verify checks that nothing was altered.',
      icon: 'ShieldCheck',
    },
    {
      id: 'paid-is-paid',
      title: 'Paid is paid.',
      body: 'A mistake is fixed by a visible refund or Void, with a reason.',
      icon: 'BadgeCheck',
    },
    {
      id: 'floor-and-kitchen-live',
      title: 'Floor and kitchen, live.',
      body: 'Service Requests reach the KOS within about a second.',
      icon: 'Radio',
    },
  ],
  scrollCue: 'Scroll to follow one night',
  imageAlt: 'A restaurant pass at dusk: tickets lined up under warm light.',
};
