import { FAQS } from './faq';
import { OG_IMAGE, img } from './images';
import { LEGAL_DOCUMENTS } from './legal';
import { CONTACT, STUDIO_NAME, STUDIO_TAGLINE } from './nav';
import { PRICED_PLANS } from './plans';
import { POSTS } from './posts';
import type { JsonLdObject, JsonLdValue, OgContent, Post, RouteSeo } from './types';

/**
 * Canonical origin. PLACEHOLDER until the production domain is chosen (see OWNER_FILL_INS key 'domain').
 * Builders accept an `origin` argument — pass `window.location.origin` at runtime or the final domain at build time.
 */
export const SITE_ORIGIN = 'https://[DOMAIN]';

export const SITE_TITLE_SUFFIX = ' – Manhar Nexus';
export const HTML_LANG = 'en-IN';
export const THEME_COLOR = '#FFFFFF';

/* ───────────────────────────── per-route titles and descriptions ───────────────────────────── */

export const HOME_SEO: RouteSeo = {
  path: '/',
  title: 'Manhar Nexus – Restaurant Software for Indian Restaurants',
  description:
    'Manhar Nexus joins floor, kitchen and Checkout in one workspace for Indian restaurants and cafés. Live KOS, GST by line, refunds with reasons. Prices in ₹.',
  ogType: 'website',
};

export const HOME_OG: OgContent = {
  title: 'Manhar Nexus — every table, every ticket, every rupee accounted for',
  description:
    'A calm restaurant operations platform from Manhar Creatives, Visnagar. Live kitchen screen, GST by line, refunds with reasons and a tamper-checkable Activity History.',
  type: 'website',
  locale: 'en_IN',
  image: OG_IMAGE.file,
  imageWidth: OG_IMAGE.width,
  imageHeight: OG_IMAGE.height,
  imageAlt: OG_IMAGE.alt,
  twitterCard: 'summary_large_image',
};

export const PRIMARY_KEYWORDS: readonly string[] = [
  'restaurant software India',
  'restaurant management software Gujarat',
  'KOT/KOS kitchen display India',
  'restaurant billing GST',
  'café software',
  'restaurant software pricing in INR',
];

export const SECONDARY_KEYWORDS: readonly string[] = [
  'restaurant Checkout software',
  'Service Request kitchen screen',
  'restaurant refund and void audit trail',
  'cloud restaurant software India',
  'restaurant software for cafés and bakeries',
];

const legalSeo: readonly RouteSeo[] = LEGAL_DOCUMENTS.map((d) => ({
  path: d.path,
  title: `${d.title}${SITE_TITLE_SUFFIX}`,
  description: d.summary,
  ogType: 'website' as const,
}));

const postSeo: readonly RouteSeo[] = POSTS.map((p) => ({
  path: p.path,
  title: p.seoTitle,
  description: p.seoDescription,
  ogType: 'article' as const,
}));

/** Every indexable public route with its title and meta description. */
export const ROUTE_SEO: readonly RouteSeo[] = [HOME_SEO, ...legalSeo, ...postSeo];

/** Paths for sitemap.xml (home, legal pages, articles). */
export const SITEMAP_PATHS: readonly string[] = ROUTE_SEO.map((r) => r.path);

/** SEO for a router path; trailing slashes are ignored. */
export function seoForPath(path: string): RouteSeo | undefined {
  const clean = path.split(/[?#]/)[0]?.replace(/\/+$/, '') || '/';
  return ROUTE_SEO.find((r) => r.path === clean);
}

/** Absolute URL for a path under the given origin. */
export function absoluteUrl(path: string, origin: string = SITE_ORIGIN): string {
  return `${origin.replace(/\/+$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}

/* ───────────────────────────── JSON-LD ───────────────────────────── */

/** Serialise for a <script type="application/ld+json"> tag. Escapes '<' so content cannot close the tag. */
export function jsonLdScript(data: JsonLdObject): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

/** Organization. The logo property is omitted until a logo file is supplied. */
export function organizationJsonLd(): JsonLdObject {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: STUDIO_NAME,
    alternateName: 'Manhar Nexus',
    url: CONTACT.studioUrl,
    slogan: STUDIO_TAGLINE,
    email: CONTACT.email,
    telephone: '+91-97145-71522',
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Sona Complex, A-252, Kansa Cross Road, Opp. Khodiyar Hotel',
      addressLocality: 'Visnagar',
      addressRegion: 'Gujarat',
      postalCode: '384315',
      addressCountry: 'IN',
    },
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'sales',
        telephone: '+91-97145-71522',
        email: CONTACT.email,
        areaServed: 'IN',
        // Owner: extend with Hindi / Gujarati only once the support team can really offer them (OWNER_FILL_INS 'support-languages').
        availableLanguage: ['English'],
      },
    ],
    sameAs: CONTACT.social.map((s) => s.href),
  };
}

const OFFER_BLURB: Readonly<Record<string, string>> = {
  counter: '1 outlet, up to 5 staff logins.',
  floor: '1 outlet, up to 15 staff logins, Operating Costs, Alerts rules.',
  pass: 'Up to 3 outlets, up to 40 staff logins, priority support.',
};

/** SoftwareApplication with six INR offers (3 plans × monthly/yearly). Prices exclude GST. */
export function softwareApplicationJsonLd(origin: string = SITE_ORIGIN): JsonLdObject {
  const offers: JsonLdValue[] = PRICED_PLANS.flatMap((plan) => {
    const blurb = OFFER_BLURB[plan.key] ?? '';
    const make = (cycle: 'monthly' | 'yearly'): JsonLdObject => {
      const price = (cycle === 'monthly' ? plan.monthly : plan.yearly) ?? 0;
      return {
        '@type': 'Offer',
        name: `${plan.name} - ${cycle}`,
        description: `${blurb}${cycle === 'yearly' ? ' 2 months free.' : ''} Price excludes 18% GST.`,
        price: String(price),
        priceCurrency: 'INR',
        availability: 'https://schema.org/InStock',
        url: absoluteUrl('/#pricing', origin),
        priceSpecification: {
          '@type': 'UnitPriceSpecification',
          price,
          priceCurrency: 'INR',
          billingDuration: cycle === 'monthly' ? 'P1M' : 'P1Y',
          unitCode: cycle === 'monthly' ? 'MON' : 'ANN',
          valueAddedTaxIncluded: false,
        },
      };
    };
    return [make('monthly'), make('yearly')];
  });

  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Manhar Nexus',
    applicationCategory: 'BusinessApplication',
    applicationSubCategory: 'Restaurant management software',
    operatingSystem: 'Web browser (Chrome, Edge, Safari, Firefox)',
    description:
      'Restaurant operations platform for Indian restaurants and cafés: dining tables, Service Requests, a live Kitchen Operations Screen, Checkout with GST, refunds and Voids with reasons, reports, operating costs and a verifiable Activity History.',
    url: absoluteUrl('/', origin),
    inLanguage: HTML_LANG,
    publisher: { '@type': 'Organization', name: STUDIO_NAME, url: CONTACT.studioUrl },
    offers,
  };
}

/** FAQPage built from faq.ts, so the visible answers and the structured data are the same strings. */
export function faqPageJsonLd(): JsonLdObject {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  };
}

/** BlogPosting for one Insights article. */
export function blogPostingJsonLd(post: Post, origin: string = SITE_ORIGIN): JsonLdObject {
  const url = absoluteUrl(post.path, origin);
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.seoDescription,
    datePublished: post.publishedAt,
    dateModified: post.publishedAt,
    inLanguage: HTML_LANG,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    url,
    image: absoluteUrl(img(post.cover).file, origin),
    articleSection: post.category.charAt(0) + post.category.slice(1).toLowerCase(),
    author: { '@type': 'Organization', name: post.author },
    publisher: { '@type': 'Organization', name: STUDIO_NAME, url: CONTACT.studioUrl },
  };
}

/** The three JSON-LD blocks that belong in the home page <head>. */
export function homeJsonLd(origin: string = SITE_ORIGIN): readonly JsonLdObject[] {
  return [organizationJsonLd(), softwareApplicationJsonLd(origin), faqPageJsonLd()];
}
