/**
 * Manhar Nexus landing page — content types.
 *
 * Every interface here is readonly and exported. Content modules in this folder
 * are pure data (no JSX, no runtime dependencies). Section components import
 * from `./content` (the barrel, index.ts), never from the report markdown.
 */

/** A lucide-react icon NAME, e.g. 'ChefHat'. Resolve it in the Icon helper. */
export type IconName = string;

/**
 * A headline with exactly ONE highlighted (green accent) word.
 * `accent` is a single word that appears once in `text`; split `text` around it
 * and render the accent in Forest (#12802B) on light or #1DBA3C on Ink.
 */
export interface Headline {
  readonly text: string;
  readonly accent: string;
}

export interface Cta {
  readonly label: string;
  readonly href: string;
}

export interface TextLink {
  readonly text: string;
  readonly href: string;
}

/** Eyebrow (mono, uppercase, at most 6 words) + h2 headline + optional subhead. */
export interface SectionHeader {
  readonly eyebrow: string;
  readonly headline: Headline;
  readonly subhead?: string;
}

/* ───────────────────────────── Final CTA banner ───────────────────────────── */

export interface CtaBannerContent {
  readonly eyebrow: string;
  readonly headline: Headline;
  readonly body: string;
  readonly primaryCta: Cta;
  readonly secondaryCta: Cta;
  readonly finePrint: string;
}

/* ───────────────────────────── Preloader ───────────────────────────── */

export interface PreloaderContent {
  readonly lines: readonly string[];
  /** Time each line stays on the ticket. */
  readonly stepMs: number;
  /** Hard ceiling for the whole preloader. */
  readonly maxMs: number;
  readonly ariaLabel: string;
}

/* ───────────────────────────── Navigation ───────────────────────────── */

export interface NavItem {
  readonly id: string;
  readonly label: string;
  /** Section id on the home page, without '#'. */
  readonly hash: string;
  /** Works from any route: '/#why'. */
  readonly href: string;
}

export interface FooterLink {
  readonly label: string;
  readonly href: string;
  /** True for off-site links (open with rel="noopener"). */
  readonly external?: boolean;
}

export interface FooterGroup {
  readonly title: string;
  readonly links: readonly FooterLink[];
}

export interface ContactDetails {
  readonly email: string;
  readonly whatsappNumber: string;
  readonly whatsappUrl: string;
  readonly addressLines: readonly string[];
  readonly addressOneLine: string;
  readonly reach: string;
  readonly studioUrl: string;
  readonly social: readonly TextLink[];
}

/* ───────────────────────────── Hero ───────────────────────────── */

export interface HeroProofPoint {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly icon: IconName;
}

export interface HeroContent {
  readonly eyebrow: string;
  readonly headline: Headline;
  /** Optional alternate H1 for A/B tests. Not used by default. */
  readonly altHeadline: Headline;
  readonly subhead: string;
  readonly primaryCta: Cta;
  readonly secondaryCta: Cta;
  readonly microcopy: string;
  /** Small pill above the headline (a new capability). Omitted when nothing is new. */
  readonly announcement?: { readonly tag: string; readonly text: string; readonly href: string };
  readonly proofPoints: readonly HeroProofPoint[];
  readonly scrollCue: string;
  readonly imageAlt: string;
}

/* ───────────────────────────── Intro ───────────────────────────── */

export interface IntroContent {
  readonly eyebrow: string;
  readonly headline: Headline;
  readonly paragraphs: readonly string[];
  readonly closingQuestion: Headline;
  readonly followLink: Cta;
}

/* ───────────────────────────── About ───────────────────────────── */

export interface AboutParagraph {
  readonly text: string;
  /** True when the owner must confirm the sentence is true before publishing. */
  readonly ownerConfirm?: boolean;
}

export interface AboutContent {
  readonly header: SectionHeader;
  readonly paragraphs: readonly AboutParagraph[];
  readonly honestNote: { readonly title: string; readonly body: string };
  readonly beliefsTitle: string;
  readonly beliefs: readonly string[];
  readonly signature: { readonly name: string; readonly role: string; readonly ownerApproved: boolean };
  readonly studioLine: string;
  readonly studioLabel: string;
  /** Not rendered by default. */
  readonly internalNote: string;
}

/* ───────────────────────────── Compare ───────────────────────────── */

export interface CompareMoment {
  readonly id: string;
  /** 24h clock stamp, e.g. '18:30'. */
  readonly clock: string;
  /** Human label, e.g. '6:30 pm'. */
  readonly label: string;
  /** Minutes after 18:00 (0–360). Position on the 18:00 → 00:00 slider. */
  readonly minutes: number;
  readonly title: string;
  readonly without: string;
  readonly with: string;
}

export interface CompareRange {
  readonly startClock: string;
  readonly endClock: string;
  readonly startLabel: string;
  readonly endLabel: string;
  readonly totalMinutes: number;
  /** Clock stamps for ticks along the slider. */
  readonly ticks: readonly string[];
  readonly sliderLabel: string;
}

/** Where Nexus stands against the alternative. Qualitative, never a number. */
export type ScorecardStatus = 'ahead' | 'equal' | 'not-yet';

export interface ScorecardRow {
  readonly id: string;
  readonly criterion: string;
  readonly paper: string;
  readonly typicalPos: string;
  readonly nexus: string;
  readonly status: ScorecardStatus;
}

export interface CompareContent {
  readonly header: SectionHeader;
  readonly range: CompareRange;
  readonly moments: readonly CompareMoment[];
  readonly withoutLabel: string;
  readonly withLabel: string;
  readonly caption: string;
  readonly scorecardHeader: SectionHeader;
  readonly scorecardIntro: string;
  readonly scorecardColumns: {
    readonly criterion: string;
    readonly paper: string;
    readonly typicalPos: string;
    readonly nexus: string;
  };
  readonly statusLabels: Readonly<Record<ScorecardStatus, string>>;
  /** Always shown with the scorecard: the comparison is qualitative and illustrative. */
  readonly basisNote: string;
  readonly scorecard: readonly ScorecardRow[];
  readonly footnote: string;
}

/* ───────────────────────────── Platform ───────────────────────────── */

export type ModuleStatus = 'live' | 'coming-soon';

export interface PlatformModule {
  readonly id: string;
  /** '01'…'12' for live modules; '' for coming-soon. */
  readonly number: string;
  readonly title: string;
  readonly curiousLine: string;
  readonly description: string;
  /** One short sentence (max ~2 lines) used on the headline cards. */
  readonly summary: string;
  /** The tiny proof detail. */
  readonly proof: string;
  readonly status: ModuleStatus;
  readonly icon: IconName;
  /** Optional supporting photo from the images manifest. */
  readonly image?: ImageName;
}

export interface PlatformContent {
  readonly header: SectionHeader;
  /** Ids of the 4-6 modules shown as large cards (in order). Everything else live goes in the compact "And also" strip. */
  readonly headlineIds: readonly string[];
  readonly alsoTitle: string;
  readonly modules: readonly PlatformModule[];
  readonly comingSoonTitle: string;
  readonly comingSoonTag: string;
  readonly comingSoon: readonly PlatformModule[];
  readonly comingSoonNote: string;
  readonly liveTag: string;
}

/* ───────────────────────────── How it works ───────────────────────────── */

export interface HowStep {
  readonly number: string;
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly time: string;
  readonly icon: IconName;
}

export interface HowContent {
  readonly header: SectionHeader;
  readonly steps: readonly HowStep[];
  readonly underStrip: string;
  readonly guaranteeLine: string;
  /** Shown on the Pay step until the Cashfree integration is live. */
  readonly payInterim: string;
  /** INTEGRATION POINT marker text for developers. */
  readonly integrationNote: string;
}

/* ───────────────────────────── Built for ───────────────────────────── */

export type BuiltForStatus = 'available' | 'partial' | 'coming-soon';

export interface BuiltForItem {
  readonly id: string;
  readonly title: string;
  readonly line: string;
  readonly status: BuiltForStatus;
  readonly statusLabel: string;
  readonly icon: IconName;
  readonly image: ImageName;
}

export interface BuiltForContent {
  readonly header: SectionHeader;
  readonly items: readonly BuiltForItem[];
  readonly closingLine: string;
  /** Images used by the perspective ring (4:5 crops), in display order. */
  readonly ringImages: readonly ImageName[];
}

/* ───────────────────────────── Trust ───────────────────────────── */

export interface TrustBlock {
  readonly id: string;
  readonly title: string;
  readonly claim: string;
  readonly backing: string;
  readonly icon: IconName;
}

export interface TrustContent {
  readonly header: SectionHeader;
  readonly blocks: readonly TrustBlock[];
  readonly notYet: { readonly title: string; readonly body: string };
  readonly backingLabel: string;
}

/* ───────────────────────────── Pricing ───────────────────────────── */

export type PlanKey = 'counter' | 'floor' | 'pass' | 'many-doors';
export type BillingCycle = 'monthly' | 'yearly';

export interface Plan {
  readonly key: PlanKey;
  readonly name: string;
  readonly eyebrow: string;
  readonly tagline: string;
  readonly badge: string;
  readonly forLine: string;
  /** Ex-GST rupees, integer. null for enquiry plans. */
  readonly monthly: number | null;
  readonly yearly: number | null;
  /** Rupees saved by paying yearly (12 × monthly − yearly). */
  readonly yearlySaving: number | null;
  /** Yearly ÷ 12, rounded as published in 03b. */
  readonly yearlyPerMonth: number | null;
  /** Founding Restaurants first-year yearly price, ex-GST. */
  readonly foundingYearly: number | null;
  readonly outlets: string;
  readonly staffLogins: string;
  /** At most five short bullets shown on the card. The full list is `features` (kept for search and tests). */
  readonly highlights: readonly string[];
  readonly features: readonly string[];
  readonly cta: Cta;
  readonly highlight: boolean;
  readonly enquiryOnly: boolean;
  readonly note?: string;
}

export interface FoundingOffer {
  readonly eyebrow: string;
  readonly title: string;
  readonly body: string;
  readonly code: string;
  readonly discountPercent: number;
  /** ISO dates in IST. */
  readonly opensOn: string;
  readonly closesAt: string;
  readonly closesLabel: string;
  readonly perks: readonly string[];
  readonly asks: readonly string[];
  readonly honestFraming: string;
}

export interface AddOn {
  readonly id: string;
  readonly name: string;
  /** Display price text, e.g. '₹49 per login per month'. */
  readonly price: string;
  readonly note: string;
  readonly status: 'available' | 'coming-soon';
}

export interface OnboardingItem {
  readonly id: string;
  readonly name: string;
  /** Ex-GST rupees, integer; null when not a fixed price. */
  readonly amount: number | null;
  readonly price: string;
  readonly detail: string;
}

export interface FlowStep {
  readonly number: string;
  readonly title: string;
  readonly body: string;
  readonly icon: IconName;
}

export interface PricingContent {
  readonly header: SectionHeader;
  readonly toggle: { readonly monthly: string; readonly yearly: string; readonly ariaLabel: string };
  readonly gstNote: string;
  readonly gstInclusiveHint: string;
  readonly foundingRibbon: string;
  readonly strikeLabel: string;
  readonly yearlyPerMonthLabel: string;
  readonly savingLabel: string;
  readonly perMonth: string;
  readonly perYear: string;
  readonly letsTalk: string;
  readonly underGrid: Cta & { readonly lead: string };
  readonly footnote: string;
  readonly flowTitle: string;
  readonly flow: readonly FlowStep[];
  readonly onboardingTitle: string;
  readonly onboardingIntro: string;
  readonly onboardingRefund: string;
  readonly addOnsTitle: string;
  readonly comingSoonTitle: string;
  readonly includedTitle: string;
  readonly included: readonly string[];
  readonly billingFaqTitle: string;
  /** Ids of FAQ entries to show as the billing mini-FAQ. */
  readonly billingFaqIds: readonly string[];
}

/* ───────────────────────────── Register ───────────────────────────── */

export type BusinessKind =
  | 'restaurant'
  | 'cafe'
  | 'food-court'
  | 'other';

export type RegisterPlanKey = PlanKey | 'not-sure';
export type BeginMode = 'pay-and-start' | 'pilot' | 'demo';

export interface SelectOption<V extends string = string> {
  readonly value: V;
  readonly label: string;
}

export type RegistrationFieldName =
  | 'restaurantName'
  | 'contactName'
  | 'phone'
  | 'email'
  | 'city'
  | 'businessKind'
  | 'outlets'
  | 'planKey'
  | 'billingCycle'
  | 'begin'
  | 'code'
  | 'message'
  | 'consent';

export interface RegistrationField {
  readonly name: RegistrationFieldName;
  readonly label: string;
  readonly placeholder: string;
  readonly help: string;
  readonly required: boolean;
  readonly maxLength?: number;
}

/** Everything the form holds. Strings so inputs stay controlled. */
export interface RegistrationFormValues {
  readonly restaurantName: string;
  readonly contactName: string;
  readonly phone: string;
  readonly email: string;
  readonly city: string;
  readonly businessKind: BusinessKind;
  readonly outlets: string;
  readonly planKey: RegisterPlanKey;
  readonly billingCycle: BillingCycle;
  readonly begin: BeginMode;
  readonly code: string;
  readonly message: string;
  readonly consent: boolean;
  readonly updates: boolean;
  /** Honeypot: must stay empty. */
  readonly website: string;
}

/** Exact body of POST /public/registrations (see 03_PLAN.md contract). */
export interface RegistrationPayload {
  readonly restaurantName: string;
  readonly contactName: string;
  readonly email: string;
  readonly phone: string;
  readonly city: string;
  readonly businessKind: BusinessKind;
  readonly outlets: number;
  readonly planKey: RegisterPlanKey;
  readonly billingCycle: BillingCycle;
  readonly message?: string;
  readonly consent: true;
  readonly consentVersion: string;
  readonly website?: string;
  readonly startedAt?: number;
}

export type RegistrationErrors = Partial<Readonly<Record<RegistrationFieldName, string>>>;

export type RegistrationFailureKind = 'rate-limit' | 'network' | 'server' | 'interim';

export interface ConsentSegment {
  readonly text: string;
  /** Present when the segment is a link to a policy page. */
  readonly href?: string;
}

/* ───────────────────────────── FAQ ───────────────────────────── */

export interface Faq {
  readonly id: string;
  readonly question: string;
  /** Plain text. Also used verbatim in FAQPage JSON-LD. */
  readonly answer: string;
  /** Inline links to render after / inside the answer. */
  readonly links?: readonly TextLink[];
  readonly topic: 'start' | 'product' | 'billing' | 'data' | 'company';
  /** Owner-facing note. Not rendered. */
  readonly internalNote?: string;
}

/* ───────────────────────────── Blog / Insights ───────────────────────────── */

export type ListItem = string | { readonly lead: string; readonly text: string };

export type PostBlock =
  | { readonly type: 'p'; readonly text: string }
  | { readonly type: 'h2'; readonly text: string }
  | { readonly type: 'h3'; readonly text: string }
  | { readonly type: 'ul'; readonly items: readonly ListItem[] }
  | { readonly type: 'ol'; readonly items: readonly ListItem[] }
  | { readonly type: 'quote'; readonly text: string }
  | { readonly type: 'callout'; readonly title?: string; readonly text: string };

export interface Post {
  readonly slug: string;
  /** Route path: '/insights/<slug>'. */
  readonly path: string;
  readonly title: string;
  readonly dek: string;
  /** Mono label, uppercase: 'OPERATIONS'. */
  readonly category: string;
  readonly readMinutes: number;
  /** ISO date (YYYY-MM-DD). */
  readonly publishedAt: string;
  readonly author: string;
  readonly cover: ImageName;
  readonly seoTitle: string;
  readonly seoDescription: string;
  readonly body: readonly PostBlock[];
}

/* ───────────────────────────── Legal ───────────────────────────── */

export type LegalBlock =
  | { readonly type: 'p'; readonly text: string }
  | { readonly type: 'clause'; readonly number: string; readonly text: string }
  | { readonly type: 'ul'; readonly items: readonly string[] }
  | { readonly type: 'ol'; readonly items: readonly string[] }
  | {
      readonly type: 'table';
      readonly headers: readonly string[];
      readonly rows: readonly (readonly string[])[];
    }
  | { readonly type: 'callout'; readonly text: string };

export interface LegalSection {
  readonly id: string;
  readonly heading: string;
  readonly blocks: readonly LegalBlock[];
}

export interface LegalDocument {
  readonly slug: string;
  /** Route path, e.g. '/terms'. */
  readonly path: string;
  readonly title: string;
  readonly shortTitle: string;
  /** Human date, e.g. '31 October 2026'. */
  readonly lastUpdated: string;
  readonly lastUpdatedISO: string;
  readonly summary: string;
  /** Lead blocks before the first numbered section (intro, plain version). */
  readonly intro: readonly LegalBlock[];
  readonly sections: readonly LegalSection[];
  /** Drafting note for the lawyer. NOT rendered by default. */
  readonly internalNote: string;
}

/* ───────────────────────────── SEO ───────────────────────────── */

export interface RouteSeo {
  readonly path: string;
  readonly title: string;
  readonly description: string;
  readonly ogType: 'website' | 'article';
  readonly noindex?: boolean;
}

export interface OgContent {
  readonly title: string;
  readonly description: string;
  readonly type: 'website';
  readonly locale: string;
  readonly image: string;
  readonly imageWidth: number;
  readonly imageHeight: number;
  readonly imageAlt: string;
  readonly twitterCard: 'summary_large_image';
}

export type JsonLdValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonLdValue[]
  | { readonly [key: string]: JsonLdValue };

export type JsonLdObject = { readonly [key: string]: JsonLdValue };

/* ───────────────────────────── Images ───────────────────────────── */

export type ImageName =
  | 'hero-pass-evening'
  | 'restaurant-dining-golden-hour'
  | 'boutique-hotel-dining'
  | 'specialty-cafe-counter'
  | 'cloud-kitchen-line'
  | 'bakery-morning-display'
  | 'indian-thali-overhead'
  | 'rooftop-restaurant-dusk'
  | 'kitchen-pass-ticket-rail'
  | 'qr-table-tent-blank'
  | 'owner-tablet-reports'
  | 'table-setting-topdown'
  | 'quick-service-counter'
  | 'bar-pour-evening'
  | 'chef-hands-plating'
  | 'restaurant-before-service'
  | 'storeroom-crates-morning'
  | 'closing-counter-lamp';

export type ImageSection =
  | 'hero'
  | 'about'
  | 'platform'
  | 'compare'
  | 'builtfor'
  | 'trust'
  | 'cta'
  | 'insights';

export interface ImageEntry {
  readonly name: ImageName;
  /** '/landing/<name>.webp' — the 1× file. */
  readonly file: string;
  /** '/landing/<name>-800.webp' — the 800-px-wide file for srcSet. */
  readonly file800: string;
  /** Descriptive alt text, never starting with 'image of'. */
  readonly alt: string;
  /** True when the photo is purely atmospheric: render alt="" and aria-hidden. */
  readonly decorative: boolean;
  /** Intrinsic width/height to put on the <img> (prevents layout shift). */
  readonly width: number;
  readonly height: number;
  /** CSS aspect-ratio value, e.g. '16 / 9'. */
  readonly ratio: string;
  readonly section: ImageSection;
  readonly alsoUsedIn: readonly string[];
  /** Hero image: load eagerly with fetchpriority="high". */
  readonly priority?: boolean;
  /** Fallback behaviour when the file is missing. */
  readonly fallbackIcon: IconName;
}

/* ───────────────────────────── Owner fill-ins ───────────────────────────── */

export interface OwnerFillIn {
  readonly key: string;
  readonly label: string;
  /** Literal bracketed tokens as they appear in the content, e.g. '[SUPPORT EMAIL]'. */
  readonly tokens: readonly string[];
  readonly usedIn: readonly string[];
  /** A value the owner can accept if it is already known. */
  readonly suggested?: string;
}

/* Re-exported so type-only consumers can import everything from one place. */
