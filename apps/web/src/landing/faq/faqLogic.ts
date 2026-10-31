import { FAQS, faqPageJsonLd, type Faq, type JsonLdObject } from '../content';

export type FaqTopic = Faq['topic'];
export type TopicFilter = FaqTopic | 'all';

export const TOPIC_LABELS: Readonly<Record<TopicFilter, string>> = {
  all: 'All',
  start: 'Getting started',
  product: 'Product',
  billing: 'Billing',
  data: 'Data and security',
  company: 'Company',
};

export const TOPIC_ORDER: readonly TopicFilter[] = ['all', 'start', 'product', 'billing', 'data', 'company'];

/** Count of questions per topic (and 'all'). */
export function topicCounts(items: readonly Faq[] = FAQS): Readonly<Record<TopicFilter, number>> {
  const counts: Record<TopicFilter, number> = { all: items.length, start: 0, product: 0, billing: 0, data: 0, company: 0 };
  for (const f of items) counts[f.topic] += 1;
  return counts;
}

/** Every whitespace-separated word of the query must occur in the question or answer (case-insensitive). */
export function filterFaqs(items: readonly Faq[], query: string, topic: TopicFilter): readonly Faq[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return items.filter((f) => {
    if (topic !== 'all' && f.topic !== topic) return false;
    if (words.length === 0) return true;
    const hay = `${f.question} ${f.answer}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

/** '#faq-gst' -> 'gst' when it names a real question; otherwise null. */
export function faqIdFromHash(hash: string, items: readonly Faq[] = FAQS): string | null {
  const m = /^#faq-([a-z0-9-]+)$/i.exec(hash);
  const id = m?.[1];
  if (!id) return null;
  return items.some((f) => f.id === id) ? id : null;
}

/** An answer is publishable in structured data only if no owner placeholder leaked into it. */
export function isPublishableAnswer(faq: Faq): boolean {
  return !/\[[^\]]+\]/.test(faq.answer) && !/\bOwner:/i.test(faq.answer);
}

/**
 * FAQPage JSON-LD for the visible questions. Same shape and same strings as seo.ts `faqPageJsonLd()`,
 * minus any answer that still carries an owner placeholder.
 */
export function publishableFaqJsonLd(items: readonly Faq[] = FAQS): JsonLdObject {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.filter(isPublishableAnswer).map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  };
}

/** Exposed so tests can assert the two builders never drift. */
export const contentFaqJsonLd = faqPageJsonLd;
