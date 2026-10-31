import { ACCEPTABLE_USE, BILLING, DPA, REFUND } from './legal-policies';
import { PRIVACY } from './legal-privacy';
import { TERMS } from './legal-terms';
import type { LegalDocument } from './types';

export { ACCEPTABLE_USE, BILLING, DPA, PRIVACY, REFUND, TERMS };

/**
 * The six legal pages, in footer order.
 * DRAFTS pending lawyer review. `internalNote` carries the drafting assumptions and is
 * NOT rendered by default. Square-bracket placeholders stay visible on the page and are
 * listed in OWNER_FILL_INS (owner-fill-ins.ts).
 */
export const LEGAL_DOCUMENTS: readonly LegalDocument[] = [
  TERMS,
  PRIVACY,
  REFUND,
  BILLING,
  ACCEPTABLE_USE,
  DPA,
];

export function getLegalDocument(slug: string): LegalDocument | undefined {
  return LEGAL_DOCUMENTS.find((d) => d.slug === slug);
}

export function getLegalDocumentByPath(path: string): LegalDocument | undefined {
  const clean = path.replace(/\/+$/, '') || '/';
  return LEGAL_DOCUMENTS.find((d) => d.path === clean);
}

/** Route paths for the router and the sitemap. */
export const LEGAL_PATHS: readonly string[] = LEGAL_DOCUMENTS.map((d) => d.path);

/** Labels used by PolicyLayout navigation. */
export const LEGAL_NAV = LEGAL_DOCUMENTS.map((d) => ({ slug: d.slug, path: d.path, label: d.shortTitle }));

export const LEGAL_UI = {
  lastUpdatedLabel: 'Last updated',
  onThisPage: 'On this page',
  otherPolicies: 'Other policies',
  backHome: '← Back to Manhar Nexus',
} as const;
