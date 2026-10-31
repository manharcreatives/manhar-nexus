import type { TrustContent } from './types';

export const TRUST: TrustContent = {
  header: {
    eyebrow: 'TRUST, IN PLAIN LANGUAGE',
    headline: {
      text: 'You shouldn’t have to trust us blindly. So we built things you can check.',
      accent: 'check',
    },
  },
  backingLabel: 'How we back it',
  blocks: [
    {
      id: 'self-proving-record',
      title: 'A record that proves itself',
      claim:
        'Sensitive actions are logged in order, and each entry is chained to the one before. If someone silently changes history, Verify shows the break.',
      backing: 'Activity History uses a hash chain; the Verify button re-checks it.',
      icon: 'Link2',
    },
    {
      id: 'finished-is-finished',
      title: 'Finished is finished',
      claim:
        'Paid Checkouts, payments and refunds are never edited or deleted. Corrections are new, visible entries with a reason. Voided numbers stay used.',
      backing: 'No edit or delete paths exist for financial records.',
      icon: 'Lock',
    },
    {
      id: 'own-job',
      title: 'Each person sees their own job',
      claim:
        'A waiter, a cook and a cashier see different screens — and the server enforces it, not just the screen.',
      backing: 'Role-based permissions; automated tests check that forbidden requests are refused.',
      icon: 'UsersRound',
    },
    {
      id: 'walled-off',
      title: 'Your restaurant is walled off',
      claim:
        'Your Business Workspace is separate from every other restaurant’s. Your staff can’t see anyone else’s data, and nobody else’s can see yours.',
      backing: 'Tenant isolation with an adversarial test sweep.',
      icon: 'Fence',
    },
    {
      id: 'no-double',
      title: 'No double charge, no double dish',
      claim:
        'A double-tap, a slow phone or a retry won’t create two Service Requests or two payments.',
      backing: 'Every money-related and order request carries a unique key the server remembers.',
      icon: 'CopyX',
    },
    {
      id: 'passwords',
      title: 'Passwords handled properly',
      claim:
        'Passwords are stored as one-way hashes, repeated wrong attempts lock the account for a while, and temporary passwords must be changed at first sign-in.',
      backing: 'argon2id hashing, lockout, forced change.',
      icon: 'KeyRound',
    },
    {
      id: 'backups',
      title: 'Backups, written down',
      // Softened: “have been rehearsed” removed — the production restore drill is still pending.
      claim:
        'Backup and restore steps are documented. We’ll publish our backup schedule and hosting region before you pay.',
      backing: 'Written backup and restore runbooks.',
      icon: 'DatabaseBackup',
    },
    {
      id: 'built-for-india',
      title: 'Built for India',
      // Softened: “Indian time” dropped — daily report days currently split at UTC, not IST.
      claim:
        'Rupees, GST and Indian number formats by default, with money rules designed for how Indian restaurants work.',
      backing: 'Hosting region will be named here when production is final.',
      icon: 'IndianRupee',
    },
  ],
  notYet: {
    title: 'What we haven’t done yet',
    body: 'Nexus has not been through an external penetration test or a formal certification. It hasn’t been run by a large number of restaurants. We tell you this because you should know exactly what you’re trusting.',
  },
};
