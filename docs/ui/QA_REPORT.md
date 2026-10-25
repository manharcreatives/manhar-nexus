# QA Report — Sellable V1 UI pass

Branch `feat/sellable-v1-ui`, 2026-10-25. Everything below was run in this session; items not run are listed at the end.

## Automated gates (final)
| Gate | Result |
|---|---|
| `npm run typecheck` | pass |
| `npm run lint` | pass, 0 errors, 0 warnings |
| `npm run test` | API 27/27, web 22/22 |
| `npm run test:e2e` | 21 suites, **607/607** (baseline 596 + 11 new for the invoice list and refund race) |
| `npm run build` | pass; web entry JS 480 kB raw / **140 kB gzip** (budget 250 kB), CSS 7 kB gzip |

## Real-browser verification (headless Edge, local dev stack)
- **Golden path, driven through the UI:** open table → build order → send to kitchen → kitchen Accept / Start preparing / Mark ready → Mark served → checkout → payment → close table → sale appears in Reports. Run twice: cash (tender ₹800 on ₹777, "Change given ₹23") and UPI (pending, then UTR confirmation). Bill math checked by hand: 2 × ₹280 + 1 × ₹180 = ₹740 + 5% GST ₹37 = ₹777.
- **Reports after both sales:** 2 paid invoices, net ₹1,554.00.
- **Variants and modifiers:** item dialog with required portion, required spice group, optional toppings (max 2); cart priced ₹280 + ₹30 = ₹310; order sent.
- **Bills:** list shows all bills; detail opens; refund form validates the amount and requires a reason. (The final refund submission was not clicked in the browser; refund behaviour is covered by API E2E.)
- **Roles:** kitchen, cashier and waiter see only their own navigation; deep links to restricted pages show a "no access" state instead of broken data. API returned 403 for every restricted call.
- **Console / network errors** across all owner routes at 1440 and 390 px: only the expected 401 from the silent session refresh before sign-in.
- Screenshots: `docs/ui/screens/after/` (every owner route, 1440 and 390), `screens/golden/`, `screens/features/`, `screens/roles/`.

## Accessibility (axe-core 4.x, WCAG 2.x A/AA rules)
Initial scan of 9 routes × 2 sizes found two issues, both fixed: the notification button's accessible name did not contain its visible text, and the 404 page had no `h1`. Login scans clean. The final post-fix scan was not repeated across every route.

## Lighthouse (production build, login route only)
| | Perf | A11y | Best practices | SEO |
|---|---|---|---|---|
| Mobile | 95 | 100 | 96 | 91 → `robots.txt` added afterwards |
| Desktop | 100 | 100 | 96 | 91 → same |

LCP 2.6 s mobile / 0.6 s desktop, CLS 0, TBT 0. Best-practices deduction is the console 401 from the pre-login session refresh. **Authenticated routes were not Lighthouse-tested**, so the ≥90/≥95 targets are verified for login only.

## Defects found by this pass and fixed
Each was found by driving the real UI, not by the existing tests:
1. Demo seed did not run (stale Prisma field names; Windows quoting in the npm script).
2. Demo seed did not activate the `reports` module, so Reports and Home "Today" failed for the demo owner.
3. Tables all grouped under "Other" (web read `areaId`; API returns `diningAreaId`).
4. Checkout showed ₹NaN for line totals and tax (wrong invoice field names).
5. Cash payments always failed with 400 (`cashReceivedMinorUnits` never sent).
6. UPI payments could not be completed (no capture step); the Card button offered a method with no server provider and was removed.
7. Platform admin saw tenant-only pages that could only fail.
8. Concurrent refunds could exceed the paid amount (check ran outside the lock) — fixed under the business lock, covered by a 4-way parallel E2E.

## Not verified
- Touch hardware, real tablet or kitchen display; screen readers; a full keyboard-only walkthrough.
- Lighthouse on authenticated routes; 768 and 1024 px screenshots (only 1440 and 390 were captured).
- "Before" screenshots (not captured before work started).
- API/Redis/storage outage behaviour end to end; printing hardware.
- Onboarding go-live and commercial dialogs were built and type-checked but not driven in a browser.
- Double-click protection was implemented and unit-structured but not stress-tested with a real double click.
