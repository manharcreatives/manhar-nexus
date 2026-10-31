import type { TrustContent } from './types';

export const TRUST: TrustContent = {
  header: {
    eyebrow: 'TRUST, IN PLAIN LANGUAGE',
    headline: {
      text: 'Don’t trust us blindly. Check.',
      accent: 'Check',
    },
  },
  backingLabel: 'How we back it',
  blocks: [
    {
      id: 'self-proving-record',
      title: 'A record that proves itself',
      claim: 'Each logged action is chained to the one before. If history is silently changed, Verify shows the break.',
      backing: 'Activity History uses a hash chain; Verify re-checks it.',
      icon: 'Link2',
    },
    {
      id: 'finished-is-finished',
      title: 'Finished is finished',
      claim: 'Paid Checkouts and refunds are never edited or deleted. Corrections are new, visible entries with a reason.',
      backing: 'No edit or delete paths exist for financial records.',
      icon: 'Lock',
    },
    {
      id: 'own-job',
      title: 'Each person sees their own job',
      claim: 'A waiter, a cook and a cashier see different screens, and the server enforces it.',
      backing: 'Role-based permissions, with tests that forbidden requests are refused.',
      icon: 'UsersRound',
    },
    {
      id: 'walled-off',
      title: 'Your restaurant is walled off',
      claim: 'Your Business Workspace is separate from every other restaurant’s, in both directions.',
      backing: 'Tenant isolation with an adversarial test sweep.',
      icon: 'Fence',
    },
  ],
  notYet: {
    title: 'What we haven’t done yet',
    body: 'No external penetration test or formal certification yet, and not a large number of restaurants. You should know exactly what you’re trusting.',
  },
};
