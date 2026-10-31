import type { HowContent } from './types';

export const HOW: HowContent = {
  header: {
    eyebrow: 'FROM HELLO TO FIRST SERVICE',
    headline: {
      text: 'Four steps. A human at every one.',
      accent: 'human',
    },
    subhead: 'We set up every restaurant ourselves. It’s slower, and it’s why the first week works.',
  },
  steps: [
    {
      number: '01',
      id: 'register',
      title: 'Register',
      body: 'Tell us your restaurant type, outlets and city. About two minutes.',
      time: '2 min',
      icon: 'ClipboardList',
    },
    {
      number: '02',
      id: 'pay',
      title: 'Pay',
      body: 'A secure payment link via Cashfree: UPI, card or net banking. GST invoice by email.',
      time: 'Same day',
      icon: 'CreditCard',
    },
    {
      number: '03',
      id: 'workspace',
      title: 'Workspace',
      body: 'We create your Business Workspace and owner login, then set up your menu, tables and team with you.',
      time: 'Target: one working day',
      icon: 'KeyRound',
    },
    {
      number: '04',
      id: 'first-service',
      title: 'First service',
      body: 'Open a table, send a Service Request, watch it reach the KOS, take the Checkout. We stay on call.',
      time: 'Your launch day',
      icon: 'Rocket',
    },
  ],
  underStrip: 'Not ready to pay? Ask for a 14-day pilot or a live demo.',
  guaranteeLine: 'Changed your mind within 14 days of activation? Full refund.',
  payInterim: 'We’ll send your payment link by WhatsApp or email within one working day.',
  integrationNote:
    'INTEGRATION POINT: Pay step — Cashfree payment link / subscription link (see 03b §5). Until live, show payInterim.',
};
