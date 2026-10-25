# Backend Changelog (this branch)

All changes are additive; no existing API contract changed.

| Change | Files | Tests |
|---|---|---|
| `GET /admin/checkout/invoices` — paginated, tenant/location-scoped invoice list with payments and refunded totals. Query: `status`, `from`, `to` (date-only `to` is inclusive of the whole day, UTC), `skip`, `take` (default 25, max 100), `locationId`. Filters on invoice creation time. | `apps/api/src/checkout/invoice/invoice.{controller,dto,service}.ts` | `test/checkout-invoice-list.e2e-spec.ts` (shape, order, filters, bounds, isolation, 401/403) |
| Refund amount check moved inside a transaction under the per-business lock to stop over-refunds under concurrency. Rules, messages and audit entries unchanged. | `apps/api/src/checkout/payment/payment.service.ts` | Same spec: 4 parallel refunds → exactly 1 succeeds |
| Demo seed repaired for the current schema (`diningAreaId`, `capacity`, `rate`, location `status`); activates the `reports` module; adds variants and modifier groups (idempotent). | `apps/api/prisma/demo-seed.ts` | Ran twice; second run created 0 new rows |
| Removed redundant `--compiler-options` JSON from `seed` / `demo:seed` scripts (broke on Windows `cmd`; `tsconfig` already sets `module: commonjs`). | `apps/api/package.json` | `npm run demo:seed` works |

Pre-existing uncommitted migration edits in the working tree (`20260824122126_npm_run_dev_api` deleted, `20260824130000_module_engine` modified) were **not** touched or committed. Verify on a fresh database before release.

Known backend gaps surfaced: no server-side modifier min/max validation; no refund idempotency key; no way to mark a pending UPI refund as paid out; invoices have no "refunded" status; no business-search endpoint (client list is filtered in the browser, capped at 200).
