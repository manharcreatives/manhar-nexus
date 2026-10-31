# 02 — DESIGN RESEARCH (Manhar Nexus launch landing)

Agent: Design Research · Date: 2026-10-31 · Inputs: `00_BRIEF.md`, live browsing via Chrome automation, repo `apps/web/src/brand/Monogram.tsx`.
No repo source files were modified. This is the only file written.

## Executive summary (10 lines)

1. Manhar's live site is a React SPA (not Next) using Clash Display + Satoshi, **no GSAP/Lenis/ScrollTrigger**, ~28 hand-written CSS keyframes, `prefers-reduced-motion` rules and a native-CSS marquee: proof that the brief's "no heavy libraries" stance matches the studio's own stack. Copy only structure/voice, never its old greens.
2. Its voice formula is reusable: blunt contrast lines ("INSTEAD OF A TEMPLATE SITE..."), honest admissions ("including when that is less than you expected"), numbered 01/02/03 sections, mono eyebrows, one coloured word per headline.
3. The live site does NOT use the phrase "Restaurant Digital Solutions" anywhere on the home page or in its 47-URL sitemap; restaurants appear only as industry card "Restaurants", showcase "Restaurant QR Menu System" and blog `/blog/restaurant-qr-menu-system-guide`. Nexus should be named as its own product (cross-link as "a Manhar Creatives product").
4. Exact contact block captured (email, phone, WhatsApp, Instagram, LinkedIn, address) in section 1.4, ready for header/footer/contact.
5. Best-in-class pattern: the hero shows the product built in DOM/HTML (Linear, Framer, Toast IQ mock), two-tone headlines, mono captions, segmented toggles, numbered step strips. All reproducible with CSS + ~40 lines of JS. Stripe's hero is WebGL (5 canvases): we deliberately do not copy that.
6. Recommended preloader: **"Kitchen Printer"** (an order ticket prints out of a printer slot in 16 stepped frames, a Forest "READY" stamp lands, the ticket-stub N tile appears, Ink curtain lifts). 1.7s min, skipped on repeat visit and under reduced motion.
7. Recommended hero: **"The Pass"**: Ink hero, headline + two buttons, beneath it a faux HTML dashboard plane tilted in perspective with three tickets floating at different translateZ; it flattens as you scroll (native `animation-timeline: view()` with a rAF `--p` fallback).
8. Four scroll-driven 3D techniques with flat layers are specified with code: flattening dashboard plane, sticky fanned ticket stack, perspective ring carousel (`tan()`-computed radius), layered translateZ "room" with pointer parallax.
9. Comparison concept **"One Saturday night, two ways"**: sticky 6pm-to-midnight timeline, left = paper chaos, right = Nexus flow, plus an accessible range-input wiper and an honestly labelled illustrative scorecard (no fake stats).
10. Image plan: 18 ChatGPT images (no text, no close-up faces, negative space noted) plus 4 UI "device mockups" built in pure HTML/CSS (KOS tablet, owner dashboard laptop, guest phone, Checkout tablet), so UI stays crisp and on-brand.

## 0. Access notes (what was blocked / not done)

- Chrome automation worked. The `javascript_tool` blocks any return value containing URLs with query strings ("BLOCKED: Cookie/query string data"), so I re-ran probes returning only names/counts/paths.
- **Vercel**: `vercel.com` redirected to `/login` in this browser session (I did not sign in); only the shared CSS bundle was inspected. Marketing-page layout NOT observed.
- **Resy**: homepage content was lazy and rendered blank at capture; only header chrome was seen (date/party selector in header). Not used for conclusions.
- **Lightspeed**: Cloudflare "Performing security verification" bot check; not bypassed (rule: no bot-detection bypass). **Godly**: redirected to `recent.design` with a single sponsored card; no usable collection.
- **Not visited**: Tock, Awwwards, Siteinspire, Codrops. Techniques attributed to them in section 2.3 are from general knowledge, flagged "(known, not verified live)".
- Observed vs known is labelled throughout. No copyrighted imagery or code was copied; only techniques are described.

---

## 1. PART 1 — Manhar Creatives website (structure reference only)

Source: https://www.manharcreatives.com (home), https://www.manharcreatives.com/sitemap.xml (47 URLs)

### 1.1 Tech and motion (inspected with javascript_tool)
- React SPA (`#root`), no Next/Astro globals. `window.gsap`, `window.Lenis`, `window.ScrollTrigger`: all absent. Native smooth behaviour only.
- Fonts loaded: Clash Display 200–700, Satoshi 300/400/500/700/900. Body stack `Satoshi, Inter, sans-serif`; h1 stack `"Clash Display", "Space Grotesk", sans-serif` (same fallbacks as the brand guide).
- Keyframes found (28): `mc-bounce mc-pulse fadeInUp fadeInDown fadeIn scaleIn slideInLeft slideInRight float float-slow pulse-dot glow-pulse gradient-shift text-shimmer rotate-slow breathe morph marquee preloaderGridPulse pulse-ring cta-glow field-shake check-pop img-shimmer aurora-drift-a/b/c mc-cue-run`.
- `@media (prefers-reduced-motion)` rule present. `CSS.supports('animation-timeline','view()')` is true in current Chrome.
- No visible preloader node (a `preloaderGridPulse` keyframe exists, so a grid-pulse loader exists in the bundle). Page chrome: thin green scroll-progress line at top edge, floating round WhatsApp/call FAB bottom-right + back-to-top arrow button above it, counters ("0+ YEARS...") that count up in view.
- Hero art: AI-rendered dark restaurant scene (tablets/phone mockups of restaurant sites on glass plates, tilted in perspective) behind centred text. Reuse the *idea* (restaurant UIs on tilted glass plates), not the dark-only grade or greens.

### 1.2 Page order (copy this rhythm, adapt to light base)
Header → Hero → About (Mission 01 / Vision 02 / Core Values 03) → Why choose us (6 numbered cards) → Services (6 numbered rows: mono tag, title, one-line promise, paragraph, 5 bullets, "Explore X →") → Our Method (6 phases "PHASE 01..06") → Featured solutions (3 cards: Benefits / Includes / "INSTEAD OF ..." line / audience chips / "See examples") → Industries (8 sticky steps "01 / 08", "Keep scrolling: eight industries, one continuous track.") → Locations (Ahmedabad, Mehsana, Visnagar) → Results & Benefits (accordion "WHAT THIS MEANS ▾") → Showcase (6 project cards, mono tag + chips + "View Website") → Studio (3 pillars + 4 count-up stats) → Insights (3 blog cards) → FAQ (9 numbered, "+" toggles) → Contact (info list + form) → Footer CTA band → Footer.

### 1.3 Header / footer / legal patterns
- **Header**: logo left; centred pill nav with items `Services ▾ · Work · About · Process · Blog · Contact`; right = green pill button "Book a Discovery Call". Active item gets a pill highlight + small underline; Services opens a mega list of the 6 services. Nexus header should be: Nexus mark left, pill nav `Why Nexus · Modules · How it works · Pricing · FAQ · Insights`, right = secondary "Sign in" + primary green "Start your restaurant".
- **Footer CTA band** (above footer): eyebrow "READY TO GROW?", headline "Describe the problem. We will name the service.", sub "You do not need to know which one you need. Tell us what the business is struggling with and we will tell you what actually fixes it, including when that is less than you expected.", buttons "Book a Discovery Call" + "Send a Message →" (WhatsApp).
- **Footer**: blurb "A digital solutions and branding partner: websites, custom software and brand systems built to help businesses grow with credibility and confidence."; 4 link columns (Company: About Us / Our Process / Our Work / Contact · Services ×6 · Resources: Blog & Insights, Company Profile · Locations: Ahmedabad / Mehsana / Visnagar); contact rows with glyph icons; socials; bottom bar: `© 2026 Manhar Creatives. All rights reserved.` · `Privacy Policy` (/privacy-policy) · `Terms & Conditions` (/terms-and-conditions) · `Sitemap` · status chip `Available for new projects`.
- Legal pattern for Nexus footer bottom bar: `© 2026 Manhar Creatives. Manhar Nexus is a product of Manhar Creatives.` · Privacy · Terms · Refund & Cancellation · Billing · Sitemap, plus chip `Onboarding new restaurants` (mono, mint wash).

### 1.4 EXACT contact + brand strings (verbatim from live site)
| Item | Value |
|---|---|
| Studio name | Manhar Creatives |
| Studio tagline (hero eyebrow, caps) | `WE DESIGN, WE BUILD, YOU GROW` |
| Tagline (studio section, sentence form) | `We Design. We Build. You Grow.` |
| Email | info@manharcreatives.com |
| Phone | +91 97145 71522 (tel:+919714571522) |
| WhatsApp | https://wa.me/919714571522 |
| Instagram | @manhar.creatives — https://www.instagram.com/manhar.creatives |
| LinkedIn | https://www.linkedin.com/company/manhar-creatives/ |
| Website | www.manharcreatives.com |
| Address | Sona Complex, A-252, Kansa Cross Road, Opp. Khodiyar Hotel, Visnagar, Mehsana, Gujarat 384315 |
| Footer location line | Visnagar, Gujarat, India |
| Service area line | Working across Gujarat and remotely across India. (Ahmedabad · Mehsana · Visnagar) |
| Form reassurance | We reply within 24 hours. Your details are never shared or sold. |
| Phone field hint | `+91 India` selector, "Digits only, e.g. 97145 71522" |
Tagline usage rules observed: caps + mono-ish tracked eyebrow under the wordmark in hero; sentence form with full stops in the studio block; never altered, never translated. Use the studio tagline only in the footer/"by Manhar Creatives" block, not as the Nexus tagline.

### 1.5 Voice and copy patterns worth borrowing
- Contrast line: `INSTEAD OF OFF-THE-SHELF SOFTWARE WITH A MONTHLY SEAT FEE` then a one-sentence payoff. For Nexus: `INSTEAD OF FIVE APPS AND A NOTEBOOK`.
- Honest admission to build trust: "including when that is less than you expected"; "If we commit to a delivery date, that date holds."
- Numbered cards `01–06`, mono tags (`WEB DEV`, `CUSTOM SOFTWARE`), `PHASE 0X` process labels, `01 / 08` step counters.
- Blog cards: mono category tag + read time ("7 min"), H3 title, one-sentence excerpt, date, "Read article". FAQ: numbered `01..09`, plain answers 2–3 sentences, no marketing fluff.
- Restaurant claims on live site (consistent with Nexus): "QR menu... built for weak connections and real kitchen conditions, with instant price updates, one-tap availability toggles, and a review capture flow."

### 1.6 What NOT to copy
Dark-only theme, old greens (the hero H1 "Creatives" and bullets use the pre-v2 green), neon glow edges, the green glass AI grade. Nexus must be light base + Ink blocks, `#1DBA3C` only.

---

## 2. PART 2 — Iconic-component research

### 2.1 Sites studied (observed unless marked)
| # | Site / URL | Observed technique (no assets copied) |
|---|---|---|
| A | Linear — https://linear.app | Inter Variable + **Berkeley Mono** captions (mono eyebrow like ours). Hero product UI is DOM-built (no canvas, no video): issue list + agent panel inside a huge rounded panel with a floor shadow and soft vignette. Two-tone headline (white + grey second sentence): "A new species of product tool. Purpose-built for...". Logo wall with tiny mono caption "POWERING THE COMPANIES BUILDING THE FUTURE". Stylesheet has 1 scroll-timeline rule + 1 perspective rule. |
| B | Stripe — https://stripe.com/in | WebGL ribbon hero (5 canvases): not for us. Reusable: live ticking counter "Global GDP running on Stripe", two-tone headline (ink + muted), logo marquee, single primary CTA "Request an invite". |
| C | Vercel — https://vercel.com (CSS only; page redirected to login) | Shared bundle uses `animation-timeline` (7 rules), 108 `position: sticky`, 30 `mask-image`, keyframes `reveal`, `card-reveal`, `chip-reveal`, `border-in`, `marching-ants`; Geist Mono labels. Confirms scroll-linked CSS + masks are production-grade without libraries. |
| D | Toast POS — https://pos.toasttab.com | Hero = full-bleed kitchen photo with large rounded bottom corners; logo marquee; **segmented toggle** (Restaurants / Retail) swapping 4 product tiles; tiles = flat orange backdrops with floating UI chips (e.g. a gradient-bordered "Toast IQ" prompt bubble over a tablet); AI demo with **tabs Sales / Menu / Labor** and 3 sample insights; numbered strip "1 Get proactive insights → 2 Let it analyze → 3 Unlock insights → 4 Take action in one click" headed "Data. Decision. Action. Impact."; a chip cloud of ~13 micro-features under "Designed for what happens mid-shift" (Offline mode, Nested modifiers...); business-type chips (Full Service, Cafe & Bakery, Hotel...); "NEW" tag cards; pricing teaser "Start for $0 / Compare Plans" with footnoted fine print; "Improvements on the old way. A vision for the new way." as the comparison tease. |
| E | Framer — https://www.framer.com | Black hero, 2-line H1, two buttons (white fill + dark ghost), then the **product demo as the hero**: an auto-typing prompt field with an animated glowing blue border inside a big rounded stage. Cookie banner is a small floating card, not a bar. |
| F | Apple iPad Pro — https://www.apple.com/ipad-pro/ | 21 sections, **17 `<video>` elements**, 9 sticky rules, 2 scroll-timeline rules: pinned sticky stages whose content is scrubbed/revealed with scroll (frames via video). We emulate the pinned-stage feel with sticky + `--p`, not video. |
| G | Manhar Creatives — own site | Section 1 above: numbered sections, sticky "01 / 08" industry track, accordion "What this means", counters, marquee. |
| H | Resy — https://resy.com | Header carries the booking selector (party / date / time) as the primary UI: a hospitality-native cue. Content was lazy and not captured. |
| — | Lightspeed, Godly | Blocked / redirected (see section 0). |

### 2.2 Cross-site pattern conclusions
1. **Product-as-hero**: the interface itself, drawn in HTML, is the hero (Linear, Framer, Toast IQ). Our faux KOS/dashboard does this.
2. **Two-tone headline**: the second clause in muted tone. We map to brand rule: headline Ink/White + ONE accent word green (Forest on light, `#1DBA3C` on Ink); muted clause `#55625B` / `#A7B2AC`.
3. **Mono captions** under logo walls/stats: matches JetBrains Mono eyebrows. We have no real customer logos: replace the logo wall with a "Built with restaurant operators in Gujarat. Pilot cohort 01 opening." strip plus module chips.
4. **Segmented toggles and tabs** drive "proof" blocks (Toast Restaurants|Retail, Sales|Menu|Labor). Use for "Restaurant | Café | Hotel | Cloud kitchen" use-cases and monthly|yearly pricing.
5. **Numbered micro-steps** ("1-2-3-4") to explain flow: use for plans → register → pay → workspace provisioned.
6. **Chip cloud of micro-features** ("Designed for what happens mid-shift") is the cheapest way to show breadth without bloated cards.
7. Scroll-driven effects are increasingly native CSS (`animation-timeline`, `view()`, sticky, `mask-image`): use native first, tiny rAF fallback.

### 2.3 Known techniques (not verified live; named for completeness)
Codrops-style 3D carousel rings and cube menus (CSS `preserve-3d` + `rotateY` + `translateZ`); Awwwards/Godly "sticky stacked cards" (sticky top offsets + scale); magnetic buttons and cursor-follow spotlights (pointer events + CSS vars); Tock/Resy-style "pick a slot" chips. All are re-implemented originally below.

### 2.4 Library decision
- **No GSAP, no Lenis, no framer-motion.** Reasons: GSAP core ≈ 25–30 kB gz + ScrollTrigger ≈ 12 kB gz; Lenis ≈ 3–4 kB but hijacks wheel scrolling (a11y, anchor/keyboard issues). Everything here needs only: `IntersectionObserver`, one 25-line `useScrollProgress` hook, CSS `animation-timeline` with fallback, `perspective/preserve-3d`, `position: sticky`. Total new JS ≈ 1.5 kB min.
- Smooth anchors: `html{scroll-behavior:smooth}` wrapped in `@media (prefers-reduced-motion:no-preference)`.

---

## 3. Shared building blocks (used by every snippet below)

```css
/* tokens (brand v2). Define once in landing.css */
:root{--ink:#0B0F0E;--night:#121A16;--night-card:#1B2620;--night-line:#2B3932;
--green:#1DBA3C;--green-bright:#35D445;--forest:#12802B;--mint:#C9F2D2;--mint-wash:#EAF9ED;
--white:#fff;--canvas:#F7F9F7;--grey:#EEF2EF;--line:#D5DDD8;--silver:#9AA5A0;
--body:#2B3631;--muted:#55625B;--ease:cubic-bezier(.2,.8,.2,1)}
@media (prefers-reduced-motion:reduce){
 *,*::before,*::after{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important;scroll-behavior:auto!important}}
```

```ts
// useScrollProgress.ts — sets --p (0..1) on an element. mode "view": 0 when element enters, 1 when it leaves.
// mode "pin": 0..1 across a tall section containing a sticky stage.  rAF-throttled, only runs while visible.
import { useEffect, useRef } from 'react';
export function useScrollProgress<T extends HTMLElement>(mode: 'view' | 'pin' | 'hero' = 'view') {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { el.style.setProperty('--p', '1'); return; }
    let raf = 0, on = false;
    const calc = () => {
      raf = 0; if (!on) return;
      const r = el.getBoundingClientRect(), vh = innerHeight;
      const p = mode === 'pin' ? -r.top / Math.max(1, r.height - vh)
              : mode === 'hero' ? scrollY / (vh * 0.6)
              : (vh - r.top) / (vh + r.height);
      el.style.setProperty('--p', Math.min(1, Math.max(0, p)).toFixed(4));
    };
    const tick = () => { if (!raf) raf = requestAnimationFrame(calc); };
    const io = new IntersectionObserver(([e]) => { on = e.isIntersecting; tick(); }, { rootMargin: '10% 0px' });
    io.observe(el); addEventListener('scroll', tick, { passive: true }); addEventListener('resize', tick);
    return () => { io.disconnect(); removeEventListener('scroll', tick); removeEventListener('resize', tick); cancelAnimationFrame(raf); };
  }, [mode]);
  return ref;
}
// useReveal: add class "in" once visible (CSS handles the rest)
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => { const el = ref.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { el.classList.add('in'); io.disconnect(); } }, { threshold: .2 });
    io.observe(el); return () => io.disconnect(); }, []);
  return ref;
}
```
```css
.reveal{opacity:0;transform:translateY(18px);transition:opacity .7s var(--ease),transform .7s var(--ease)}
.reveal.in{opacity:1;transform:none}
@media (prefers-reduced-motion:reduce){.reveal{opacity:1;transform:none}}
```
Rule: any 3D/scroll effect must (1) render a sensible static state with `--p:1` / no JS, (2) be wrapped so reduced-motion = final state, (3) use only `transform`/`opacity` (compositor-only), (4) set `will-change` only on the moving plane, (5) be non-interactive layers `pointer-events:none` + `aria-hidden="true"` when decorative.

---

## 4. Proposals

### 4.a Preloader concepts (restaurant-tied). WINNER: A "Kitchen Printer"

Shared rules: render only if not seen this session (`sessionStorage`), not under reduced motion, min 1.7 s, hard max 3.5 s, wait for `document.fonts.ready` + hero image decode, lock scroll while shown, `role="status"` with an `aria-label`, never block LCP beyond max. Geometry of the N tile = existing `TILE_PATH`, `N_PATH`, `RULE_PATH` from `Monogram.tsx`, but the tile fill `#1DBA3C` (glyph fill `#F7F9F7`).

**A. Kitchen Printer (winner)**: an Ink curtain; a Night Card printer body with a green LED; an order ticket (Soft White paper, mono text, half-moon notches like the tile) prints downward in 16 stepped frames (mechanical feel); a Forest "READY" stamp slams in; the N tile pops at the bottom; the curtain lifts upward (clip-path). Why it wins: it IS the product metaphor (KOS ticket), reuses the ticket-stub N geometry, can be built in ~60 lines of CSS, and the same ticket recurs in the hero and the sticky ticket stack, giving the page one visual motif.

```tsx
// Preloader.tsx
export function Preloader() {
  const { show, done } = usePreloader();
  if (!show) return null;
  return (
    <div className={`pl${done ? ' is-done' : ''}`} role="status" aria-label="Loading Manhar Nexus">
      <div className="pl-printer" aria-hidden="true">
        <div className="pl-body"><i className="pl-led" /></div>
        <div className="pl-chute">
          <div className="pl-ticket">
            <b>TABLE 07 · 2 COVERS</b><br/>1× PANEER TIKKA<br/>2× BUTTER NAAN<br/>1× MASALA CHAI<br/>FIRED 19:42
            <span className="pl-stamp">READY</span>
            <svg className="pl-mark" viewBox="0 0 32 32" width="40" height="40">
              <path d={TILE_PATH} fill="#1DBA3C"/><path d={N_PATH} fill="#F7F9F7"/><path d={RULE_PATH} fill="#F7F9F7" opacity=".62"/>
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
```
```css
.pl{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;background:var(--ink);
  clip-path:inset(0);transition:clip-path .8s cubic-bezier(.7,0,.2,1)}
.pl.is-done{clip-path:inset(0 0 100% 0)}                     /* curtain lifts */
.pl-printer{width:min(300px,78vw)}
.pl-body{position:relative;z-index:2;height:46px;border-radius:14px 14px 4px 4px;background:var(--night-card);border:1px solid var(--night-line)}
.pl-body::after{content:"";position:absolute;left:14px;right:14px;bottom:10px;height:6px;border-radius:3px;background:var(--ink)} /* slot */
.pl-led{position:absolute;top:14px;right:16px;width:7px;height:7px;border-radius:50%;background:var(--green);animation:pl-blink .5s steps(2) infinite}
.pl-chute{overflow:hidden;margin:-6px 14px 0;height:250px}
.pl-ticket{position:relative;padding:18px 16px 70px;background:var(--canvas);color:var(--ink);
  font:500 11px/1.9 "JetBrains Mono",ui-monospace,monospace;letter-spacing:.1em;
  transform:translateY(-100%);animation:pl-print 1.2s steps(16,end) .15s forwards;
  -webkit-mask:radial-gradient(circle 7px at 0 55%,#0000 97%,#000) left/51% 100% no-repeat,radial-gradient(circle 7px at 100% 55%,#0000 97%,#000) right/51% 100% no-repeat;
          mask:radial-gradient(circle 7px at 0 55%,#0000 97%,#000) left/51% 100% no-repeat,radial-gradient(circle 7px at 100% 55%,#0000 97%,#000) right/51% 100% no-repeat}
.pl-stamp{position:absolute;right:14px;top:92px;padding:2px 8px;border:2px solid var(--forest);color:var(--forest);border-radius:4px;
  opacity:0;transform:rotate(-8deg) scale(1.7);animation:pl-stamp .28s cubic-bezier(.2,1.4,.4,1) 1.5s forwards}
.pl-mark{position:absolute;left:50%;bottom:14px;margin-left:-20px;opacity:0;transform:scale(.6);animation:pl-pop .4s var(--ease) 1.65s forwards}
@keyframes pl-print{to{transform:translateY(0)}}
@keyframes pl-stamp{to{opacity:1;transform:rotate(-8deg) scale(1)}}
@keyframes pl-pop{to{opacity:1;transform:none}}
@keyframes pl-blink{50%{opacity:.25}}
```
```ts
export function usePreloader(minMs = 1700, maxMs = 3500) {
  const [show, setShow] = useState(() => {
    try { if (sessionStorage.getItem('nx-pl')) return false; } catch {}
    return !matchMedia('(prefers-reduced-motion: reduce)').matches;
  });
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!show) return;
    document.documentElement.style.overflow = 'hidden';
    const t0 = performance.now();
    const hero = document.querySelector<HTMLImageElement>('img[data-hero]');
    const ready = Promise.race([
      Promise.all([document.fonts.ready, hero?.decode?.().catch(() => {})]),
      new Promise(r => setTimeout(r, maxMs)),
    ]);
    ready.then(() => setTimeout(() => setDone(true), Math.max(0, minMs - (performance.now() - t0))));
    return () => { document.documentElement.style.overflow = ''; };
  }, [show]);
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => { setShow(false); document.documentElement.style.overflow = '';
      try { sessionStorage.setItem('nx-pl', '1'); } catch {} }, 850);
    return () => clearTimeout(t);
  }, [done]);
  return { show, done };
}
```

**B. "Laying the table"**: an Ink screen; a plate circle strokes itself (`stroke-dashoffset`), a fork and a knife slide in from left/right, then all collapse to the centre and morph into the N tile. Pro: elegant, no text. Con: fork/knife art must be drawn (3 SVG paths), less on-product than A.
```css
.pl-b circle{stroke:#A7B2AC;fill:none;stroke-width:1.5;stroke-dasharray:314;stroke-dashoffset:314;animation:draw .9s var(--ease) forwards}
.pl-b .fork{transform:translateX(-90px);opacity:0;animation:land .6s var(--ease) .5s forwards}
.pl-b .knife{transform:translateX(90px);opacity:0;animation:land .6s var(--ease) .6s forwards}
.pl-b .tile{transform:scale(0);animation:pop .45s cubic-bezier(.2,1.4,.4,1) 1.3s forwards}
@keyframes draw{to{stroke-dashoffset:0}} @keyframes land{to{transform:none;opacity:1}} @keyframes pop{to{transform:scale(1)}}
```

**C. "Order stamps PAID"**: a bill with line items; a counter rolls the total (`₹ 0 → ₹ 1,240`, decorative sample); a Forest "PAID" stamp lands with a tiny screen shake; the bill folds into the N tile. Pro: strongest tie to Checkout and online payment. Con: showing a price first can feel transactional before the user has any context; keep as the **form-success state** (after registration) rather than first-load.
```css
.shake{animation:shake .18s 1}
@keyframes shake{25%{transform:translate(2px,-2px)}75%{transform:translate(-2px,2px)}}
```
Pick: **A for first load**, reuse C's stamp in the registration success state.

### 4.b Hero concepts. WINNER: H1 "The Pass"

Copy placeholders only (final copy belongs to the copy agent): eyebrow mono `FOR RESTAURANTS, CAFÉS & HOTELS`; H1 `The kitchen already knows. Now the <em>floor</em> does too.` (one accent word); CTAs "Start your restaurant" (green) + "See how it runs" (ghost on Ink).

**H1 "The Pass" (winner)**: Ink block. Under the CTAs a faux dashboard/KOS plane in HTML (see section 6 mockups) sits in `perspective:1400px`, tilted `rotateX(32deg)`, with three ticket cards at `translateZ(60/120/180px)`. On scroll the plane flattens (`--p` 0→1 via `useScrollProgress('hero')`); pointer move adds a subtle +-3deg parallax. Static state (no JS / reduced motion) = flat plane.
```css
.hero{background:var(--ink);color:#fff;padding-block:clamp(96px,14vh,160px) 0;overflow:clip}
.hero-stage{perspective:1400px;perspective-origin:50% 0;margin-top:56px}
.hero-plane{--tilt:calc((1 - var(--p,1)) * 32deg);
  transform:rotateX(calc(var(--tilt) + var(--ry,0deg))) rotateY(var(--rx,0deg)) translateY(calc((1 - var(--p,1)) * 36px));
  transform-origin:50% 0;transform-style:preserve-3d;will-change:transform;
  border-radius:20px;background:var(--night);border:1px solid var(--night-line);box-shadow:0 60px 120px -50px rgba(29,186,60,.25)}
.hero-ticket{position:absolute;transform:translateZ(var(--z));width:180px;background:var(--canvas);color:var(--ink);border-radius:10px;
  padding:12px;font:500 11px/1.7 "JetBrains Mono",monospace;letter-spacing:.08em;box-shadow:0 24px 40px -18px rgba(0,0,0,.6)}
.hero-ticket:nth-child(1){--z:60px;left:6%;top:18%} .hero-ticket:nth-child(2){--z:120px;right:8%;top:8%} .hero-ticket:nth-child(3){--z:180px;right:22%;bottom:10%}
```
```ts
// pointer parallax — attach to .hero-stage
el.addEventListener('pointermove', e => { const b = el.getBoundingClientRect();
  el.style.setProperty('--rx', (((e.clientX - b.left) / b.width - .5) * 6).toFixed(2) + 'deg');
  el.style.setProperty('--ry', ((.5 - (e.clientY - b.top) / b.height) * 4).toFixed(2) + 'deg'); }, { passive: true });
```
Note: an element with `overflow:hidden` flattens `preserve-3d`; keep `overflow:clip` on the *hero section*, never on `.hero-plane`.

**H2 "Ticket Rail"**: Ink hero, headline centred; behind it a rail of 10 tickets drifting right-to-left in perspective (`rotateY(-18deg) rotateX(8deg)`), like orders on a kitchen rail. Cheap, atmospheric, but the product is not visible above the fold.
```css
.rail{perspective:900px;overflow:clip;mask-image:linear-gradient(90deg,#0000,#000 12%,#000 88%,#0000)}
.rail-track{display:flex;gap:16px;width:max-content;transform:rotateY(-18deg) rotateX(8deg);animation:rail 46s linear infinite}
@keyframes rail{to{transform:rotateY(-18deg) rotateX(8deg) translateX(-50%)}}   /* duplicate the tickets once */
@media (prefers-reduced-motion:reduce){.rail-track{animation:none}}
```
**H3 "Window Seat"**: a full-bleed golden-hour restaurant photo (images 02/08) on the right 58%, flat Ink panel on the left 42% holding the copy, a QR table-tent card (HTML) overlapping the seam with translateZ parallax. Strongest hospitality feel, weakest at showing software. NOTE: do not use an Ink->transparent scrim gradient (brand allows only two gradients); use a flat Ink panel or an Ink layer with `opacity` plus `mask-image` (mask is not a colour gradient, but flag for the reviewer).

Pick H1. Use H3's photo as a faint (opacity .18) texture at the hero's top-right, and image 01 inside the dashboard as the "venue photo" tile.

---

### 4.c Scroll-driven 3D techniques (flat images / HTML layers only)

Native-first pattern used by 1 and 2:
```css
@supports (animation-timeline: view()){ .scroll-fx{animation:var(--fx) linear both;animation-timeline:view();animation-range:var(--range,entry 5% cover 40%)} }
@supports not (animation-timeline: view()){ /* JS sets --p on the element via useScrollProgress('view') */ }
@media (prefers-reduced-motion:reduce){ .scroll-fx{animation:none!important;transform:none!important} }
```

**1. Tilted dashboard plane that flattens (section "The whole house, one screen")** (give the element both classes `dash scroll-fx`)
```css
.dash-wrap{perspective:1600px;padding-block:96px}
.dash{--fx:flatten;transform:rotateX(calc((1 - var(--p,1)) * 26deg)) scale(calc(.92 + var(--p,1) * .08));transform-origin:50% 100%;border-radius:20px;border:1px solid var(--line);background:#fff;box-shadow:0 50px 90px -40px rgba(11,15,14,.35)}
@supports (animation-timeline: view()){ .dash{transform:none} @keyframes flatten{from{transform:rotateX(26deg) scale(.92)}to{transform:none}} }
```
(Note the `@supports` block overrides the JS-driven transform so the two never fight.)

**2. Sticky stacked "ticket" cards fanning in 3D (module walkthrough: Floor, Kitchen/KOS, Menu & Sold-Out, Checkout, Reports)**
Section height = `n * 80vh`. Cards stick with growing offsets; earlier cards recede (scale + rotateX) as later ones arrive.
```css
.stack{--n:5;position:relative;padding-bottom:20vh}
.stack-card{position:sticky;top:calc(96px + var(--i) * 28px);height:min(60vh,460px);margin-bottom:24vh;background:#fff;border:1px solid var(--line);border-radius:20px;padding:32px;
  transform-origin:50% 0;transform:perspective(1200px) rotateX(calc(var(--depth,0) * -3deg)) scale(calc(1 - var(--depth,0) * .04));
  clip-path:none}   /* ticket notches via mask like .pl-ticket */
/* --depth = how many cards are stacked on top of this one. JS: for each card i, depth = clamp(activeIndex - i, 0, n) */
```
```ts
const cards = [...root.querySelectorAll<HTMLElement>('.stack-card')];
const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) active = cards.indexOf(e.target as HTMLElement);
  cards.forEach((c, i) => c.style.setProperty('--depth', String(Math.max(0, active - i)))); }), { rootMargin: '-45% 0px -50% 0px' });
cards.forEach(c => io.observe(c));
```
Static fallback (reduced motion): `--depth` stays 0, plain sticky stack, still readable.

**3. Perspective carousel ring of restaurant photos (use cases: Restaurant · Hotel dining · Café · Cloud kitchen · Bakery · Thali · Rooftop · Bar)**
```css
.ring-scene{perspective:1400px;height:clamp(320px,52vw,520px);display:grid;place-items:center}
.ring{--n:8;--w:min(46vw,260px);position:relative;width:var(--w);aspect-ratio:4/5;transform-style:preserve-3d;
  transform:translateZ(calc(var(--r) * -1)) rotateY(calc(var(--p,0) * -360deg + var(--spin,0deg)));
  --r:calc(var(--w) / 2 / tan(180deg / var(--n)) + 12px)}
.ring-item{position:absolute;inset:0;border-radius:14px;overflow:hidden;backface-visibility:hidden;
  transform:rotateY(calc(var(--i) * 360deg / var(--n))) translateZ(var(--r))}
.ring-item img{width:100%;height:100%;object-fit:cover}
@keyframes spin{to{--spin:360deg}}   /* optional idle spin: register @property --spin <angle> */
@property --spin{syntax:"<angle>";inherits:true;initial-value:0deg}
.ring.idle{animation:spin 60s linear infinite}
@media (prefers-reduced-motion:reduce){.ring{transform:none}.ring-item{position:relative;transform:none;display:inline-block}} /* becomes a plain scroll-snap row */
```
Drive `--p` with `useScrollProgress('pin')` inside a 300vh section with a sticky stage so the ring turns one full revolution while the user scrolls. `tan()` is supported in all evergreen browsers (Chrome 111+, Safari 15.4+, Firefox 108+); fallback: compute `--r` in JS (`w/2/Math.tan(Math.PI/n)`).

**4. Layered parallax "dining room" with translateZ (section about / "A restaurant is a room full of moments")**
Depth cheat: for a layer at `translateZ(z)` with `perspective:P`, set `scale((P - z)/P)` so it appears the same size but shifts more on rotate.
```css
.room{perspective:1000px;height:70vh;position:relative;overflow:clip}
.room-inner{position:absolute;inset:0;transform-style:preserve-3d;transform:rotateX(calc(var(--ry,0deg) + (1 - var(--p,1)) * 6deg)) rotateY(var(--rx,0deg))}
.layer{position:absolute;inset:-6%;background-size:cover;background-position:center}
.l-back{transform:translateZ(-300px) scale(1.3)}    /* (1000+300)/1000 = 1.3: image 16 empty restaurant prep */
.l-mid {transform:translateZ(-120px) scale(1.12)}   /* image 02 */
.l-table{transform:translateZ(60px) scale(.94);inset:auto 8% -4% 8%;height:44%} /* HTML table + QR tent card (image 10 as img) */
.l-front{transform:translateZ(200px) scale(.8);filter:blur(2px);pointer-events:none} /* plant/leaf cut-out PNG or CSS shape */
```
Reuse the same pointer script as the hero for `--rx/--ry`. On touch devices skip pointer; use scroll `--p` only (`@media (hover:none){...}`).

---

### 4.d Comparison section: "One Saturday night, two ways" (ledger vs chaos)

Concept: a sticky stage with a clock (mono, `18:00 → 00:00`). As the user scrolls six steps, the clock advances. Left column ("The old way") shows paper chaos: a slightly rotated order slip, a WhatsApp-style bubble, a crossed-out notebook line, a calculator, a missed table. Right column ("The Nexus way") shows the same moment as clean Ink tickets and a green tick. At 00:00 both columns reveal a **closing-the-day scorecard**. All numbers are labelled "ILLUSTRATIVE SCENARIO" (no fake stats). A second control, the **wiper**, lets keyboard/touch users drag a divider to compare the two worlds in one frame.

Step structure (6 steps, copy by copy agent):
`18:00 Doors open` · `19:30 The rush` · `20:15 A guest changes the order` · `21:00 Sold-Out is real` · `22:30 Bill split four ways` · `00:00 Close the day`.
```tsx
<section className="vs" ref={pin}>             {/* height: 600vh */}
  <div className="vs-stage" data-step={step}> {/* position:sticky; top:0; height:100svh */}
    <div className="vs-clock" aria-live="polite">{times[step]}</div>
    <div className="vs-col vs-old">{oldScenes[step]}</div>
    <div className="vs-col vs-new">{newScenes[step]}</div>
  </div>
  {steps.map((s,i)=><div key={i} className="vs-sentinel" data-i={i}/>)}  {/* 6 x 100vh, IO sets step */}
</section>
```
```css
.vs{height:600vh;position:relative}
.vs-stage{position:sticky;top:0;height:100svh;display:grid;grid-template-columns:1fr 1fr;gap:0;background:var(--canvas)}
.vs-old{background:var(--grey);color:var(--body)} .vs-new{background:var(--ink);color:#fff}
.vs-scene{opacity:0;transform:translateY(24px) rotate(var(--rot,0deg));transition:.6s var(--ease)}
.vs-stage[data-step="2"] .vs-scene[data-s="2"], /* ...generate for each step */ .vs-scene.is-on{opacity:1;transform:rotate(var(--rot,0deg))}
.vs-old .vs-scene{--rot:-2deg;border:1px dashed var(--silver);background:#fff;font-family:Satoshi}      /* paper slip look */
.vs-new .vs-scene{background:var(--night-card);border:1px solid var(--night-line);border-radius:12px}     /* ticket look */
.vs-clock{position:absolute;left:50%;top:24px;transform:translateX(-50%);z-index:3;padding:6px 14px;border-radius:999px;
  background:var(--ink);color:#fff;font:500 12px "JetBrains Mono",monospace;letter-spacing:.1em}
@media (max-width:760px){.vs-stage{grid-template-columns:1fr;grid-template-rows:1fr 1fr}}
```
```ts
// sentinels drive the step; IO is enough, no scroll math
const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) setStep(+((e.target as HTMLElement).dataset.i!)); }),
  { rootMargin: '-50% 0px -50% 0px' });
```
**Wiper (accessible alternative / second view)**
```tsx
<div className="wipe" style={{ '--x': x + '%' } as any}>
  <div className="wipe-old">…old way panel…</div>
  <div className="wipe-new">…Nexus panel…</div>
  <input type="range" min={0} max={100} value={x} onChange={e => setX(+e.target.value)} aria-label="Compare the old way with the Nexus way" />
</div>
```
```css
.wipe{position:relative;overflow:hidden;border-radius:20px;border:1px solid var(--line)}
.wipe-new{position:absolute;inset:0;clip-path:inset(0 0 0 var(--x))}
.wipe input{position:absolute;inset:auto 0 12px;width:calc(100% - 24px);margin-inline:12px;accent-color:var(--green)}
.wipe::after{content:"";position:absolute;top:0;bottom:0;left:var(--x);width:2px;background:var(--green);pointer-events:none}
```
**Scorecard (end state)**: a ledger-styled table (mono columns) with rows `Order reaches kitchen`, `Menu change reaches every screen`, `Stock-outs found`, `End-of-day numbers`, columns `Old way` (Silver text, struck lines) vs `Nexus` (Forest ticks). Only qualitative claims that exist in the spec; label the block `ILLUSTRATIVE, YOUR NUMBERS WILL DIFFER`.

---

### 4.e Other iconic-component patterns

**Pricing (INR, GST extra)**: 3 plan cards + an "enterprise / chain" row. Monthly | Yearly segmented toggle (sliding pill, `aria-pressed`), yearly shows "2 months free" Mint Wash tag. Middle plan = Ink card with 1px green top edge ("Most restaurants start here"). Below: a feature scorecard table (sticky first column on mobile), and a flow strip "1 Pick plan → 2 Register → 3 Pay via Cashfree → 4 Workspace provisioned" with the integration point marked. Fine print: "Prices exclude 18% GST. Billed by Manhar Creatives."
```css
.seg{display:inline-grid;grid-auto-flow:column;gap:0;padding:4px;border:1px solid var(--line);border-radius:999px;background:#fff;position:relative}
.seg button{position:relative;z-index:1;padding:8px 18px;border-radius:999px;font:700 14px Satoshi}
.seg::before{content:"";position:absolute;inset:4px auto 4px 4px;width:calc(50% - 4px);border-radius:999px;background:var(--green);transition:transform .35s var(--ease)}
.seg[data-v="yearly"]::before{transform:translateX(100%)}
```
**FAQ**: native `<details>` with animated height using `grid-template-rows` (no JS), numbered mono `01..`, "+" rotates to "×".
```css
.faq details>.a{display:grid;grid-template-rows:0fr;transition:grid-template-rows .35s var(--ease)}
.faq details[open]>.a{grid-template-rows:1fr} .faq .a>div{overflow:hidden}
.faq summary{list-style:none;cursor:pointer} .faq summary::-webkit-details-marker{display:none}
.faq summary::after{content:"+";transition:transform .3s} .faq details[open] summary::after{transform:rotate(45deg)}
```
(`details` content is not animatable from `display:none` in all browsers; if the closing animation is required, add `interpolate-size`/JS later. Opening animation works in Chrome 131+ via `::details-content`; elsewhere it simply snaps, which is acceptable.)
**Blog cards**: first card spans 2 columns (image 3:2, mono tag + date), others stack; hover = image `scale(1.04)` inside `overflow:hidden`, title underline draws left-to-right; read-time chip in mono. Cards link to real article routes only (no dead links).

### 4.f Micro-interactions list (all reduced-motion safe)
1. **Magnetic primary button**: translate toward cursor <= 6 px within 60 px radius; spring back (skip on `hover:none`).
2. **Cursor spotlight on cards**: `--mx/--my` set on pointermove; `background:radial-gradient(240px circle at var(--mx) var(--my), rgba(29,186,60,.10), transparent 60%)`. (Radial glow is an effect on a card, not a page gradient; flag to reviewer.)
3. **Ticket perforation hover**: card top edge shows a dashed line + notch circles that "tear" 2 px on hover.
4. **Arrow nudge**: `→` moves 3 px on button hover.
5. **Underline draw** on links: `background:linear-gradient(currentColor,currentColor) 0 100%/0 1px no-repeat` → `100%` on hover.
6. **Count-up numbers** (JetBrains Mono, tabular-nums) when 40% visible, once.
7. **Line-by-line headline reveal** (`clip-path:inset(0 0 100% 0)` → `inset(0)`), staggered 60 ms, capped at 3 lines.
8. **Scroll-spy nav** with sliding green dot under the active pill; header gains a Line border after 8 px scroll.
9. **Scroll progress hairline** at top (2 px `#1DBA3C`) via `animation-timeline: scroll()` (fallback: none).
10. **Marquee of module chips** with pause on hover/focus and `prefers-reduced-motion` stop.
11. **Mobile sticky CTA** bar "Start your restaurant" appearing after the hero; hides on form focus.
12. **Form success**: stamp "REGISTERED" (reuse preloader stamp) + `check-pop` tick; fields get a gentle `field-shake` only on invalid (same names as Manhar's site).
13. **Pricing toggle**: numbers roll (translateY digit strip, 250 ms).
14. **Toast-style tab insight demo** (Sales / Menu / Labor analogue → "Floor / Kitchen / Books"): tab switch cross-fades a faux panel; auto-advances every 6 s, pauses on hover/focus.
15. **WhatsApp FAB** (bottom-right, like Manhar's) opening `https://wa.me/919714571522?text=...` with a prefilled "I want to know about Manhar Nexus" (query string only contains a fixed greeting, no user data).
```ts
// magnetic button (tiny)
btn.addEventListener('pointermove', e => { const b = btn.getBoundingClientRect();
  const x = (e.clientX - (b.left + b.width / 2)) * .18, y = (e.clientY - (b.top + b.height / 2)) * .18;
  btn.style.transform = `translate(${x}px,${y}px)`; });
btn.addEventListener('pointerleave', () => (btn.style.transform = ''));
```

---

## 5. PART 3 — Image art-direction plan (ChatGPT Desktop image generation)

### 5.1 Global rules
- **Prepend this STYLE BLOCK to every prompt** (keeps the set coherent):
  `Photorealistic editorial photograph, 35mm lens, shallow depth of field, warm natural light, soft film-like grade, deep near-black shadows (#0B0F0E ink tone), a restrained touch of fresh leaf-green (#1DBA3C) only in small props such as herbs, a plant, a napkin or a menu board edge, muted warm highlights, premium hospitality mood, India-relevant where stated. ABSOLUTELY NO text, letters, numbers, logos, signage text, brand names, QR codes, watermarks or readable screens anywhere. No close-up faces: people only as silhouettes, backs, hands or small figures far from the camera. Clean uncluttered negative space where stated. No cartoon, no illustration, no 3D render look.`
- ChatGPT outputs ~1536x1024 (3:2), 1024x1536 (2:3) or 1024x1024 (1:1). For 16:9 generate 3:2 and crop; for 4:5 generate 2:3 and crop. Always ask: "keep the main subject inside the central 70% so it survives cropping".
- Save as `apps/web/public/landing/<filename>.webp` at q78: export two widths (1600w + 800w, suffix `-800`), `width/height` attributes set in markup, `loading="lazy"` except `hero-pass-evening` (`fetchpriority="high"`, `data-hero`). Budget: hero <= 140 kB, others <= 90 kB, total landing images <= 1.6 MB.
- Alt text: describe the scene in plain words (no "image of"). Decorative layers: `alt=""`.
- Never generate text into images: QR codes, ticket text, menu text, dashboards, phone screens are all drawn in HTML/CSS (section 6).
- Universal fallback if a generation fails twice: keep the same filename and `aspect-ratio` box, fill it with a flat `#121A16` panel (no gradient) plus a Mint Wash lucide-react icon tile, so layout never shifts. Re-prompt tip: shorten to subject + light + composition and drop adjectives.

### 5.2 The set (18 images)
Columns: file · ratio (final crop) · used in · prompt · fallback.

| # | File (webp) | Ratio | Section |
|---|---|---|---|
| 01 | hero-pass-evening | 16:9 | Hero background texture + dashboard "venue" tile |
| 02 | restaurant-dining-golden-hour | 3:2 | About / room parallax mid layer / ring |
| 03 | boutique-hotel-dining | 3:2 | Use cases (Hotel dining), ring |
| 04 | specialty-cafe-counter | 4:5 | Use cases (Café), ring |
| 05 | cloud-kitchen-line | 3:2 | Use cases (Cloud kitchen), KOS feature |
| 06 | bakery-morning-display | 4:5 | Use cases (Bakery), ring |
| 07 | indian-thali-overhead | 1:1 | Use cases (Thali restaurant), Menu feature, ring |
| 08 | rooftop-restaurant-dusk | 16:9 | Enquiry/CTA banner background, ring |
| 09 | kitchen-pass-ticket-rail | 3:2 | KOS module feature |
| 10 | qr-table-tent-blank | 4:5 | QR ordering module + room table layer |
| 11 | owner-tablet-reports | 3:2 | Reports / "Business Workspace" section |
| 12 | table-setting-topdown | 1:1 | Preloader-adjacent brand moment, Floor/Tables module |
| 13 | quick-service-counter | 3:2 | Use cases (Quick service / chai & snacks) |
| 14 | bar-pour-evening | 4:5 | Use cases (Bar & lounge), ring |
| 15 | chef-hands-plating | 3:2 | Why Nexus / kitchen story |
| 16 | restaurant-before-service | 3:2 | Room parallax back layer, comparison 18:00 |
| 17 | storeroom-crates-morning | 1:1 | Inventory / stock module |
| 18 | closing-counter-lamp | 3:2 | Comparison 00:00 scene, blog fallback cover |

**Prompts (after the STYLE BLOCK) and fallbacks**

01 `hero-pass-evening` — "A busy Indian restaurant kitchen pass seen from the dining-room side at evening service: a stainless steel pass shelf, plated dishes under warm heat lamps, a row of blank paper order tickets hanging on a rail, chefs only as blurred backs far behind. Camera low, wide. Leave the left 40% of the frame dark and calm for headline overlay." Fallback: use 09 darkened (Ink overlay at 70% opacity) or flat `#121A16`.

02 `restaurant-dining-golden-hour` — "A warm contemporary Indian restaurant interior at golden hour, long window light across wooden tables with empty white plates and green herb pots, soft blurred guests far away as silhouettes. Leave the top-right empty for overlay text." Fallback: 16 or 03.

03 `boutique-hotel-dining` — "An elegant boutique hotel restaurant, breakfast service just beginning, linen-covered tables, a brass pendant light, a green potted palm, morning sun through tall windows, nobody in focus. Composition leaves the lower third clean." Fallback: 02 re-crop.

04 `specialty-cafe-counter` — "A specialty coffee café counter in India, matte espresso machine, pour-over set, a blank wooden menu board without any writing, ceramic cups, a hanging green plant, warm side light. Negative space left side." Fallback: 06 re-crop.

05 `cloud-kitchen-line` — "A tidy cloud kitchen: stainless prep line, rows of sealed takeaway containers in plain unmarked kraft bags, an empty dispatch shelf, cool overhead light mixed with a warm glow, one cook seen only from behind far away. Leave the right third empty." Fallback: 09.

06 `bakery-morning-display` — "A neighbourhood bakery at 7am, a glass display with croissants, buns and a loaf of brown bread, flour dust in a shaft of sunlight, wooden shelves, no labels or price tags visible. Warm tones, clean upper area." Fallback: 04.

07 `indian-thali-overhead` — "Top-down photograph of a stainless steel Gujarati thali on a dark slate table: small bowls of dal, kadhi, two sabzis, rotli, farsan, rice, pickle and a green chutney, soft window light, a folded plain green cloth napkin. Centre-weighted with dark empty corners." Fallback: 12.

08 `rooftop-restaurant-dusk` — "A rooftop restaurant in an Indian city at blue-hour dusk, string lights, a few set tables with candles, skyline blurred, nobody in the frame. Wide cinematic, dark lower area for text." Fallback: 02 darkened.

09 `kitchen-pass-ticket-rail` — "Close detail of a kitchen order rail above a steel pass: several blank white paper tickets clipped in a row, warm heat-lamp glow, blurred plated dishes below. Shallow depth of field, tickets sharp, no writing on them." Fallback: build the ticket rail in HTML (hero-ticket component) on flat `#121A16`.

10 `qr-table-tent-blank` — "A small free-standing blank white card table tent on a wooden restaurant table, nothing printed on it, a water glass and a sprig of basil beside it, warm blurred dining room behind. Leave the tent face completely empty (the QR is added in HTML)." Fallback: pure HTML tent card (CSS only).

11 `owner-tablet-reports` — "A restaurant owner seen from behind and slightly above the shoulder, sitting at a corner table after lunch service with a tablet whose screen is angled away from the camera and dark, a cup of chai, warm daylight. No face visible. Leave the left half calm." Fallback: tablet mockup in HTML over 02 blurred.

12 `table-setting-topdown` — "Top-down view of a perfectly set restaurant table: white plate, steel cutlery, linen napkin, small green plant sprig, dark wooden surface, soft side light, symmetrical, lots of empty dark space around." Fallback: SVG plate + cutlery from preloader B.

13 `quick-service-counter` — "An Indian quick-service snack and chai counter at evening, steel kettle, a tray of samosas, paper cups, warm bulbs, a blank chalkboard menu without writing, a single customer only as a hand reaching with a coin purse, no faces. Leave the top clean." Fallback: 04.

14 `bar-pour-evening` — "A craft bar counter at night, a bartender's hands pouring a drink into a coupe glass, bottles blurred behind with no labels visible, amber bokeh, one small green garnish. Hands only." Fallback: 08.

15 `chef-hands-plating` — "A chef's hands (gloved or bare, no face, no arms above the elbow beyond frame) placing a final green herb leaf on a plated curry dish on a steel pass, steam in warm light, background dark." Fallback: 07.

16 `restaurant-before-service` — "An empty restaurant at 5pm before opening, chairs on tables being set, low golden light through windows, a green plant in the corner, no people. Wide, symmetrical, calm." Fallback: 02.

17 `storeroom-crates-morning` — "A restaurant storeroom at morning: wooden and steel crates of onions, tomatoes, green chillies and herbs on shelves, neat and organised, soft cool window light, no packaging text visible." Fallback: flat panel + lucide `Boxes` icon tile.

18 `closing-counter-lamp` — "A restaurant billing counter after closing, one warm lamp on, a closed laptop, a cup of tea, folded chairs in soft darkness behind, quiet and calm, no people, no screens lit. Dark with warm highlights." Fallback: 16 darkened.

### 5.3 Ring carousel set
Use 02, 03, 04, 05, 06, 07, 08, 14 (all `object-fit:cover`, 4:5 crop). If fewer than 8 succeed, set `--n` to the number available (min 6) and the maths in 4.c-3 adapts automatically.

---

## 6. Device mockups: build in HTML/CSS (preferred), not images

Reason: crisp at every DPR, on-brand colours, theme-able, tiny, searchable text, no AI-redrawn gibberish. Only show features that exist in the spec/glossary (KOS, Service Request, Checkout, Sold-Out, Business Workspace); mark anything roadmap as "coming soon". All text inside is real HTML but the whole mockup is `aria-hidden="true"` with a nearby visible caption, and fake data is plain-language samples (no real names).

| Mockup | Used in | Structure |
|---|---|---|
| M1 KOS tablet (landscape) | Hero plane, KOS module | Ink bezel 14 px radius 22; 3 columns "New / Preparing / Ready" (mono headers); 4 ticket cards (Soft White, notched, mono, timer chip `04:12`); one card has a Forest tick. |
| M2 Owner dashboard (laptop) | Reports / Business Workspace, dashboard plane (4.c-1) | Night Panel sidebar (5 icons), top bar, 3 KPI cards (Soft White), a bar chart using only `#1DBA3C / #0B0F0E / #9AA5A0`, a table of recent Checkouts. |
| M3 Guest phone | QR ordering module | 9:19 rounded frame; menu list with veg/non-veg dots, Sold-Out item greyed with a Silver "Sold out" tag, sticky "Call a waiter" (Service Request) button in green. |
| M4 Checkout tablet | Checkout/billing module | Order lines, GST 5% line item, split-bill chips, big green "Settle" button; Forest "PAID" stamp rotates in when the section enters view. |

Reusable device frame (CSS only):
```css
.dev{position:relative;background:var(--ink);border-radius:26px;padding:12px;box-shadow:0 40px 80px -40px rgba(11,15,14,.55)}
.dev::before{content:"";position:absolute;top:6px;left:50%;width:6px;height:6px;margin-left:-3px;border-radius:50%;background:var(--night-line)} /* camera */
.dev-screen{border-radius:16px;overflow:hidden;background:var(--canvas);aspect-ratio:16/10;display:grid}
.dev--phone{border-radius:36px;padding:10px;width:min(260px,70vw)} .dev--phone .dev-screen{aspect-ratio:9/19;border-radius:28px}
.dev-glare{position:absolute;inset:12px;border-radius:16px;pointer-events:none;
  background:linear-gradient(115deg,rgba(255,255,255,.10),transparent 38%)}    /* white-alpha sheen, not a brand colour gradient; drop if reviewer objects */
.tk{background:#fff;border:1px solid var(--line);border-radius:10px;padding:10px 12px;font:500 11px/1.6 "JetBrains Mono",monospace;letter-spacing:.06em;text-transform:uppercase;color:var(--ink)}
.tk-timer{float:right;padding:0 6px;border-radius:999px;background:var(--mint-wash);border:1px solid var(--mint);color:#106021}
.bar{background:var(--green);border-radius:4px 4px 0 0} .bar.alt{background:var(--ink)} .bar.ghost{background:var(--silver)}
```
Optional 4th "photo mockup": place M1 on top of image 09 with `mix-blend-mode:normal`, shadow only; never composite UI into the AI photo.

---

## 7. Implementation handoff notes (for the build agents)

1. **File layout suggestion**: `apps/web/src/landing/{Preloader.tsx,Hero.tsx,hooks/useScrollProgress.ts,mockups/*.tsx,sections/*.tsx}` and one `landing.css` imported only by the landing route (tokens in section 3). Do not touch `styles.css` (old greens).
2. **Fonts**: JetBrains Mono 500 via `@fontsource/jetbrains-mono/500.css` (self-hosted); preload Clash 600/700 + Satoshi 400/500/700 woff2 for the hero only; `font-display:swap`.
3. **Perf budget**: landing JS (excluding React/router) <= 12 kB gz; no layout shift (`aspect-ratio` on every media box); LCP element = hero H1 (not an image); 3D planes `contain:layout paint` where they do not overflow.
4. **Mobile (375)**: drop pointer parallax; ring carousel becomes `scroll-snap-type:x mandatory` row; sticky stack keeps sticky but `top:72px` and card height auto; comparison stacks vertically with the clock pinned; preloader unchanged (it scales via `min()` widths).
5. **A11y**: preloader `role="status"`; all decorative 3D `aria-hidden`; wiper is a real `<input type="range">`; toggle is `button[aria-pressed]`; FAQ uses `<details>`; focus-visible ring = 2 px `#12802B` offset 2 px (Forest on light) / `#1DBA3C` on Ink; no motion-only meaning (every animated scene has a text equivalent).
6. **Brand checks to repeat in QA**: no `#22C55E #16A34A #4ADE80`, no `#000`, green button text Ink, green text on light = Forest, one accent word per H1/H2, no gradient except the two allowed ones (flagged exceptions: Ink-to-transparent masks used as `mask-image`, white-alpha glare, cursor spotlight; reviewer decides, safe fallback = remove them).
7. **Payment honesty**: in the pricing flow strip, mark step 3 as `data-integration="cashfree-subscription"` with a visible "Secure online payment via Cashfree (coming online at launch)" hint; the stamp "PAID" animation appears only in the *demo* mockup M4 and the registration-success state, never as a claim that payment succeeded unless the API says so.
8. **Open questions for the owner**: (a) is the product public name "Manhar Nexus" or "Nexus by Manhar Creatives"; (b) should the page show the Manhar Creatives logo (only a low-res extract exists) in header or only in the footer "by" block; (c) approve the flagged gradient/mask exceptions in item 6.

## 8. Source list
- Manhar Creatives (home + sitemap): https://www.manharcreatives.com , https://www.manharcreatives.com/sitemap.xml
- Linear: https://linear.app
- Stripe (India home): https://stripe.com/in
- Vercel (CSS-only inspection, redirected to login): https://vercel.com
- Toast POS: https://pos.toasttab.com
- Framer: https://www.framer.com
- Apple iPad Pro: https://www.apple.com/ipad-pro/
- Resy (header only): https://resy.com
- Blocked / unusable: https://www.lightspeedhq.com/pos/restaurant/ (Cloudflare check), https://godly.website (redirect to recent.design)
- Repo references: `apps/web/src/brand/Monogram.tsx` (TILE_PATH / N_PATH / RULE_PATH), `docs/landing/00_BRIEF.md`.
