import type { IntroContent } from './types';

/** “Between the chair and the last report” — the curiosity intro. */
export const INTRO: IntroContent = {
  eyebrow: 'A GUEST SITS DOWN',
  headline: {
    text: 'Seven minutes after a guest sits down, your restaurant has already made six decisions you won’t remember.',
    accent: 'decisions',
  },
  paragraphs: [
    'A guest sits at Table 6. Someone notes it. Someone else asks for the water. Half-portion or full? “Less spicy” — said once, to one person, in a noisy room.',
    'The slip goes to the kitchen. Or the words do. The cook reads it the way cooks read things at 8:40 on a Saturday. A dish runs out, and only two people know.',
    'Then the guest asks for the bill. The total is right — probably. Cash is counted — roughly. Someone gives a discount, because the guest looked unhappy, and that is a kind thing to do, and nobody writes it down.',
    'At midnight you add it up. The drawer is short by ₹300. The register says one thing; the notebook says another; the WhatsApp group says a third.',
    'Nothing here is dramatic. No one stole. No one lied. A restaurant simply passed through a hundred small hand-offs, and every hand-off was a place where the truth could slip.',
  ],
  closingQuestion: {
    text: 'So where does the truth of your restaurant actually live — and who is allowed to change it?',
    accent: 'truth',
  },
  followLink: { label: 'Follow one night, start to finish →', href: '/#why' },
};
