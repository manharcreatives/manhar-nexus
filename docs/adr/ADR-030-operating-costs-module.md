# ADR-030 — Operating Costs Module Architecture

| Field | Value |
|---|---|
| **Status** | ACCEPTED |
| **Date** | 2026-08-30 |
| **Deciders** | Platform engineering |
| **Context** | Phase 15 complete; first Phase 16 module selected based on zero-dependency value |

## Context

The Operating Costs module tracks business operating expenses (rent, utilities, wages, repairs, etc.) with an optional approval workflow. It was the first Phase 16 candidate implemented because it has no dependencies on other vertical modules, applies to any business type, and provides immediate financial visibility for pilot restaurant clients.

## Decision

### Module identity

- Module key: `costs`
- No dependencies (works standalone, any business type)
- Module-gated: all routes require `costs` module ACTIVE for the requesting business

### Data model

Two tables: `expense_category` (per-business classification) and `expense` (per-location records). Both carry `businessId NOT NULL` with FK `ON DELETE RESTRICT` to `business`.

- Amounts in **integer minor units** (paise for INR) — per ADR-015. No Decimal math; no float arithmetic.
- `paidAt` stored as `TIMESTAMPTZ(6)` UTC — per ADR-015.
- `idempotencyKey UUID UNIQUE` on `expense` prevents duplicate submissions from the UI — per ADR-017. Note: the unique constraint is global (not scoped to `businessId`) because service-layer lookup is always scoped to the principal's `businessId` and UUID collision probability across businesses is astronomically low (1 in 2^122). A future migration to `UNIQUE(businessId, idempotencyKey)` would be strictly more correct; deferred as not blocking.
- `version INTEGER` on both tables supports optimistic concurrency if needed.

### Approval workflow

Categories carry `requiresApproval BOOLEAN`. When `false`, submitted expenses are auto-approved at creation time (status=APPROVED, approvedAt=now, approvedById=principalId). When `true`, expenses are created in `PENDING_APPROVAL` and require an explicit `POST .../approve` action by a user with `costs.expense.approve` permission. Rejection sets `REJECTED` + `rejectionReason`. Once approved or rejected, re-approval/re-rejection returns 400.

This avoids a separate approval-queue table while supporting the most common restaurant use case (owner approves manager-submitted expenses).

### Permissions

Five permissions registered in the module manifest:
- `costs.category.view` — list/get categories
- `costs.category.manage` — create/patch categories
- `costs.expense.view` — list/get/summary
- `costs.expense.create` — submit new expenses
- `costs.expense.approve` — approve or reject pending expenses

System roles assignment: `location-manager` gets full costs access; other roles get view/create access per their scope. Platform-admin wildcard covers all.

### Security invariants

- `businessId` always sourced from JWT principal (`scopeFromPrincipal`) — never from URL or body.
- `this.scoped(scope, ...)` applied to every Prisma query for tenant isolation.
- Location cross-reference validated before create: `location.businessId` must equal `scope.businessId`.
- Category cross-reference validated before create: category must exist, be active, and belong to `scope.businessId`.
- `this.getExpenseOrThrow(scope, id)` used before approve/reject — prevents IDOR on action routes.
- Module gating: `@RequireModule('costs')` at controller class level; PLATFORM realm bypasses.
- Input validated via Zod schemas at the boundary.

### Frontend

`CostsPage.tsx` — three-tab page (Expenses, Categories, Summary). Rejection reason collected via inline form (no `window.prompt()` — avoids blocking browser dialog). Location ID is entered manually as a UUID for pilot (no location selector available until the header selector ships in a future phase).

### What was NOT built

- Delete category or expense (soft-deactivate only; financial records are immutable per ADR-016).
- Export to CSV/XLSX (deferred).
- Recurring expense automation (tracked via `isRecurring` flag + `recurringNote` for manual reference only; no scheduling engine).
- Integration with the Daily Closing Report (operating costs are intentionally separate from revenue reporting in V1).
- Multi-currency support (INR assumed for pilot; `currencyCode` can be added when multi-currency is a validated need).

## Consequences

- Any business (restaurant, hotel, manufacturing) can track operating expenses without activating restaurant/catalog/checkout.
- Approval workflow is simple and auditable without a dedicated queue service.
- idempotency key uniqueness is global; documented as known technical debt.
- Adding this module increased the total E2E test suite from 549 to ~590 (costs.e2e-spec.ts).
