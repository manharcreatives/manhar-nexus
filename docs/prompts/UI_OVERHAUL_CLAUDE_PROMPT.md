# CLAUDE PROMPT — Manhar Nexus: Sellable, Fully-Owned, Award-Worthy V1

> Copy everything below this line into Claude (Claude Code with multi-agent/subagents preferred).

---

## 0. MISSION

You are the **Product Lead + Design Director + Principal Full-Stack Engineer + QA/Security Lead** for **Manhar Nexus**, a modular business operations platform.

This is **not** a "build everything" task. This is a **sell it** task.

> Make Manhar Nexus a focused, fully working, reliable, great-looking product that **we can confidently sell to a real restaurant/business as our own**, demo end-to-end, and support through a pilot — without apologizing, without "that part is coming," and without depending on someone else's brand or platform.

Two equal bars:

1. **It works.** Every visible action works, every flow in scope completes, money/time are correct, permissions hold, states are handled.
2. **It's ours and it's excellent.** A distinctive, original, white-label-ready product — not a generic admin template, not a reskinned stock UI, not a mashup of borrowed screens. Award-worthy craft, but in service of selling and daily use.

**Scope discipline is part of the job.** A tight, polished, ownable V1 that closes deals beats a broad, half-finished platform. Cut ruthlessly, ship what sells.

---

## 1. WHO WE'RE SELLING TO & THE PROMISE

**Buyer:** Restaurant owner / operator (single or multi-location), and the platform admin at Manhar Creatives who onboards them.

**What they're buying:**
- A calmer, faster way to run daily service: floor → kitchen → bill → payment → reports.
- Visibility and control: sales today, open tables, kitchen load, costs, staff/roles, audit trail.
- Confidence: permissions, audit, backups, reliable printing, data they own.

**The promise the product must keep in the first 10 minutes:**
> "This feels like a real, premium product built for us — and I can see exactly how it makes my day easier."

**The demo must tell one clear story**, not tour every feature. Sell the outcome, not the module list.

---

## 2. SCOPE — SELLABLE V1

Lock scope before designing. If in doubt, cut. Everything not in "IN" is deferred.

### IN (must be sellable, polished, working)
- **Auth & access:** login, session handling, role-aware navigation, permission-denied UX.
- **Shell & identity:** branded app shell, working business/location context, notifications, user menu, environment/version.
- **Restaurant daily operations (the core sale):**
  - Tables/floor + sessions
  - Order building (items, variants, modifiers), send to kitchen
  - Kitchen Display (KDS) lifecycle
  - Checkout: invoice, payment capture/cancel/refund, session close
  - Correct money, tax, and receipt/print affordance where supported
- **Owner visibility:** dashboard, reports (daily/sales/top items), operating costs (expenses + approvals + summary).
- **Trust & admin (client-facing basics):** activity/audit view, roles/users, basic settings + alert rules.
- **Onboarding:** a guided go-live journey for a new client (no raw UUIDs).
- **Platform internal surfaces** (commercial, modules, price books, bundles, activation): functional and credible, but **not** the sales centerpiece. Do not gold-plate internal tools.

### LATER (do not build now)
- Digital orders, dispatch, aggregators, marketplace
- AI insights / exception center
- Native mobile apps
- Multi-currency, multi-tax-regime complexity beyond current support
- Advanced split/merge/course/hold if not already functional
- White-label admin UI for clients to rebrand themselves (config-level rebrand is enough)

### OUT
- Feature parity with Toast/Square/Lightspeed
- Plugin ecosystem, public API program
- Dark mode (unless it is nearly free and correct)
- Exhaustive documentation, Storybook-as-a-product, or internal tooling beyond what ships
- New modules not demanded by a real pilot

**Rule:** if a change doesn't make the product more sellable, more trustworthy, or more usable in daily service, it is not in V1.

---

## 3. OWNERSHIP & WHITE-LABEL (NON-NEGOTIABLE)

We must be able to say "this is fully ours" and hand it to a client under our brand.

1. **Original design.** No copied competitor screens, no paid template, no "inspired-by" clones of a specific product. Research principles, not pixels.
2. **Own assets.** Logo mark/wordmark, favicon, OG image, empty-state illustrations, and any custom graphics are original or properly licensed. Keep source files in the repo.
3. **Fonts.** Self-hosted, commercially embeddable license (OFL/Apache preferred). Record the license. No runtime Google Fonts CDN.
4. **Icons.** One set with a permissive license (e.g., lucide, ISC). Record third-party notices.
5. **No branding leaks.** No third-party product names/logos in the UI, no "powered by <SaaS>" in core flows, no vendor branding the client would question.
6. **Rebrandable.** Product name, logo, accent color, and key brand strings must be configurable (env/config/tenant config) without code surgery. At minimum: one place to change name/logo/accent, documented.
7. **No lock-in.** Core runs on our stack (React/NestJS/Postgres) in our repo. No proprietary UI builder or hosted-only dependency required for the sold product. Third-party services must be optional and swappable.
8. **Data ownership.** Client can export their operational data (CSV/JSON) and we can back up/restore. Document it.
9. **License hygiene.** Add a `THIRD_PARTY_NOTICES.md` and ensure no GPL/AGPL dependency is introduced into distributed code without explicit approval.
10. **Code ownership.** Clean, typed, tested, documented enough that another Manhar engineer can take over. No dead code, no mystery hacks.

**Deliverable:** `docs/ui/OWNERSHIP_AND_WHITE_LABEL.md` (assets, fonts, licenses, rebrand steps, data export, dependencies).

---

## 4. PRODUCT & TECH CONTEXT

- **Product:** Manhar Nexus — "One Platform. Configure It Your Way."
- **Model:** Modular monolith: Core + Modules + Configuration; multi-business, multi-location, RBAC.
- **Primary vertical:** Restaurants.
- **Company:** Manhar Creatives.
- **Local demo login:** `platform@manhar.local` / `ChangeMe!Dev12345` (development only).
- **Local URL:** web `http://localhost:5173`, API `http://localhost:3000`, Postgres `localhost:15432`.
- **Current reality:** backend is deep and tested internally (~596 E2E, 27 unit), but the product is **not sellable yet**: UI is a generic admin, several flows are CRUD-grade or developer-oriented, some actions are incomplete, and it doesn't feel like something a business would buy.

**Read before touching code:**
- `README.md`
- `docs/MASTER_IMPLEMENTATION_ROADMAP.md` (known issues, deferred items)
- `docs/pilot-acceptance-checklist.md`
- `docs/PROJECT_SETUP_AND_TRANSFER_GUIDE.md`
- `docs/runbooks/`
- `Manhar_Nexus_Master_Product_Architecture_v1.md` (READ-ONLY)
- `Manhar_Nexus_Restaurant_Product_Architecture_v2_Original_Terminology.md` (READ-ONLY)
- `docs/spec-normalized/CANONICAL_GLOSSARY.md`
- `apps/api/prisma/schema.prisma`, `apps/api/prisma/demo-seed.ts`
- `apps/api/src/**` controllers/services and `apps/web/src/**` pages

Respect the source-of-truth hierarchy. Never silently rewrite product requirements.

**Fixed stack:** React 18, TypeScript, Vite 6, Tailwind CSS v4, NestJS 11, Prisma 6, PostgreSQL, react-i18next, Node ≥ 20.

**Allowed:** additive backend endpoints/DTOs/services the UX genuinely needs; bug fixes; validation/transaction/idempotency hardening; additive Prisma migrations; justifiable frontend deps (native CSS, Radix primitives, `clsx`/`tailwind-merge`, `lucide-react`, `framer-motion`).

**Forbidden:** breaking existing API contracts/tests; deleting/weakening tests; secrets in code; default telemetry; wholesale UI frameworks (MUI/Chakra/Ant/shadcn-as-the-system).

---

## 5. DEFINITION OF "SELLABLE"

All must be true.

### Functional
1. Every visible action works or is honestly disabled with a reason.
2. In-scope flows complete end-to-end and persist after refresh/re-login.
3. No dead ends, no placeholder screens in primary navigation, no raw UUIDs as primary input.
4. Money, tax, totals, rounding correct and consistent; currency/locale formatting correct.
5. Inline validation; server errors mapped to human messages; success confirmed.
6. Permissions enforced in UI and API; wrong-role access prevented and explained.
7. Business/location isolation respected in every list, selector, and form.
8. Money/state actions are safe against double-click/retry (idempotency).
9. Restaurant golden path and client-onboarding path work without manual DB edits.

### UX
10. A stranger understands the product, the task, and their location within seconds.
11. One obvious primary action per screen; clear scan order; secondary actions recede.
12. Loading, empty, error, permission, offline, partial, long-content states designed and implemented.
13. POS/floor and KDS usable on touch; owner flows usable on phone.
14. Copy specific, calm, human; canonical terms; no developer jargon.

### Visual
15. One coherent premium system; no one-off styling.
16. Distinctive typography, color, spacing, iconography, motion, data display.
17. Before/after screenshots; independent Critic signs off "award-worthy, not generic."

### Trust / Ops
18. `typecheck`, `lint`, `test`, `test:e2e`, `build` pass with captured output.
19. Lighthouse on key routes: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95.
20. WCAG 2.1 AA; keyboard-only operation; reduced motion; no console errors.
21. Clean-machine demo: `db:init` → `db:migrate` → `demo:seed` → `build` → `preview`.
22. Demo script, ownership doc, and deployment readiness doc exist and match reality.

---

## 6. MULTI-AGENT OPERATING MODEL

Use subagents/tasks if available; otherwise simulate sequentially with the same rigor. **One owner per file at a time. No one-off styles. No unscoped feature work.**

### Orchestrator (you)
- Lock scope (§2), create plan/todo/branch, enforce phase gates, maintain decision log.
- Reject generic, incomplete, or out-of-scope work.
- Guarantee single sources of truth: tokens, primitives, types, money/time helpers.
- Keep API changes additive and tested.

### Agent A — Product & Sales Strategist
- Define the one demo story, the buyer, objections, and the "first 10 minutes" experience.
- Cut scope: produce the IN/LATER/OUT list and defend it.
- Write the 5-minute demo script and a 1-page feature sheet.
- Deliverable: `docs/ui/DEMO_SCRIPT.md`, `docs/ui/POSITIONING.md`.

### Agent B — Functional Auditor
- Walk every route and API. Build a capability matrix: feature → UI → API → works? → gap.
- Find dead buttons, unhandled actions, raw-ID forms, missing search/pagination, wrong money/time, missing validation, broken role gating, flows requiring manual DB edits.
- Reproduce with steps; rank by daily-use and demo impact.
- Deliverable: `docs/ui/FUNCTIONAL_AUDIT.md` + prioritized backlog.

### Agent C — Backend & API Hardening
- Fix functional defects; add only the additive endpoints/fields UX needs.
- Enforce DTO validation, consistent errors, authorization, transactions, idempotency for money/state, audit events, pagination limits.
- Tests for every change (unit + E2E); additive migrations verified on a fresh DB.
- Deliverable: code + tests + `docs/ui/BACKEND_CHANGELOG.md`.

### Agent D — Brand, Design System & Foundations
- Research principles (Linear, Stripe, Ramp, Mercury, Toast, Square, Awwwards/Godly/Mobbin) — extract, never copy.
- Choose one art direction (default bias: warm editorial-operational hybrid — paper/ink base, one confident signature accent, expressive display + precise UI type, generous negative space around dense data). Document rationale.
- Tokens in `apps/web/src/styles.css` via Tailwind v4 `@theme`; self-host fonts; `font-display`/`font-ui`.
- Primitives in `apps/web/src/ui/`: Button, IconButton, Input, Select, Combobox, Textarea, Checkbox, Switch, Field, Card, Panel, Badge, StatusPill, Tabs, Table, DataGrid, Dialog, Sheet, Drawer, Tooltip, Popover, Menu, Toast, EmptyState, ErrorState, Skeleton, Spinner, Avatar, Kbd, PageHeader, StatCard, Timeline, Pagination, Breadcrumb, CommandPalette.
- Formatters: `lib/format.ts` (currency/date/number), `lib/money.ts` (minor units), `lib/cn.ts`.
- Deliverables: `docs/ui/ART_DIRECTION.md`, `docs/ui/DESIGN_SYSTEM.md`, dev-only `/_ui` showcase.

### Agent E — Shell, Auth & Identity
- Rebuild `AppShell` + `LoginScreen` first. Working business/location selectors (or remove them honestly). Command palette, mobile nav, keyboard shortcuts, user menu, environment badge.
- Logo/wordmark, favicon, theme-color, titles, OG/meta; rebrand config.
- Auth UX: visibility toggle, caps-lock hint, inline validation, loading, rate-limit/session-expiry messaging, safe return-to-view.
- Deliverable: implemented + `docs/ui/OWNERSHIP_AND_WHITE_LABEL.md`.

### Agent F — Restaurant Core
- Tables/floor/sessions; order building with variants/modifiers; send to kitchen; KDS lifecycle; checkout/invoice/payment/session close.
- Real POS ergonomics (thumb-friendly tablet, keyboard shortcuts on desktop); clear destructive confirmations; correct money math.
- Gate: golden path demo works with seed data and persists.
- Deliverable: implemented pages + notes.

### Agent G — Owner Visibility & Trust
- Dashboard: real role-aware "today" (sales, orders, open tables, kitchen load, pending approvals, alerts, quick actions) from existing APIs; honest designed states if data missing.
- Reports: KPIs, date presets, trends, payment/tax breakdowns, top items, export/print, no-data.
- Costs: expenses, categories, approvals (bulk), summary.
- Activity/audit: timeline + filters + integrity as trust signal.
- Roles/users, settings + alert rules: clear, safe, validated.
- Deliverable: implemented pages + notes.

### Agent H — Client Onboarding & Internal Surfaces
- Onboarding: guided go-live checklist; searchable business picker (add API if needed); steps/blockers/notes/LIVE.
- Commercial + modules: functional and credible, not gold-plated. Prefer clear next actions over exhaustive admin.
- Notifications: grouped, prioritized, deep-linked.
- Deliverable: implemented + notes.

### Agent I — States, Copy, i18n & Accessibility
- Full state matrix per surface; skeletons matching layout; humane errors; permission/offline.
- Copy pass across i18n keys; canonical terms; remove raw IDs from primary flows.
- A11y: labels, landmarks, focus order/trap, `aria-live`, reduced motion, contrast, 44px targets.
- Deliverable: accessibility report + fixes.

### Agent J — Performance, Security & Reliability
- Budgets: shell JS ≤ 250 KB gzip (excl. route chunks), LCP < 2.5s, CLS < 0.1, 60fps.
- Code-splitting, lazy charts/dialogs, list virtualization, request cancellation, no storms.
- Security: auth/session/refresh, CSRF posture, RBAC on new routes, tenant isolation/IDOR, validation, rate limits, money/time/idempotency.
- Verify error boundaries, degraded API messaging, structured logs, audit coverage.
- Deliverables: `docs/ui/QA_REPORT.md`, `docs/ui/SECURITY_REVIEW.md`.

### Agent K — Adversarial Critic (independent)
- Harsh review of every in-scope screen against §§7–9.
- Ask: "Would this close a deal? Would a paying client trust it for a full shift? Is any part generic, fake, or incomplete?"
- Reject and return with concrete fixes; no default first-pass approval.
- Deliverable: `docs/ui/CRITIQUE_LOG.md`.

### Agent L — Packaging, Demo & Deployment
- Demo seed that looks alive (multi-location, menu, orders, expenses, reports).
- Production build + preview from clean state; metadata/favicon/OG; 404; error boundary; env banner; version.
- Verify runbooks/pilot checklist against reality; update if changed.
- Deliverables: `docs/ui/DEPLOYMENT_READINESS.md`, updated runbooks, feature sheet.

---

## 7. DESIGN CONSTITUTION

1. **One system.** Tokens only; repeated values become tokens.
2. **Hierarchy first.** One obvious primary action; clear scan order; receding secondary actions.
3. **Typography is the design.** Distinctive, commercially embeddable pairing; deliberate scale; real weight contrast; tabular numerals for money; 45–75ch measure. No `system-ui` slop.
4. **Color with intent.** Neutral + ink + one signature accent + semantics. Not Tailwind blue. AA contrast. Never color-only status.
5. **Space is a feature.** Generous rhythm; density only where operators need it (tables, KDS, audit).
6. **Depth with restraint.** Borders/tonal layering over shadow soup; no glassmorphism clichés.
7. **Motion with purpose.** 120–240ms micro, 240–400ms surfaces; respect `prefers-reduced-motion`.
8. **Iconography.** One set, consistent stroke/size; no emoji.
9. **Data is beautiful.** KPIs, tables, charts, badges share a language; right-aligned tabular numbers, units, localized, deltas with context.
10. **Copy is product.** Specific, calm, confident; no lorem, no dead "coming soon" in primary nav, no raw IDs, no engineer voice.
11. **Every state designed.** Loading, empty, error, success, permission, offline, partial, long-content.
12. **Accessible by default.** Keyboard, screen reader, contrast, focus, reduced motion, touch targets.
13. **Responsive by intent.** Recompose, don't just stack: sidebar → bottom bar/sheet; tables → cards; KDS → full-screen; POS → thumb-friendly.
14. **Award-worthy ≠ decorative.** Wow from clarity, craft, rhythm, typography, micro-interactions, confidence.

---

## 8. FUNCTIONAL CONSTITUTION

1. **No fake UI.** Visible ⇒ works; otherwise honestly disabled with a reason or absent.
2. **Persist everything.** Create/edit/transition survives refresh and re-login.
3. **Validate twice.** Inline client + authoritative server; map errors to human messages.
4. **Money is sacred.** Integer minor units; one formatter; explicit currency; consistent rounding; no float math in UI totals.
5. **Time is explicit.** Store UTC; display in location timezone; correct date boundaries.
6. **Idempotency.** Payments, finalise, session close, approvals, transitions safe against double-click/retry.
7. **Authorization everywhere.** UI gating is convenience; API is the boundary; tests for new routes.
8. **Tenant isolation.** Every query scoped; cross-tenant returns 404/403, never data.
9. **Concurrency.** Read-modify-write transactional or lock-safe; audit sequence gapless.
10. **Recoverable errors.** Explain cause + next step; retry where safe.
11. **Search & scale.** Search/filter/sort/pagination where volume demands.
12. **Audit & observability.** New mutations emit audit events + structured logs.
13. **Backward compatibility.** Additive changes only unless approved.
14. **Demo-ready reality.** Seed data exercises real states, not just happy path.

---

## 9. FORBIDDEN PATTERNS

**UI/Design:** default Tailwind blue/slate admin; identical card grids; unstyled tables; browser-default inputs; random radii/shadows/spacing; emoji icons; color-only status; generic errors; unexplained disabled controls; raw UUIDs as primary input; tooltip-only critical actions; modal-for-everything; mismatched skeletons; "coming soon" in primary nav; engineer-voice copy; charts without labels/units; motion that delays; fake numbers/lorem/dead buttons/half-migrated pages.

**Engineering:** silent contract breaks; deleting/weakening tests; float money math; naive timezones; missing auth/tenant scoping; unbounded queries; N+1 list endpoints; request storms; `any` to dodge types; disabled lint without justification; secrets in code; touching read-only product docs; unscoped feature creep.

---

## 10. REQUIRED DELIVERABLES

```
apps/web/public/fonts/…                     self-hosted variable fonts (with licenses)
apps/web/src/styles.css                     @theme tokens, base styles, utilities
apps/web/src/ui/…                           primitives
apps/web/src/ui/icons.ts                    icon registry
apps/web/src/lib/cn.ts | format.ts | money.ts
apps/web/src/components/…                   composed components
docs/ui/POSITIONING.md
docs/ui/FUNCTIONAL_AUDIT.md
docs/ui/ART_DIRECTION.md
docs/ui/DESIGN_SYSTEM.md
docs/ui/BACKEND_CHANGELOG.md
docs/ui/OWNERSHIP_AND_WHITE_LABEL.md
docs/ui/SECURITY_REVIEW.md
docs/ui/CRITIQUE_LOG.md
docs/ui/QA_REPORT.md
docs/ui/DEMO_SCRIPT.md
docs/ui/DEPLOYMENT_READINESS.md
docs/ui/screens/…                           before/after screenshots per in-scope route
docs/adr/ADR-031-ui-design-system.md
THIRD_PARTY_NOTICES.md
```

Screenshots: real browser at 1440×900, 1024×768, 390×844 for every in-scope route. Before + after.

---

## 11. EXECUTION PLAN (WITH GATES)

**Phase 0 — Protect Baseline**
1. Start DB/API/web; log in; click every nav item and action; capture before screenshots.
2. Run and record: `typecheck`, `lint`, `test`, `test:e2e`, `build`.
3. Branch from `main`; never commit to `main`.
4. Inventory routes, API modules, roles, seed data, known/deferred items.

**Phase 1 — Scope Lock & Functional Audit**
- Produce IN/LATER/OUT + capability matrix + prioritized backlog.
- Decide per gap: UI-only / additive API / bug fix / migration.
- Gate: Orchestrator approves scope and file ownership. **No feature outside IN.**

**Phase 2 — Brand & Foundations**
- Art direction, tokens, fonts, primitives, formatters, money/time helpers, `/_ui`.
- Gate: every primitive correct; tokens are the only styling source; ownership doc started.

**Phase 3 — Shell + Auth**
- Rebuild shell and login; working context selectors; command palette; mobile nav; identity assets; rebrand config.
- Gate: premium desktop + mobile; keyboard works; Critic approves.

**Phase 4 — Restaurant Golden Path**
- Tables/sessions → order → kitchen → KDS → checkout → payment → close. Fix functional gaps. Touch-verify.
- Gate: end-to-end works with seed data, persists, money verified.

**Phase 5 — Owner Visibility & Trust**
- Dashboard → Reports → Costs → Activity → Roles/Users → Settings/Alerts.
- Gate: functional, state-complete, design-consistent; Critic page-by-page sign-off.

**Phase 6 — Onboarding & Internal Credibility**
- Onboarding (searchable picker, steps, LIVE) + commercial/modules/notifications to a credible standard.
- Gate: client-onboarding path works; internal tools are not gold-plated.

**Phase 7 — Cross-Cutting Hardening**
- Global states, toasts, dialogs, focus, error boundary, 404, env banner; i18n pass; raw-ID removal; permission UX; a11y/responsive.
- Idempotency/validation/tenant review on touched endpoints.
- Gate: keyboard-only path passes; no dead actions; axe/contrast clean.

**Phase 8 — Performance, Security & QA**
- Code-split, bundle profile, lazy load; security review; full gates green.
- Gate: budgets met; no console errors; all tests pass with captured output.

**Phase 9 — Packaging & Sell**
- Demo seed, clean-machine demo, build/preview, metadata, runbooks, demo script, feature sheet, ownership/license notices.
- Gate: clean-state demo works; docs match reality.

**Phase 10 — Adversarial Final Review**
- Critic verdict per screen; fix below "award-worthy"; before/after gallery; ADRs; roadmap update.
- Gate: Definition of Done (§13) fully checked with evidence.

---

## 12. GOLDEN PATHS (MUST WORK END-TO-END)

**Restaurant (the sale)**
1. Login → select business/location.
2. Open table/start session.
3. Add items with variants/modifiers; verify totals/tax.
4. Send to kitchen; see on KDS.
5. Advance ticket/item states.
6. Checkout: create/finalise invoice; capture payment; test cancel/refund.
7. Close session; table free.
8. Sale appears in Reports; action in Activity.
9. Record/approve a cost; verify summary.

**Client onboarding (the handoff)**
1. Platform admin creates/locates client business.
2. Activate modules; complete setup.
3. Start onboarding; advance steps; reach LIVE with validations satisfied.
4. Verify audit + notifications.

**Trust**
1. Change setting; verify precedence (Location > Business > default).
2. Create alert rule; trigger event; receive notification.
3. Verify non-owner roles can't see/do restricted actions.
4. Stop API/Redis/storage; verify honest degraded state + retry.
5. Double-click money actions; verify no duplicates.

Automate where feasible (E2E/unit); otherwise manual verification with evidence.

---

## 13. QUALITY GATES & DEFINITION OF DONE

**Run and report real output:**
```powershell
npm run typecheck
npm run lint
npm run test
npm run test:e2e
npm run build
npm run dev:web   # manual golden-path walkthrough
```
Plus: Lighthouse (login/home/tables/kitchen/checkout/reports); keyboard-only walkthrough; screen-reader spot check; reduced-motion; 390/768/1024/1440 screenshots; zero console errors; bundle report.

**Done checklist**
- [ ] Scope locked; no out-of-scope features built.
- [ ] Functional audit complete; all P0/P1 in-scope gaps resolved.
- [ ] Every visible action works or is honestly disabled.
- [ ] Restaurant golden path + client onboarding pass end-to-end.
- [ ] Money/time/idempotency/tenant-scoping verified.
- [ ] One coherent design system; no one-off styling.
- [ ] In-scope pages redesigned; all states implemented.
- [ ] Raw UUIDs removed from primary flows; copy pass complete.
- [ ] Responsive 390/768/1024/1440; POS + KDS touch-usable.
- [ ] WCAG 2.1 AA; keyboard + screen reader checks pass.
- [ ] Lighthouse targets + budgets met; no console errors.
- [ ] All gates green with captured output.
- [ ] Demo seed realistic; clean-machine demo verified.
- [ ] Demo script, positioning, ownership/license, security, deployment docs written.
- [ ] Rebrand config works (name/logo/accent); no third-party branding leaks.
- [ ] `THIRD_PARTY_NOTICES.md` accurate; no problematic licenses introduced.
- [ ] ADR(s) + roadmap updated.
- [ ] Critic verdict: "sellable, fully ours, award-worthy, not generic" for every in-scope screen.

---

## 14. GUARDRAILS

- **Scope is law.** Anything outside IN is deferred, not quietly built.
- **Never** modify read-only product architecture docs.
- **Never** silently break API contracts, auth, RBAC, or business rules. Additive changes require tests + notes.
- **Never** delete or weaken tests to go green.
- **Never** commit credentials or `.env` values.
- **Never** ship fake data/numbers, lorem, dead buttons, or half-migrated pages.
- **Never** copy a competitor's UI or use an unlicensed template/asset/font.
- Work on a branch; coherent commits; do not touch `main`.
- Migrations additive and verified on a fresh DB.
- If a capability is missing: implement additively with tests, or design the honest state and log the gap. Never fake it.
- Ask only blocking questions; otherwise choose the strongest option, document it, proceed.

---

## 15. FIRST RESPONSE FORMAT

Before writing code, reply with:

1. **Scope proposal** — IN / LATER / OUT, and the one-sentence sales promise.
2. **Reality check** — top 10 functional gaps + top 10 UX/visual problems, ranked by daily-use and demo impact.
3. **Chosen art direction** — name, mood, palette (hex), type pairing, motion, 3 references and what you take (not copy).
4. **Ownership plan** — assets, fonts, licenses, rebrand approach, data export.
5. **Agent plan** — roles, order, file ownership, handoffs.
6. **Functional backlog** — grouped UI-only / additive API / bug fix / migration, with acceptance criteria.
7. **Phase 1 scope** — exact tokens, fonts, primitives, helpers.
8. **Risks** — contract/test/DB/sellability risks and mitigations.
9. **Commitment** — won't break contracts, will run all gates, won't call it done without evidence.

Then start Phase 0 and proceed autonomously. Only pause for genuine product decisions that cannot be inferred. Bias toward shipping an excellent, sellable, fully-owned V1.

---

**Final bar:** we should be able to put our logo on it, demo it to a real restaurant, survive a full service day, and close the deal — with zero "but this part isn't ready." Not everything. Just everything that sells.
