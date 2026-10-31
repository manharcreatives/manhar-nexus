import * as lucide from 'lucide-react';
import { describe, expect, it } from 'vitest';
import * as C from './index';

/* ───────────────────────────── helpers ───────────────────────────── */

type Visit = (value: unknown, path: string) => void;

/** Depth-first walk over plain data (objects, arrays). Functions are skipped. */
function walk(value: unknown, visit: Visit, path = '$', skipKeys: readonly string[] = []): void {
  visit(value, path);
  if (Array.isArray(value)) {
    value.forEach((v, i) => walk(v, visit, `${path}[${i}]`, skipKeys));
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (skipKeys.includes(k)) continue;
      walk(v, visit, `${path}.${k}`, skipKeys);
    }
  }
}

function strings(value: unknown, skipKeys: readonly string[] = []): string[] {
  const out: string[] = [];
  walk(value, (v) => {
    if (typeof v === 'string') out.push(v);
  }, '$', skipKeys);
  return out;
}

/** Only data exports: drop functions and the helper namespaces. */
function dataExports(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(C)) {
    if (typeof v !== 'function') out[k] = v;
  }
  return out;
}

const unique = (xs: readonly string[]): boolean => new Set(xs).size === xs.length;
const wordCount = (s: string): number => s.trim().split(/\s+/).filter(Boolean).length;

/* ───────────────────────────── counts and uniqueness ───────────────────────────── */

describe('content counts', () => {
  it('has the planned number of items', () => {
    expect(C.POSTS).toHaveLength(6);
    expect(C.FAQS).toHaveLength(16);
    expect(C.LEGAL_DOCUMENTS).toHaveLength(6);
    expect(C.IMAGES).toHaveLength(18);
    expect(C.PLATFORM_MODULES).toHaveLength(12);
    expect(C.COMING_SOON_MODULES).toHaveLength(8);
    expect(C.COMPARE_MOMENTS).toHaveLength(8);
    expect(C.HOW.steps).toHaveLength(5);
    expect(C.TRUST.blocks).toHaveLength(8);
    expect(C.BUILT_FOR.items).toHaveLength(6);
    expect(C.PLANS).toHaveLength(4);
    expect(C.NAV_ITEMS).toHaveLength(7);
    expect(C.PRELOADER.lines).toHaveLength(4);
    expect(C.HERO.proofPoints).toHaveLength(3);
  });

  it('keeps ids, slugs and names unique', () => {
    expect(unique(C.POSTS.map((p) => p.slug))).toBe(true);
    expect(unique(C.FAQS.map((f) => f.id))).toBe(true);
    expect(unique(C.LEGAL_DOCUMENTS.map((d) => d.slug))).toBe(true);
    expect(unique(C.LEGAL_DOCUMENTS.map((d) => d.path))).toBe(true);
    expect(unique(C.ALL_PLATFORM_MODULES.map((m) => m.id))).toBe(true);
    expect(unique(C.IMAGES.map((i) => i.name))).toBe(true);
    expect(unique(C.COMPARE_MOMENTS.map((m) => m.id))).toBe(true);
    expect(unique(C.SCORECARD_ROWS.map((r) => r.id))).toBe(true);
    expect(unique(C.PLANS.map((p) => p.key))).toBe(true);
    expect(unique(C.NAV_ITEMS.map((n) => n.id))).toBe(true);
    expect(unique(C.ROUTE_SEO.map((r) => r.path))).toBe(true);
  });
});

/* ───────────────────────────── posts, faq, legal ───────────────────────────── */

describe('posts', () => {
  it('every post has a body, metadata and a matching path', () => {
    for (const post of C.POSTS) {
      expect(post.body.length).toBeGreaterThan(5);
      expect(post.path).toBe(`/insights/${post.slug}`);
      expect(post.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(post.category).toBe(post.category.toUpperCase());
      expect(post.author).toBe('Manhar Nexus team');
      expect(post.readMinutes).toBeGreaterThanOrEqual(5);
      const words = post.body.reduce((n, b) => {
        if (b.type === 'ul' || b.type === 'ol') {
          return n + b.items.reduce((m, it) => m + wordCount(typeof it === 'string' ? it : `${it.lead} ${it.text}`), 0);
        }
        return n + wordCount(b.text);
      }, 0);
      expect(words).toBeGreaterThan(380);
    }
  });
});

describe('faq', () => {
  it('every FAQ has a question and an answer', () => {
    for (const f of C.FAQS) {
      expect(f.question.endsWith('?')).toBe(true);
      expect(f.answer.length).toBeGreaterThan(60);
    }
  });

  it('billing mini-FAQ ids resolve', () => {
    expect(C.faqsByIds(C.PRICING.billingFaqIds)).toHaveLength(C.PRICING.billingFaqIds.length);
  });

  it('FAQPage JSON-LD is built from the same strings', () => {
    const ld = C.faqPageJsonLd() as { mainEntity: { name: string; acceptedAnswer: { text: string } }[] };
    expect(ld.mainEntity).toHaveLength(C.FAQS.length);
    C.FAQS.forEach((f, i) => {
      expect(ld.mainEntity[i]?.name).toBe(f.question);
      expect(ld.mainEntity[i]?.acceptedAnswer.text).toBe(f.answer);
    });
  });
});

describe('legal', () => {
  const publicText = C.LEGAL_DOCUMENTS.flatMap((d) => strings(d, ['internalNote']));

  it('has six documents with sections and an internal note', () => {
    for (const d of C.LEGAL_DOCUMENTS) {
      expect(d.sections.length).toBeGreaterThan(0);
      expect(d.internalNote.length).toBeGreaterThan(40);
      expect(d.lastUpdatedISO).toBe('2026-10-31');
      expect(d.path.startsWith('/')).toBe(true);
    }
    expect(C.LEGAL_PATHS).toEqual([
      '/terms',
      '/privacy',
      '/refund-policy',
      '/billing-policy',
      '/acceptable-use',
      '/data-processing',
    ]);
  });

  it('OWNER_FILL_INS is non-empty and every token appears in the legal copy', () => {
    expect(C.OWNER_FILL_INS.length).toBeGreaterThan(10);
    expect(unique(C.OWNER_FILL_INS.map((f) => f.key))).toBe(true);
    for (const token of C.OWNER_FILL_IN_TOKENS) {
      expect(publicText.some((t) => t.includes(token)), `token not found in legal copy: ${token}`).toBe(true);
    }
  });

  it('every visible [placeholder] in the legal copy is listed in OWNER_FILL_INS', () => {
    const known = new Set(C.OWNER_FILL_IN_TOKENS);
    const missing = new Set<string>();
    for (const t of publicText) {
      for (const m of t.match(/\[[^[\]]+\]/g) ?? []) {
        if (!known.has(m)) missing.add(m);
      }
    }
    expect([...missing]).toEqual([]);
  });

  it('keeps no placeholder text in the internal notes of other content', () => {
    expect(strings(C.FAQS.map((f) => f.answer)).some((s) => /\[[^\]]+\]/.test(s))).toBe(false);
  });
});

/* ───────────────────────────── pricing ───────────────────────────── */

describe('plans match 03b', () => {
  const by = (k: C.PlanKey): C.Plan => C.getPlan(k);

  it('has the published prices', () => {
    expect([by('counter').monthly, by('counter').yearly]).toEqual([599, 5990]);
    expect([by('floor').monthly, by('floor').yearly]).toEqual([1299, 12990]);
    expect([by('pass').monthly, by('pass').yearly]).toEqual([2499, 24990]);
    expect([by('many-doors').monthly, by('many-doors').yearly]).toEqual([null, null]);
    expect([by('counter').foundingYearly, by('floor').foundingYearly, by('pass').foundingYearly]).toEqual([
      4490, 9740, 18740,
    ]);
    expect([by('counter').yearlyPerMonth, by('floor').yearlyPerMonth, by('pass').yearlyPerMonth]).toEqual([
      499, 1082, 2083,
    ]);
  });

  it('yearly saving equals two months free', () => {
    for (const p of C.PRICED_PLANS) {
      expect(p.yearlySaving).toBe((p.monthly ?? 0) * 12 - (p.yearly ?? 0));
      expect(p.yearly).toBe((p.monthly ?? 0) * 10);
    }
  });

  it('GST helpers', () => {
    expect(C.gstInclusive(599)).toBe(707);
    expect(C.gstInclusive(1299)).toBe(1533);
    expect(C.gstInclusive(2499)).toBe(2949);
    expect(C.gstInclusiveExact(599)).toBe(706.82);
    expect(C.gstInclusiveExact(12990)).toBe(15328.2);
    expect(C.gstHint(1299)).toBe('₹1,532.82 incl. 18% GST');
  });

  it('formatINR groups the Indian way', () => {
    expect(C.formatINR(599)).toBe('₹599');
    expect(C.formatINR(5990)).toBe('₹5,990');
    expect(C.formatINR(24990)).toBe('₹24,990');
    expect(C.formatINR(100000)).toBe('₹1,00,000');
    expect(C.formatINR(706.82)).toBe('₹706.82');
    expect(C.rupeesInWords(12990)).toBe('twelve thousand nine hundred ninety');
    expect(C.priceAriaLabel(12990, 'yearly')).toBe('twelve thousand nine hundred ninety rupees per year plus GST');
  });

  it('founding offer window', () => {
    expect(C.isFoundingOfferOpen(new Date('2026-10-31T12:00:00+05:30'))).toBe(false);
    expect(C.isFoundingOfferOpen(new Date('2026-11-01T00:00:00+05:30'))).toBe(true);
    expect(C.isFoundingOfferOpen(new Date('2027-01-31T23:00:00+05:30'))).toBe(true);
    expect(C.isFoundingOfferOpen(new Date('2027-02-01T00:30:00+05:30'))).toBe(false);
  });

  it('onboarding: launch pack is cheaper than à la carte', () => {
    const alaCarte = ['menu-upload', 'floor-layout', 'remote-training', 'go-live']
      .map((id) => C.ONBOARDING.find((o) => o.id === id)?.amount ?? 0)
      .reduce((a, b) => a + b, 0);
    expect(alaCarte).toBe(4500);
    expect(C.LAUNCH_PACK_PRICE).toBe(3499);
  });

  it('plan CTAs deep-link to the register section', () => {
    for (const p of C.PLANS) expect(p.cta.href.startsWith('/#register?plan=')).toBe(true);
    expect(C.planCtaHref('floor', 'yearly')).toBe('/#register?plan=floor&cycle=yearly');
  });
});

/* ───────────────────────────── registration ───────────────────────────── */

describe('register', () => {
  const good: C.RegistrationFormValues = {
    ...C.DEFAULT_FORM_VALUES,
    restaurantName: 'Shree Ram Dining',
    contactName: 'Rajesh Patel',
    phone: '98765 43210',
    email: 'rajesh@example.in',
    city: 'Visnagar',
    consent: true,
  };

  it('consent version is fixed', () => {
    expect(C.consentVersion).toBe('2026-10-31');
  });

  it('validates', () => {
    expect(C.validateRegistration(good)).toEqual({});
    const bad = C.validateRegistration({ ...C.DEFAULT_FORM_VALUES, email: 'nope', phone: '123', outlets: '0' });
    expect(bad.restaurantName).toBe('Please fill in restaurant name.');
    expect(bad.email).toBeDefined();
    expect(bad.phone).toBe('Enter a 10-digit Indian mobile number.');
    expect(bad.outlets).toBe('Enter a number from 1 to 500.');
    expect(bad.consent).toBe('Please accept the terms to continue.');
  });

  it('normalises Indian mobile numbers', () => {
    expect(C.normalizeIndianMobile('98765 43210')).toBe('9876543210');
    expect(C.normalizeIndianMobile('+91 98765-43210')).toBe('9876543210');
    expect(C.normalizeIndianMobile('09876543210')).toBe('9876543210');
    expect(C.normalizeIndianMobile('12345')).toBeNull();
  });

  it('builds the API payload within the contract', () => {
    const payload = C.toRegistrationPayload({ ...good, message: 'x'.repeat(1000), code: 'FOUNDING26', updates: true }, 123);
    expect(payload.phone).toBe('+919876543210');
    expect(payload.outlets).toBe(1);
    expect(payload.consent).toBe(true);
    expect(payload.consentVersion).toBe('2026-10-31');
    expect(payload.startedAt).toBe(123);
    expect(payload.website).toBe('');
    expect((payload.message ?? '').length).toBeLessThanOrEqual(1000);
    expect(payload.message).toContain('[Code: FOUNDING26]');
  });

  it('builds WhatsApp and mailto fallbacks', () => {
    const wa = C.buildWhatsAppUrl(good, 'NX-ABC123');
    expect(wa.startsWith('https://wa.me/919714571522?text=')).toBe(true);
    expect(decodeURIComponent(wa)).toContain('Shree Ram Dining');
    expect(decodeURIComponent(wa)).toContain('NX-ABC123');
    const mail = C.buildMailtoUrl(good);
    expect(mail.startsWith('mailto:info@manharcreatives.com?subject=')).toBe(true);
  });

  it('parses register hash intents', () => {
    expect(C.parseRegisterHash('#register?plan=floor&cycle=monthly&begin=demo')).toEqual({
      plan: 'floor',
      cycle: 'monthly',
      begin: 'demo',
    });
    expect(C.parseRegisterHash('#register?plan=bogus')).toEqual({});
  });

  it('success copy carries the reference', () => {
    const s = C.registrationSuccess('Rajesh', 'NX-ABC123');
    expect(s.lead + s.reference + s.tail).toContain('Thank you, Rajesh. Your reference is NX-ABC123.');
  });
});

/* ───────────────────────────── compare ───────────────────────────── */

describe('compare', () => {
  it('moments are in order inside 18:00–00:00', () => {
    const mins = C.COMPARE_MOMENTS.map((m) => m.minutes);
    expect([...mins].sort((a, b) => a - b)).toEqual(mins);
    expect(Math.min(...mins)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...mins)).toBeLessThanOrEqual(360);
    expect(C.COMPARE.range.totalMinutes).toBe(360);
  });

  it('scorecard is qualitative: no numbers or percentages', () => {
    for (const r of C.SCORECARD_ROWS) {
      expect(['ahead', 'equal', 'not-yet']).toContain(r.status);
      expect(`${r.paper} ${r.typicalPos} ${r.nexus}`).not.toMatch(/%|\d+x/);
    }
    expect(C.COMPARE.basisNote).toMatch(/qualitative/i);
  });
});

/* ───────────────────────────── SEO ───────────────────────────── */

describe('seo', () => {
  it('home title and description fit', () => {
    expect(C.HOME_SEO.title.length).toBeLessThanOrEqual(60);
    expect(C.HOME_SEO.description.length).toBeLessThanOrEqual(160);
  });

  it('every route has a title and description', () => {
    expect(C.ROUTE_SEO).toHaveLength(1 + 6 + 6);
    for (const r of C.ROUTE_SEO) {
      expect(r.title.length).toBeGreaterThan(10);
      expect(r.description.length).toBeGreaterThan(20);
    }
    expect(C.seoForPath('/terms/')?.title).toBe('Terms & Conditions – Manhar Nexus');
  });

  it('SoftwareApplication has six INR offers, ex-GST', () => {
    const ld = C.softwareApplicationJsonLd('https://example.in') as {
      offers: { priceCurrency: string; priceSpecification: { valueAddedTaxIncluded: boolean } }[];
    };
    expect(ld.offers).toHaveLength(6);
    for (const o of ld.offers) {
      expect(o.priceCurrency).toBe('INR');
      expect(o.priceSpecification.valueAddedTaxIncluded).toBe(false);
    }
  });

  it('BlogPosting and script serialisation', () => {
    const post = C.POSTS[0];
    expect(post).toBeDefined();
    if (!post) return;
    const ld = C.blogPostingJsonLd(post, 'https://example.in') as { url: string };
    expect(ld.url).toBe('https://example.in/insights/hidden-cost-of-order-mistakes');
    expect(C.jsonLdScript({ a: '</script>' })).not.toContain('</script>');
  });
});

/* ───────────────────────────── images ───────────────────────────── */

describe('images', () => {
  it('manifest is complete and well-formed', () => {
    expect(C.IMAGES.filter((i) => i.priority)).toHaveLength(1);
    for (const i of C.IMAGES) {
      expect(i.file).toBe(`/landing/${i.name}.webp`);
      expect(i.file800).toBe(`/landing/${i.name}-800.webp`);
      expect(i.alt.length).toBeGreaterThan(30);
      expect(i.alt.toLowerCase().startsWith('image of')).toBe(false);
      expect(i.width).toBeGreaterThan(0);
      expect(i.height).toBeGreaterThan(0);
    }
    expect(C.img('hero-pass-evening').priority).toBe(true);
    expect(C.imgSrcSet('hero-pass-evening')).toContain('800w');
  });

  it('every referenced image name exists', () => {
    const names = new Set<string>(C.IMAGES.map((i) => i.name));
    for (const m of C.ALL_PLATFORM_MODULES) if (m.image) expect(names.has(m.image)).toBe(true);
    for (const b of C.BUILT_FOR.items) expect(names.has(b.image)).toBe(true);
    for (const n of C.BUILT_FOR.ringImages) expect(names.has(n)).toBe(true);
    for (const p of C.POSTS) expect(names.has(p.cover)).toBe(true);
  });
});

/* ───────────────────────────── brand and honesty rules ───────────────────────────── */

describe('brand and honesty rules', () => {
  const all = strings(dataExports());

  it('never mentions the old greens, blockchain or guaranteed uptime', () => {
    const banned = [/#22c55e/i, /#16a34a/i, /#4ade80/i, /blockchain/i, /guaranteed uptime/i, /tamper-proof/i, /bank-grade/i];
    for (const s of all) for (const re of banned) expect(re.test(s), `${re} in: ${s.slice(0, 80)}`).toBe(false);
  });

  it('uses curly apostrophes and quotes', () => {
    for (const s of all) {
      if (/^(https?:|mailto:|\/|#|tel:)/.test(s)) continue;
      expect(/\w'\w/.test(s), `straight apostrophe in: ${s.slice(0, 80)}`).toBe(false);
      expect(s.includes('"'), `straight double quote in: ${s.slice(0, 80)}`).toBe(false);
    }
  });

  it('headlines carry exactly one accent word that occurs once', () => {
    const headlines: { text: string; accent: string; path: string }[] = [];
    walk(dataExports(), (v, path) => {
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        const o = v as Record<string, unknown>;
        if (typeof o.text === 'string' && typeof o.accent === 'string' && Object.keys(o).length === 2) {
          headlines.push({ text: o.text, accent: o.accent, path });
        }
      }
    });
    expect(headlines.length).toBeGreaterThanOrEqual(15);
    for (const h of headlines) {
      expect(/^\S+$/.test(h.accent), `accent must be one word: ${h.accent}`).toBe(true);
      const hits = h.text.split(/[^\p{L}\p{N}’]+/u).filter((w) => w === h.accent);
      expect(hits.length, `${h.path}: "${h.accent}" in "${h.text}"`).toBe(1);
    }
  });

  it('eyebrows are mono labels of at most six words', () => {
    const eyebrows: string[] = [];
    walk(dataExports(), (v) => {
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        const e = (v as Record<string, unknown>).eyebrow;
        if (typeof e === 'string') eyebrows.push(e);
      }
    });
    expect(eyebrows.length).toBeGreaterThan(12);
    for (const e of eyebrows) {
      expect(e, e).toBe(e.toUpperCase());
      expect(e.replace(/[·]/g, ' ').trim().split(/\s+/).length, e).toBeLessThanOrEqual(6);
    }
  });

  it('coming-soon items are never marked live', () => {
    for (const m of C.COMING_SOON_MODULES) expect(m.status).toBe('coming-soon');
    for (const m of C.PLATFORM_MODULES) expect(m.status).toBe('live');
    const mustBeSoon = ['Card payments at Checkout', 'QR ordering / aggregator links', 'Receipt printing', 'Stock & recipes'];
    for (const r of C.SCORECARD_ROWS.filter((x) => mustBeSoon.includes(x.criterion))) {
      expect(r.status).toBe('not-yet');
    }
  });
});

/* ───────────────────────────── icons ───────────────────────────── */

describe('lucide-react icon names', () => {
  it('every icon key resolves to a real lucide-react export', () => {
    const icons = new Set<string>();
    for (const m of C.ALL_PLATFORM_MODULES) icons.add(m.icon);
    for (const p of C.HERO.proofPoints) icons.add(p.icon);
    for (const s of C.HOW.steps) icons.add(s.icon);
    for (const b of C.BUILT_FOR.items) icons.add(b.icon);
    for (const t of C.TRUST.blocks) icons.add(t.icon);
    for (const f of C.PRICING.flow) icons.add(f.icon);
    for (const i of C.IMAGES) icons.add(i.fallbackIcon);
    const lib = lucide as unknown as Record<string, unknown>;
    const missing = [...icons].filter((name) => lib[name] === undefined);
    expect(missing).toEqual([]);
  });
});
