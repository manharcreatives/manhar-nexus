# 06 — Content Report (CONTENT agent)

Owner of `apps/web/src/landing/content/*.ts`. Import everything from the barrel: `import { HERO, PLANS, formatINR } from '../content'` (path relative to your file). All modules are pure data plus pure helpers: strict TS, no `any`, no JSX, no runtime dependencies. Verified with `AGENT=content bash $HOME/lp-verify.sh quick` (tsc OK, eslint OK) and `vitest run src/landing/content` (38 tests, all green; includes a check that every icon name exists in the installed `lucide-react`).

Typography: curly quotes and apostrophes everywhere (a test fails on straight ones), `₹` for rupees, en dash in numeric ranges and page-title separators, em dash kept where the copy used it as a voice device.

## 1. Conventions every section agent needs

- **Accent word.** Every h2/h1 is a `Headline = { text, accent }`. `accent` is ONE word that occurs exactly once in `text` (tested). Split the text around it and wrap only that word in the accent style.
- **Eyebrows** are already UPPERCASE mono labels of at most six words (tested).
- **Hash links** work from any route: nav items carry `href: '/#why'`. Register deep links use `/#register?plan=floor&cycle=yearly` and `/#register?begin=demo`; parse with `parseRegisterHash(window.location.hash)`.
- **Section ids** to use: `hero intro about why platform how builtfor trust pricing register faq insights cta` (nav and footer links already point at these; the copy report spelled `#built-for`, the plan says `builtfor`).
- **Icons** are lucide-react NAME strings (e.g. `'ChefHat'`). Resolve them with a small map built from individual imports (tree-shaken), not `import *`. The full set in use is listed in section 3.
- **Images** go through `img(name)` (returns `ImageEntry`), then `<ImageSlot src={i.file} width={i.width} height={i.height} alt={i.decorative ? '' : i.alt} decorative={i.decorative} priority={i.priority} />`.
- **`internalNote`** fields (legal docs, About, FAQ support) exist for the owner and must NOT be rendered by default.
- **Route paths** follow `03_PLAN.md` (owner decision 3), not the copy report: `/terms /privacy /refund-policy /billing-policy /acceptable-use /data-processing` and articles at `/insights/:slug`. The copy report's `/refund-cancellation /billing-payments /dpa /blog/...` are NOT used (FOUNDATION's `PATH_ALIASES` already redirects them).

## 2. Exports catalogue

Types are in `types.ts` (all `readonly`). Module -> exported consts and helpers:

| Module | Exports | Shape / notes |
|---|---|---|
| `types.ts` | all interfaces and unions | `Headline`, `Cta`, `TextLink`, `SectionHeader`, `HeroContent`, `IntroContent`, `AboutContent`, `CompareContent`, `PlatformContent`, `PlatformModule`, `HowContent`, `BuiltForContent`, `TrustContent`, `Plan`, `PricingContent`, `FoundingOffer`, `AddOn`, `OnboardingItem`, `RegistrationFormValues`, `RegistrationPayload`, `Faq`, `Post`, `PostBlock`, `ListItem`, `LegalDocument`, `LegalBlock`, `RouteSeo`, `OgContent`, `JsonLdObject`, `ImageEntry`, `ImageName`, `OwnerFillIn`, `CtaBannerContent`, `PreloaderContent`, `ContactDetails`, `FooterGroup`, `NavItem` … |
| `preloader.ts` | `PRELOADER`, `PRELOADER_LINES` | `{ lines: string[4], stepMs: 400, maxMs: 1700, ariaLabel }` |
| `nav.ts` | `SITE_NAME`, `STUDIO_NAME`, `STUDIO_TAGLINE`, `PRODUCT_LINE_LABEL`, `NAV_ITEMS`, `SIGN_IN_LINK`, `HEADER_CTA`, `SKIP_LINK`, `MOBILE_MENU_NOTE`, `CONTACT`, `FOOTER_BRAND`, `FOOTER_GROUPS`, `FOOTER_BOTTOM`, `FOOTER_CHIP`, `PAYMENTS_LINE` | `NAV_ITEMS: NavItem[7] {id,label,hash,href}`; `CONTACT: {email, phoneDisplay, phoneTel:'tel:+91…', whatsappNumber, whatsappUrl, addressLines[2], addressOneLine, reach, studioUrl, social[2]}`; `FOOTER_GROUPS: {title, links:{label,href,external?}[]}[4]` (Product, Company, Legal, Account) |
| `hero.ts` | `HERO` | `{ eyebrow, headline, altHeadline, subhead, primaryCta, secondaryCta, microcopy, proofPoints[3]{id,title,body,icon}, scrollCue, imageAlt }` |
| `intro.ts` | `INTRO` | `{ eyebrow, headline, paragraphs[5], closingQuestion: Headline, followLink: Cta }` |
| `about.ts` | `ABOUT` | `{ header, paragraphs[3]{text, ownerConfirm?}, honestNote{title,body}, beliefsTitle, beliefs[3], signature{name,role,ownerApproved:false}, studioLine, studioLabel, internalNote }` |
| `compare.ts` | `COMPARE`, `COMPARE_MOMENTS`, `SCORECARD_ROWS` | `COMPARE: { header, range{startClock:'18:00', endClock:'00:00', startLabel, endLabel, totalMinutes:360, ticks[7], sliderLabel}, moments, withoutLabel, withLabel, caption, scorecardHeader, scorecardIntro, scorecardColumns, statusLabels, basisNote, scorecard, footnote }`. Moment: `{ id, clock:'19:42', label:'7:42 pm', minutes: 0..360 after 18:00, title, without, with }`. Scorecard row: `{ id, criterion, paper, typicalPos, nexus, status:'ahead'|'equal'|'not-yet' }` — qualitative only, no numbers (tested). Always render `basisNote`. |
| `platform.ts` | `PLATFORM`, `PLATFORM_MODULES`, `COMING_SOON_MODULES`, `ALL_PLATFORM_MODULES` | Module: `{ id, number:'01', title, curiousLine, description, proof, status:'live'|'coming-soon', icon, image? }`. 12 live, 8 coming-soon (number `''`, proof `''`). `PLATFORM: { header, modules, comingSoonTitle, comingSoonTag:'COMING SOON', comingSoon, comingSoonNote, liveTag }`. |
| `how.ts` | `HOW` | `{ header, steps[5]{number,id,title,body,time,icon}, underStrip, guaranteeLine, payInterim, integrationNote }` |
| `builtfor.ts` | `BUILT_FOR` | `{ header, items[6]{id,title,line,status:'available'|'partial'|'coming-soon',statusLabel,icon,image}, closingLine, ringImages: ImageName[8] }` |
| `trust.ts` | `TRUST` | `{ header, blocks[8]{id,title,claim,backing,icon}, notYet{title,body}, backingLabel }` |
| `plans.ts` | `PLANS`, `PRICED_PLANS`, `PRICING`, `FOUNDING_OFFER`, `ADD_ONS`, `ONBOARDING`, `LAUNCH_PACK_PRICE`, `GST_RATE`, `GST_PERCENT`; helpers `gstInclusive`, `gstInclusiveExact`, `gstAmountExact`, `formatINR`, `gstHint`, `rupeesInWords`, `priceAriaLabel`, `planCtaHref`, `getPlan`, `planPrice`, `isFoundingOfferOpen` | `Plan: { key:'counter'|'floor'|'pass'|'many-doors', name, eyebrow, tagline, badge, forLine, monthly, yearly, yearlySaving, yearlyPerMonth, foundingYearly (all integer ₹ ex-GST or null), outlets, staffLogins, features[], cta, highlight, enquiryOnly, note? }`. `gstInclusive(599) === 707`; `gstInclusiveExact(599) === 706.82`; `formatINR(24990) === '₹24,990'`, `formatINR(100000) === '₹1,00,000'`; `gstHint(1299) === '₹1,532.82 incl. 18% GST'`; `priceAriaLabel(12990,'yearly')` -> "twelve thousand nine hundred ninety rupees per year plus GST". `FOUNDING_OFFER: { eyebrow:'FOUNDING RESTAURANTS · UNTIL 31 JAN 2027', title, body, code:'FOUNDING26', discountPercent:25, opensOn, closesAt (IST ISO), closesLabel, perks, asks, honestFraming }`. `PRICING` holds toggle labels, footnote, flow strip (4 steps), onboarding/add-on/coming-soon titles, `included[]`, `billingFaqIds`. |
| `register.ts` | `consentVersion` (and `CONSENT_VERSION`) = `'2026-10-31'`, `REGISTER_HEADER`, `REGISTER_NEXT_STEPS`, `REGISTER_NEXT_TITLE`, `BUSINESS_KIND_OPTIONS`, `PLAN_OPTIONS`, `BILLING_OPTIONS`, `BEGIN_OPTIONS`, `REGISTRATION_FIELDS`, `REGISTRATION_FIELD_ORDER`, `MANY_DOORS_NOTE`, `MANY_DOORS_THRESHOLD`, `CONSENT_SEGMENTS`, `CONSENT_TEXT`, `UPDATES_LABEL`, `CONSENT_SMALL_PRINT`, `SUBMIT_LABEL`, `SUBMIT_LOADING_LABEL`, `SUBMIT_MICROCOPY`, `FALLBACK_*`, `VALIDATION_MESSAGES`, `FAILURE_MESSAGES`, `DEFAULT_FORM_VALUES`; helpers `registrationSuccess(contactName, ref)`, `normalizeIndianMobile`, `validateRegistration(values)`, `composeMessage`, `toRegistrationPayload(values, startedAt?)`, `buildRequestText`, `buildWhatsAppUrl(values, ref?)`, `buildMailtoUrl(values, ref?)`, `parseRegisterHash(hash)` | Option values match the API contract exactly (`businessKind`, `planKey` incl. `not-sure`/`many-doors`, `billingCycle`). `validateRegistration` returns `{}` when valid, else `{ field: message }`. `toRegistrationPayload` yields the exact strict body for `POST /public/registrations`; the three form fields the API schema has no slot for (how to begin, code, updates opt-in) are folded into `message` as `[Begin: …] [Code: …] [Product updates: yes]` and the result is capped at 1,000 characters. Phone is sent as `+91XXXXXXXXXX`. `CONSENT_SEGMENTS` is `{text, href?}[]` for rendering the three policy links. `FAILURE_MESSAGES` keys: `rate-limit | network | server | interim`. |
| `faq.ts` | `FAQ_HEADER`, `FAQS`, `getFaq`, `faqsByIds` | `Faq: { id, question, answer (plain), links?: {text,href}[], topic, internalNote? }`, 16 items. Billing mini-FAQ ids: `free-trial, cancel-and-data, hidden-fees, payments, refund-policy`. |
| `posts.ts` | `POSTS`, `INSIGHTS_HEADER`, `getPost`, `relatedPosts` | `Post: { slug, path:'/insights/<slug>', title, dek, category (UPPERCASE), readMinutes, publishedAt:'2026-10-31', author:'Manhar Nexus team', cover: ImageName, seoTitle, seoDescription, body: PostBlock[] }`. `PostBlock`: `{type:'p'\|'h2'\|'h3'\|'quote'\|'callout' ...}` — `p/h2/h3/quote: {text}`, `callout: {title?, text}`, `ul/ol: {items: (string \| {lead,text})[]}` (render `lead` in `<strong>` then `text`). The post title is the page h1; body headings start at h2. |
| `legal.ts` (+ `legal-terms.ts`, `legal-privacy.ts`, `legal-policies.ts`, `legal-blocks.ts`) | `LEGAL_DOCUMENTS`, `TERMS`, `PRIVACY`, `REFUND`, `BILLING`, `ACCEPTABLE_USE`, `DPA`, `getLegalDocument(slug)`, `getLegalDocumentByPath(path)`, `LEGAL_PATHS`, `LEGAL_NAV`, `LEGAL_UI` | `LegalDocument: { slug, path, title, shortTitle, lastUpdated:'31 October 2026', lastUpdatedISO, summary, intro: LegalBlock[], sections: {id, heading, blocks}[], internalNote }`. `LegalBlock`: `p {text}`, `clause {number:'3.3', text}` (render number as hanging label), `ul/ol {items:string[]}`, `table {headers, rows}`, `callout {text}`. Anchors: use `section.id`. |
| `seo.ts` | `SITE_ORIGIN` (`'https://[DOMAIN]'`), `SITE_TITLE_SUFFIX`, `HTML_LANG`, `THEME_COLOR`, `HOME_SEO`, `HOME_OG`, `PRIMARY_KEYWORDS`, `SECONDARY_KEYWORDS`, `ROUTE_SEO`, `SITEMAP_PATHS`, `seoForPath(path)`, `absoluteUrl(path, origin?)`, `jsonLdScript(obj)`, `organizationJsonLd()`, `softwareApplicationJsonLd(origin?)`, `faqPageJsonLd()`, `blogPostingJsonLd(post, origin?)`, `homeJsonLd(origin?)` | `RouteSeo: { path, title, description, ogType }`, 13 routes (home, 6 legal, 6 posts). Pass `window.location.origin` as `origin` until the production domain is final. `jsonLdScript` escapes `<`. |
| `images.ts` | `IMAGES`, `img(name)`, `imgSrcSet(name)`, `imagesFor(section)`, `OG_IMAGE` | `ImageEntry: { name, file:'/landing/<name>.webp', file800:'/landing/<name>-800.webp', alt, decorative, width, height, ratio:'3 / 2', section, alsoUsedIn[], priority?, fallbackIcon }`. Exactly one `priority` image (`hero-pass-evening`, decorative). Sizes: 16:9 1536×864, 3:2 1536×1024, 4:5 1024×1280, 1:1 1024×1024 (real sizes ChatGPT can deliver after cropping). |
| `cta.ts` | `CTA_BANNER` | Not in your module list but needed by `CtaBanner.tsx`: `{ eyebrow, headline, body, primaryCta, secondaryCta, finePrint }`. |
| `owner-fill-ins.ts` | `OWNER_FILL_INS`, `OWNER_FILL_IN_TOKENS` | `OwnerFillIn: { key, label, tokens[], usedIn[], suggested? }`. |

## 3. Icon names in use (all verified against lucide-react)

`ShieldCheck BadgeCheck Radio ClipboardList CreditCard KeyRound UtensilsCrossed Rocket Utensils Coffee Croissant Hotel CookingPot Store Link2 Lock UsersRound Fence CopyX DatabaseBackup IndianRupee LayoutGrid ConciergeBell ChefHat Receipt Undo2 ChartColumn Wallet History Bell MapPin Printer CalendarClock Users QrCode Boxes MessageCircle Percent Languages Building2 Wine Sunset Lamp`

## 4. Copy changes I made and why

Voice and depth are unchanged; edits are limited to typos, factual mismatches and brand/honesty rules.

1. **Hero proof 1:** “a Verify button can prove nothing was altered” -> “checks that nothing was altered” (Activity History is tamper-evident, not tamper-proof; analysis §4 forbids “tamper-proof”). Same softening in the Compare 11:45 pm moment.
2. **Hero proof 3:** “while the waiter is still walking away” -> “within about a second” (the code gives about a second; no numeric latency SLA is allowed, so “about” stays).
3. **Compare 6:30 pm:** “Needs cleaning” -> “Cleaning” (the real Dining Table state is Available / Occupied / Cleaning).
4. **Compare 7:42 pm:** “portion, the spice level and the extra” -> portion plus “the Add-ons you have defined — spice level, an extra” (spice level is only there if the restaurant defines it).
5. **Compare 9:50 pm:** the Void also needs a reason (verified: `voidInvoiceSchema.reason` is required), so the line now says so.
6. **Platform 09 Roles:** “Manager” -> “Location Manager” (the real system role name).
7. **Platform 11 Alerts proof:** “The bell shows alerts relevant to your role” was not provable from the code -> “A bell in the app keeps every alert in one place.”
8. **Trust “Backups, written down”:** removed “and have been rehearsed” and “Runbooks in the repo” (the staging restore drill is still pending per the analysis). Same fix in Terms 10.2, Privacy §7 and the DPA row (“backups and restore tests” -> “documented backup and restore procedures”).
9. **Trust “Built for India”:** removed “Indian time” — daily reports currently split days at UTC, not IST (QA report known gap). Do not claim IST day boundaries until that is fixed.
10. **Terms 1.4:** removed “preserving drafts” (the in-progress cart is React state and is not persisted across reloads).
11. **FAQ Q2 (printers):** “is being validated with real printers” -> “is built in the engine but not yet validated with real printers” (printing is API-only, all printer models UNVERIFIED). Same wording on the platform coming-soon card and the pricing add-on note.
12. **FAQ Q4 (data):** the 30-day window now says exactly what exists: CSV report downloads in the app, plus “a fuller export of your Workspace data prepared by us on request” (no full-export feature is built; Terms 11.4 already says this).
13. **Pricing, Counter and Floor bullets:** the Owner “Today” home and 14-day trend moved from Floor to Counter. 03b §1.4 rows 13 and 14 mark them included in every plan and 03b wins on plan contents. Counter also lists “default alerts”, which 03b includes.
14. **Scorecard “Receipt printing”:** “In validation” -> “Not yet — in the engine, being validated — coming soon” (not “In validation” as if testing were under way).
15. **Premium support add-on:** the copy report gives Pass a quarterly review call and the Premium-support add-on a monthly one; both are kept as 03b states them, with the difference spelled out in the add-on note instead of implying the add-on is “included in Pass”.
16. **CTA eyebrow:** “READY TO CLOSE THE NIGHT WITH ONE TRUTH?” (8 words) -> “READY TO CLOSE WITH ONE TRUTH?” (brand rule: labels max 6 words).
17. **Q13 / About:** the in-answer `[Owner: …]` text was moved to `internalNote` so it never shows on the live page or in FAQPage JSON-LD. The two About paragraphs that need the owner’s confirmation carry `ownerConfirm: true`.
18. **Organization JSON-LD:** `availableLanguage` is `['English']` only (the copy listed Hindi and Gujarati, but support languages are unconfirmed — see fill-in `support-languages`); `logo` is omitted until a logo file exists. SoftwareApplication offers keep the exact copy-report shapes (`valueAddedTaxIncluded: false`).
19. **New copy (small, in the same voice):** FAQ section header (“Questions worth asking before you pay.” / “Straight answers, including the uncomfortable ones.”), the pricing “Included, where others charge extra” list, the coming-soon module one-liners (all say “Planned / in the engine, not available yet”), the pricing flow strip bodies, the scorecard `basisNote`, and the three small status words. Replace freely.
20. **Legal drafts:** transcribed verbatim except bold markers (dropped) and the nested placeholder in Terms 18.3, which was flattened to “…with the seat in a city of your choice instead]” so each placeholder is a single `[…]` token.
21. **“Order” wording:** the copy report’s Pricing flow strip said “First order”; the glossary avoids “order”, so it is “First service”.

## 5. Claims softened or labelled (feature truth table)

- Printing, bookings screen, guest profiles, QR Scan Menu, stock and recipes, WhatsApp/SMS, discounts and split Checkouts, card payments, Gujarati/Hindi, aggregator links: all `coming-soon` or `Not yet`, never `live`. Eight roadmap cards are in `COMING_SOON_MODULES`; the scorecard marks every one `not-yet` (tested).
- Never claimed: offline mode, India data residency, uptime, certifications, bank-grade security, tamper-proof, blockchain, customer counts, logos, testimonials, awards, ratings, numeric response SLAs. A test fails on `blockchain`, `guaranteed uptime`, `tamper-proof`, `bank-grade` and the three old greens.
- **Operational promises the product does not automate yet** (kept because they are policy in 03b/03d, but the owner must be able to honour them by hand): UPI AutoPay for monthly plans and Cashfree payment links (no Cashfree code exists; Pay step shows the interim line “We’ll send your payment link by WhatsApp or email within one working day”), the dunning ladder and “limited mode”, “deleted from our live systems” after the 30-day export window (no whole-Workspace delete tool exists), the fuller data export on request, and the Workspace-within-one-working-day target.

## 6. Integration points and notes for the lead

- `FOUNDATION`'s `site.ts` re-declares nav and contact data (and assumes `https://nexus.manharcreatives.com` as origin). Nothing imports `content/` yet. Recommend `Header`/`Footer`/`useDocumentMeta` read `NAV_ITEMS`, `CONTACT`, `FOOTER_GROUPS`, `seoForPath` from `content` so the copy stays in one place. Header order follows the copy report (Why Nexus · Platform · How it works · Built for · Pricing · Insights · FAQ); `site.ts` has a different order.
- `SITE_ORIGIN` is deliberately the placeholder `https://[DOMAIN]`; pass the real origin to the JSON-LD builders.
- `// INTEGRATION POINT` for Cashfree: `HOW.integrationNote`, `HOW.payInterim`, `FAILURE_MESSAGES.interim`.
- The `index.html` JSON-LD and meta from 03c §17 can be generated from `homeJsonLd()` / `HOME_SEO` / `HOME_OG` at build time; `theme-color` should be `#FFFFFF` (`THEME_COLOR`).
- Photos are not required for building: every image has a `fallbackIcon` for the Ink / Light-Grey fallback box.

## 7. OWNER_FILL_INS (also exported from `content/owner-fill-ins.ts`)

Bracket tokens listed here appear verbatim and visibly in the legal pages until replaced (a test checks both directions: every token appears in the copy, and no unlisted `[…]` appears).

| key | what to supply | used in | suggested value |
|---|---|---|---|
| `legal-form` | Legal form (proprietorship / partnership / LLP / company) | terms | — |
| `udyam` | Udyam registration number | terms | — |
| `registered-address` | Registered address | terms, privacy | Sona Complex, A-252, Kansa Cross Road, Opp. Khodiyar Hotel |
| `pin-code` | PIN code | terms | 384315 |
| `gstin` | GSTIN, and whether GST-registered at all | terms | — |
| `gst-registration-decision` | If not GST-registered: quote tax-inclusive prices; CA to confirm invoice rules and TDS | billing-policy | — |
| `support-email` | Support email | terms, refund | info@manharcreatives.com |
| `support-channel` | WhatsApp / phone support channel | terms | +91 97145 71522 |
| `support-hours` | Support hours (IST); also whether “we reply the same working day” is true | terms, mobile menu | — |
| `phone` | Phone for Terms and Grievance Officer | terms, privacy | +91 97145 71522 |
| `billing-email` | Billing email | billing-policy | info@manharcreatives.com |
| `abuse-email` | Abuse-reporting email | acceptable-use | info@manharcreatives.com |
| `support-languages` | Languages support can truly offer; update FAQ and JSON-LD | faq, seo | — |
| `grievance-officer` | Name, designation, email, hours (+ DPO if required) | privacy | — |
| `hosting` | Hosting provider and region (Docker+Caddy vs Vercel+Neon undecided) | privacy, data-processing, trust | — |
| `production-security-facts` | Verify TLS, encryption at rest, backup schedule and off-host copy, production access before claiming | privacy, data-processing | — |
| `subprocessors` | Email/SMS/WhatsApp providers; where the sub-processor list is published | privacy, data-processing | — |
| `analytics` | Analytics tool (none, or name it; consent banner may be needed) | privacy | — |
| `provisioning-target` | Workspace provisioning target | terms | one working day |
| `deletion-days` | Deletion window and sub-processor notice period (`[30]`) | terms, privacy, data-processing | 30 |
| `backup-retention` | Logical backups (`[14]`) and PITR (`[7]`) days | terms, privacy | — |
| `retention-periods` | Unconverted registrations (`[12]`), logs (`[90]`), tax records | privacy | — |
| `rights-timelines` | Acknowledge/resolve and breach timelines; DPDP status | privacy | — |
| `liability-cap` | 6 or 12 months of fees | terms | — |
| `jurisdiction` | Visnagar vs Mehsana courts, or arbitration seat | terms | — |
| `refund-thresholds` | Pro-rata option, provisioning window, outage threshold, refund timeline | refund-policy | — |
| `billing-operations` | Invoice-correction window, Cashfree retry schedule, limited-mode timing, query response time | billing-policy | — |
| `dpa-document` | Signable DPA; breach-notice target | data-processing | within 72 hours (to confirm) |
| `domain` | Production domain (replaces `[DOMAIN]`) | seo, index.html, sitemap | — |
| `organization-logo` | Manhar Creatives logo file | nav, JSON-LD | — |
| `og-image` | Brand v2 OG image at `/landing/og-1200x630.png` | seo | — |
| `about-story` | Confirm or rewrite the two About paragraphs about experience around restaurants | about | — |
| `founder-signature` | Approve “Utsav Prajapati, Founder, Manhar Creatives” | about | — |
| `contact-data` | Confirm email, phone, WhatsApp, address, socials | nav | — |
| `cashfree-integration` | Cashfree account facts before the Pay step goes live | how, register, billing | — |
| `founding-offer-dates` | Founding window (1 Nov 2026 – 31 Jan 2027) and hand-setup capacity | plans, footer | — |

## 8. Files

All under `apps/web/src/landing/content/`: `types.ts index.ts preloader.ts nav.ts hero.ts intro.ts about.ts compare.ts platform.ts how.ts builtfor.ts trust.ts plans.ts register.ts faq.ts posts.ts legal.ts legal-blocks.ts legal-terms.ts legal-privacy.ts legal-policies.ts seo.ts images.ts cta.ts owner-fill-ins.ts content.test.ts` (plus this report). No existing file outside this folder was touched; no new dependencies.
