/** Static site facts shared by header, footer, SEO hooks and (optionally) section agents. */

export const SITE = {
  name: 'Manhar Nexus',
  studio: 'Manhar Creatives',
  studioUrl: 'https://www.manharcreatives.com',
  /** TO CONFIRM: the final production hostname is not decided yet (analysis R2/R10). */
  origin: 'https://nexus.manharcreatives.com',
  tagline: 'We Design, We Build, You Grow.',
  email: 'info@manharcreatives.com',
  phoneDisplay: '+91 97145 71522',
  phoneTel: '+919714571522',
  whatsappBase: 'https://wa.me/919714571522',
  addressLines: [
    'Sona Complex, A-252, Kansa Cross Road,',
    'Opp. Khodiyar Hotel, Visnagar,',
    'Mehsana, Gujarat 384315',
  ],
  serviceArea: 'Working across Gujarat and remotely across India.',
  linkedin: 'https://www.linkedin.com/company/manhar-creatives/',
  instagram: 'https://www.instagram.com/manhar.creatives',
  year: 2026,
} as const;

/** Header navigation: `id` is the section id on the home page. */
export const NAV_ITEMS = [
  { id: 'platform', label: 'Platform' },
  { id: 'why', label: 'Why Nexus' },
  { id: 'how', label: 'How it works' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'insights', label: 'Insights' },
  { id: 'faq', label: 'FAQ' },
] as const;

export function absoluteUrl(path: string): string {
  return `${SITE.origin}${path.startsWith('/') ? path : `/${path}`}`;
}

/** wa.me link; `text` must be a fixed greeting, never user data. */
export function whatsappUrl(text = 'Hi, I want to know about Manhar Nexus'): string {
  return `${SITE.whatsappBase}?text=${encodeURIComponent(text)}`;
}

/** Home page head defaults (index.html carries the same text for scrapers). */
export const HOME_META = {
  title: 'Manhar Nexus – Restaurant Software for Indian Restaurants',
  description:
    'Manhar Nexus joins floor, kitchen and Checkout in one workspace for Indian restaurants and cafés. Live KOS, GST by line, refunds with reasons. Prices in ₹.',
  ogTitle: 'Manhar Nexus — every table, every ticket, every rupee accounted for',
  ogDescription:
    'A calm restaurant operations platform from Manhar Creatives, Visnagar. Live kitchen screen, GST by line, refunds with reasons and a tamper-checkable Activity History.',
} as const;
