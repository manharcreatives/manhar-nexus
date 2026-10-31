# 05 - FOUNDATION report (Manhar Nexus landing)

Agent: FOUNDATION. Status: skeleton complete and green (`bash $HOME/lp-verify.sh` = tsc OK, eslint OK, vitest 255/255, vite build OK).
Everything below is in `D:\manhar-nexus` (device VM: `$HOME/mnt/manhar-nexus`). Nothing was committed.

## 1. How to run verify (all agents)

```
AGENT=<name> bash $HOME/lp-verify.sh quick     # rsync + tsc --noEmit + eslint            (~25 s)
AGENT=<name> bash $HOME/lp-verify.sh           # quick + vitest run + vite build + chunk table (~60 s)
bash $HOME/lp-verify.sh status                 # npm install state + log tail
bash $HOME/lp-verify.sh install                # force re-install (only after a lockfile/package.json change)
bash $HOME/lp-verify.sh sync                   # rsync only
```
- rsync repo -> `$HOME/lpbuild` (excludes .git, node_modules, dist, .lp-tmp). `npm ci --ignore-scripts -w @nexus/web -w @nexus/shared --include-workspace-root` runs ONLY when the hash of package-lock + all package.json changed; it runs in the background (nohup, log `$HOME/lp-npm.log`) and the script waits up to 140 s (`LP_WAIT`), else exits 3 ("run again"). Install takes ~1 min the first time; it is already done.
- Runs are serialised with `flock` on `$HOME/lp-verify.lock` (up to 120 s wait) because all agents share `$HOME/lpbuild`. Build output goes to `$HOME/lpdist-$AGENT`. Vitest full log: `$HOME/lp-vitest-$AGENT.log`.
- ESLint targets: `apps/web/src/landing`, `App.tsx`, `App.test.tsx`, `auth/sessionHint.test.tsx` (root `eslint.config.mjs`).
- The full run fails loudly if: tsc/eslint/vitest/vite fail, entry JS > 250 kB gzip, or `.lp-root` CSS leaks into the entry stylesheet (= a static import of landing code).
- No headless browser is available in the VM (playwright download is blocked), so NOTHING has been checked visually in a real browser. QA must open the build (`vite preview` on the Windows side) and look.

## 2. Baseline numbers
| | Before (untouched repo) | After FOUNDATION |
|---|---|---|
| Tests (apps/web) | 195 passed | 255 passed (includes the content agent's tests and my 60) |
| Entry JS | 671.75 kB raw / 195.76 kB gz (191.2 KiB) | 674.52 kB raw / 197.01 kB gz (192.4 KiB), budget 250 |
| Entry CSS | 79.16 kB / 14.76 kB gz | 79.77 kB / 14.85 kB gz |
| Landing chunk | n/a | `LandingApp-*.js` 24.4 kB raw / 7.3 kB gz (+ `LandingApp-*.css` 24.0 kB / 5.7 kB gz) with all stubs |
Entry grew ~1.1 kB gz (router `Navigate`/`useLocation`, `paths.ts`, the lazy wrapper). The landing is NOT in the entry (checked by the script).

## 3. Files created / edited
Edited (existing): `apps/web/src/App.tsx`, `App.test.tsx`, `auth/sessionHint.test.tsx`, `apps/web/index.html`, `apps/web/public/robots.txt`, `deploy/Caddyfile`.
Created outside src/landing: `apps/web/public/sitemap.xml`, `public/fonts/jetbrains-mono-500.woff2` (+ `jetbrains-mono-OFL.txt`), `public/landing/brand/manhar-creatives-on-ink.jpg` (copy of docs/landing/brand/...), `$HOME/lp-verify.sh`.
Created in `apps/web/src/landing/`:
- `paths.ts` (+ `paths.test.ts`), `site.ts`, `LandingApp.tsx`, `LandingPage.tsx`, `routes.tsx`, `landing.css` (726 lines), `styles/chrome.css`, `styles/preloader.css`
- `hooks/`: `useReducedMotion.ts, useScrollProgress.ts, useInView.ts (useInView+useReveal), useTilt.ts, useDocumentMeta.ts (+useJsonLd), useRegistrationIntent.ts, useFocusTrap.ts, useScrollLock.ts, index.ts`
- `components/`: `Container, Section, Eyebrow, Heading (AccentWord, Heading, SectionHeader), Button (Button, SectionButton), Tag, Reveal, NexusMark (NexusMark, NexusLockup), ImageSlot, Icon (Icon, IconTile), SectionLink, Header, MobileMenu, Footer, PolicyLayout, cx.ts, index.ts` (barrel: `import { Section, Button, ... } from '../components'`)
- `sections/`: `Preloader.tsx` (real) + 13 stubs: `Hero, Intro, About, Compare, Platform, HowItWorks, BuiltFor, Trust, Pricing, Register, Faq, Insights, CtaBanner`
- tests: `foundation.test.tsx`, `routing.test.tsx`, `paths.test.ts`

## 4. Routing behaviour (App.tsx `Gate`)
| State | Path | Result |
|---|---|---|
| loading, no session hint, public path | `/`, policy, article | Landing immediately (no "Loading..." flash) |
| loading, otherwise | any | "Loading..." as before |
| signed out | `/`, policy routes, `/insights/:slug` (+ `/blog/:slug` and legacy aliases) | Landing (`LandingApp`, lazy) |
| signed out | `/login` and ANY other path (`/bills`...) | `LoginScreen` (return-to-view preserved) |
| signed in | `/login` | `<Navigate to="/" replace />` |
| signed in | policy / article path | Landing shell (public documents), NOT the in-app 404 |
| signed in | everything else | unchanged (PasswordGate / AppShell) |
| just signed out / session expired while on `/` | `/` | `<Navigate to="/login" replace />` (deviation, see section 10) |
`isPublicPath(pathname)` lives in `src/landing/paths.ts` (no imports, safe for the entry bundle) and also exports `POLICY_ROUTES`, `PATH_ALIASES`, `normalizePath`, `isHomePath`, `isContentPath`.
Existing tests fixed: `App.test.tsx` (2 tests now push `/login`), `sessionHint.test.tsx` (2 tests push `/login`). New tests: `/` shows the website (one h1, banner, contentinfo, skip link, `data-surface=landing`), `/terms` shows the policy page, `/bills` still shows sign-in, isPublicPath unit tests, signed-in `/login` redirect, signed-in `/privacy` shows website.

## 5. Component API (src/landing/components) - exact
All are named exports; import from `'../components'` (sections) or `'../components/Button'`. `Link`-based pieces (`Button to=`, `SectionLink`, Header, Footer, MobileMenu, PolicyLayout) need a Router ancestor (App has BrowserRouter; in unit tests wrap in `<MemoryRouter>`).

```tsx
<Section id="pricing" tone="canvas|light|alt|ink|night" labelledBy="pricing-title"
         pad="default|tight|none" bleed={false} size="default|narrow|wide" className="...">children</Section>
```
Renders `<section id aria-labelledby class="lp-section lp-section--{tone} [lp-on-dark for ink/night]">` and wraps children in `<Container>` unless `bleed` (use `bleed` + `pad="none"` for pinned/sticky stages, then add your own `.lp-container` inside). Tones: canvas = Soft White (default), light = White, alt = Light Grey, ink = Ink, night = Night Panel (#121A16). `className="lp-edge-green"` adds the 1px #1DBA3C top edge (CtaBanner stub already uses it).

```tsx
<Container size="default|narrow|wide" as="div">   // 1200 / 760 / 1360 + fluid gutter
<Eyebrow>FOR RESTAURANTS, CAFES & HOTELS</Eyebrow> // <p class="lp-eyebrow">, JetBrains Mono, auto colour per surface
<Heading level={2} size="h2" id="x">Title with <AccentWord>one</AccentWord> word</Heading>  // level 1-4, size h1|h2|h3 (default by level)
<AccentWord>word</AccentWord>   // Forest on light, #1DBA3C on dark (CSS by ancestor .lp-on-dark). ONE per headline.
<SectionHeader eyebrow="..." title={<>... <AccentWord>x</AccentWord></>} titleId="x-title" lede="..." level={2} align="left|center" />
<Button href="#register" variant="primary|secondary|ghost" tone="light|dark" size="sm|md|lg" arrow block external>Label</Button>   // <a>
<Button to="/login" variant="secondary">Sign in</Button>                                                                      // router <Link>
<Button onClick={fn}>Label</Button>                                                                                          // <button type=button>
<SectionButton section="register" arrow>Register</SectionButton>   // same look, works from policy pages too (#id vs /#id)
<SectionLink to="pricing" className="...">Pricing</SectionLink>    // `to` may carry params: "register?begin=demo"
<Tag tone="mint|dark|outline">Coming soon</Tag>
<Reveal as="div" delay={120} effect="up|fade|scale" className="...">...</Reveal>   // fade/slide in once
<NexusMark size={32} title="Manhar Nexus" tile="#1DBA3C" glyph="#0B0F0E" />        // decorative unless `title`
<NexusLockup tone="light|dark" size={32} />
<ImageSlot src="/landing/hero-pass.webp" alt="..." width={1600} height={900}
           priority decorative fit="cover|contain" position="50% 30%" fallback="ink|grey" fallbackLabel="..."
           sources={[{type:'image/avif',srcSet:'...'}]} srcSet sizes className imgClassName />
<Icon icon={Utensils} size={20} title="optional a11y name" />     // lucide-react component, decorative by default
<IconTile icon={Utensils} />                                        // #1DBA3C rounded tile, Ink glyph
<PolicyLayout eyebrow="LEGAL" title="Terms & Conditions" meta="Last updated ..." lede="..." back={{to:'/',label:'...'}}>...prose HTML...</PolicyLayout>
```
Notes:
- Button: secondary/ghost on a dark surface flip automatically inside any `.lp-on-dark` ancestor (all `ink`/`night` Sections); `tone="dark"` forces it. Primary = Manhar Green + Ink text, hover #35D445. `<Button>` with `href` is a plain `<a>`: use it for `#id` ONLY on the home page; use `SectionButton`/`SectionLink` in anything shared with policy pages.
- ImageSlot: renders a `span.lp-img` that reserves `aspect-ratio: width/height` (no CLS) containing `<picture><img loading=lazy decoding=async>`; on `error` it swaps to a dashed fallback box (Ink or Light Grey) with the file name in mono and keeps `role=img` + alt. `priority` = eager + `fetchpriority="high"` (lowercase attr; React 18 safe) for the hero image only. Size the wrapper via `className` (e.g. `style` width/radius); the image fills it.
- PolicyLayout renders Header + `<main id="main">` + Footer, so policy/article pages need nothing else. Children styled by `.lp-prose` (h2/h3/p/ul/ol/table/blockquote/a/code/hr).
- Header: sticky white, `NAV_ITEMS` (Platform, Why Nexus, How it works, Pricing, Insights, FAQ) with `aria-current="location"` scroll-spy on the home page, "Sign in" -> `/login`, primary "Register your restaurant" -> `#register`, mobile menu = dialog panel with focus trap, Escape, scroll lock, auto-close on route change/desktop width. Header/Footer are rendered by `LandingPage` and `PolicyLayout`; section agents never render them.

## 6. Hooks API (src/landing/hooks, barrel `index.ts`)
```ts
useReducedMotion(): boolean                 // live matchMedia; false in jsdom
prefersReducedMotion(): boolean             // non-hook read
isCoarsePointer(): boolean                  // (hover: none) -> skip pointer parallax/tilt
useScrollProgress<T>(mode: 'view'|'pin'|'hero' = 'view', prop = '--p'): RefObject<T>
   // writes 0..1 into CSS var --p on the element. Reduced motion / no IntersectionObserver => sets '1' once (final state).
useInView<T>({threshold=.2, rootMargin='0px 0px -8% 0px', once=true}): [ref, inView]   // inView = true immediately without IO (jsdom)
useReveal<T>(opts): ref                      // adds class `is-in` imperatively; pair with .lp-reveal
useTilt<T>(maxDeg = 8): ref                  // sets --lp-rx/--lp-ry on pointermove; use with class .lp-tilt; off for touch/reduced motion
useDocumentMeta({ title, description, path='/', ogTitle?, ogDescription?, ogImage?, robots?, ogType? })
   // sets title/description/canonical/og:*/twitter:*, restores previous values on unmount. canonical = SITE.origin + path
useJsonLd(id: string, data: object | null)  // <script type=application/ld+json data-lp-ld=id> in <head> while mounted (FAQ agent: useJsonLd('faq', faqPageJsonLd))
useRegistrationIntent(): { plan, cycle, begin, choosePlan(plan, cycle?), setCycle(c), setBegin(b) }
   // plan: 'counter'|'floor'|'pass'|'many-doors'|'not-sure' (default 'not-sure'), cycle: 'monthly'|'yearly' (default 'yearly'), begin: 'register'|'demo'
getRegistrationIntent(), setRegistrationIntent(patch), resetRegistrationIntent(), applyIntentFromHash('#register?plan=floor&cycle=monthly&begin=demo')
useFocusTrap(containerRef, active, onEscape?), useScrollLock(active)
```
Pricing usage: `<Button href="#register" onClick={() => choosePlan('floor', cycle)}>Choose Floor</Button>`; Register reads `const { plan, cycle, begin } = useRegistrationIntent()`. `LandingApp` calls `applyIntentFromHash` on every hash navigation, so links like `#register?plan=pass&cycle=yearly` also work (the router-level scroll strips the `?...` part).
jsdom has NO `matchMedia` and NO `IntersectionObserver`: all hooks guard for this; do the same in section code (use the hooks, not raw globals).

## 7. CSS catalogue (landing.css + styles/chrome.css + styles/preloader.css)
Tokens on `.lp-root` (all `--lp-*`): `green #1DBA3C, green-bright #35D445, forest #12802B, deep #106021, glow #69F361, mint #C9F2D2, mint-wash #EAF9ED, white, canvas #F7F9F7, grey #EEF2EF, mist #E3E9E5, line #D5DDD8, silver #9AA5A0, ink #0B0F0E, night #121A16, night-card #1B2620, night-line #2B3932, text, body #2B3631, muted #55625B, on-dark #FFF, on-dark-soft #A7B2AC, on-dark-muted #8A9690, success/warning/error/info`, fonts `--lp-font-display/body/mono`, type `--lp-fs-h1/h2/h3/lede` (H1 64 / H2 40 / H3 24 desktop, `clamp()` below), layout `--lp-gutter --lp-max --lp-max-narrow --lp-max-wide --lp-header-h (64px, 72px >=1024) --lp-section-y`, shape `--lp-radius-sm/radius/radius-lg/radius-xl --lp-shadow-card --lp-shadow-lift`, motion `--lp-ease --lp-ease-stamp`. The brand-guide section 09 names (`--color-primary`, `--bg`, `--dark-bg`, ...) are also defined as aliases inside `.lp-root`.
Classes: `.lp-root, .lp-section (+ --canvas/--light/--alt/--ink/--night, --pad-tight/--pad-none), .lp-on-dark, .lp-edge-green, .lp-container(--narrow/--wide), .lp-h1/.lp-h2/.lp-h3 (bare h1-h4 inside .lp-root are styled too), .lp-section-header(--center), .lp-eyebrow, .lp-accent, .lp-lede, .lp-muted, .lp-mono, .lp-num, .lp-link, .lp-visually-hidden, .lp-skip, .lp-btn (--primary/--secondary/--ghost, --sm/--lg, --dark, --block, __label, __arrow), .lp-tag (--dark/--outline), .lp-card (--lift, --dark), .lp-icon-tile, .lp-tilt, .lp-3d, .lp-preserve-3d, .lp-label/.lp-input/.lp-select/.lp-textarea/.lp-field-help/.lp-field-error (form base, Forest focus border), .lp-reveal (--fade/--scale, `.is-in`), .lp-img (--ink, __el, __fallback, __label), .lp-lockup, .lp-mark, header/footer/prose classes (.lp-header, .lp-nav, .lp-mobile, .lp-footer, .lp-policy, .lp-prose)`.
Behaviours baked in: `html[data-surface="landing"]` (set by LandingApp) = light colour-scheme, Soft White background, app aurora/grain hidden, `scroll-behavior:smooth` only under `prefers-reduced-motion: no-preference`; `scroll-margin-top: var(--lp-header-h)` on `.lp-section`; focus ring Forest (light) / #1DBA3C (dark) 2 px offset 2 px, overriding the app's glow; reduced-motion = reveal in final state; print styles (header/menu/preloader hidden, reveals visible, footer light, prose links print their URL).
Specificity: the app stylesheet is in `@layer base`; landing.css is unlayered, so it always wins. Do not use Tailwind utility classes on the landing (their meaning is inverted).
Contrast decisions: `.lp-section--alt .lp-eyebrow/.lp-num` use Deep #106021 instead of Forest because Forest on Light Grey is 4.48:1 (< 4.5 AA for 12 px text).

## 8. Other deliverables
- `Preloader.tsx` ("Kitchen Printer"): Ink overlay, printer + ticket printed in 16 stepped frames (0.08-0.72 s), Forest READY stamp (0.78 s), N tile pop (0.88 s), 4 rotating micro-copy lines (CSS-only, 0.3 s each, from 03c section 1), curtain lift (clip-path) from 1.06 s, removed at 1.4 s hard cap. Once per session (`sessionStorage['nx-pl']`, try/catch), skipped for reduced motion and for deep links (`#hash`); lives in `LandingPage` only so policy/article routes never see it. `aria-hidden`, `role=presentation`, `position: fixed` (zero CLS), no scroll lock, no focus trap, content already in the DOM underneath, any key press / pointer down dismisses it.
- `LandingApp.tsx`: `.lp-root` wrapper, skip link ("Skip to main content" -> focuses `<main id="main" tabindex="-1">`), sets/restores `data-surface` + `color-scheme`, hash scrolling after in-app navigation (retries up to 30 frames for late sections; scroll-to-top on route change), route table: `/` = `LandingPage` (statically imported: LCP route), everything else from `LANDING_ROUTES`, unknown -> redirect `/`.
- `routes.tsx` (OWNER NOW: SECTIONS-C): `export const LANDING_ROUTES: { path: string; element: ReactElement }[]` containing placeholder `PolicyPlaceholder` (6 policy paths), `ArticlePlaceholder` at `/insights/:slug`, `/blog/:slug` -> `/insights/:slug` redirect, and the legacy aliases redirect (`/refund-cancellation`, `/billing-payments`, `/dpa`, `/insights`). Replace the elements with `React.lazy` pages (LandingApp wraps routes in `<Suspense fallback={null}>`). Keep the paths.
- `LandingPage.tsx`: composition in contract order inside `<main id="main">`; sets home meta from `HOME_META` (site.ts); Preloader + Header + Footer.
- `site.ts`: `SITE` (name, origin placeholder `https://nexus.manharcreatives.com` TO CONFIRM, contact data, social, address), `NAV_ITEMS`, `HOME_META`, `absoluteUrl()`, `whatsappUrl(text?)`.
- `index.html`: lang `en-IN`, title/description from 03c section 17.1, `robots index,follow`, `theme-color #0B0F0E` (as requested; 03c suggests #FFFFFF), canonical + `og:*`/`twitter:*` with absolute URLs, preloads for `clash-display-600` and `satoshi-400`, JSON-LD Organization + SoftwareApplication (6 INR offers, GST excluded), `<noscript>` summary. FAQPage JSON-LD is intentionally not static: the FAQ agent injects it with `useJsonLd`.
- `robots.txt`: `Allow: /`, `Disallow: /api/`, Sitemap line. `sitemap.xml`: `/`, the 6 policy routes and the 6 article URLs (slugs from content/posts.ts). Host placeholder flagged TO CONFIRM in comments.
- `Caddyfile`: new `handle /landing/*` and `handle /fonts/*` blocks (`Cache-Control: public, max-age=604800`, real 404 on a miss) before the catch-all. Nothing else touched. Vercel: if that is the real target, equivalent `vercel.json` headers are still needed (analysis R9).
- JetBrains Mono 500 latin woff2 (21.8 kB, from the `@fontsource/jetbrains-mono@5.3.0` tarball via `npm pack` in a scratch dir; no package.json change) + OFL text in `public/fonts/`. `@font-face` is in landing.css. **THIRD_PARTY_NOTICES.md still needs a JetBrains Mono (OFL 1.1) entry** (not my file).

## 9. Notes for other agents
- Section stubs: replace the whole file; keep the default export, `id`, `aria-labelledby` and exactly ONE heading (only Hero has h1). Per-section CSS goes in `styles/<section>.css`, imported from your section file, every selector prefixed `.lp-` (or your own `lp-<section>-` prefix) and nested under `.lp-root` only if you need to beat a global rule.
- Never import the app's `Monogram`, Tailwind utilities, `t()`/i18next, or anything from `../../ui` into landing code.
- `.lp-reveal` content is `opacity:0` until scrolled into view (IntersectionObserver). Full-page screenshot tools that never scroll will see blank below-the-fold reveals: scroll first, or QA with reduced motion enabled (everything then renders in its final state).
- For "3D scroll" scenes: use `useScrollProgress` (writes `--p`), render the final state in CSS when `--p` is 1, mark decorative layers `aria-hidden` + `pointer-events:none`, only animate `transform`/`opacity`.
- `content/nav.ts` (CONTENT agent) lists 7 nav items in 03c order ("Why Nexus" first, with "Built for"); Header/Footer here use `site.ts` `NAV_ITEMS` (6 items, as specified in my brief). The lead can reconcile; the Footer link set already mirrors 03c section 16 (+ Sign in / Register).

## 10. Deviations from the plan / brief
1. Signed-in users on policy/article paths see the website shell (not the in-app 404); small extension of analysis 8.1.
2. Sign-out / session expiry while on `/` redirects to `/login` (otherwise the existing AppShell test "user menu ... signs out" and real UX would drop owners onto the marketing page). `AuthContext.tsx` was NOT touched.
3. `LandingPage` statically imported by LandingApp (home is the LCP route); only policy/article pages should be lazy.
4. Header nav = the 6 items in the brief (no "Built for"), order Platform, Why Nexus, How it works, Pricing, Insights, FAQ.
5. Policy paths follow the PLAN (`/refund-policy`, `/billing-policy`, `/data-processing`, `/insights/:slug`), not 03c's `/refund-cancellation`, `/billing-payments`, `/dpa`, `/blog/...`; the 03c spellings are accepted as redirects.
6. Preloader hard cap 1.4 s (brief) instead of 1.7-3.5 s from the research; it does not wait for fonts or the hero image.
7. Caddy: a missing `/landing/*` or `/fonts/*` file now returns a real 404 (not index.html); that is what makes the ImageSlot fallback reliable behind Caddy.
8. Preloader ticket notches use `mask` gradients (alpha only, no colour gradient); the underline-draw on ghost buttons uses a `currentColor` gradient line. Both are effects, not colour gradients.
9. `theme-color` is Ink (#0B0F0E) in index.html as requested; this also tints the login page's browser chrome.

## 11. Open issues / follow-ups
- **New OG image needed**: `public/og.png` is the old dark look with banned #22c55e. Index.html references it (absolute URL) with a TODO to switch to `/landing/og-nexus.png` + alt "Manhar Nexus: a restaurant pass at dusk with tickets lined up." when the IMAGE agent/owner produces it. Scrapers do not run JS, so only index.html matters for WhatsApp/LinkedIn previews.
- Production hostname unknown: `https://nexus.manharcreatives.com` is a placeholder in index.html, site.ts (`SITE.origin`), robots.txt, sitemap.xml.
- `public/favicon.svg` is still #22c55e (shared with the app); `LoginScreen` has no "Back to website" link (optional, not mine).
- Visual QA not possible in the VM: header spacing at 1024-1280 px (6 links + Sign in + CTA + "A Manhar Creatives product" label at >=1280), mobile menu, footer grid, preloader timing and the printer art need a real browser pass.
- Footer "by" logo is the low-res 610x540 JPG shown at 132 px wide (~2x on retina is not available); replace with the real vector/PNG when supplied.
- Cashfree: footer states "Subscriptions are processed securely by Cashfree Payments." as 03c prescribes (no logo). Owner should confirm that statement is true at launch.
- Contact block, address and WhatsApp number come from 03c/site.ts; owner must confirm before publishing.
- `lp-verify.sh` lints only the paths listed above; section agents' CSS is not linted (no stylelint in the repo).
