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
