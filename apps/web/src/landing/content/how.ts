import type { HowContent } from './types';

export const HOW: HowContent = {
  header: {
    eyebrow: 'FROM HELLO TO FIRST SERVICE REQUEST',
    headline: {
      text: 'Five steps. A human at every one.',
      accent: 'human',
    },
    subhead:
      'Nexus isn’t instant sign-up software. We set up every restaurant ourselves — that’s slower, and it’s why the first week works.',
  },
  steps: [
    {
      number: '01',
      id: 'register',
      title: 'Register',
      body: 'Tell us about your restaurant: type, outlets, city, how you’d like to begin. Takes about two minutes.',
      time: '2 min',
      icon: 'ClipboardList',
    },
    {
      number: '02',
      id: 'pay',
      title: 'Pay',
      body: 'We send a secure payment link (UPI, card or net banking via Cashfree). Yearly is one payment; monthly uses UPI AutoPay. GST invoice by email.',
      time: 'Same day',
      icon: 'CreditCard',
    },
    {
      number: '03',
      id: 'workspace',
      title: 'Workspace',
      body: 'We create your Business Workspace, your first location, the owner login and the right modules. You sign in and set your own password.',
      time: 'Target: within one working day',
      icon: 'KeyRound',
    },
    {
      number: '04',
      id: 'menu-and-tables',
      title: 'Menu & tables',
      body: 'Upload your menu (or let us enter it), draw your Dining Areas and tables, add your team and their roles.',
      time: 'A few hours to a few days — depends on your menu',
      icon: 'UtensilsCrossed',
    },
    {
      number: '05',
      id: 'first-service',
      title: 'First service',
      body: 'Open a table, send a Service Request, watch it appear on the KOS, take the Checkout. We stay on call for your first service.',
      time: 'Your launch day',
      icon: 'Rocket',
    },
  ],
  underStrip: 'Not ready to pay? Ask for a 14-day pilot or a live demo instead.',
  guaranteeLine: 'Changed your mind within 14 days of activation? Full refund.',
  payInterim: 'We’ll send your payment link by WhatsApp or email within one working day.',
  integrationNote:
    'INTEGRATION POINT: Pay step — Cashfree payment link / subscription link (see 03b §5). Until live, show payInterim.',
};
