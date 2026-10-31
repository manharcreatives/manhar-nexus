import { QR_MENU_LIVE, QR_MENU_NAME } from './flags';

/**
 * "Nexus Menu": the QR digital menu + self-ordering showcase. Copy is honest: what the guest can do is what the
 * feature does. UPI only (staff confirm receipt), no card payments, no invented numbers.
 * Gated by QR_MENU_LIVE (content/flags.ts): when false the section reads "Coming soon" and promises nothing.
 */
export interface MenuFeature {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly icon: string;
}

export interface NexusMenuContent {
  readonly name: string;
  readonly eyebrow: string;
  readonly headline: { readonly text: string; readonly accent: string };
  readonly lede: string;
  readonly statusTag: string;
  readonly features: readonly MenuFeature[];
  readonly chips: readonly string[];
  readonly note: string;
  readonly primaryCta: string;
  readonly secondaryCta: string;
}

export const NEXUS_MENU: NexusMenuContent = {
  name: QR_MENU_NAME,
  eyebrow: 'NEXUS MENU · QR DIGITAL MENU',
  headline: {
    text: 'A menu worth scanning, on every table.',
    accent: 'scanning',
  },
  lede: QR_MENU_LIVE
    ? 'Guests scan the table’s QR code and your live menu opens on their phone. No app, no login.'
    : 'A QR menu for every table, with photos of every dish. We are finishing it now.',
  statusTag: QR_MENU_LIVE ? 'LIVE' : 'COMING SOON',
  features: [
    {
      id: 'live',
      title: 'Live the moment you edit',
      body: 'Change a price or mark a dish Sold-Out and every table sees it at once.',
      icon: 'Radio',
    },
    {
      id: 'order',
      title: 'Guests can order like a waiter',
      body: 'Portions, Add-ons and notes. Your waiter confirms each order by default.',
      icon: 'ConciergeBell',
    },
    {
      id: 'status',
      title: 'Everyone sees the same table',
      body: 'Guests follow order status and the bill. Staff see guest orders marked Guest.',
      icon: 'Receipt',
    },
  ],
  chips: ['Photos of every dish', 'Call the waiter', 'Ask for the bill', 'Pay by UPI'],
  note: 'UPI only for now, and your staff confirm every payment. Card payments are coming soon.',
  primaryCta: 'Ask for a Nexus Menu demo',
  secondaryCta: 'See pricing',
};
