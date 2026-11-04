# Backend Changelog (this branch)
All changes are additive; no existing API contract changed.

| Change | Files | Tests |
|  ---   |  ---  |  ---  |
| `GET /admin/checkout/invoices` — paginated, tenant/location-scoped invoice list with payments and refunded totals. Query: `status`, `from`, `to` (date-only `to` is inclusive of the whole day, UTC), `skip`, `take` (default 25, max 100), `locationId`. Filters on invoice creation time. | `apps/api/src/checkout/invoice/invoice.{controller,dto,service}.ts` | `test/checkout-invoice-list.e2e-spec.ts` (shape, order, filters, bounds, isolation, 401/403) |
| Refund amount check moved inside a transaction under the per-business lock to stop over-refunds under concurrency. Rules, messages and audit entries unchanged. | `apps/api/src/checkout/payment/payment.service.ts` | Same spec: 4 parallel refunds → exactly 1 succeeds |
| Demo seed repaired for the current schema (`diningAreaId`, `capacity`, `rate`, location `status`); activates the `reports` module; adds variants and modifier groups (idempotent). | `apps/api/prisma/demo-seed.ts` | Ran twice; second run created 0 new rows |
| Removed redundant `--compiler-options` JSON from `seed` / `demo:seed` scripts (broke on Windows `cmd`; `tsconfig` already sets `module: commonjs`). | `apps/api/package.json` | `npm run demo:seed` works |

Additional additive changes in this branch:

| Change | Files | Tests |
|---|---|---|
| Server-side variant/modifier validation on order create and add-lines (foreign variant/option, unavailable, duplicates, group min/max/required). | `apps/api/src/restaurant/order/order.service.ts` | `test/order-config-refund-idempotency.e2e-spec.ts` |
| Refund `idempotencyKey` (optional uuid, unique per business) with replay/conflict semantics. Migration `20261025120000_refund_idempotency`. | `payment.{service,dto}.ts`, `schema.prisma` | same spec |
| Invoice totals no longer add modifier prices a second time (order unit price already includes them). | `checkout/invoice/invoice.service.ts` | `order-config-refund-idempotency` ("Invoice pricing") |
| `GET /admin/users/directory`, `POST /admin/users/:id/password`. | `iam/user.{controller,service}.ts` | `test/team-directory.e2e-spec.ts` |
| `GET /admin/reports/daily-series`. | `reports/report.*` | `test/reports-daily-series.e2e-spec.ts` |
| **Real-time**: `GET /admin/realtime/stream` (SSE, per-business bus, hello/ping/change/expired/replaced). One global interceptor maps successful mutation routes to topics. See ADR-032. | `apps/api/src/realtime/**` | `test/realtime.e2e-spec.ts` (15) |
| Waiters (`service-team`) hold read-only `restaurant.kitchen.view`. | `iam/system-roles.catalog.ts` | `system-roles.catalog.spec.ts` |
| Migration squash: `module_activation` index is created under its final name in `module_engine`; the separate rename migration was removed. Existing databases keep one harmless extra history row. | `prisma/migrations/20260824130000_module_engine` | empty-DB `migrate deploy` verified |

Known backend gaps: no way to mark a pending UPI refund as paid out; invoices have no "refunded" status; no business-search endpoint (client list is filtered in the browser, capped at 200); the realtime bus is in-process (single API instance; Redis adapter point documented in ADR-032).

## Error sweep (role permission grants)

Found by `scripts/qa/role-sweep.mjs` (see `docs/ui/ERROR_SWEEP.md`). System-role templates in `apps/api/src/iam/system-roles.catalog.ts` changed; run `cd apps/api && npx ts-node prisma/seed.ts` (idempotent role sync) on every environment. No endpoint contract changed.

| Role | Permission granted | Why (page that returned 403) |
|---|---|---|
| `checkout-associate` (cashier) | `restaurant.dining.view` | Tables page lists areas/tables (`GET /admin/dining/areas`, `/tables`); the cashier's nav showed Tables but the floor plan failed to load. |
| `kitchen-team` | `restaurant.dining.view`, `restaurant.session.view` | Kitchen page reads tables and open sessions to show table names/guests on tickets (`GET /admin/dining/tables` and `GET /admin/sessions?status=OPEN` returned 403 twice per load). |
| `host` | `catalog.category.view`, `catalog.item.view`, `catalog.modifier.view` | Tables page loads the menu for its order panel (`GET /admin/catalog/*` 403 -> "Could not load the floor plan"). View only. |
| `location-manager` | `core.alert.view`, `core.alert.edit` | Settings > Alerts tab (`/admin/alerts/rules`) was shown to managers but returned 403. |
| `accountant` | `core.location.view` | Operating Costs filters by location (`GET /admin/locations`); the accountant now also sees Costs, Reports and Activity (they already held `costs.*.view`, `costs.expense.approve`, `reports.*.view`, `core.audit.view`). |

Deliberately not granted: `core.modules.view` to `location-manager` (the Module Center is now owner-only in the UI instead), `costs.expense.create` / `costs.category.manage` to `accountant` (UI hides those controls). Unit test: `apps/api/src/iam/system-roles.catalog.spec.ts`.
