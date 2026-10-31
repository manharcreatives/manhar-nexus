import type { IntroContent } from './types';

/** “Between the chair and the last report” — the curiosity intro, kept to three beats. */
export const INTRO: IntroContent = {
  eyebrow: 'A GUEST SITS DOWN',
  headline: {
    text: 'Seven minutes after a guest sits down, your restaurant has made six decisions nobody wrote down.',
    accent: 'decisions',
  },
  paragraphs: [
    'Half portion or full? “Less spicy” — said once, in a noisy room. The slip goes to the kitchen, or only the words do.',
    'The bill is right, probably. The cash is counted, roughly. A discount is given kindly, and never written down.',
    'At midnight the drawer is short by ₹300. No one lied. A hundred small hand-offs did it.',
  ],
  closingQuestion: {
    text: 'So where does the truth of your restaurant live, and who is allowed to change it?',
    accent: 'truth',
  },
  followLink: { label: 'Follow one night, start to finish →', href: '/#why' },
};
