# Security Review — UI pass (scoped)

This reviews what changed in this branch, not the whole platform (see `docs/runbooks/` and ADR-028 for the pilot hardening audit). It is a developer review, not an independent penetration test.

## Changes with security relevance
| Change | Assessment |
|---|---|
| New `GET /admin/checkout/invoices` | Same permission decorator as sibling reads (`checkout.invoice.view`), tenant- and location-scoped, `take` capped at 100, unknown query keys rejected. E2E covers cross-tenant isolation (foreign `locationId` → 404), 403 for a role without access, 401 unauthenticated. |
| Refund limit race | Previously the "amount ≤ remaining" check ran outside a transaction. It now runs under the existing per-business lock. A 4-way parallel refund E2E asserts exactly one succeeds. Refund has no idempotency key; a retry after an unknown outcome could duplicate a refund, so the UI re-reads refunds and asks staff to verify first. Recommend adding an idempotency key to refunds. |
| Web route guards | Convenience only. Every restricted API call was confirmed to return 403 for kitchen, cashier and waiter roles. The API remains the authorization boundary. |
| Token handling | Unchanged: access token in memory only, refresh token in an httpOnly cookie (ADR-024). No credentials stored in `localStorage`. |
| CSV export | Cells beginning with `=`, `+`, `-`, `@` are prefixed to prevent spreadsheet formula injection; values are quoted and escaped. Unit-tested. |
| Fonts / icons / assets | Self-hosted; no third-party requests at runtime. |
| `robots.txt` | Disallows crawling of the app. |
| Demo seed | Guarded by `NEXUS_DEMO_SEED=true` and refuses `NODE_ENV=production`. Demo passwords are published in the seed file: **never run it against a real database.** |

## Open findings
1. **Server does not validate modifier rules.** Min/max selections, required groups and "option belongs to item" are enforced only in the UI; a crafted API call can bypass them. Add server-side validation.
2. **Refund idempotency** (above).
3. **Rate limiting** returned 429 during rapid automated logins and route loads — good — but a failing pre-login session refresh counts toward it; consider skipping the refresh call when no session cookie is present.
4. **Production credentials** (platform bootstrap password, JWT secret) must be rotated before go-live (roadmap condition, unchanged).
5. Platform realm has no tenant context for business-scoped pages; the UI now hides them, but the API error text ("Business-scoped route requires a business principal") is developer-facing.
