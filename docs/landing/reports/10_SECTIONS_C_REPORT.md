# 10 - SECTIONS-C report (Pricing, Register, FAQ, Insights, CTA, Article and Legal pages)

STATUS: merged into the repo; tsc, eslint and the vite build pass; 428 of 429 tests pass.
The one failing test is not in the sections-C files (see 1.2).

## 1. Verify results (`AGENT=sectionsC bash $HOME/lp-verify.sh`, full, 31 Oct 2026)
| Step | Result |
|---|---|
| tsc --noEmit (apps/web) | OK |
| eslint | OK |
| vitest | 43 of 44 files, 428 of 429 tests pass |
| vite build | OK. Entry JS 192.5 kB gz (budget 250). LandingApp 80.2 kB JS + 21.7 kB CSS gz. ArticlePage 2.7 kB, LegalPage 1.2 kB, Toc 1.0 kB gz (lazy chunks) |

### 1.1 Fixed in my files during the run
- `sectionsC.test.tsx` source-hygiene suite crashed: Vite rewrote `new URL(`../${rel}`, import.meta.url)`. Now uses `dirname(fileURLToPath(import.meta.url))` + `resolve`.
- `PlanCard` used `<header>`, which testing tools count as an extra banner landmark. Now a `<div>`.
- New `sectionsC/SectionHead.tsx` (div-based, same `.lp-section-header` look) replaces the Foundation `SectionHeader` in Pricing, Register, Faq and Insights, for the same landmark reason.
- Tests corrected: article share row WhatsApp query is scoped to `.lp-share` (the CTA also links to WhatsApp); the legal TOC test uses `LEGAL_UI.onThisPage` and expects no contents list on `/data-processing` (one section, TOC deliberately hidden under 2 items).
- The 700-line budget test failed on `pricing.css` after the luxury pass, so that layer lives in `styles/pricing-lux.css` (imported by `Pricing.tsx`). The hygiene test covers it.

### 1.2 Remaining failure (not mine)
`src/App.test.tsx > App auth gate > shows the public website ... at "/"` fails with "Found multiple elements with the role banner".
The extra `<header>` elements left are `.lp-intro__head` (`sections/Intro.tsx`) and `.lp-about__head` (`sections/About.tsx`) besides the real `.lp-header`.
Fix for their owner: make those two `<div>`s (as `sections/_b/SectionHead.tsx` and `sectionsC/SectionHead.tsx` do). The Foundation `SectionHeader` (`components/Heading.tsx`) has the same flaw for anyone still using it.

## 1.3 Luxury and premium pass (03_PLAN addendum), applied in the repo
Only existing tokens, no new colours or fonts.
- Space: Pricing, Register, FAQ, Insights and CTA sections use `clamp(6rem ... 10rem)` vertical padding; headers capped at 44rem; body copy capped near 62ch.
- Type: `text-wrap: balance` on headings, `pretty` on paragraphs; mono labels with +12% tracking; lining tabular numerals on prices, reference codes, counts and clause numbers; CTA headline up to 4rem.
- Surfaces: 24px radii, 1px hairlines (`--lp-line` / `--lp-night-line`), layered quiet shadows `0 1px 0 + 0 24px 48px -28px`, inset white-alpha highlight on the Ink featured plan and the white register card. Hairline rules between plan head, price and features; hairline table rows; FAQ as a ruled list; article h2 sections separated by a hairline.
- Motion: `cubic-bezier(0.16, 1, 0.3, 1)` at 400-900 ms for the billing pill, plan and post-card lift (4px, hover and pointer devices only), accordion rows and chips, field focus, TOC links. All guarded by `prefers-reduced-motion`.
- Ticket stub keeps its dashed perforation (one of the three allowed perforation uses).
- Not done: Ken-Burns, magnetic buttons and page-load choreography are Foundation or Hero concerns, not in these sections.

## 2. What was built
- **Pricing (#pricing)**: monthly/yearly native-radio radiogroup ("Yearly = 10 months paid"), GST-inclusive switch (exact to the paisa),
  3 plan cards + "Many Doors" enquiry card, "Coming soon" tags, time-aware Founding Restaurants banner (IST window, hidden after 31 Jan 2027),
  onboarding and add-ons tables, 14-day trial/guarantee notes, "How payment works" explainer with the INTEGRATION POINT comment,
  comparison table (caption, `th scope`, sticky first column, focusable scroll region). `choosePlan(plan, cycle)` writes the intent store and scrolls to #register.
  Fixed 4-row price block, so toggling does not shift layout.
- **Register (#register)**: Ink block, green top edge, white form card. All fields from the brief, blur+submit validation, `aria-invalid`/`aria-describedby`,
  focused error summary, honeypot `website`, `startedAt` time-trap, consent link to /terms and /privacy, busy state.
  Success: "RECEIVED" ticket stub (`role=status`, reference code, copy button, 3 next steps, WhatsApp follow-up).
  Failure (network/5xx/429): calm message + mailto and WhatsApp fallbacks built from entered values (URL-encoded).
  POST `${VITE_API_URL ?? '/api'}/public/registrations`, `credentials:'omit'`, JSON, 15 s abort. Indian phone normalisation. Prefill from `useRegistrationIntent()`.
  No third-party scripts, no CAPTCHA, no console output, no PII logging.
- **FAQ (#faq)**: accessible accordion (button, `aria-expanded`, `aria-controls`, region, arrow/Home/End keys), `#faq-<id>` deep links, topic chips (`aria-pressed`),
  search-as-you-type with a `role=status` count, expand/collapse all, empty state, `useJsonLd('faq')` with publishable answers only.
- **Insights (#insights)**: featured first card + grid, optional cover image with typographic fallback, links to `/insights/:slug`.
- **ArticlePage**: block renderer, reading-progress bar, TOC from h2s, prev/next, share (copy link, native share if present, wa.me), CTA to #register,
  `useDocumentMeta` + BlogPosting JSON-LD, calm noindex 404 for unknown slugs.
- **LegalPage**: all six policy routes in `PolicyLayout`, sticky TOC (desktop >=1400px, collapsible below), anchors, "Last updated", summary,
  `[...]` placeholders highlighted as `<mark class="lp-ph">` with a title hint, `internalNote` never rendered, print styles.
- **routes.tsx**: lazy pages, `POLICY_ROUTES` map, `/insights/:slug`, `/blog/:slug` redirect, `PATH_ALIASES` redirects kept.
- **CtaBanner (#cta)**: Ink, green edge, one accent word, primary to #register, secondary to WhatsApp (new tab). Its `.lp-cta*` CSS lives in `insights.css`.

## 3. Tests written (all run, passing)
- `pricing/pricingMath.test.ts`: GST math, yearly saving, founding state transitions.
- `registration/validation.test.ts`, `submit.test.ts` (202 / 400 issues / 429 / 500 / network / timeout; payload equals contract; fallback link encoding),
  `RegisterForm.test.tsx` (honeypot untouched, plan prefill from intent, error summary, success ticket).
- `sections/sectionsC.test.tsx` (744 lines; consider splitting): Pricing toggle and GST, FAQ filter and deep link, Insights, CtaBanner,
  ArticlePage 404, LegalPage TOC anchors and every legal route title, route table, source hygiene (no banned colours, gradients, console, third-party URLs).

## 4. Visual-QA checklist (no browser was available)
- 375 / 768 / 1280 / 1920 px: no horizontal page scroll; plan grid goes 1 -> 2 -> 4 columns (4 from 1240 px).
- Comparison table scrolls inside its region; first column stays sticky and readable at 375 px; focus ring visible on the region.
- Monthly/yearly and GST toggles: no height change in cards; featured Ink card keeps green top border and legible text.
- Founding banner: check "Opens soon" today (31 Oct 2026), "Open now" from 1 Nov, absent after 31 Jan 2027.
- Register: white card legible inside the Ink section (text not inheriting `.lp-on-dark`), Forest focus border, errors in AA contrast, 44 px targets.
- Ticket: stamp animation; with reduced motion it must not animate. Copy button announces "Copied".
- FAQ: closed panels not tabbable; chips wrap at 375 px; hash deep link opens and scrolls.
- Article: progress bar sits above/below the sticky header correctly; TOC readable; share row wraps.
- Legal: TOC sticky at >=1400 px, collapsible below; `lp-ph` marks visible in Mint Wash; print preview hides header, footer and TOC.
- Luxury pass: confirm 4px hover lift only on pointer devices, hairlines visible but quiet, ticket perforation intact, CTA headline balanced at 375 px.
- Only #1DBA3C green; no pure black; green buttons use Ink text; one accent word per headline.

## 5. Owner action items (placeholders still visible on legal pages)
Legal entity name/form, Udyam number, registered address and PIN, GSTIN, support email/hours/channel, phone, billing and abuse emails,
grievance officer, hosting provider/region, sub-processors, analytics tooling, retention and backup periods, liability cap, jurisdiction,
refund thresholds, billing operations details, DPA, production domain. Each renders as a highlighted `[...]` until filled in `content/`.

## 6. Integration notes and risks
- Payments: INTEGRATION POINT for Cashfree `createCheckout(referenceCode)` (PaymentFlow step 02 and `nextSteps.ts`). Today the ticket says RECEIVED, never PAID.
- API base mirrors `auth/api.ts` (the Vite dev proxy does not strip `/api`). Deploy action from the API report: set `REGISTRATION_IP_SALT`.
- Comparison rows come from `compareRows.ts` (sourced from doc 03b); no content module existed. Review wording with the owner.
- Founding code is prefilled only while the offer is open. OG images and article cover images are optional; fallback is typographic.
- Honesty rule honoured: no testimonials, counts or logos.
- Memory: nothing new to save.
