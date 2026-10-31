# 09 - SECTIONS-B report (Platform, Compare, HowItWorks, BuiltFor, Trust)

Owner: SECTIONS-B agent. Scope: `apps/web/src/landing/` only, files listed below. Nothing outside this list was edited, nothing was committed or pushed.

## 1. Files

Sections (default exports, ids and `aria-labelledby` kept, exactly one h2 each):

- `sections/Platform.tsx` (#platform, canvas)
- `sections/Compare.tsx` (#why, alt)
- `sections/HowItWorks.tsx` (#how, Light Grey)
- `sections/BuiltFor.tsx` (#builtfor)
- `sections/Trust.tsx` (#trust, night, 1px green top edge)

Styles: `styles/platform.css`, `compare.css`, `how.css`, `builtfor.css`, `trust.css`.

Private parts in `sections/_b/`: `ModuleTicket.tsx`, `CompareArtefacts.tsx` (paper pile, tidy ticks), `CompareScorecard.tsx`, `clock.ts`, `HowChips.tsx`, `RefundMock.tsx`, `SectionHead.tsx`, `icons.ts` (lucide name to component map, only used icons), `useMq.ts`, `usePinScroll.ts`, `headline.tsx`, `util.ts`.

Tests: `sections/sectionsB.test.tsx` (12 tests, all pass).

## 2. What each section does

**Platform.** Sticky fanned 3D ticket stack. `useScrollProgress('pin')` supplies `--p`; CSS derives each card's position (`--pos`, `--d`, `--ad`) with clamp/min/max/calc, so no JS per frame. Tickets have mask-based notches, mono "03 / 12" numbers, an icon, a Live / Coming soon tag, a curious line, description and proof line. Index rail 01-12 is clickable and scrolls to that card's progress. Below the stack: the coming-soon tickets as a muted grid. Everything is in the DOM in order. Small screens, coarse pointers and reduced motion get a plain ticket list (no sticky, no 3D). No ancestor up to `.lp-root` has overflow other than the root's `overflow-x: clip`.

**Compare ("One Saturday night, two ways").** Eight moments (mono stamps 18:30 to 23:45) share one grid cell, so the box is as tall as the tallest and nothing is measured in JS. A native range input is the clock (0-360 min, step 5, `aria-label`, `aria-valuetext` e.g. "8:05 pm. Two taps on a laggy phone", arrow keys work). The "with Nexus" line is revealed by clip-path. Chips jump to a moment. On roomy screens the section pins and auto-plays with scroll until the user touches the control (pointer or any key except Tab); "Play with scroll again" resumes it. Reduced motion renders a static ledger of all eight moments, no slider. Scorecard: real `<table>` with caption "Illustrative, not measured", `th scope`, text status labels plus icon, no numbers; below 720px rows become stacked cards with explicit ARIA table roles and `data-label`.

**HowItWorks.** Five numbered steps, Forest numbers, a rule that draws on scroll (`--draw` from `useScrollProgress('view')`; horizontal at 1024px+, vertical below), per-step decorative mini-UI chips (aria-hidden). Honest about manual provisioning (headline "A human at every one") and the payment-link flow; the pay step carries an interim "Today" note (WhatsApp or email within one working day). It is marked with an `INTEGRATION POINT` comment in the TSX so it can be swapped when the self-serve pay flow exists.

**BuiltFor.** Perspective carousel ring of six business types (`ImageSlot`, manifest images, Ink fallback while images are absent). Rotates with scroll (tilt via `--p`), drag (pointer capture), ArrowLeft/Right, Prev / Pause / Next buttons, slow auto-rotate (5.2 s) that stops on reduced motion, hover, focus or Pause. `role="status"` live region names the current type, and only speaks on user action. One-liner per type below the ring. Under 768px or with reduced motion it is a scroll-snap strip with the one-liners inside each card.

**Trust.** Night section with a layered depth room: two framed photo layers and two ticket-outline layers behind an Ink veil, pointer parallax (fine pointers only, rAF-written `--rx/--ry`) plus scroll. Phones and `hover:none` get a flat backdrop. Six pillars each with an "How we back it" evidence line, two remaining facts, a "What we haven't done yet" aside, and a refund-reversal device mock. No India data-residency, blockchain or uptime claims (a test asserts this).

## 3. Things that must stay in sync

Media queries are duplicated between TSX (JS decides the mode) and CSS. Change both or neither:

| Constant | TSX | CSS |
|---|---|---|
| `STACK_MQ` | `Platform.tsx` | `platform.css` stack-mode block |
| `PIN_MQ` | `Compare.tsx` | `compare.css` pinned block |
| `RING_MQ` | `BuiltFor.tsx` | `builtfor.css` ring-mode block |

`useMq` returns false in jsdom, so tests see the plain (non-enhanced) layout.

## 4. Luxury choices (per the plan addendum)

Cards are white with a 1px hairline and the soft layered shadow `0 1px 0 rgb(11 15 14/.04), 0 24px 48px -24px rgb(11 15 14/.14)`; section padding clamp(96-160px); one easing `cubic-bezier(.16,1,.3,1)` with slow (0.7 s to 1.2 s) weighted motion; framed imagery with an inner white-alpha hairline and a 1 to 1.04 Ken-Burns on the front BuiltFor card (transform only, 16 s). No new colours, no gradients, no duotone or gold; accent is #1DBA3C only, one accent word per headline. The ticket perforation motif is used on the Platform tickets, with dashed paper slips in Compare and dashed chip frames in How as quieter echoes (the lead may trim these to hold the "3 places" cap); no `01 -` section markers were added.

## 5. Verification

- `AGENT=sectionsB lp-verify.sh quick`: tsc and eslint clean.
- `lp-verify.sh full`: tsc, eslint and vite build pass. Entry JS 192.5 kB gz (budget 250); LandingApp chunk 82 kB gz JS, 21 kB gz CSS.
- Vitest: 363 passed, 1 failed, plus 1 file failing to load. Neither is in my files (section 6). My 12 tests pass.
- Real Chrome on the production build (Playwright, local server): sticky pin and fan, Compare auto-play and wiper, How rule, BuiltFor ring, Trust room all render. `overflow-x` is 0 at 1440 and 375. Reduced motion shows the static Compare ledger and plain Platform list. No external (third-party) requests.
- Console: only 404s for `/landing/*.webp` (images not delivered yet, see section 7). No other console noise.

## 6. Failures that are not mine (for the lead)

1. `src/App.test.tsx` "shows the public website ... at /": "Found multiple elements with the role banner". Cause: other sections render a `<header>` inside a `<section>` (SECTIONS-A Intro `<header class="lp-intro__head">`, About / PlanCard, and Foundation `SectionHeader` is a `<header>`). I avoided this in my files by using `<div>`-based heads (`_b/SectionHead.tsx`). Fix: use `<div>` in those places, or scope the test query.
2. `src/landing/sections/sectionsC.test.tsx` fails to load: `ENOENT scandir .../sections/undefined` in its source-hygiene test (a path variable is undefined). Not mine.

## 7. Notes and hand-offs

- **Class collision found and fixed.** `pricing.css` already owns `.lp-cmp`, `.lp-cmp__table`, `.lp-cmp__text` (pricing compare table: `overflow-x:auto`, border, white background). In the real build this broke my Compare pin (sticky inside an overflow container) and framed it. My Compare namespace was renamed to `lp-cs` (`.lp-cs`, `.lp-cs__*`, `.lp-cs-section`). I grepped all my other prefixes (`lp-pf`, `lp-bf`, `lp-how`, `lp-tr`, `lp-rm`, `lp-platform`) for collisions: none. Lesson: harness runs without the other sections' CSS hide this; always check the full build.
- **Missing images.** `public/landing/` only has `brand/`. BuiltFor and Trust use `restaurant-dining-golden-hour`, `restaurant-before-service` and the six `*-800.webp` card images; they fall back to Ink with the file name in mono until delivered. Not a code bug.
- **RefundMock.** I used a local `_b/RefundMock.tsx` instead of the shared `CheckoutTablet` because that device shows a paid sample bill, not a refund reversal. If SECTIONS-A ships a refund device, swap it in `Trust.tsx`.
- **How card copy length.** Body copy in some How cards is longer than three lines at 1024-1200px; content files are fixed, so cards stretch (equal height, time line pinned to the bottom) instead.
- **Staging copy.** `D:\manhar-nexus\.lp-tmp\distB` is a build copy I left for browser checks (deletions are disabled in connected folders). Safe to delete; it should not be committed. `.lp-tmp/` is only a scratch folder.
- `THIRD_PARTY_NOTICES` is not touched by me.

## 8. Visual-QA checklist: what to look at first

1. **Platform at 1440x900**, scroll slowly through the pin: cards should fan and settle, one front card readable, rail highlights in step; click rail item 08 and confirm the scroll lands on it.
2. **Platform at 375**: a plain list of tickets, notches on the card edges, no horizontal scroll.
3. **Compare pin**: scroll through #why; time advances 18:00 to 00:00, the Nexus layer wipes, the section un-pins into the scorecard with no jump. Touch the slider and confirm auto-play stops; tab to it and use arrow keys; confirm the announced value reads time plus title.
4. **Compare scorecard at 375**: stacked cards, labels beside values, status has text not only colour.
5. **Compare with reduced motion**: all eight moments visible as a ledger, no slider.
6. **How at 1440 and 375**: rule draws with scroll, five cards equal height, pay-step "Today" note readable.
7. **BuiltFor**: ring rotates with scroll and drag, arrows and Prev/Next work, Pause stops it, status line names the type; at 375 it is a snap strip. (Cards show Ink with file names until the images land.)
8. **Trust**: move the mouse over the room (subtle parallax, no jank), check green top edge, refund mock caption legible, text contrast on cards. Check touch and reduced-motion for the flat backdrop.
9. **Everywhere**: tab through for visible focus rings; DevTools Performance should show only transform/opacity/clip-path animating; Network should show no third-party hosts.
