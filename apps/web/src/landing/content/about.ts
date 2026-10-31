import type { AboutContent } from './types';

export const ABOUT: AboutContent = {
  header: {
    eyebrow: 'BUILT IN VISNAGAR, GUJARAT',
    headline: {
      text: 'We build brands and software, and kept noticing one quiet leak in restaurants.',
      accent: 'leak',
    },
  },
  paragraphs: [
    {
      text: 'Manhar Creatives is a small design and software studio in Visnagar, Gujarat. We have spent our days making websites, brand systems and custom software for businesses across the state — including restaurants and cafés.',
      ownerConfirm: true,
    },
    {
      text: 'Around restaurants, one pattern keeps repeating. Good food, loyal guests, hard-working teams — and still, at night, a ledger that doesn’t quite close. Not because anyone is careless, but because the tools are either too thin (a slip pad and WhatsApp) or too loud (a hundred buttons, hidden prices, an add-on for everything).',
      ownerConfirm: true,
    },
    {
      text: 'So we built Nexus the way we build everything: start with the real hand-offs, from table to kitchen to Checkout to the day’s report. Then make each one boring, visible and hard to get wrong.',
    },
  ],
  honestNote: {
    title: 'An honest note',
    body: 'Nexus is new. It is built carefully and tested hard, but it has not yet run a hundred restaurants. We are opening to our first Founding Restaurants and will set each one up by hand.',
  },
  beliefsTitle: 'What we believe',
  beliefs: [
    'Your numbers belong to you. Take your reports with you.',
    'A tool should explain itself in words, not just colours.',
    'Price should be written down where you can see it.',
  ],
  signature: {
    name: 'Utsav Prajapati',
    role: 'Founder, Manhar Creatives',
    ownerApproved: false,
  },
  studioLine: 'We Design, We Build, You Grow.',
  studioLabel: 'A Manhar Creatives product',
  internalNote:
    'The two paragraphs flagged ownerConfirm describe the studio’s real experience around restaurants. The brief says: do not publish unless true. Confirm or rewrite from real experience. Also approve the founder signature (signature.ownerApproved).',
};
