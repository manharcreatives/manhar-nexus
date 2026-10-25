# Functional Audit — Sellable V1 (Phase 0/1)

Baseline on branch `feat/sellable-v1-ui` (from `main` @ 58e7d77), 2026-10-25.

## Baseline gates
| Gate | Result |
|---|---|
| typecheck | pass |
| lint | pass |
| unit tests | api pass; web 2/2 |
| build | pass (web JS 324 kB / 88.8 kB gzip, CSS 6.1 kB gzip) |
| test:e2e | see `QA_REPORT.md` (run recorded there) |

Working tree carried onto the branch untouched: deleted migration `20260824122126_npm_run_dev_api`,
modified `20260824130000_module_engine`. Not ours to alter; verify on a fresh DB before release.

## Capability findings (P0 = blocks a demo, P1 = visible weakness)
| # | Area | Finding | Evidence | Fix type | Pri |
|---|---|---|---|---|---|
| 1 | Shell | Business/Location selectors are disabled "coming soon" buttons | `shell/AppShell.tsx` header | UI + existing API, or remove | P0 |
| 2 | Shell | No router: no deep links, refresh/back loses place | `view` is `useState` | UI | P0 |
| 3 | Home | Home is a placeholder ("phase label · version") | `AppShell.tsx` home view | UI (existing report APIs) | P0 |
| 4 | Onboarding | Raw business UUID text input | `OnboardingPage.tsx` `initBizId` | UI + additive search API | P0 |
| 5 | Commercial | Module activation via `window.prompt` | `ClientsPage.tsx:98` | UI | P1 |
| 6 | Money | Four independent minor-unit formatters, INR hard-coded in three | `restaurant/api.ts`, `costs/api.ts`, `reports/api.ts`, `PriceBooksPage.tsx` | UI (single `lib/money`) | P0 |
| 7 | Resilience | No error boundary, 404, or degraded-API state | `App.tsx` | UI | P1 |
| 8 | Auth | No password visibility toggle, caps-lock hint, or return-to-view | `LoginScreen.tsx` | UI | P1 |
| 9 | Responsive | Fixed 240px sidebar, no mobile nav | `AppShell.tsx` | UI | P1 |
| 10 | Reports | No export/print affordance | `ReportsPage.tsx` | UI (CSV from loaded data) | P1 |
| 11 | Metadata | No favicon/OG; theme-color is Tailwind blue | `index.html` | UI | P1 |

## To verify in Phase 4/5 (not yet exercised in a browser)
Touch ergonomics of `TablesPage` (782 lines), UI double-submit protection on payment/close,
sale -> Reports/Activity propagation, permission-denied messaging for non-owner roles.

## Resolution status (end of pass)
| # | Finding | Status |
|---|---|---|
| 1 | Disabled business/location selectors | Removed (honest). A working switcher is **not** built. |
| 2 | No router | Fixed (react-router, real URLs). |
| 3 | Placeholder home | Replaced with a real Today dashboard (thin; see CRITIQUE_LOG). |
| 4 | Raw UUID onboarding input | Fixed (searchable client picker; list capped at 200 clients client-side). |
| 5 | `window.prompt` module activation | Fixed (dialog with checklist). |
| 6 | Four money formatters | Fixed (single `lib/money.ts`). |
| 7 | No error boundary / 404 | Fixed, plus a designed no-access state for restricted deep links. |
| 8 | Login UX | Fixed (toggle, Caps Lock hint, loading). Return-to-view after session expiry not built. |
| 9 | Mobile nav | Fixed (drawer). |
| 10 | Report export/print | CSV export and print added. |
| 11 | Metadata | Favicon, theme-color, robots added; OG image not built. |

### Found by driving the real UI (see QA_REPORT.md)
Seed drift, missing `reports` module, table grouping, ₹NaN checkout, cash and UPI payment failures, refund race, platform-realm dead pages and bell. All fixed.

### Newly added scope
Bills page with refund and void (+ additive list endpoint), item variants and modifiers in the order builder.

### Still open
Business/location switcher; card payments; server-side modifier validation; refund idempotency key; trend charts; richer demo data; Lighthouse on authenticated routes; touch-hardware and screen-reader checks.
