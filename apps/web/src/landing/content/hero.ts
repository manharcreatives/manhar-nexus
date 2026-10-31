import type { HeroContent } from './types';

export const HERO: HeroContent = {
  eyebrow: 'NEXUS · A RESTAURANT OPERATIONS PLATFORM',
  headline: {
    text: 'Every table, every ticket, every rupee — accounted for.',
    accent: 'accounted',
  },
  altHeadline: {
    text: 'The night ends. Your numbers should agree.',
    accent: 'agree',
  },
  subhead:
    'Manhar Nexus joins the floor, the kitchen and the counter in one calm workspace — so closing time brings numbers you can trust, not a notebook you have to decode.',
  primaryCta: { label: 'Register your restaurant', href: '/#register' },
  secondaryCta: { label: 'See how a night runs ↓', href: '/#why' },
  microcopy:
    'Pay online. We set up your Business Workspace by hand. 14-day money-back guarantee.',
  proofPoints: [
    {
      id: 'self-checking-record',
      title: 'A record that can check itself.',
      // Softened from “prove nothing was altered”: Activity History is tamper-evident, not tamper-proof.
      body: 'Every sensitive action goes into Activity History, and a Verify button checks that nothing was altered.',
      icon: 'ShieldCheck',
    },
    {
      id: 'paid-is-paid',
      title: 'Paid is paid.',
      body: 'A finished Checkout is never edited. A mistake is fixed by a visible refund or Void, with a reason.',
      icon: 'BadgeCheck',
    },
    {
      id: 'floor-and-kitchen-live',
      title: 'Floor and kitchen, live.',
      // Softened: “while the waiter is still walking away” → “within about a second”.
      body: 'Service Requests reach the Kitchen Operations Screen (KOS) within about a second. No refresh button.',
      icon: 'Radio',
    },
  ],
  scrollCue: 'Scroll — the night begins at 7:42 pm',
  imageAlt: 'A restaurant pass at dusk: tickets lined up under warm light.',
};
