# Error sweep: every role, every page

Method: `scripts/qa/role-sweep.mjs` (headless Edge, fresh context per role and viewport, 1440x900 and 390x844, client-side navigation, 1.5 s settle). Per page it records console errors/warnings, page errors, every HTTP >= 400, visible `role=alert` text, raw i18n keys, phone horizontal overflow and axe-core violations; `--explore` clicks every non-destructive tab/button once. API-level action walks covered the primary write actions per role (waiter: open table, order, send, serve, close; kitchen: accept/prepare/ready; cashier: invoice, finalise, pay; owner/manager/accountant: expense create/approve/reject, category, user create/suspend, alert rule create/patch/delete). A permission matrix (7 roles x 26 endpoints) was diffed against `system-roles.catalog.ts`.

Roles swept: owner, cashier (`checkout-associate`), kitchen (`kitchen-team`), waiter (`service-team`), platform admin, plus `location-manager`, `accountant`, `host` (created in the dev DB as `qa.<role>@pilot.nexus`).

## Result per role x page (before -> after)

"ok" = no console error/warning, no 4xx/5xx, no alert, no raw key, no axe violation in files this sweep owns. Axe items still open are in other owners' files (see hand-off).

| Role | Page | Before | After |
|---|---|---|---|
| owner | Home, Modules, Config, Reports, Team, Activity, Costs, Kitchen | axe `label-content-name-mismatch` x3 (header) | ok |
| owner | Tables | same | ok in shell; "Mark X available" buttons open (H1) |
| owner | Bills | same + 13 rows | rows open (H2) |
| owner | /commercial, /onboarding (deep link) | no h1 on the no-access page | ok (403 heading) |
| cashier | Home | header axe | ok |
| cashier | Tables | **403 `/admin/dining/areas`, `/tables`; "Could not load the floor plan"** | ok (grant) |
| cashier | Bills | header axe | rows open (H2) |
| kitchen | Home | header axe | ok |
| kitchen | Kitchen | **403 `/admin/dining/tables` x2**, later also **403 `/admin/sessions?status=OPEN` x2** after the page started reading sessions | ok (grants); H3 |
| waiter | Home, Tables, Kitchen (read-only) | header axe only | ok |
| host | Tables | **403 `/admin/catalog/categories`, `/items`; "Could not load the floor plan"** | ok (grant); H4 |
| location-manager | Modules | **403 `/admin/modules` "Missing permission"** | page hidden (owner-only) |
| location-manager | Config > Alerts | **403 `/admin/alerts/rules`** (tab shown, API denied) | ok (grant) |
| location-manager | Team | add/manage controls | already capability-driven (read-only view for a manager); ok |
| accountant | nav | only Home; Costs/Reports/Activity hidden although the role holds their permissions | Reports, Activity, Costs visible; create/manage controls hidden |
| accountant | Costs | n/a (hidden); would 403 on `/admin/locations` | ok (grant `core.location.view`) |
| platform | Home, Commercial, Onboarding | header axe only | ok |
| every role | pre-login first load | **console `401 POST /auth/refresh`** | gone |

## Defects found (13) and fixes

| # | Defect | Cause | Fix | Test |
|---|---|---|---|---|
| 1 | Cashier Tables page: floor plan fails (403) | `checkout-associate` lacked `restaurant.dining.view`; Tables is in the cashier's nav | grant in catalog | `system-roles.catalog.spec.ts` |
| 2 | Kitchen page 403 on tables, later on sessions | `kitchen-team` lacked `restaurant.dining.view` / `restaurant.session.view` | grants | same spec |
| 3 | Host Tables page 403 on menu | `host` lacked catalog view (page loads the menu unconditionally) | `catalog.category/item/modifier.view` | same spec |
| 4 | Manager sees Config > Alerts that 403s | `location-manager` lacked `core.alert.view/edit` | grants | same spec |
| 5 | Manager sees Module Center that 403s | page gated by "full access", API needs `core.modules.view` (owner only) | new `canSeeModules` (owner) in `shell/access.ts` + `pages.tsx` | `shell/access.test.ts` |
| 6 | Accountant cannot reach Costs/Reports/Activity | nav gated by "full access" instead of the permissions the role holds | `canSeeCosts/Reports/Activity` for owner, manager, accountant; accountant gets `core.location.view` | access test + spec |
| 7 | Accountant would be offered "record expense" / "add category" (403) | Costs page not capability-aware | `canManageCosts` hides those controls (`costs/CostsPage.tsx`) | access test |
| 8 | Pre-login `401 /auth/refresh` in the console on every first load | silent refresh attempted unconditionally | non-sensitive `nx.session` flag set at login, cleared at logout / on refresh 401; refresh skipped without it. Token still memory-only, refresh token still httpOnly cookie (ADR-024); the flag grants nothing | `auth/sessionHint.test.tsx` |
| 9 | axe serious `label-content-name-mismatch` on three header controls on every page (palette, location switcher, user menu) | `aria-label` replaced the visible text | name now comes from content (palette, switcher); avatar initials rendered via CSS | sweep |
| 10 | axe `page-has-heading-one` on every no-access deep link | `EmptyState` renders an h2 | no-access view uses `PageHeader` (h1) | sweep |
| 11 | `act(...)` warning in `AppShell.test` | live-stream status updates after the test | realtime provider mocked in that test | vitest output clean |
| 12 | Nothing guarded against a role-grant typo, a page/role mismatch or a missing translation recurring | none | catalog spec validates every key against the registry and per-role page needs; `i18n/keys.test.ts` validates every literal `t('...')` key exists | both specs |
| 13 | Harness: login rate limit (10/min) made later roles fail | n/a | harness throttles logins (`NX_LOGINS_PER_MIN`) | n/a |

Verified not defects: API write actions for each role succeed or return 403 exactly where the UI hides the control (accountant create expense 403 and hidden; manager create user 403 and Team add button hidden; waiter kitchen accept 403 and buttons hidden). No raw i18n keys on any page, no React key warnings, no page errors in any run. `npx eslint apps`, `npm run typecheck`, web vitest (3 consecutive runs) and API unit tests are green.

## Hand-off (files owned by the other agents; not edited)

| # | File | Symptom | Fix |
|---|---|---|---|
| H1 | `apps/web/src/restaurant/**` (buttons `aria-label="Mark G1 available"`) | axe serious `label-content-name-mismatch` x2 on Tables | make the accessible name contain the visible text, or drop the aria-label |
| H2 | `apps/web/src/bills/BillsPage.tsx` (rows `aria-label="Open bill ML-0377"`) | axe serious `label-content-name-mismatch` x14 per page | same: the accessible name must contain the row's visible text |
| H3 | `apps/web/src/restaurant/KitchenPage.tsx` | calls `GET /admin/sessions?status=OPEN` and `/admin/dining/tables`; both are optional lookups, so a custom role without them gets console 403s | tolerate 403 on optional lookups silently (omit table names) instead of relying on grants |
| H4 | `apps/web/src/restaurant/TablesPage.tsx` | loads the menu (`catalog.*`) even for roles that cannot take orders (host, cashier; cashier lacks `catalog.modifier.view` so the order panel would 403) | load the catalogue lazily and only when `canManageOrders` |
| H5 | `apps/web/src/home/HomePage.tsx:37` | Reports quick link uses `nav.isTenantAdmin`; accountants can now open Reports | use `nav.canSeeReports` |

## Remaining / not fixable here

- A stale `nx.session` flag (refresh cookie expired or cleared server side) still produces one `401 /auth/refresh` on that visit, after which the flag clears; unavoidable without a server-readable marker, and harmless.
- Dev API restarts (file watching while other agents edit) produce `ERR_CONNECTION_REFUSED` noise in a sweep; re-run those pages.
- Web gating is role-key based (`/auth/me` has no permission list); custom roles fall back to API 403 handling. Adding `permissions` to `/auth/me` would allow exact gating; not done (API contract change).
- Dev DB now contains sweep fixtures: users `qa.manager@`, `qa.accountant@`, `qa.host@pilot.nexus` (password in gitignored `scripts/qa/.env.local`), a suspended `qa.tmp*` user, a deactivated "QA sweep" expense category with two expenses, and a few paid/closed table sessions. Remove or suspend them before a demo.
