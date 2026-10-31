# 01 - Codebase Analysis for the Manhar Nexus Launch Landing Page

Author: codebase-analyst agent. Date: 2026-10-31. Repo: D:\manhar-nexus, branch `main` (HEAD 655ae7e), only `docs/landing/` untracked.
Method: read-only (grep/sed/cat) over apps/web, apps/api, deploy/, docs/, both spec files. No source file was modified. `node_modules` is absent on the mount, so nothing was built or run; every statement is from reading code/docs, not from executing it.

---------------------------------------------------------------------------------------------------

## EXECUTIVE SUMMARY (10 lines)

1. Today every URL renders `LoginScreen` for signed-out visitors: `App.tsx` `Gate` branches ONLY on auth status, never on the URL. `BrowserRouter` sits above `Gate`, so a path-aware branch is a ~15-line change. Landing-as-lazy-chunk is feasible and low risk.
2. There is NO public registration of any kind. The only `@Public()` routes are `GET /health`, `POST /auth/login`, `POST /auth/refresh` and the print-agent routes. Workspaces are created only by a platform admin (`NewRestaurantDialog` -> `runProvision`, 6+ authenticated `/internal/*` calls). There is also no SaaS-subscription billing code of any kind (no Cashfree/Razorpay adapter; `Invoice` is restaurant-checkout only).
3. Safest registration path: new public, throttled `POST /public/registrations` that stores a `RegistrationRequest` row (no auto-provisioning), plus a platform-side list, plus a `mailto:`/WhatsApp fallback in the UI. Auto-provisioning from a public endpoint must NOT be built before payment verification exists.
4. Truthful feature core (live, UI + API + E2E): tables/floor, guest sessions, service requests with variants and add-ons, live KOS, checkout (CASH + manual UPI with UTR), bills with refund/void, reports (daily/sales/items/7-day trend, CSV, print), operating costs with approvals, team + roles (RBAC), tamper-evident Activity History with Verify, realtime SSE, location switcher, per-restaurant accent colour, GST per-item tax categories.
5. Spec-only / not shipped (must be "coming soon" or omitted): card payments, online payment gateway for restaurant bills, discounts, service charge, split/merge/transfer, cash-counter shift reconciliation, QR scan-menu / digital orders, delivery/aggregators, stock & recipes, procurement, guest rewards, bookings UI, Guest CRM UI, printing UI, PIN/device login, manager exception centre, AI insights, Gujarati/Hindi UI, offline mode, multi-location comparison, restaurant-type presets.
6. Printing is built in the API only (agent protocol, ESC/POS templates, truthful job states) with NO web UI and NO certified printer (all models `UNVERIFIED`). Do not claim "prints receipts" as a shipped feature.
7. Honest differentiators with code evidence: hash-chained audit log (`AuditService.verifyChain`), immutable financial rows + reversal-only refunds, idempotency keys + optimistic concurrency, whole-paise integer money, Core+Modules+Configuration with a module dependency DAG, strict tenant scoping with an adversarial E2E sweep (659 E2E passing as of 2026-10-27). No external pen-test, no pilot client yet (roadmap: "PILOT READY WITH CONDITIONS").
8. Deploy reality is split: committed artifacts (Dockerfile.web + `deploy/Caddyfile`, same-origin, CSP `script-src 'self'`, `connect-src 'self'`, `img-src 'self' data: blob:`, `font-src 'self'`, `frame-ancestors 'none'`) versus `docs/runbooks/collaboration-and-deploy.md` (2026-10-30) which says production is Vercel + Neon, with no `vercel.json` or `api/index.js` in the repo. Vercel project `manhar-nexus` exists (framework vite) but latest production deployment state is BLOCKED and project `live:false`. Owner must confirm the real target before SEO/headers/SPA-fallback work.
9. Launch-blockers for a public page: `robots.txt` is `Disallow: /`; no sitemap; static OG/meta in `index.html` describe the old dark login look; `og.png` and `favicon.svg` use the banned `#22c55e`; `theme-color` `#070a09`; app CSS globally forces dark `color-scheme`, aurora/grain pseudo-elements, and green focus rings; app tokens are inverted (`text-ink` = near-white), so landing must use its own scoped CSS. Cashfree JS SDK would require loosening the CSP; prefer a server-created hosted payment/authorisation link redirect.
10. Integration verdict: validated with changes. Use `src/landing/` lazy chunk, path-aware `Gate`, copy kept OUT of i18next JSON (the `i18n/keys.test.ts` scanner and eager `import.meta.glob` would otherwise drag copy into the main bundle), and update 4 existing tests (`App.test.tsx` x2, `sessionHint.test.tsx` x2) to visit `/login`.

---------------------------------------------------------------------------------------------------

## 1. STACK AND REPO MAP

### 1.1 Monorepo
- npm workspaces: `packages/shared` (`@nexus/shared`, constants, health types), `apps/api` (NestJS 11 + Prisma 6 + Postgres 16, zod, argon2, helmet, @nestjs/throttler), `apps/web` (React 18.3, Vite 6, Tailwind v4 via `@tailwindcss/vite`, react-router-dom 7.18, i18next 23 + react-i18next 15, lucide-react 1.61). Node >= 20 (Docker uses 22).
- Web dependencies list `@fontsource-variable/fraunces` and `inter-tight`, but nothing in `src/` imports them (grep: no hits). They are unused dead deps; `Wordmark.tsx` comments still mention Fraunces. Fonts actually used are Clash Display + Satoshi from `public/fonts`.
- Spec docs at repo root are READ-ONLY. Note the spec text contains find-and-replace corruption ("Dining Dining Tables", "checkouting", "accoundining table user"). `docs/spec-normalized/CANONICAL_GLOSSARY.md` has a corrections map. Landing copy must be written from the glossary, never pasted from the spec.

### 1.2 apps/web structure (src/)
| Dir | Contents |
|---|---|
| `App.tsx`, `main.tsx` | Provider tree + `Gate`; bootstraps `./i18n`, `./styles.css`, `applyBrand()` |
| `auth/` | `AuthContext.tsx`, `api.ts` (fetch client, in-memory token, session hint), `LoginScreen.tsx`, `PasswordGate.tsx` |
| `shell/` | `AppShell.tsx` (the ONLY `<Routes>`), `pages.tsx` (single `PAGES` list drives sidebar, router, palette, `g <key>` shortcuts), `CommandPalette`, `ContextSwitcher`, etc. |
| `restaurant/`, `setup/`, `bills/`, `reports/`, `costs/`, `people/`, `activity/`, `profile/`, `config/`, `modules/`, `home/`, `notifications/`, `realtime/` | Feature areas |
| `commercial/`, `onboarding/` | PLATFORM-realm (Manhar staff) pages only |
| `brand/` | `Monogram.tsx`, `Wordmark.tsx`, `illustrations.tsx`, `og-source.html` |
| `ui/` | Design-system primitives (Button, Dialog, Field, Tabs, Toast...) |
| `i18n/` | `index.ts` + `en.json` + 9 `en.<area>.json` overlays |
| `lib/` | `brand.ts`, `money.ts` (en-IN, minor units), `cn.ts`, `humanize.ts` |

### 1.3 Routing and the login-vs-app decision (exact)
`App.tsx`:
```
<AuthProvider><ToastProvider><BrowserRouter><Gate/></BrowserRouter></ToastProvider></AuthProvider>
Gate():
  status==='loading'                          -> centered "Loading..." div
  authenticated && user.mustChangePassword    -> <PasswordGate/>
  authenticated                               -> <WorkLocationProvider><RealtimeProvider><AppShell/></...>
  else                                        -> <LoginScreen notice={notice}/>
```
- `AppShell.tsx` line ~244 holds the only `<Routes>`: every `PAGES` entry, `/home` -> `Navigate to "/"`, and `*` -> in-app 404. App paths: `/` (Home), `/modules`, `/config`, `/profile`, `/reports`, `/team`, `/activity`, `/tables`, `/kitchen`, `/bills`, `/floor`, `/menu`, plus platform pages `/commercial`, `/onboarding` (see `shell/pages.tsx`).
- The unauthenticated branch ignores the URL. Side effect that is GOOD and must be preserved: a signed-out user opening `/bills` sees the login form at `/bills`, and after sign-in lands on `/bills` (implicit return-to-view).
- `AuthContext`: on mount, `hasSessionHint()` (localStorage `nx.session==='1'`, ADR-024: a bare flag, never a token) decides whether to call `POST /auth/refresh`. No hint -> `status` flips to `unauthenticated` in the first effect (so a first-time visitor sees the "Loading..." div for one commit). With hint -> network refresh, then `GET /auth/me`. `setAuthLostHandler` sets `notice='sessionExpired'`.
- Auth model: access JWT in memory only; refresh token httpOnly cookie `nexus_refresh`, `SameSite=Strict`, `Path=/auth` (Caddy rewrites to `/api/auth`). Login = `POST /auth/login` {email,password} -> {accessToken, expiresIn, user}. Two realms: PLATFORM (Manhar staff) and BUSINESS (restaurant users). No SSO, no OTP, no PIN, no self-service password reset page (only authenticated change-password and forced change for temporary passwords).

### 1.4 i18n
- `i18n/index.ts`: i18next, `lng:'en'`, resources built by deep-merging `en.json` with every `./en.*.json` via `import.meta.glob(..., {eager:true})`. Only English exists. ADR-011: Gujarati/Hindi are future.
- `i18n/keys.test.ts` walks every non-test `.ts/.tsx` under `src/` and asserts that each literal `t('a.b.c')` resolves. Consequences for the landing: (a) any function named `t('x.y')` under `src/landing/` is scanned; (b) putting landing copy into `en.landing.json` would be bundled EAGERLY into the main chunk by the glob. Recommendation: landing copy lives in typed TS data files inside `src/landing/` (lazy chunk), no `t()` calls.

### 1.5 Styles and tokens (apps/web/src/styles.css, 448 lines)
- Tailwind v4 `@import "tailwindcss"` + `@theme`. Token NAMES are inverted relative to a light theme (kept from an older paper theme): `--color-paper:#070a09` (canvas), `--color-surface:#0f1513`, `--color-ink:#f3f7f5` (this is the near-white TEXT colour), `--color-muted:#94a09b`, `--color-line:#222d29`, `--color-accent:#22c55e`, `--color-accent-strong/--color-ember-glow:#4ade80`, `--accent-rgb: 34 197 94`. So Tailwind utilities `text-ink`, `bg-paper`, `bg-surface`, `border-line`, `text-muted`, `bg-accent` are all dark-theme/old-green values. The landing must NOT use these utilities.
- Global base rules that leak onto any page: `html{color-scheme:dark; background:#070a09}`, `body{min-height:100vh; background:paper}`, `body::before` (fixed aurora radial gradients in accent) and `body::after` (fixed film-grain SVG, opacity .55) both `z-index:0`, `#root{position:relative;z-index:1}`; `h1,h2,h3{font-family:var(--font-display); letter-spacing:-0.02em; text-wrap:balance; word-spacing:.08em}`; `:focus-visible{outline:2px solid var(--color-accent); box-shadow:0 0 0 5px rgb(var(--accent-rgb)/.22)}` (old green); `input,select,textarea{color-scheme:dark}`; custom dark scrollbars; `@media (prefers-reduced-motion: reduce){*,*::before,*::after{animation-duration:.01ms!important; transition-duration:.01ms!important ...}}` (helpful: CSS animation is auto-neutralised, JS-driven scroll transforms are not).
- Classes beginning `nx-` (`nx-primary`, `nx-glass`, `nx-ledger`, `nx-stub`, `nx-tile`, `nx-page`...) are app-specific and use the old accent. Do not reuse.
- Runtime accent: `AuthProvider` effect calls `applyAccent(user?.business?.accentColor ?? brand.accent)`; with no user it removes inline overrides -> default tokens. It writes inline properties on `<html>`; harmless to a scoped landing.
- Fonts: `@font-face` for Clash Display 400/500/600/700 and Satoshi 300/400/500/700 from `/fonts/*.woff2` (`font-display: swap`) + metric-matched fallbacks "Clash Display Fallback"/"Satoshi Fallback". Files on disk additionally include clash-display-200/300 and satoshi-900 (not declared in CSS). No JetBrains Mono anywhere (`--font-ticket` is a system mono stack). No `<link rel=preload>` for fonts.
- Brand mismatch to the Colour Guide v2: the whole app still uses `#22c55e/#4ade80`, `public/favicon.svg` is `#22c55e`, `Monogram.tsx` uses Tailwind `fill-accent`/`fill-surface`, `ProfilePage.tsx` `DEFAULT_ACCENT='#22c55e'`, `lib/brand.ts` doc comment. The brief says landing wins; do not "fix" the app.

### 1.6 Build / deploy artifacts
- `apps/web/vite.config.ts`: plugins react + tailwind; alias `@nexus/shared` -> `../../packages/shared/src`; dev server port 5173 with proxy `/api` -> `http://localhost:3000`; vitest jsdom, globals. No `base`, no `build.rollupOptions`, no manualChunks, no multi-page inputs. `tsc --noEmit && vite build` is the build script (typecheck gates the build).
- `Dockerfile.web`: stage 1 node:22 `npm ci --ignore-scripts` (uses package-lock; adding an npm dependency requires a regenerated lockfile), builds `@nexus/shared` then `@nexus/web` with `VITE_API_URL=/api`, `VITE_BRAND_NAME`, `VITE_BRAND_ACCENT`; stage 2 caddy:2.10-alpine copies `dist` to `/srv`. Everything under `apps/web/public/` (so `public/landing/*`) lands in `/srv`.
- `deploy/Caddyfile` (same-origin edge):
  - `encode zstd gzip` except SSE path; security headers on every response: HSTS 1y includeSubDomains, CSP `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; manifest-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests`, nosniff, `X-Frame-Options DENY`, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy `camera=(), microphone=(), geolocation=(), payment=(), usb=()`, COOP same-origin.
  - `handle_path /api/*` -> `reverse_proxy api:3000` (strips /api, `flush_interval -1`, rewrites Set-Cookie Path=/auth -> /api/auth, forces `Cache-Control: no-store`).
  - `handle /assets/*` -> immutable 1-year cache, real 404 on miss (no SPA fallback).
  - catch-all `handle` -> `Cache-Control: no-cache`, `try_files {path} /index.html` (SPA fallback for `/login`, `/terms`, ...). So `/landing/*.webp` and `/fonts/*.woff2` are served with `no-cache` (revalidated every view). Landing imagery will be the heaviest assets, so add a `handle /landing/*` and `handle /fonts/*` block with e.g. `Cache-Control "public, max-age=604800"` (use content-hashed file names if longer).
  - `/healthz` on 127.0.0.1:8081 for the container healthcheck.
- `docker-compose.prod.yml`: `postgres:16-alpine`, one-shot `migrate` (profile release), `api` (TRUST_PROXY=1), `web` (ports 80/443/443-udp, `NEXUS_DOMAIN`, `ACME_EMAIL`, `NEXUS_TLS`). One hostname serves SPA and API.
- OTHER deploy path (conflict): `docs/runbooks/collaboration-and-deploy.md` (committed 2026-10-30, newest doc) states production is `https://manhar-nexus.vercel.app`, Vercel project `manhar-nexus` in team "Manhar Creatives' projects", API as serverless `api/index.js` on Neon Postgres, manual `npx vercel deploy --prod`. The repo contains no `vercel.json`, no root `api/` dir, no `.vercel/`. Vercel MCP lookup (read-only): project exists, framework `vite`, node 22.x, domains are only `*.vercel.app` aliases, `live:false`, latest production deployment `readyState: BLOCKED`. UNKNOWN: whether SPA rewrites / security headers are configured in the Vercel dashboard. If Vercel is the real target, then (a) the Caddyfile headers and `/assets` rules are NOT in effect, so a `vercel.json` with `rewrites` (`/(.*)` -> `/index.html` excluding files), `headers` and cache rules is needed, (b) the throttler is in-memory per serverless instance (weak), (c) the cookie rewrite and same-origin `/api` assumption must be re-verified, (d) `deploy.md` line 51 warns that `SameSite=Strict` refresh breaks across different registrable domains.
- `.github/workflows/ci.yml`: typecheck, lint, unit (API + web), `prisma migrate deploy`, seed, E2E on Postgres, build, then Docker image build + compose smoke. A new web test or lint error breaks CI.
- Entry bundle budget: 174.75 kB gzip against a 250 kB budget (QA_REPORT 2026-10-27). The landing must be a separate lazy chunk to keep the app untouched. `index.html` uses `<div id="root">` and `/src/main.tsx`; there is no SSR or prerender.

---------------------------------------------------------------------------------------------------

## 2. WHAT ALREADY EXISTS FOR REGISTRATION / ONBOARDING / LOGIN

### 2.1 Public (unauthenticated) endpoints today
Global guards `JwtAuthGuard` then `PermissionGuard` (IamModule `APP_GUARD`) protect everything unless `@Public()` (`iam/principal.ts` `IS_PUBLIC`). Complete list of `@Public()`:
| Route | File | Notes |
|---|---|---|
| `GET /health` | `health/health.controller.ts` | status JSON |
| `POST /auth/login` | `iam/auth.controller.ts` | `@UseGuards(ThrottlerGuard)`, body {email,password}; lockout after `AUTH_MAX_FAILED_ATTEMPTS`=5 for 15 min |
| `POST /auth/refresh` | same | cookie or body token |
| `/agent/print/*` | `printing/job/job-agent.controller.ts` | print-agent bearer secret via `agent-auth.guard.ts`, not user JWT |
There is NO register, signup, forgot-password, contact-form or lead endpoint. `ThrottlerModule.forRootAsync` lives in `IamModule` with ONE default throttler (`AUTH_RATE_LIMIT` default 10 per `AUTH_RATE_TTL_MS` default 60 000), applied only where `@UseGuards(ThrottlerGuard)` is present. Storage is the default in-memory store (not Redis). `auth-ratelimit.e2e-spec.ts` shows the test pattern (env set before module load).

### 2.2 Tenants are provisioned only by platform admins (answer: NO self-service signup)
Sequence performed by `apps/web/src/onboarding/provision.ts` `runProvision()` inside `NewRestaurantDialog.tsx` (Onboarding page, PLATFORM realm only), all authenticated:
1. `POST /internal/businesses` {name, businessTypeKey:'restaurant'} (perm `platform.business.create`; schema `createBusinessSchema` in `core/business/business.dto.ts`, `.strict()`: name, legalName?, businessTypeKey, currencyCode?, timezone?, slug?, accentColor?, logoUrl?, invoiceName?, invoiceAddress?, taxId?).
2. `POST /internal/businesses/:id/locations` {name}.
3. `POST /internal/businesses/:id/provision` {email, displayName, password(8-128), requirePasswordChange} (`iam/provisioning.controller.ts`, perm `platform.business.configure`; 409 if the email exists anywhere or the business already has an owner).
4. For each module `restaurant`, `catalog`, `checkout` (+ optional `reports`, `costs`): `POST /internal/businesses/:id/modules/:key/activate` then `.../complete-setup` (`modules/platform-module.controller.ts`).
5. `PATCH /internal/commercial/clients/:id` {commercialStatus: PROSPECT|TRIAL|ACTIVE|SUSPENDED|CHURNED}.
6. `POST /internal/onboarding/:id/initialize` -> `OnboardingProgress` with 9 ordered steps (`BUSINESS_CREATED`...`COMPLETED`, ADR-027); `GET .../validate` returns {hasLocation, hasActiveModule, hasNonOwnerUser, hasBranding, issues[]}.
The password is generated client-side (`generatePassword()`, crypto random 16 chars), shown once, and the owner must change it at first sign-in (`mustChangePassword`, migration `20261029120000_must_change_password`). Retry resumes at the failed step.

### 2.3 Commercial layer (all PLATFORM-realm, `/internal/commercial/*`, ADR-026)
- Prisma: `Offering` {key, name, type SETUP_FEE|RECURRING|ONE_TIME|TRIAL, moduleKeys[]}, `PriceBook` {currency INR, isDefault, validFrom/To}, `PriceBookEntry` {amountMinorUnits, billingPeriodDays (30 monthly / 365 annual)}, `ClientPriceOverride`, `Bundle`/`BundleItem`, `ActivationRequest` (state machine REQUESTED -> QUOTED -> APPROVED -> PENDING_SETUP -> ACTIVE -> SUSPENDED|REMOVED, immutable `ActivationRequestEvent`s, `quotedAmount`, version), `DeploymentChecklist(+Item)`. `Business.commercialStatus/accountNotes/assignedTo`.
- Endpoints: offerings, price-books (+entries), bundles (+items), clients (+usage, price-overrides, activation-requests, transition, checklist). Perms `platform.commercial.*`, `platform.client.*`, `platform.activation.*` (all `restricted:true`, defined in `iam/permission.registry.ts`).
- Everything is an internal catalogue and manual workflow. `Offering.moduleKeys` is "informational; activation is manual". There is no subscription, billing cycle, dunning, GST invoice for Manhar's own charges, payment-gateway adapter, or webhook. `grep -ri "cashfree"` over code finds nothing (only the brief); `razorpay` appears only in ADR-008 and as a comment in the manual UPI provider. Seed data (`prisma/seed.ts`) creates business types, system roles and the platform admin only: no offerings, price books or bundles.

### 2.4 Recommendation: least-risky public "Register your restaurant / request workspace"
Principle: collect a LEAD, never create a tenant or an owner login from an unauthenticated request. A public endpoint that provisions would let anyone create businesses and consume emails, and no payment verification exists yet.

Tiering:
- Tier 0 (zero backend, ship-day safe): primary button opens a form that builds a `mailto:` to the Manhar mailbox and a `https://wa.me/<number>?text=...` link (owner supplies address/number). Works under the current CSP (anchor navigation, no fetch). Use as permanent fallback even after Tier 1.
- Tier 1 (recommended): public rate-limited `POST /public/registrations` storing a `RegistrationRequest`; platform staff review it in the app and run the existing `NewRestaurantDialog` (pre-filled), then set commercial status. Payment (Cashfree) stays a separate integration point: the landing's "Pay" step is a clearly marked placeholder that, for now, ends in "We'll send your payment link".
- Tier 2 (later, after payment webhook + verification): server creates a Cashfree order/subscription for a `RegistrationRequest`, webhook (signature verified, idempotent, same discipline as ADR-008) flips it to PAID and enqueues provisioning.

Files to touch for Tier 1 (new unless marked "edit"):
| File | Change |
|---|---|
| `apps/api/prisma/schema.prisma` (edit) + new migration `apps/api/prisma/migrations/2026MMDDHHMMSS_registration_request/migration.sql` | model below. Forward-only (`migrate deploy`); NEVER `db push` (deploy docs) |
| `apps/api/src/registration/registration.module.ts`, `.controller.ts`, `.service.ts`, `.dto.ts` (new) | public create endpoint + platform list/update |
| `apps/api/src/app.module.ts` (edit) | import `RegistrationModule` |
| `apps/api/src/iam/permission.registry.ts` (edit, near line 102) | add `p('platform','registration','view',...,true)` and `...'manage'...true` (restricted). `permission.registry.spec.ts` / `system-roles.catalog.spec.ts` may need counts updated; platform-admin wildcard covers them |
| `apps/api/test/registration.e2e-spec.ts` (new) | public 202, validation 400, honeypot, rate-limit 429 (copy `auth-ratelimit.e2e-spec.ts` pattern), platform-only list 403 for business user |
| `apps/web/src/landing/**` (new) | form, uses plain `fetch(VITE_API_URL + '/public/registrations')` WITHOUT credentials (do not reuse `auth/api.ts` `api()`: it attaches bearer + `credentials:'include'`; `API_BASE` is not exported, re-read `import.meta.env.VITE_API_URL`) |
| `apps/web/src/commercial/` (edit, optional phase 1b) | "Requests" tab in `CommercialPage.tsx` (tabs array + `en.platform.json` keys) listing requests with a "Create workspace" action prefilling `NewRestaurantDialog` |
| `deploy/Caddyfile` (no change needed for same-origin `/api/public/*`) | `handle_path /api/*` already covers it. `connect-src 'self'` allows it |

Prisma sketch (name/field style follows existing models, `@@map` snake_case, timestamptz):
```prisma
enum RegistrationStatus { NEW CONTACTED QUALIFIED CONVERTED REJECTED SPAM }

model RegistrationRequest {
  id              String             @id @default(uuid()) @db.Uuid
  referenceCode   String             @unique            // e.g. "NX-7K2Q9M", shown to the visitor
  status          RegistrationStatus @default(NEW)
  restaurantName  String
  contactName     String
  email           String                                 // lower-cased
  phone           String?                                // E.164-ish, India default
  city            String?
  businessKind    String?                                // restaurant|cafe|bakery|cloud-kitchen|hotel|other (free-text key, not an enum)
  outlets         Int?   // 1..500
  planKey         String?                                // plan the visitor chose, validated against a server allow-list
  billingCycle    String?                                // 'monthly' | 'yearly'
  message         String?                                // max 1000
  consentVersion  String                                 // terms/privacy version accepted
  consentAt       DateTime           @db.Timestamptz(6)
  ipHash          String?                                // HMAC-SHA256(ip, server secret); never the raw IP
  userAgent       String?                                // truncated to 200
  source          String?                                // utm/section label, max 64
  assignedTo      String?
  internalNotes   String?
  businessId      String?            @db.Uuid            // set when converted (no FK needed initially)
  createdAt       DateTime           @default(now()) @db.Timestamptz(6)
  updatedAt       DateTime           @updatedAt @db.Timestamptz(6)
  @@index([status, createdAt])
  @@index([email])
  @@index([ipHash, createdAt])
  @@map("registration_request")
}
```
Controller sketch: `@Controller('public/registrations') @Public() @UseGuards(ThrottlerGuard)` on `POST /` with `@Throttle({ default: { limit: 5, ttl: 3_600_000 } })` (per IP/hour override of the global 10/min; verify the installed @nestjs/throttler v6 override syntax) and `@HttpCode(202)`. Platform side: `@Controller('internal/registrations')` with `@RequirePermission('platform.registration.view'|'manage')`.

Security considerations:
- Validate with zod `.strict()` via `zodBody`, trim and cap every field (name <= 120, message <= 1000), normalise email lower-case, India phone regex optional, `consent: z.literal(true)` and server-pinned `consentVersion`. Reject unknown keys.
- Honeypot: a hidden field (e.g. `website`) that must be empty; on non-empty return the SAME 202 response but store as `SPAM` (or drop) so bots learn nothing. Optional time-trap: client sends `startedAt`; reject < 2 s with the same 202.
- No enumeration/PII leakage: always respond `{ ok: true, referenceCode }` even for duplicates (do NOT reuse `ConflictError('Email already registered')` as `provisioning.service.ts` does); the response never echoes input; log events with ids only (pino `logger.child({ref })`), never email/phone. Do not check `User` table existence.
- Abuse limits: ThrottlerGuard per-IP is in-memory; behind Vercel serverless it does not hold across instances. Add a DB-backed cap in the service (e.g. max 5 rows per `ipHash` per hour and 3 per email per day via the indexes above). Keep `TRUST_PROXY=1` so `req.ip` is the client (Caddy), otherwise every request shares the proxy IP.
- CORS: production is same-origin; dev uses `CORS_ORIGIN` credentials mode. The public route needs no cookie.
- Audit: `AuditService.append` is per-business hash-chained (needs a `businessId`), so it cannot record pre-tenant events. Rely on the row's own timestamps + structured logs; on conversion the platform action IS audited via the existing provisioning calls.
- DPDP-minded: collect only what sales needs, show consent text, add a retention note (delete SPAM/REJECTED after N days), keep `ipHash` salted/HMAC'd. Do not add a CAPTCHA vendor script: CSP `script-src 'self'` blocks it by design; honeypot + rate limit + DB caps are the captcha-less path. If CAPTCHA becomes necessary, Cloudflare Turnstile would need `script-src`/`frame-src`/`connect-src` additions.
- Email notification to Manhar on new request is NOT possible today: ADR-012 messaging abstraction is spec-only (grep shows no mailer). Staff discover requests in the app; optionally also log and use an external uptime/alert.

### 2.5 Payment (Cashfree subscription) readiness
- Nothing exists. Needed later: server-side Cashfree client, plan -> amount mapping (GST 18% extra), subscription/mandate or payment-link creation, webhook endpoint (signature check + dedupe, mirroring ADR-008), an SaaS-invoice record with Manhar's GSTIN, state sync to `Business.commercialStatus`.
- CSP/headers: `form-action 'self'` blocks HTML forms posting to a gateway; Cashfree JS SDK would need `script-src https://sdk.cashfree.com`, `frame-src`/`connect-src` for Cashfree hosts (exact hosts: verify in Cashfree docs, not known here) and the `Permissions-Policy payment=()` would need `payment=(self)` if Payment Request is used. To avoid weakening the CSP, prefer: API creates the Cashfree payment link / subscription authorisation link and returns its URL, browser does `window.location.assign(url)` (top-level navigation is not restricted by CSP). Confirm with Cashfree docs that the chosen product supports link-based authorisation for recurring collection.
- The landing page should treat "Pay" as `// INTEGRATION POINT: createCheckout(registrationRef)` returning a URL, and until wired show "Payment link will be shared by our team".

---------------------------------------------------------------------------------------------------

## 3. REAL FEATURE INVENTORY (TRUTH TABLE)

Status legend: LIVE = API + web UI + automated tests (and for most, driven in a real browser per `docs/ui/QA_REPORT.md`); API-ONLY = backend exists, no web screen; SPEC = not built. Evidence in the last column. Glossary terms (CANONICAL_GLOSSARY): use Service Request (not "order"), Checkout (not "bill" - NOTE the shipped UI nav says "Bills", and API paths say `/admin/orders`, so the landing should say "Checkout and bills" carefully), KOS, Sold-Out, Business Workspace, Guest Session, Activity History, Pass Control, Payment Option. Avoid "POS" and "tenant".

### 3.1 LIVE (safe to present as available now, subject to the pilot caveat in section 7)
| # | Capability | One-line owner benefit | Glossary term | Evidence |
|---|---|---|---|---|
| 1 | Business Workspace + owner sign-in | Your restaurant gets its own private workspace and login | Business Workspace | `core/business`, `iam/provisioning`, `LoginScreen` |
| 2 | Role-based access (RBAC): Owner, Location Manager, Checkout Associate, Service Team, Host, Kitchen Team, Stock Control Manager, Accountant + custom roles | Each person sees only what their job needs; the cook never sees sales | Role / Permission | `iam/system-roles.catalog.ts`, `role.controller.ts`, `people/` Team page, role-aware nav (`shell/access.ts`). Kitchen/cashier/waiter navigation verified in browser (QA_REPORT) |
| 3 | Menu: categories, items, variants (e.g. portion size), Add-ons (modifier groups, single/multiple, min/max, priced options), item-level Sold-Out toggle, per-item tax category | Change a dish, price or availability yourself, no developer | Catalog Item, Preference / Add-on, Sold-Out | `setup/MenuSetupPage.tsx`, `AddOnsSection.tsx`, `restaurant/catalog`; server-side modifier validation added 2026-10-27 |
| 4 | Floor: dining areas, tables with codes and capacity | Draw your floor once; see every table at a glance | Dining Area / Dining Table | `setup/FloorSetupPage.tsx`, `restaurant/dining` |
| 5 | Live table board: Available / Occupied / Cleaning in words not just colour, reset after cleaning | Know which table is free, seated or being cleaned | Dining Table states | `restaurant/TablesPage.tsx`, `FloorGrid.tsx`, `POST /admin/dining/tables/:id/reset` |
| 6 | Guest Session: open table with party size, multiple rounds, close, void | One visit = one session, however many rounds | Guest Session, Service Round | `OpenSessionDialog`, `SessionPanel`, `session.service` |
| 7 | Service Request taking with variants/add-ons, send to kitchen, cancel line, mark served | Waiter taps, the kitchen sees it | Service Request, Service Line | `OrderBuilder.tsx`, `ItemConfigDialog.tsx`, `/admin/orders`; duplicate-tap guard via idempotency key |
| 8 | Kitchen Operations Screen (KOS): queue oldest-first, Accept / Start preparing / Mark ready, waiting time with "running late" flag, partial line transitions | Kitchen knows what to cook next without calling the floor | KOS | `KitchenPage.tsx` (+ `KitchenPage.test.tsx`), `/admin/kitchen`. NOTE no station filter in the UI; routing by `productionAreaId` exists in API/schema only |
| 9 | Realtime updates (SSE, "Live" badge), auto-reconnect and full resync | Screens update within about a second without refresh | (Realtime) | ADR-032, `realtime/`, `LiveBadge`, `realtime.e2e-spec` |
| 10 | Checkout: one Checkout per Guest Session, GST per line, totals computed on the server in whole paise, pay by CASH (tender + change due) or UPI with UTR confirmation | Bill is exact; cash change is worked out for you | Checkout, Payment Option | `CheckoutDialog.tsx` (`METHODS = ['CASH','UPI']`), `checkout/`; golden path verified in browser |
| 11 | Bills list + detail, Refund (reason mandatory, capped at amount paid, idempotent) and Void | Corrections are traceable, never silent | Void | `bills/`, `POST /admin/checkout/payments/:id/refunds`, `.../invoices/:id/void`; refund race fixed (4-way parallel E2E) |
| 12 | GST tax categories (rate per category, tax breakdown by rate on checkout and reports; tax-EXCLUSIVE pricing only) | GST shown line by line, grouped by rate | Tax category | `TaxCategory` Decimal(6,4), `invoice.service`; no inclusive-price toggle found in code |
| 13 | Reports: Daily closing, Sales summary (payment method, tax, refunds), Top items, 14-day trend, CSV export, print | Know today's takings without a spreadsheet | Reports | `reports/ReportsPage.tsx`, `/admin/reports/{daily,sales,daily-series,items}`. Caveat: days split at UTC not IST (QA_REPORT known gap) |
| 14 | Owner Home "Today": net revenue, paid bills, average bill, 7-day sparkline, live tables/kitchen widgets, expense approvals | Open the app, see how the day is going | Home | `home/`; known gap: Home vs Bills "today" definitions differ slightly |
| 15 | Operating Costs: categories, expenses, approval flow (approve/reject with reason), summary | Track and approve running costs | Operating Costs | `costs/`, ADR-030, module key `costs` |
| 16 | Activity History with "Verify" | Every sensitive action is recorded; the log can prove nothing was altered | Activity History | `activity/ActivityPage.tsx`, `GET /admin/audit`, `GET /admin/audit/verify`, hash chain in `AuditService` |
| 17 | Alerts Center (in-app bell) + configurable alert rules | Be told when something needs attention | Alerts Center | `notifications/`, `config/ConfigCenter.tsx` Alerts tab, `alert-rule.controller` |
| 18 | Module Center (activate/disable modules, dependency-aware, setup steps) | Switch capabilities on as the business grows | Module | `modules/ModuleCenter.tsx`, `module.registry.ts` DAG; built-in manifests: restaurant, catalog, checkout, reports, printing, costs |
| 19 | Multiple locations per workspace + working-location switcher + location-scoped roles | One login, several outlets | Location | `ContextSwitcher.tsx`, `LocationContext`, `UserRoleLocation`. NOT built: central menu, cross-location comparison, creating locations from the owner UI (locations are created by platform provisioning / `POST /admin/locations`, no owner screen found) |
| 20 | Restaurant profile and branding: name, accent colour (applied for every staff member), invoice name/address, GSTIN, slug | Your name, colour and GSTIN on the system | Business branding (ADR-014) | `profile/ProfilePage.tsx`; logo URL exists in API but no upload UI found |
| 21 | Settings (Configuration Center): precedence Location > Business | Configure without code | Configuration | `config/ConfigCenter.tsx`; registry currently exposes only core settings (locale, date/time format, rounding) per `settings.registry.ts` - do not oversell "hundreds of settings" |
| 22 | Command palette and keyboard shortcuts, responsive/mobile drawer nav, designed 403/404/error states | Fast for power users, usable on a tablet/phone | - | `shell/CommandPalette`, `shortcuts.ts`, QA at 1440 and 390 px only |
| 23 | Security basics: argon2id passwords, 5-attempt lockout, rotating refresh sessions, httpOnly cookie, tenant isolation, CSV formula-injection guard, forced password change on temporary passwords | Staff accounts and data are protected | - | ADR-004/023/024, `security.e2e-spec`, ADR-028 |
| 24 | Duplicate-tap and double-payment protection (idempotency keys) + optimistic concurrency | Double-tap does not make double orders or double charges | - | ADR-017; `CheckoutDialog` per-attempt key; `OrderBuilder` key; UNIQUE(businessId, idempotencyKey) |
| 25 | Data export: Reports CSV; database dump is the full export | Your sales data is yours | - | `docs/ui/OWNERSHIP_AND_WHITE_LABEL.md`: full JSON export NOT built |
| 26 | Backup/restore, deploy and rollback runbooks, health endpoint | Operational maturity (internal) | - | `scripts/`, `docs/runbooks/` - say "tested restore drill" only after the staging drill is done (roadmap lists it as pending) |

### 3.2 API-ONLY or PARTIAL (do NOT show as "live" on the page; mention as "in the engine, screens coming")
| Capability | State | Evidence |
|---|---|---|
| Printing & hardware (Local Print Agent -> ESC/POS, truthful states QUEUED/SENT/PRINTED/FAILED/OFFLINE, retry, reprint, receipt + kitchen templates) | API-ONLY; no web screen (`grep printing` in web = none); all 3 listed printer models `UNVERIFIED`, no physical validation (roadmap pending condition #1). Reports page has browser Print | `apps/api/src/printing`, `certified-models.ts`, ADR-007/025 |
| Bookings / reservations | API-ONLY (`/admin/bookings`, Booking -> seat creates a Guest Session); no web UI | `restaurant/booking`, `Booking` model |
| Guest profiles (Guest CRM base) | API-ONLY (`/admin/guests`); guest name field appears when opening a table; no history/preferences/consent screens | `restaurant/people` |
| Staff Profiles (employee without login) | API-ONLY | `/admin/staff` |
| Kitchen station routing (Production Areas) | API/schema only; item has `productionAreaId`; no setup or KOS filter UI | `ProductionArea` model, `/admin/catalog/production-areas` |
| Sold-Out "sync to all channels" | PARTIAL: item-level availability flag exists; only one channel exists (staff console), no QR/online channel, no kitchen-side one-tap Sold-Out | `CatalogItem.isAvailable` |
| Offline tolerance | PARTIAL/minimal: idempotent retry + realtime resync only. The in-progress cart is React state; no draft persistence across reload; no offline mode (ADR-009 forbids claiming it) | `OrderBuilder.tsx`, `realtime/client.ts` |
| Multi-location | PARTIAL: see row 19 | |
| Accent/theme per restaurant | LIVE but basic (ADR-014 says no theme engine) | |

### 3.3 SPEC-ONLY / ROADMAP - must be labelled "Coming soon" (or left out)
Source: spec section 5 module map (A-X), section 32 advanced features, roadmap Phase 16-18 (all DEFERRED "pending pilot demand").
| Item | Spec ref | Status |
|---|---|---|
| Card payments and online UPI QR/gateway for restaurant bills (Razorpay adapter behind a flag) | ADR-008, Module I | SPEC; "Card" button was removed rather than faked |
| Discounts with approval limits, service charge, rounding config, comps | Module H | SPEC (Phase 9 "NOT built") |
| Split / merge / hold checkouts, table merge/split/transfer, course firing, holds | Modules D/F/H, section 32 | SPEC |
| Cash Counter / Shift Reconciliation (open, in/out, close, variance) | Module I | SPEC (roadmap "deferred to a later phase") |
| Pass Control (final quality gate) | glossary | SPEC (no code) |
| QR Scan Menu, table-side digital ordering, direct digital orders, pickup/delivery, aggregators, dispatch | Modules R/S/T | SPEC (roadmap P17) |
| Stock Control, recipes, consumption, Procurement, Vendors | Modules M/N | SPEC (module priority "NEXT") |
| Guest Rewards, offers, coupons, membership, campaigns | Module Q | SPEC |
| Alerts & Messaging (WhatsApp/SMS/email), accounting integrations | Modules V/X, ADR-012 | SPEC (no mailer exists) |
| Team shifts, attendance, leave, payroll | Module P | SPEC (only users + roles + staff profile API) |
| Manager Exception Center | section 33 | SPEC (Activity History + Alerts are the nearest live parts) |
| Location comparison dashboards, central menu, Multi-Location packaging | sections 32/38 | SPEC |
| PIN / registered-device frontline login | glossary Device, Phase 3 "deferred" | SPEC |
| AI insights, scheduled menu changes, guest preference memory | section 32 | SPEC (LATER/NEXT) |
| Gujarati / Hindi interface | ADR-011 | SPEC (English only) |
| Restaurant Type Presets / Packs | section 35 | SPEC (see section 5) |
| Native mobile apps, PWA/offline mode | POSITIONING | SPEC (no manifest, no service worker) |
| E-invoicing / GST filing automation | ADR-010 | SPEC |
| Client self-service rebranding UI beyond accent/invoice fields; white-label | POSITIONING, ADR-014 | SPEC |
| Non-restaurant verticals (factory, retail, hotel PMS, etc.) | Master blueprint | SPEC. Business types (hotel, resort, banquet, retail, manufacturing) exist only as seeded catalogue rows; no module serves them |

---------------------------------------------------------------------------------------------------

## 4. DIFFERENTIATORS GROUNDED IN THE ARCHITECTURE (owner-friendly wording + evidence)

Use these as "why Nexus is different" material. Each claim lists what can safely be said and what must NOT be said.
| # | Owner-language claim | Engineering evidence | Do NOT say |
|---|---|---|---|
| 1 | "One platform you grow into: switch on only the modules you need" (Core + Modules + Configuration) | `modules/module-manifest.ts` (6 manifests with dependency DAG, setup steps, per-module permissions), `ModuleGatingGuard` returns 403 MODULE_DISABLED, Module Center UI, `Business.commercialStatus`, Offerings/Bundles for add-on selling | That 20+ modules exist. 6 are built-in (restaurant, catalog, checkout, reports, printing, costs) |
| 2 | "Nobody can quietly rewrite your numbers: every sensitive action is recorded and the record can prove it was not tampered with" | `AuditService` hash-chain (`stableStringify`, per-business `sequence`, `prevHash`), `verifyChain`, `GET /admin/audit/verify`, "Verify" button; `audit.hash.spec.ts`; demo verified `valid:true, 129 events` | "Blockchain", "tamper-proof", or legal/compliance certification. Say "tamper-evident" |
| 3 | "A paid bill is never edited: mistakes are fixed by a visible reversal with a reason" | ADR-016: no UPDATE/DELETE paths on financial tables, refunds reversal-only with mandatory reason, invoice line snapshots (`nameSnapshot`, `priceSnapshot`), voided numbers stay consumed | That discounts/approvals exist (not built) |
| 4 | "Double-tap, bad Wi-Fi or a retry will not charge twice or send the dish twice" | ADR-017: client UUID `idempotencyKey` on service requests and payments with DB UNIQUE(businessId, idempotencyKey), optimistic `version` columns, 4-way concurrent refund E2E | "Works offline" (it does not) |
| 5 | "Money is exact: everything in whole paise, GST computed once on the server" | ADR-015, integer minor units end-to-end, `lib/money.ts` is the only formatter, tax invariant tests, checkout hand-verified (2 x 280 + 1 x 180 = 740 + 5% GST) | "GST-return filing/e-invoicing" (ADR-010: deferred) |
| 6 | "Kitchen and floor stay in sync in about a second" | ADR-032 SSE with heartbeat, snapshot-on-reconnect, per-topic invalidation, `LiveBadge` | A numeric latency SLA |
| 7 | "Your staff see only what they need" | RBAC with module.resource.action permissions, location-scoped grants, `restricted` platform permissions never grantable to business roles; API is the boundary, UI is convenience; E2E proves 403 per role | "SOC 2 / ISO 27001" |
| 8 | "Your restaurant's data is walled off from every other restaurant" | ADR-002 single DB with mandatory `business_id`, `TenantScopedRepository`, `scopeFromPrincipal` derives tenant from the JWT only; adversarial cross-tenant sweeps; 55 security + 12 concurrency E2E (ADR-028) | "Separate database per restaurant". ADR-002 is shared-schema multi-tenant. NOTE `docs/ui/OWNERSHIP_AND_WHITE_LABEL.md` says "Operational data lives in the client's PostgreSQL" - true only for a dedicated deployment; do NOT repeat it for the SaaS plans |
| 9 | "Built for India: INR, GST, IST, India-first hosting" | `currencyCode` default INR, timezone `Asia/Kolkata`, `en-IN` formatting, GST tax categories, ADR-013 "India region PREFERRED where practical" | "Data stored in India" as a guarantee. ADR-013 is a preference; the actual host (Docker host vs Vercel/Neon region) is undecided/unknown in the repo |
| 10 | "Designed so the first ten minutes feel like a restaurant tool, not an accounting screen": words not colours for table state, large touch targets, calm dark UI | `docs/ui/POSITIONING.md`, ADR-031, DESIGN_SYSTEM/ART_DIRECTION | Claims of tested touch hardware (unverified) |
| 11 | "Manhar sets you up and stays with you": guided onboarding with a 9-step go-live tracker and checklist | ADR-027 `OnboardingProgress`, `validate` endpoint, deployment checklist, `pilot-setup.md` | A fixed go-live SLA ("live in 24 hours") |
| 12 | "Open stack, no lock-in": React, NestJS, PostgreSQL; CSV export; pg_dump | OWNERSHIP_AND_WHITE_LABEL | "Open source" (license is UNLICENSED) |
Honest gaps the page must not paper over: no pilot client yet; printing unvalidated; QA by the builders (no independent reviewer sign-off per roadmap); Lighthouse recorded only for the login route (mobile perf 95, a11y 100).

---------------------------------------------------------------------------------------------------

## 5. TARGET SEGMENTS AND RESTAURANT-TYPE PRESETS

### 5.1 What the product supports today
- Seeded Business Types (`prisma/seed.ts` lines 24-33): restaurant, cafe, qsr (counter/fast service), cloud-kitchen ("delivery-only kitchens"), hotel, resort, banquet, retail, manufacturing, service. `POST /internal/businesses` requires `businessTypeKey`, and the provisioning UI hard-codes `'restaurant'`.
- Only the restaurant vertical has modules. The `restaurant` manifest even has a setup step "Confirm Business Type: ensure the business type is set to restaurant, cafe, or QSR". So the honest supported segment today = dine-in restaurants and cafes with table service and a kitchen, in India (INR, GST), plus counter-style cafes/bakeries that can live with tables or a single "counter" table.
- Best fit (workflow match: table -> kitchen screen -> cash/UPI checkout): single-outlet dine-in restaurants, cafes, bakeries with seating, family restaurants, small multi-outlet groups (location switcher, role scope per location).
- Weak/absent fit today: delivery-only cloud kitchens (no digital orders, dispatch, aggregators, stock), hotels/resorts/banquets (no room/PMS/event features), QSR counter flows needing token/pickup, card-only venues (no card payments), venues needing printed KOT/receipt on day one (printing UI + hardware validation pending), businesses needing discounts/split bills.
- Landing guidance: list cafes, bakeries, restaurants as "available now"; hotels' restaurants/F&B outlets only if the F&B outlet is a normal table-service restaurant; cloud kitchens and hotels as "coming soon / tell us your need". The brief wants hospitality imagery for hotels/cafes/cloud kitchens/bakeries; imagery is fine but copy must not promise cloud-kitchen dispatch.

### 5.2 Spec presets (section 35) vs code
| Preset (spec) | Modules in spec | In code? |
|---|---|---|
| Small Cafe | Menu + Service Console + Dining Tables + Checkout + Payments + Receipt | No preset object; the manual equivalent today = modules restaurant + catalog + checkout (the "core three" always activated by `runProvision`) |
| Dine-in Restaurant | Cafe + KOS + Guests + Bookings + Team | Core three + reports + costs are what the provisioning UI offers; guests/bookings API-only |
| QSR | Console + Menu + KOS + Checkout + Pickup/Dispatch | Pickup/dispatch SPEC |
| Cloud Kitchen | Menu + Requests + KOS + Stock + Procurement + Dispatch | Mostly SPEC |
| Premium Restaurant | Dine-in + Bookings + Guest CRM + Rewards + advanced BI | SPEC |
| Multi-Location Restaurant | All + Multi-Location + Central Menu + BI | PARTIAL (location switcher only) |
`Pack`/`pack_template` is a glossary term and `Bundle` is the commercial analogue, but there is no "apply preset" function in code or UI.

---------------------------------------------------------------------------------------------------

## 6. COMMERCIAL MODEL HINTS (for the pricing agent)

### 6.1 In code
- Catalogue objects (PLATFORM-only): Offering (SETUP_FEE | RECURRING | ONE_TIME | TRIAL, with `moduleKeys[]`), PriceBook (currency, default flag, validity window), PriceBookEntry (`amountMinorUnits` in paise, `billingPeriodDays` e.g. 30/365), ClientPriceOverride (effective-dated, reason), Bundle (e.g. "Restaurant Starter Pack" in a code comment), ActivationRequest workflow with `quotedAmount`. This implies the intended model: recurring subscription per module/bundle + optional one-time setup fee + trial, per-client negotiated overrides, manual quoting/approval and manual activation.
- No amounts anywhere in code ("No monetary constants appear in application code", ADR-026); no seeded offerings. Currency default INR; timezone IST.
- `commercialStatus` lifecycle PROSPECT -> TRIAL -> ACTIVE -> SUSPENDED -> CHURNED; provisioning UI offers "Trial for a free pilot". Module lifecycle (master spec section 4): Available, Trial, Pending Setup, Active, Suspended, Disabled.
- Always-on core modules in provisioning: restaurant, catalog, checkout. Optional extras: reports, costs. Printing is a separate manifest (not offered in the provisioning dialog).

### 6.2 In the spec (restaurant doc section 38, master section on packaging)
| Package | Target | Core modules |
|---|---|---|
| Nexus Cafe | small cafe / bakery | Menu + Service Console + Checkout & Invoicing + Payments + Dining Tables |
| Nexus Restaurant | standard dine-in | Cafe + KOS + Guests + Team + Reports |
| Nexus Pro | high-volume restaurant | Restaurant + Stock Control + Procurement + Bookings + QR |
| Nexus Multi-Location | growing chain | Pro + Multi-Location + Central Controls + Advanced BI |
| Add-on Modules | specific needs | Guest Rewards, Direct Digital Orders, Dispatch, Advanced Stock Control... |
Spec statements: "subscription-led with optional setup/onboarding, hardware/device configuration, premium support and justified custom work"; "price validated against local Gujarat/India willingness-to-pay rather than guessed from feature count"; success criterion "Guests can buy only the modules they actually need".
- Implication for plan design: only plans whose contents are LIVE today can be sold with full confidence. Map: Cafe/Starter = restaurant + catalog + checkout; Restaurant = + reports + costs + team/RBAC + KOS (all live); Pro/Multi-Location tiers contain SPEC modules (Stock, Procurement, Bookings UI, QR, central controls) -> present as "coming soon", priced as waitlist/early-access or exclude from the price table.
- Printing & device setup and onboarding are natural one-time/paid add-ons (matches `SETUP_FEE`), but printing is unvalidated: sell as "assisted setup, hardware validated per site", not as guaranteed.
- The trial path already exists in the product (`commercialStatus: TRIAL`), so a "start with a free pilot/trial" offer is supportable operationally.
- UNKNOWN to this analysis: any actual price points, Manhar's GSTIN/legal entity details, Cashfree plan limits. A separate agent has produced `docs/landing/reports/03a_MARKET_PRICING_RESEARCH.md` (seen in the folder; not read or evaluated here).

---------------------------------------------------------------------------------------------------

## 7. RISKS AND GAPS FOR A PUBLIC LAUNCH

### 7.1 Technical / SEO / security
| # | Finding | Evidence | Action |
|---|---|---|---|
| R1 | Site is currently unindexable | `public/robots.txt`: `User-agent: * / Disallow: /` | Replace: allow `/`, `/terms`, `/privacy`, policy pages; `Disallow:` the authenticated app paths if desired (they render login anyway); add `Sitemap:` line. Needs edit of `apps/web/public/robots.txt` |
| R2 | No sitemap | `public/` has none | Add `public/sitemap.xml` (static list; hash anchors are not separate URLs). Needs an absolute domain: the final production hostname is UNKNOWN |
| R3 | Static meta/OG describe the old login | `index.html`: title "Manhar Nexus", description "Run the floor, the kitchen and the books from one calm place.", `og:image` `/og.png` (relative, so scrapers need an absolute URL), twitter card, `theme-color #070a09`; `og.png` is 249 KB in the old dark look, alt text refers to the old login tagline | Rewrite meta in `index.html` (also needed because WhatsApp/LinkedIn/Facebook scrapers do not run JS, so per-route head changes made by React will not be seen), regenerate OG image in the new brand colours, set absolute `og:url`/`og:image`, add `<link rel="canonical">`, `theme-color #0B0F0E`, JSON-LD (Organization/SoftwareApplication; JSON-LD is a data block and is NOT blocked by `script-src 'self'`) |
| R4 | Client-rendered only | no SSR/prerender; `<div id="root">` empty | Googlebot renders JS, social scrapers do not. Optional: a post-build script that writes a static HTML snapshot of the landing into `dist/` and have Caddy/Vercel serve it for `/`... but `/` also serves the app to signed-in users, so a snapshot cannot replace `index.html`. Keep it simple: strong static meta in `index.html` + `<noscript>` summary + semantic HTML |
| R5 | Page title/description are app-wide | `main.tsx` `applyBrand()` sets `document.title = brand.name`; `AuthProvider` doesn't touch the title | Landing sets/restores `document.title` and meta description in an effect |
| R6 | CSP blocks third parties | `script-src 'self'`, `connect-src 'self'`, `img-src 'self' data: blob:`, `font-src 'self'`, `frame-ancestors 'none'`, `form-action 'self'` | No Google Fonts/CDN, no analytics tag, no embedded video/maps, no remote images, no hosted form widgets. All images/fonts must be local. Inline styles ARE allowed (`style-src 'unsafe-inline'`), so scroll-linked transforms via `style=` are fine. Analytics: privacy-friendly self-hosted only, or none at launch |
| R7 | Fonts | JetBrains Mono not present anywhere; Satoshi has no 600 weight declared; `public/fonts` lacks a Mono file | Self-host JetBrains Mono 500 woff2 under `apps/web/public/fonts/` and declare `@font-face` in the landing CSS. Avoid adding an npm package: `Dockerfile.web` uses `npm ci` (lockfile must be regenerated and committed) and the sandbox here cannot run npm. Verify the OFL licence file is added to `THIRD_PARTY_NOTICES.md`. Brief says "npm @fontsource/jetbrains-mono" is acceptable if the owner prefers; then `package-lock.json` must change |
| R8 | Cache headers for landing assets | Caddy catch-all is `no-cache` | Add `handle /landing/*` and `/fonts/*` caching in Caddyfile (or `vercel.json` headers). Use `width`/`height` + `loading="lazy"` + WebP/AVIF; Caddy `encode` does not compress images |
| R9 | Deploy target unclear (Docker+Caddy vs Vercel) | section 1.6 | Owner decision needed before relying on any header/rewrite work. If Vercel: author `vercel.json` (SPA rewrite, headers copied from the Caddyfile, long cache for `/assets` `/landing` `/fonts`, `Content-Type` for sitemap) |
| R10 | Same host serves app and marketing | single `NEXUS_DOMAIN` / `*.vercel.app` | A branded domain is not present in the repo. A `*.vercel.app` URL is poor for SEO/trust. Consider `www.<domain>` (landing) vs `app.<domain>` (app) later; the cookie `SameSite=Strict` requirement (deploy.md line 51) means API must stay on the same registrable domain as the web app |
| R11 | Public form abuse / spam | none exists | Section 2.4 controls |
| R12 | Public pages reveal tenant info? | `/auth/login` messages are generic; lockout message `locked` is distinguishable (`LoginScreen` maps /locked/ to a different text) | Minor existing enumeration of locked accounts; unrelated to landing but do not add "does this email exist" feedback to the registration form |
| R13 | Security headers missing nothing major, but note `Cross-Origin-Opener-Policy same-origin` + `Cross-Origin-Resource-Policy` not set at Caddy for static files | Caddyfile | Fine for a first-party-only page; third-party popups (payment pages opened via `window.open`) would lose `window.opener`, so use same-tab redirect |
| R14 | Lighthouse for authenticated routes unverified; landing has no baseline | QA_REPORT | Run Lighthouse on `/` after build (mobile): LCP is the risk with hero imagery; preload hero image, `fetchpriority="high"`, `<picture>` WebP/AVIF |
| R15 | Hard-coded strings in the app that appear on the public login | `i18n/en.json` `auth.heroFootnote` "A Manhar Creatives product"; `LoginScreen` hero text and vignette ("Paneer Tikka", "Table T4")| Fine to keep. Login stays under `/login`; the brand mismatch (old green) between landing (#1DBA3C) and login (#22c55e) is visible when the user clicks Sign in. Flag to owner; not in the landing scope |
| R16 | `lib/brand.ts` and `Monogram` default accent `#22c55e`, favicon `#22c55e` | files above | Landing needs its own monogram component with `#1DBA3C` (copy geometry from `TILE_PATH`, `N_PATH`, `RULE_PATH` exported by `brand/Monogram.tsx`; N glyph is serif-style - flagged: brand rule says no serif; keep geometry per brief) |
| R17 | Missing legal/commercial facts | none in repo: no legal entity name, GSTIN, registered address, grievance officer, support email/phone, refund policy text | Owner must supply; policies are drafts for lawyer review. DPDP Act 2023 notice, IT Rules grievance officer, GST invoicing for subscription, Cashfree merchant terms (refund/cancellation display requirements) |
| R18 | Contact details | the repo has no public support email/phone/WhatsApp | Ask the owner which contact details to publish; never publish personal numbers unasked |

### 7.2 What the landing must NOT claim
- "Free trial / free forever" unless the owner decides it (the product supports `TRIAL` status operationally, but there is no self-serve trial).
- "Instant sign-up / instant workspace / live in minutes": provisioning is manual.
- Card, Razorpay or online-payment collection for restaurant bills; "accepts all payment methods". True today: Cash, UPI (static/manual, staff confirm UTR).
- Printing/receipt-printer support, "works with any thermal printer".
- QR menu, online/delivery orders, Zomato/Swiggy integration, WhatsApp bills, loyalty, inventory, recipes, purchase, bookings screen, staff shifts/payroll, discounts, split bills, AI.
- "Works offline", "100% uptime", "bank-grade/military-grade security", "SOC 2/ISO/PCI", "unhackable", "tamper-proof", "blockchain", "data stored in India", "dedicated database".
- Customer counts, logos, testimonials, awards, ratings, revenue-lift or time-saved percentages (none exist; no pilot yet). Use "design partners / pilot programme" language.
- NEC/IIT Bombay credentials or any personal credentials of the founder unless the owner supplies them for the About section (they are about the founder, not the product).
- Gujarati/Hindi interface (English only today).
- Support SLAs, response times or 24x7 support (none documented).

---------------------------------------------------------------------------------------------------

## 8. RECOMMENDED INTEGRATION ARCHITECTURE (validated and challenged)

### 8.1 Verdict
The proposal (lazy `src/landing/`, signed-out `/` shows landing, `/login` shows `LoginScreen`, signed-in users untouched, scoped CSS) is SOUND with five adjustments.

Why it works:
- `BrowserRouter` already wraps `Gate`, so `Gate` can read `useLocation()`.
- Signed-in users: the authenticated branch is unchanged, so `AppShell.test.tsx` (which seeds `nx.session=1`, pushes `/`, mocks fetch as authenticated) is unaffected.
- Lazy chunk: `React.lazy(() => import('./landing/LandingApp'))` keeps the 174.75 kB-gzip entry budget intact; Vite emits the CSS imported by the chunk as a separate async stylesheet.

Adjustments / challenges:
1. Keep the deep-link-return behaviour. Do NOT make every unauthenticated URL show the landing. Rule: signed-out + path `/` -> Landing; signed-out + one of the landing paths (`/terms`, `/privacy`, `/refund-policy`, `/cancellation`, `/billing`, `/register`, `/contact`, `/blog/*`...) -> Landing; signed-out + `/login` -> `LoginScreen`; signed-out + any other path -> `LoginScreen` (current behaviour, preserves return-to-view). Single-page requirement: legal "pages" can be routes that render inside the same lazy chunk (SPA fallback already serves them), with the main sections as hash anchors.
2. Signed-in users hitting `/login` or landing-only paths: `AppShell` would show its in-app 404. Add `Gate`-level redirect: authenticated + path `/login` -> `<Navigate to="/" replace/>`. Add landing paths to the route list only for signed-out. (After a successful sign-in at `/login`, `AuthContext` flips to authenticated and the user would otherwise sit on `/login` -> 404; the redirect fixes this.)
3. Avoid the "Loading..." flash and an unnecessary LCP delay on the landing. `Gate` currently renders the loading div while `status==='loading'`. For visitors with no session hint, render the landing immediately (e.g. in `Gate`: `if (status==='loading' && !hasSessionHint() && isLandingPath) -> Landing`). `hasSessionHint` is exported from `auth/api.ts`. Optionally change `AuthProvider` initial state to `hasSessionHint() ? 'loading' : 'unauthenticated'`; this keeps `sessionHint.test.tsx` assertions valid (no refresh call without hint). Returning owners with a hint still see the loading screen, then the app (they are logged in) - acceptable; a stale hint resolves to landing after the 401.
4. Copy must not go through i18next (section 1.4): typed TS content modules in `src/landing/content/*.ts`, not `en.landing.json`, and avoid a local helper named `t(...)` with dotted literals.
5. Isolation of global CSS (section 1.5): the app stylesheet is global and unconditional; the landing chunk cannot "unload" it. Mitigations: (a) wrap the landing in `<div class="lp-root">` with its own opaque Soft White background and `position:relative; z-index:1; isolation:isolate` so the fixed `body::before/::after` aurora/grain are hidden behind it; (b) on mount set `document.documentElement.dataset.surface='landing'` and `color-scheme: light` (restore on unmount) so overscroll/scrollbars/inputs are light; the Ink hero/footer blocks set `color-scheme: dark` locally; (c) landing CSS re-declares `:focus-visible` inside `.lp-root` (Forest `#12802B` ring on light, `#1DBA3C` on Ink) overriding the green glow; (d) use `--lp-*` custom properties only; never `bg-paper/text-ink/...` utilities; Tailwind utilities with arbitrary values or plain CSS classes are fine; (e) the global reduced-motion rule neutralises CSS animations; scroll-linked JS transforms (3D layers) must additionally check `matchMedia('(prefers-reduced-motion: reduce)')` and skip.
6. Per-route head management is manual (no react-helmet; React 18): small `useDocumentMeta()` hook in the landing that sets title/description/canonical/og:url and restores `brand.name` on unmount.

### 8.2 Proposed file layout
```
apps/web/src/landing/
  LandingApp.tsx            default export, routes: / (home sections) and policy/legal routes
  landing.css               all styles, scoped under .lp-root, @font-face for JetBrains Mono, tokens from the Brand Guide
  content/*.ts              typed copy: hero, intro, why, modules, how, plans, faq, posts, legal
  sections/*.tsx            Preloader, Hero, Intro, About, Compare, Features, HowItWorks, Pricing, Faq, Insights, Contact, Register
  components/*.tsx          LpMonogram (recoloured), ParallaxStack, StickyStack, Reveal, Header, Footer
  hooks/useDocumentMeta.ts, useReducedMotion.ts, useScrollProgress.ts
  registration/RegisterForm.tsx + submit.ts   (Tier 0 mailto/WhatsApp; Tier 1 fetch)
apps/web/public/landing/*.webp|avif   generated imagery
apps/web/public/fonts/jetbrains-mono-500.woff2
```
Preloader: a pure-CSS/short JS overlay inside the landing, shown only on first landing view per session (`sessionStorage` in try/catch), hard time cap (<= 1.2 s), skipped for reduced motion, must never gate content or LCP. Do not block the app path with it.

### 8.3 Exact edits to existing files
| File | Edit |
|---|---|
| `apps/web/src/App.tsx` | Add `import { lazy, Suspense } from 'react'`, `useLocation`, `Navigate`; `const LandingApp = lazy(() => import('./landing/LandingApp'))`; in `Gate()` add a pure helper `isPublicPath(pathname)`; branch order: loading(+no hint+public path -> Landing) -> authenticated+mustChangePassword -> authenticated (+ `/login` -> `<Navigate to="/" replace />` handled before `AppShell`) -> unauthenticated: `pathname==='/login' || !isPublicPath` ? `LoginScreen` : `Suspense(fallback=null) LandingApp`. Keep providers order. ~25 lines |
| `apps/web/src/auth/LoginScreen.tsx` | OPTIONAL: add a small "Back to website" / "Register your restaurant" link (anchor to `/` and `/#register`). Not required |
| `apps/web/src/auth/AuthContext.tsx` | OPTIONAL: initial status from `hasSessionHint()` (adjustment 3) |
| `apps/web/src/main.tsx` | no change required (CSS for the landing arrives with the lazy chunk). Do not import landing.css here |
| `apps/web/index.html` | rewrite title/description/OG/Twitter/`theme-color`/canonical; absolute URLs; `<meta name="robots" content="index,follow">`; JSON-LD block; optional `<link rel="preload" as="font" type="font/woff2" crossorigin href="/fonts/clash-display-600.woff2">` (and satoshi-400) - preloading fonts for the app login too is harmless. Replace `og.png` (new asset) |
| `apps/web/public/robots.txt`, `public/sitemap.xml` (new), `public/favicon.svg` (recolour to #1DBA3C only if owner wants the tab icon to match; app icon is shared) | see R1-R3 |
| `deploy/Caddyfile` | (a) add `handle /landing/*` and `handle /fonts/*` blocks with `Cache-Control "public, max-age=604800"` BEFORE the catch-all; (b) NO CSP change if images/fonts are local and payment is a redirect; (c) if a Cashfree JS SDK is chosen, extend `script-src`, `connect-src`, `frame-src`, `Permissions-Policy payment`; (d) optional `redir /index.html /` not needed. SPA fallback already covers `/login`, `/terms`... |
| `vercel.json` (new, only if Vercel is the real target) | rewrites + headers mirroring Caddy |
| `apps/web/src/i18n/*` | none (landing copy deliberately outside i18n) |
| `docs/` | optional: ADR note "ADR-033 Public landing & registration requests" |

### 8.4 Existing tests that would break and fixes
| Test | Why it breaks | Fix |
|---|---|---|
| `apps/web/src/App.test.tsx` "shows the sign-in screen when there is no session" | renders `<App/>` at jsdom default URL `/` and expects "Sign in to Manhar Nexus" | add `window.history.pushState({}, '', '/login')` in `beforeEach` (keeps the intent: sign-in screen when no session). Add a new test: at `/` unauthenticated renders the landing's h1 (lazy: use `findBy...`) |
| `App.test.tsx` "renders the brand name on the sign-in screen" | same | same fix |
| `auth/sessionHint.test.tsx` both tests | `pushState({}, '', '/')` then waits for `getByLabelText(/email/i)` | change the pushState to `/login` (the hint logic is path-independent) |
| `i18n/keys.test.ts` | would fail if landing code calls `t('dotted.key')` without matching resources | avoid `t()` in landing (adjustment 4) |
| `shell/AppShell.test.tsx` | not affected (authenticated, `/`, then `/kitchen`, `/tables`) unless `Gate` redirects change authenticated `/` behaviour - it must not | keep authenticated path handling identical; re-run |
| `tsc --noEmit` / `eslint` (CI) | new code must be typed; `build` runs `tsc` first. ESLint config at repo root (`eslint.config.mjs`); landing code is linted | keep strict types; no `any` |
| Lighthouse/bundle budget | not a test, but entry JS must stay near 175 kB gzip: ensure `landing` is NOT statically imported anywhere (a stray `import` in `App.tsx` defeats the split) | verify with `vite build` output chunk list |
New tests worth adding (owner of frontend decides): path-routing unit test for `isPublicPath`, landing smoke render, registration form validation (honeypot, consent), `useDocumentMeta` restore.

### 8.5 Alternative considered and rejected
- Separate multi-page Vite entry (`landing.html`) served at `/` by the web server: cannot decide auth server-side (the refresh cookie is `Path=/auth`), so signed-in owners opening `/` would hit the marketing page; and Caddy `try_files` would need a path split (e.g. move the app to `/app/*`), a breaking change for every deep link, PWA scope, `BrowserRouter basename`, and tests.
- Separate repo/Vercel project for marketing on `www.` with the app on `app.`: cleanest SEO and CSP separation, and arguably the best long-term shape, but outside the "inside apps/web" brief and requires a purchased domain (UNKNOWN). Keep the landing code self-contained under `src/landing/` so it can be lifted into its own project later with minimal changes.

---------------------------------------------------------------------------------------------------

## APPENDIX A - Key file/symbol index
- Auth gate: `apps/web/src/App.tsx` (`Gate`), `apps/web/src/auth/AuthContext.tsx` (`AuthProvider`, `useAuth`), `apps/web/src/auth/api.ts` (`hasSessionHint`, `tryRefresh`, `login`, `api`)
- Routes/pages: `apps/web/src/shell/AppShell.tsx` (`<Routes>`), `apps/web/src/shell/pages.tsx` (`PAGES`)
- Platform provisioning: `apps/web/src/onboarding/provision.ts` (`runProvision`, `generatePassword`, `CORE_MODULES`, `OPTIONAL_MODULES`), `NewRestaurantDialog.tsx`
- API: `apps/api/src/iam/auth.controller.ts`, `provisioning.controller.ts`, `iam/principal.ts` (`Public`, `RequirePermission`), `iam/permission.registry.ts` (platform perms ~line 86-110), `core/business/business.controller.ts`, `onboarding/*`, `commercial/*`, `modules/module-manifest.ts`, `core/audit/audit.service.ts` (`verifyChain`), `app.factory.ts` (helmet, CORS, trust proxy), `common/domain-exception.filter.ts` (error envelope `{statusCode, error:{code,message,details}, requestId}`)
- Schema: `apps/api/prisma/schema.prisma` (`Business` l.118, commercial models l.1560-1760, `OnboardingProgress` l.1844)
- Edge/deploy: `deploy/Caddyfile`, `Dockerfile.web`, `docker-compose.prod.yml`, `docs/runbooks/deploy.md`, `docs/runbooks/collaboration-and-deploy.md`, `docs/ui/DEPLOYMENT_READINESS.md`
- Truth docs: `docs/MASTER_IMPLEMENTATION_ROADMAP.md` (status table, "What NOT built" per phase), `docs/ui/POSITIONING.md`, `docs/ui/QA_REPORT.md`, `docs/ui/SECURITY_REVIEW.md`, `docs/ui/OWNERSHIP_AND_WHITE_LABEL.md`, `docs/adr/ADR-002/007/008/009/010/011/013/014/015/016/017/026/027/028/032`

## APPENDIX B - Open questions for the owner
1. Real production target and domain: Docker+Caddy host or Vercel+Neon? Which hostname will the landing live on (SEO, OG URLs, sitemap)? Why is the latest Vercel production deployment BLOCKED?
2. Is the data region really India (Neon/Vercel region, or the Docker host)? Until confirmed, do not state data residency.
3. Legal entity name, GSTIN, registered address, grievance officer, public support email/phone/WhatsApp for policies and the contact section.
4. Is a free trial/pilot offered, and for how long? (Product supports `TRIAL` status; no self-serve trial.)
5. Approve the lead-capture (Tier 0 now, Tier 1 later) approach; confirm no auto-provisioning from public requests until payment verification exists.
6. Cashfree product choice (subscriptions/mandates vs payment links) and whether redirect-based flow is acceptable (keeps CSP strict).
7. Who owns app-side rebrand to #1DBA3C (favicon, login, tokens)? Currently out of landing scope.
