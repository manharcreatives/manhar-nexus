import type { ContactDetails, FooterGroup, NavItem, TextLink } from './types';

export const SITE_NAME = 'Manhar Nexus';
export const STUDIO_NAME = 'Manhar Creatives';
export const STUDIO_TAGLINE = 'We Design, We Build, You Grow.';
export const PRODUCT_LINE_LABEL = 'A Manhar Creatives product';

const nav = (id: string, label: string, hash: string): NavItem => ({
  id,
  label,
  hash,
  href: `/#${hash}`,
});

/** Header navigation, in order. Hash ids match the section ids on the home page. */
export const NAV_ITEMS: readonly NavItem[] = [
  nav('why', 'Why Nexus', 'why'),
  nav('platform', 'Platform', 'platform'),
  nav('how', 'How it works', 'how'),
  nav('builtfor', 'Built for', 'builtfor'),
  nav('pricing', 'Pricing', 'pricing'),
  nav('insights', 'Insights', 'insights'),
  nav('faq', 'FAQ', 'faq'),
];

export const SIGN_IN_LINK: TextLink = { text: 'Sign in', href: '/login' };
export const HEADER_CTA: TextLink = { text: 'Register your restaurant', href: '/#register' };
export const SKIP_LINK = 'Skip to main content';
/** Owner: only keep if true. */
export const MOBILE_MENU_NOTE = 'Questions? WhatsApp us — we reply the same working day.';

export const CONTACT: ContactDetails = {
  email: 'info@manharcreatives.com',
  phoneDisplay: '+91 97145 71522',
  phoneTel: 'tel:+919714571522',
  whatsappNumber: '919714571522',
  whatsappUrl: 'https://wa.me/919714571522',
  addressLines: [
    'Sona Complex, A-252, Kansa Cross Road, Opp. Khodiyar Hotel',
    'Visnagar, Mehsana, Gujarat 384315',
  ],
  addressOneLine:
    'Sona Complex, A-252, Kansa Cross Road, Opp. Khodiyar Hotel, Visnagar, Mehsana, Gujarat 384315',
  reach: 'Working across Gujarat and remotely across India.',
  studioUrl: 'https://www.manharcreatives.com',
  social: [
    { text: 'LinkedIn', href: 'https://www.linkedin.com/company/manhar-creatives/' },
    { text: 'Instagram', href: 'https://www.instagram.com/manhar.creatives' },
  ],
};

export const FOOTER_BRAND = {
  line: 'A restaurant operations platform by Manhar Creatives.',
  tagline: STUDIO_TAGLINE,
} as const;

export const FOOTER_GROUPS: readonly FooterGroup[] = [
  {
    title: 'Product',
    links: [
      { label: 'Why Nexus', href: '/#why' },
      { label: 'Platform', href: '/#platform' },
      { label: 'How it works', href: '/#how' },
      { label: 'Built for', href: '/#builtfor' },
      { label: 'Pricing', href: '/#pricing' },
      { label: 'Insights', href: '/#insights' },
      { label: 'FAQ', href: '/#faq' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '/#about' },
      { label: 'Manhar Creatives', href: CONTACT.studioUrl, external: true },
      { label: 'Contact', href: '/#register' },
      { label: 'Book a demo', href: '/#register?begin=demo' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Terms & Conditions', href: '/terms' },
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Refund & Cancellation', href: '/refund-policy' },
      { label: 'Billing & Payments', href: '/billing-policy' },
      { label: 'Acceptable Use', href: '/acceptable-use' },
      { label: 'Data Processing Summary', href: '/data-processing' },
    ],
  },
  {
    title: 'Account',
    links: [
      { label: 'Sign in', href: '/login' },
      { label: 'Register your restaurant', href: '/#register' },
    ],
  },
];

export const FOOTER_BOTTOM = {
  copyright: '© 2026 Manhar Creatives. Manhar Nexus is a product of Manhar Creatives.',
  links: [
    { label: 'Privacy', href: '/privacy' },
    { label: 'Terms', href: '/terms' },
    { label: 'Refund & Cancellation', href: '/refund-policy' },
    { label: 'Billing', href: '/billing-policy' },
    { label: 'Sitemap', href: '/sitemap.xml' },
  ],
} as const;

export const FOOTER_CHIP = 'Onboarding new restaurants now — Founding Restaurants offer until 31 Jan 2027.';
/** Do not show Cashfree’s logo unless their brand rules allow it. */
export const PAYMENTS_LINE = 'Subscriptions are processed securely by Cashfree Payments.';
