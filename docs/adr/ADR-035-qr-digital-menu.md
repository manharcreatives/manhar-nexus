# ADR-035: QR digital menu and guest self-ordering ("Nexus Menu")

- **Status:** ACCEPTED
- **Date:** 2026-10-31
- **Related:** ADR-002 (tenant scoping), ADR-015 (money), ADR-016/017 (audit, idempotency), ADR-032 (realtime SSE), ADR-033 (public endpoints, throttling), `docs/landing/04_UPDATES_PLAN.md` section B (wire contract, "as implemented")

## Context

Each table gets a QR code. A guest scans it and gets the restaurant's live menu in the phone browser (no app, no login), can order like a waiter would, call the waiter, see the running bill and open a UPI payment. Until now every API route except a handful needed a staff JWT, and the ordering domain assumed a staff actor on every write. The feature therefore adds the first customer-facing, unauthenticated *write* surface of the product. It must not weaken tenant isolation, must not let a stranger run up orders, and must not leak anything about the business or its staff.

## Decision

### 1. Two capabilities, no accounts

| Credential | Format | Stored as | Grants |
|---|---|---|---|
| **Table token** (the QR) | 24 random bytes = 192 bits, base64url, 32 chars, in the URL path `/m/<token>` and `/public/menu/<token>/...` | plaintext, unique index (`table_qr_code.token`) | read the menu, open a stream, issue a guest token, call the waiter |
| **Guest token** (per device) | 32 random bytes = 256 bits, base64url, 43 chars, header `X-Guest-Token` | **sha256 only** (`guest_menu_token.tokenHash`) | place orders, read the table state, ask for a payment intent |

The table token must be stored recoverable because staff print it; it is a *locator + weak capability* (anyone in the room can scan it), so it is deliberately insufficient for anything that costs money. The guest token is the identity: it is bound to the table **and to the table's OPEN Guest Session**. When the visit closes, or the QR is rotated, or the token expires (12 h), it stops verifying (401 `GUEST_TOKEN_INVALID`) and the page silently re-issues one. At most 40 live guest tokens per visit. Staff can rotate a table's token at any time (old link: 404 at once, guest tokens revoked, open streams closed with `bye`), and switch a table, its ordering, or the whole menu off. Comparison is constant-time; lookups by hash.

### 2. Guest orders are ordinary Service Requests

A guest order is a `ServiceRequest` with `source=GUEST` plus a one-to-one `GuestOrder` row (decision PENDING | CONFIRMED | AUTO_CONFIRMED | REJECTED, mode, request fingerprint, guest token id, optional typed name). There is no parallel order model: the kitchen display, numbering, invoice, audit, order-edit and reports all keep working unchanged.

- **Confirm mode (default):** the request is created as `DRAFT` (invisible to the kitchen). The waiter confirms (becomes `SENT`, numbered from the same `service_request` series, `FOR UPDATE` on the request row, one transaction), rejects with a reason (lines + request cancelled) or edits quantities/note first through `OrderEditService` (audited, version-checked, idempotent). Confirm/reject are idempotent and serialised against each other.
- **Auto mode:** created straight as `SENT` with a number allocated up front.
- The actor of guest-originated writes is a SYSTEM actor labelled `Guest, table T7` so the hash-chained audit trail shows who did what without pretending a user exists.
- Once any non-void invoice exists for the visit, new guest orders are refused (`ORDERING_LOCKED`), and a pending one can no longer be confirmed: a bill must never change under a cashier.

### 3. Price integrity and idempotency

The client sends item ids, variant id, add-on option ids, quantity, note. Nothing about money is read from the body (the schema is `.strict()`, so a stray `priceMinor` is a 400). Lines are priced by the same `OrderService.resolveLineSnapshots` that staff orders use (live catalog, variant adjustment, required add-on groups, tax snapshot per line); unavailable items/variants/options answer `SOLD_OUT`. Totals are integer paise.

`POST /orders` requires an `Idempotency-Key`. The key is namespaced by the guest token (`uuidv5-shape(sha256(guestTokenId : key))`) and mapped onto the existing `service_request(businessId, idempotencyKey)` unique constraint, plus a request fingerprint: same key + same body replays the original answer (`200`, `Idempotent-Replay: true`), same key + different body is `409 IDEMPOTENCY_KEY_REUSED`, and ten parallel identical requests create exactly one order (the loser of the unique race re-reads the winner). Caps: 25 lines, 20 per line, 60 items per order, 5 unconfirmed guest orders per visit.

### 4. The bill a guest sees

`GET /state` returns the guest's own orders (plus every confirmed order of the table; other guests' pending/rejected orders and all staff-only drafts are hidden), a customer-safe timeline (statuses and times, no staff names), and a `bill`. Until the cashier finalises an invoice the bill is **RUNNING**: `computeRunningBill` repeats `InvoiceService.computeTotals` exactly (per-line `round(subtotal x rate)`, grouped by category and rate), and an e2e test locks that it equals the invoice generated from the same lines. Once an invoice is finalised it is the invoice (FINAL, then PAID). GST is shown as CGST + SGST halves summing to the stored tax.

### 5. UPI

`POST /pay-intent` builds a `upi://pay` deep link with the existing `buildUpiUri` (VPA and payee from the `checkout` settings) for the **amount still due on the finalised invoice**, computed on the server. It records nothing: staff still verify and record the payment (ADR-008), so the product makes no gateway or "paid" claim. It is only available when the restaurant enabled UPI and has a valid VPA, and never for a DRAFT or already-paid bill.

### 6. Live updates without leaking

Two layers. (a) Staff edits through this API process call `GuestHub.notifyMenu`, via a global interceptor on `/admin/(catalog|menu|qr|dining|settings)` mutations; (b) the hub subscribes to the per-business `RealtimeBus` (ADR-032) only while a guest stream is open, debounces bursts (120 ms), recomputes a small public-safe snapshot per table and sends only differences. A 25 s sweep re-compares, so a change made on another API instance still arrives within seconds. `EventSource` cannot send headers, so the stream is addressed by the table token alone and therefore carries **hints only**: `menu.changed {etag}`, `table.updated {open}`, `order.updated {orderId,status}`, `bill.updated {}`, `waiter.ack {}`. The page re-reads `/state` or the menu with its guest token. Streams are recycled every 30 min, limited per IP and per token, and kept out of compression and `no-store` rewriting at the edge.

The public menu supports `ETag` / `If-None-Match` (304) with a weak validator computed from the payload fingerprint, so polling and reconnects are cheap; the business catalog is cached 2 s in memory and invalidated on in-process edits.

### 7. Pictures

`ImageStore` is an interface (`put/open/remove`, content-addressed names `<sha1>[-w].<ext>` under `<businessId>/`) with a local-disk implementation on `MEDIA_DIR` (a Docker volume). Uploads are `multipart/form-data` (field `file`). The type is decided from **magic bytes** (png, jpeg, webp), never from name or Content-Type; dimensions are read from the header (64..6000 px per side, 24 MP, no animation) so decompression bombs are refused before any decoder runs; EXIF/XMP/text/comment chunks are dropped (a JPEG with an EXIF orientation is rejected in the dependency-free path rather than served sideways). When `sharp` is installed (optional dependency) the picture is auto-rotated, re-encoded to WebP and resized, with a 480 px thumbnail, a blur-up data URI and a dominant colour. Files are served publicly by `GET /media/:businessId/:file` with `immutable` caching, `nosniff`, a sandbox CSP and a strict file-name regex (no traversal). Replacing or deleting a picture removes the file once nothing references it. Without `MEDIA_DIR` in production uploads answer 503 (never a container layer).

### 8. Abuse and privacy controls (public surface)

- Rate limits (in-memory fixed window, per API instance, env-tunable, 429 + `Retry-After`) per IP, per table token and per guest token on every endpoint, concurrent-stream caps, and an anti-enumeration penalty: an address that hits 30 unknown tokens in a minute is throttled for every public endpoint.
- Unknown and malformed tokens produce byte-identical 404s; disabled menus 403 `MENU_DISABLED`. Errors never echo a token.
- The table token is redacted in request logs (`/public/menu/abcd...`).
- Public payloads contain no ids of the business, location, session or staff, no emails, no other guests' names, no audit data. The only personal datum collected is the optional display name (control characters stripped, 40 chars), shown to staff on the order.
- All staff routes sit behind `restaurant.qr.manage` (QR codes, settings, photos) or `restaurant.guestorder.manage` (inbox, waiter alerts) and are tenant-scoped; location-restricted staff only see their locations.

### Schema

`TableQrCode`, `QrMenuSetting`, `GuestMenuToken`, `GuestOrder`, `WaiterCall` (partial unique index: one OPEN call per table and reason), enums, and nullable columns on catalog item/category (`imageUrl`, `imageThumbUrl`, `imageBlur`, `imageColor`, `dietType`, `menuTags`, `spiceLevel`). Migration `20261031170000_qr_digital_menu` is additive.

## Alternatives considered

- **Signed (HMAC/JWT) table tokens.** Stateless, but cannot be rotated or disabled per table without a deny-list, and the QR would carry structure. A random 192-bit value in a unique index is simpler and instantly revocable.
- **A separate guest-order table and kitchen path.** Rejected: duplicates numbering, KDS, billing, audit and order-edit.
- **WebSocket / per-guest SSE with the guest token in the query string.** Tokens in URLs end up in logs and referrers. Hints-only SSE keyed by the table token plus a header-authenticated re-read keeps the secret out of the URL.
- **`@nestjs/throttler` for the public routes.** It applies one rule per route; these endpoints need several independent keys per request (IP, table, device) with different limits.
- **Storing pictures in Postgres.** Simpler backups, but bloats the database and the hot path; the interface keeps that adapter possible.
- **Auto-rotating table tokens per visit.** Would invalidate printed QR codes. Rotation is a manual staff action (lost phone, photographed QR, abuse).

## Consequences

- One in-memory rate limiter and one in-memory stream hub per API instance, like ADR-032/033. With more than one replica the limits multiply and cross-instance menu edits reach streams via the 25 s sweep. Redis is the documented follow-up before scaling out (adapter points: `RateLimiter`, `RealtimeBus`).
- Table tokens are bearer secrets visible in URLs: anyone who photographs the QR can browse the menu and, while a visit is open, order (subject to caps and waiter confirmation in the default mode). That is the accepted trade-off of QR menus; rotation, per-table disable, confirm mode and the audit trail are the mitigations. Guests are never authenticated persons.
- Edge access logs (Caddy) still contain the token unless filtered; the runbook says so.
- Existing databases need `prisma db seed` to give system roles the two new permissions.
- Pictures need a persistent volume and must be backed up with the database.
- The staff catalog editor does not yet set dietary marks / tags / spice (API ready: `PATCH /admin/menu/items/:id/presentation`).
