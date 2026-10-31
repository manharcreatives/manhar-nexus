# 15 - W2 report (Pricing, FAQ, Insights, Register, CTA, legal and article pages) - dark-luxury round

Scope: `apps/web/src/landing/**` only. No git commit/push, nothing deleted.

## What changed
Shared layer: `styles/w2-base.css` (new). Literal software-palette tokens as `--w2-*` (paper #070a09, surface #0f1513, sunken #161e1b, line #222d29, ink #f3f7f5, muted #94a09b, green #1DBA3C/#35D445), the hairline brand-gradient edge (`.w2-glow-edge`) and a native-`<details>` disclosure. My CSS never reads the global `--lp-*` colour tokens, so it holds whatever W1 does to them. Section header: `sectionsC/SectionHead.tsx` now just re-exports W1's `components/SectionHead` (numbered index + hairline + eyebrow), so every W2 section shares the one pattern.

- **Pricing** (`sections/Pricing.tsx`, `pricing/*`, `styles/pricing.css`, `pricing-lux.css`): three priced cards in a row, middle (Floor) lifted 16px with a hairline #1DBA3C to #35D445 border and a ribbon; tabular lining INR figures in Clash Display; at most 5 bullets per card (the curated `highlights`); exactly one CTA each (Floor primary, others outline); fixed 4-row price block so toggling never moves a card; monthly/yearly segmented toggle with a "2 months free" chip; GST switch kept. Many Doors is a wide enquiry card under the grid (one CTA, "Let's talk", honest not-built note). Founding banner is now a slim row (first sentence + details). A one-line payment strip ("Register, Pay, Workspace, First service. Nothing is charged on this page.") sits under the cards. Three closed disclosures: Compare plans (includes "in every plan" list), Setup and add-ons, Trying it/paying/billing (try options, full payment flow with the Cashfree INTEGRATION POINT, billing mini-FAQ). Prices, GST maths and founding logic untouched (`pricingMath.ts` unchanged). Nexus Menu: Counter highlight line and a "in every plan" line, consistent with `plans.ts`/`compareRows.ts` and `flags.ts`.
- **FAQ**: five visible (`FAQ_FEATURED_IDS`) plus "More questions (N)"; two-column with a sticky header and a WhatsApp ask; `#faq-<id>` deep links open "More" when needed; FAQPage JSON-LD still lists all questions. Search box and topic chips were removed from the UI (helpers kept in `faqLogic.ts` and tested).
- **Insights**: three equal cards (`INSIGHTS_FEATURED_SLUGS` in `content/posts.ts`), the other three behind "More articles" (all six stay linked from the home page).
- **Register**: dark surface card, sunken fields, green focus ring, error colours AA on dark, dark ticket stub (dashed perforation kept); side notes tightened to one line each.
- **CTA**: dark, centred, one gradient primary.
- **Legal and article pages**: `pages.css` re-themed (TOC, clauses, placeholder marks, callouts, share row, prev/next, article CTA, dark prose guard). Legal text untouched. New visible note on every policy: "Draft, pending legal review. Items in [brackets] will be completed before it takes effect." (constant in `LegalPage.tsx`, since `content/legal.ts` is not mine).
- Content: `plans.ts` (shorter subhead, Nexus Menu line in `included`), `posts.ts` (featured slugs), `content.test.ts` FAQS count now `QR_MENU_LIVE ? 17 : 16`.

## Verify (AGENT=w2)
- tsc OK, eslint OK (whole apps/web/src).
- vitest, run in foreground per file group because the shared VM kills background jobs: `sectionsC.test.tsx` 69/69 pass (new tests: lifted featured card, <=5 bullets, Many Doors outside grid, three closed disclosures, Nexus Menu line, 5 visible FAQs and More, deep link into More, 3 insight cards, More articles, gradient whitelist in CSS). `src/landing` run: 235 pass, 5 fail, all in W1 files (see below). `src/App.test.tsx` 5/5.
- vite build OK; entry JS 216.8 kB gz (budget 250), LandingApp 81.2 kB gz JS, 23.7 kB gz CSS, LegalPage 1.3, ArticlePage 2.7.
- Tests changed: hygiene test now allows only the two brand gradients (and opaque `#fff` mask helpers), bans radial/conic, and also scans `w2-base.css`.

## Not mine, failing
1. `sectionsB.test.tsx > Nexus Menu`: copy matches the honesty regex (percent/guarantee-style words).
2. `sectionsB.test.tsx > dark theme rules in the W1 styles` (x2): `#000` in a W1 style file; a `linear-gradient(var(--lp-ink) 0 0)` mask helper trips the gradient whitelist.
3. `content.test.ts > planned number of items`: `PLATFORM_MODULES` is 13, test says 12. `coming-soon items are never marked live`: a scorecard row ("QR ordering / aggregator links") is now `equal`, test still expects `not-yet`. (Both stem from the Nexus Menu change; W1 files.)
4. Earlier full-run log also showed Trust (expects 6 pillars, now 4), Intro accent word, About unconfirmed-claims, Compare chips and an OrderBuilder test, all outside my files. Trust 4 pillars is W1's (Trust.tsx and trust.ts are not in my list).

## Unverified
- No browser exists in the VM and the user's browser pane cannot reach it, so there are no screenshots. Please eyeball: featured-card gradient ring (mask with `inset:-1px`), ribbon overlap at 375px, lifted card at 960-1100px, toggle chip wrapping under 420px, sticky FAQ header, disclosure chevrons, register card contrast, legal TOC at >=1400px.
- `flags.ts` already existed (W1) with the exact contents requested; I did not create it.
- `builtfor.ts` was in my content list but BuiltFor.tsx is W1's; left untouched.
