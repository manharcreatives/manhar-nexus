# 11 - Q-API report: QR digital menu backend (ADR-035)

Date: 2026-10-31. Owner: Q-API agent. Wire contract: `docs/landing/04_UPDATES_PLAN.md` section B (now with an "AS IMPLEMENTED" subsection). Decision record: `docs/adr/ADR-035-qr-digital-menu.md`.

## 1. What was there, what I did

An earlier run was cut off. Audit of what existed: schema + additive migration `20261031170000_qr_digital_menu`, `guestmenu.config.ts`, `guestmenu.errors.ts`, `guestmenu.tokens.ts`, `rate-limiter.service.ts`, the permission entries, `OrderEditService`, `bill-view`, `checkout/upi`. All kept. Finished (no controllers, services, module or tests existed):

- `apps/api/src/guestmenu/`: `GuestMenuModule` (registered in `app.module.ts`; `RestaurantModule` now exports `OrderService` and `OrderEditService`), public controller (7 endpoints), `TableContextService`, `MenuService`, `GuestTokenService`, `GuestOrderService` (place / state / bill / waiter / pay-intent), `GuestHub` (SSE fan-out), staff controllers (`admin/qr/*`, `admin/menu/*`, `admin/guest-orders/*`), `QrAdminService`, `GuestOrderAdminService`, `ImageService` + `ImageStore`/`LocalDiskImageStore` + magic-byte image validation / metadata stripping / optional `sharp`, `MediaController`, `MenuChangeInterceptor` (menu edits go live), `running-bill.ts`, `guest-status.ts`, DTOs.
- Shared files touched surgically: `modules/module-manifest.ts` + `iam/system-roles.catalog.ts` (+ spec) for the two permissions, `common/domain-exception.filter.ts` (`Retry-After` on 429), `logging/logging.middleware.ts` + `logging/redact-url.ts` (table token never logged), `app.factory.ts` (CORS `exposedHeaders: Retry-After, ETag, Idempotent-Replay`, only matters in cross-origin dev), `restaurant.module.ts` (exports).
- Demo: `prisma/demo/qr-menu.ts` called from `prisma/demo-seed.ts` (QR code per table, menu policy, veg/tags/spice on the 12 dishes, 11 pictures copied from `apps/web/public/landing/*-800.webp` into `MEDIA_DIR`). I also fixed a pre-existing break in `prisma/demo/live.ts` (`SessionService` needs a `RealtimeBus` since ADR-032; the demo seed did not compile before).
- Infra/docs: `deploy/Caddyfile`, `docker-compose.prod.yml` (`media` volume + `MEDIA_DIR`), `Dockerfile.api` (`/data/media` owned by `node`), `apps/api/.env.example`, `docs/runbooks/deploy.md` (new QR-menu section), section B of the plan, ADR-035, this report. The migration file is untouched (its header comment still says `14_QAPI_REPORT.md`; this report is `11_`; I left it alone because editing a committed migration changes its checksum).

## 2. Verification (scratch copy `$HOME/qapi`, embedded PostgreSQL 17 on port 15434, Prisma client engine + `@prisma/adapter-pg`; none of those hacks are in the repo)

| Check | Result |
|---|---|
| `tsc --noEmit` (src + test) | clean |
| `eslint src test prisma` | 0 errors in my files; 1 pre-existing error in `test/order-edit.e2e-spec.ts` (`waiter` unused, not mine) |
| `prisma validate` / `prisma generate` | OK (with the fake-engine stubs) |
| Unit (`jest`) | 21 suites, **166 tests: 165 pass, 1 fail**. The failure is pre-existing and unrelated: `checkout/upi/upi-uri.spec.ts` "keeps non-Latin payee names" (Gujarati vowel sign dropped in this Node/ICU; file untouched). My 6 new suites = 33 tests, all pass (`image-sanitize`, `guestmenu.tokens`, `rate-limiter`, `running-bill`, `guest-status`, `redact-url`); `system-roles.catalog.spec` and `permission.registry.spec` pass with the new permissions |
| New e2e `test/guestmenu*.e2e-spec.ts` | **4 suites, 53 tests, all pass**: `guestmenu` 31, `guestmenu-limits` 5, `guestmenu-stream` 8, `guestmenu-media` 9 (shared fixture `test/guestmenu-harness.ts`) |
| Existing e2e (all 28 other suites, run in 5 chunks) | **765 tests: 763 pass, 2 fail**. Both failures are `concurrency.e2e-spec.ts` "20 concurrent order reads" and "Concurrent mixed read workload": `read ECONNRESET` from supertest in this VM. I re-ran that spec with `GuestMenuModule` removed from `app.module` and got the identical 2 failures, so they are environmental/pre-existing. The other 10 concurrency tests pass. Restaurant (mvp, operations, workflow), checkout (+invoice list), realtime, order-edit, waiter-bill-timeline, security, auth*, config-center, reports etc. all pass |
| Demo seed (`NEXUS_DEMO_SEED=true prisma/demo-seed.ts`) | runs end to end after the `live.ts` fix; `[16c] QR menu: 13 new QR code(s), 12 dish(es) marked, 11 picture(s) set`; audit chain VALID |

What the new e2e specs prove (summary): token format/uniqueness/stability, rotation (old link 404, guest tokens revoked, streams closed), per-table and global disable, permission matrix (owner / waiter / kitchen / host / other tenant / anonymous), public menu shape with absolute variant prices, add-on groups, sold-out flags, ETag/304 and a live price edit changing the ETag, 404 bodies identical for unknown vs malformed tokens, guest token binding (other table, closed visit, new visit), server-side pricing (client price field rejected; variant + add-on maths), idempotent replay / reuse conflict / 10 parallel identical requests = 1 order, sold-out / variant required / unavailable option / foreign item / caps, pending-order flood cap, confirm (numbered, idempotent, concurrent) / reject / edit / late-edit lock, running bill = invoice (subtotal and total locked), `ORDERING_LOCKED` after an invoice, UPI intent amount = invoice due with `am=141.75`, auto mode, restaurant-wide off, waiter call dedupe / alerts / ack / switch-off, privacy sweeps (no ids, emails, tokens, other tables in any public body), all rate limits (429 + Retry-After, per-device isolation, anti-enumeration), SSE (hello, `menu.changed` on price / sold-out / tagline, `order.updated`, `bill.updated`, `waiter.ack`, `table.updated`, tenant isolation, concurrent-stream cap and release, `bye` on rotate), pictures (content-addressed storage, metadata removed, immutable cache + 304, replace / delete / shared-file refcount, HTML / SVG / GIF / exe / truncated / tiny / animated / huge-dimension / oversize rejection, traversal attempts, brand + category pictures, presentation fields).

## 3. What could NOT be run / verified

- **`prisma migrate diff` / `migrate deploy` against the real Prisma engines**: binaries.prisma.sh is blocked. The migration was applied by the scratch harness (`dbprep.js` replays every `migration.sql` in order on embedded Postgres) and the schema validated with stubs, but I could not run `prisma migrate diff --from-migrations --to-schema` to prove zero drift. Please run it once where the engines download.
- **`sharp` path** (re-encode to WebP, 480 px thumb, blur data URI, dominant colour, auto-rotate): `sharp` is not installed here. Only the dependency-free path (validate + strip + store the original) is tested; the sharp branch is written defensively (optional `require`, falls back silently) but is unexercised. JPEG EXIF stripping is unit-tested on synthetic JPEGs, not in e2e (the e2e images are real PNGs so they would also decode under sharp).
- **Caddy**: no `caddy` binary, so `deploy/Caddyfile` edits (stream excluded from compression, `/api/media/*` block without `no-store`, `X-Forwarded-Prefix`) were not `caddy validate`d or smoked. Run `caddy validate` and `curl -N .../api/public/menu/<token>/stream` after deploy.
- **Web**: I did not run or touch `apps/web` (vitest/tsc not run). Compatibility with `apps/web/src/guestmenu/api.ts`, `qr/api.ts`, `qr/normalize.ts`, `types.ts` was checked by reading them against the e2e-tested wire shapes.
- **More than one API instance**: rate limits and stream hub are per instance (documented in ADR-035 / runbook); not testable here.
- **Load/soak** of the SSE hub beyond the unit of 3 to 4 concurrent streams per spec.

## 4. Contract: differences and additions (full text now in plan section B, "AS IMPLEMENTED")

Same as the sketch, except:
1. `POST /orders` **requires** `Idempotency-Key` (400 `IDEMPOTENCY_KEY_REQUIRED`) and `X-Guest-Token`; replay answers 200 + `Idempotent-Replay: true`.
2. A guest order's id = the Service Request id in guest and staff APIs alike (`orderId`, `state.orders[].id`, `admin/guest-orders` `id`, `:id` of confirm/reject/edit). `guestOrderId` is extra.
3. `/state`: extra `mine`, `edited`, `rejectReason`; status vocabulary has `PREPARING|READY|SERVED|REJECTED|CANCELLED` besides AWAITING/CONFIRMED; `bill` is `null` until something is confirmed, `bill.status` is `RUNNING|FINAL|PAID` plus `reference`; `taxLines[]` = `{name,label,ratePercent,amountMinor}` with GST as CGST+SGST; `waiterCall` is `{open:false}` or `{open:true,reason,at}`.
4. Stream events carry hints only (`order.updated {orderId,status}`, `bill.updated {}`, `waiter.ack {}`), plus `hello` and `bye`.
5. `waiter` returns 202 with `{open,reason,at}`; `pay-intent` is 200 with `{upiUri,qrPayload,amountMinor,reference}`.
6. Error envelope `{error:{code,message,details}}`; codes `MENU_DISABLED, ORDERING_OFF, TABLE_CLOSED, GUEST_TOKEN_INVALID, ORDERING_LOCKED, SOLD_OUT, IDEMPOTENCY_KEY_REUSED, BILL_NOT_READY, UPI_UNAVAILABLE, RATE_LIMITED, UNSUPPORTED_MEDIA, PAYLOAD_TOO_LARGE, MEDIA_NOT_CONFIGURED`.
7. Staff additions beyond the sketch: `POST /admin/qr/tables/:tableId/rotate`, `PATCH /admin/qr/tables/:tableId {enabled?,orderingEnabled?}`, `POST|DELETE /admin/qr/settings/logo|cover`, `POST|DELETE /admin/menu/categories/:id/image`, `PATCH /admin/menu/items/:id/presentation`, `GET /admin/guest-orders/alerts`, `POST /admin/guest-orders/alerts/:tableId/ack`, public `GET /media/:businessId/:file`. `GET /admin/guest-orders` defaults to the last 24 h when no `status` is given.
8. Uploads: multipart field `file` (matches Q-STAFF's assumption), optional `blur` and `color` fields; response `{...,imageUrl,imageThumbUrl,blurDataUri,color}`; `imageUrl` is the relative `/media/<businessId>/<sha1>.<ext>` for staff (the web helper makes it absolute) and absolute in the public menu.

## 5. Notes for Q-WEB / Q-STAFF (nothing in `apps/web` was edited)

- Q-STAFF's assumptions all hold: `/admin/guest-orders/alerts` + `alerts/:tableId/ack` exist and behave as assumed; `uploadImage` field `file` is right; `edit` body `{lines:[{id,qty}],note?}` is exactly what the API takes (qty 0 removes; every `id` must be a line id from the same order row); `Idempotency-Key` on confirm/reject is accepted and ignored because those are naturally idempotent.
- The staff **catalog editor does not yet set** `dietType` / `menuTags` / `spiceLevel`; the endpoint is ready (`PATCH /admin/menu/items/:id/presentation`, permission `restaurant.qr.manage`).
- `edited` in `/state` is false for edits made before confirmation (they are not kitchen-visible, same rule as ADR-016/017 order-edit); the guest still sees the new quantities and total.
- The guest page must handle `401 GUEST_TOKEN_INVALID` by re-issuing a token (it already does) and `409 ORDERING_LOCKED` ("a bill has been prepared, ask your waiter").
- EventSource reconnects by itself after a `bye`; `hello`/`bye` are named events the web may ignore.

## 6. Operational notes

- **Existing databases** need `prisma db seed` (the release `migrate` job does it) so system roles receive `restaurant.qr.manage` (owner via wildcard, location-manager) and `restaurant.guestorder.manage` (+ service-team).
- `apps/api/src/guestmenu/guestmenu.providers.ts` is an empty, unreferenced leftover of the first run. Deletions are disabled on the mount; please `git rm` it.
- Env (all optional in dev, see `.env.example`): `MEDIA_DIR` (**required in production**, else uploads 503), `MEDIA_MAX_UPLOAD_BYTES`, `MEDIA_PUBLIC_BASE_URL`, `QR_PUBLIC_BASE_URL`, `GUESTMENU_LIMIT_*`, `GUESTMENU_*`.
- Back up the `media` volume with the database. Table tokens are secrets: Caddy's own access log still records the full URI (documented; the API log redacts it).
- `sharp` is intentionally not added to `package.json` (no lockfile change possible here). To enable resizing/WebP/thumbnails: `npm i -w @nexus/api sharp` in the build stage; no code change needed.

## 7. Nothing here was committed or pushed.
