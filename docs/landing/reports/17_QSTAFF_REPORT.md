# 17 — Q-STAFF report (staff QR pages wired to the real API)

Scope: apps/web/src/qr/**, i18n/en.qr.json, small edits to shell/pages.tsx, shell/access.ts, AppShell, FloorGrid, MenuSetupPage.

## Changed
- qr/types.ts, normalize.ts, api.ts rewritten to the real wire shapes (tables with `url`, `orderingEnabled`, `version`, `waiterCall`; settings with `version`; guest orders with `rejectReason`, `lines[].cancelled`; upload responses `imageUrl`/`imageThumbUrl`).
- Tables: rotate / enable / ordering toggle send `expectedVersion`; stale save -> "someone changed this" + reload. QR URL = server `url` first, page origin fallback.
- Settings: PATCH with `expectedVersion`; logo/cover upload bumps version, panel reloads.
- Pictures: multipart field `file`; item photos show the 480px thumb; new "Category pictures" section; server reasons surfaced (too small / animated / hidden camera rotation / size cap / media storage not configured).
- Inbox: confirm / reject are plain POSTs; edit carries `Idempotency-Key`; `ORDERING_LOCKED` explained as "a bill exists".
- QR_MOCK is build-time false in production; qr/mock.ts throws if loaded there.
- Catalog editor (MenuSetupPage): "Guest menu details" fieldset (dietary mark, up to 6 tags, spice level) via PATCH /admin/menu/items/:id/presentation (owner / location-manager only).
- Nav: `/guest-orders` (g o) and `/qr` (g q) gated by `canManageGuestOrders` / `canManageQr`; GuestOrderProvider in AppShell with count badge; FloorGrid tiles show guest / waiter chips.

## Verification
- Live integration vs real API (embedded Postgres, demo seed): 14/14 (list, rotate incl. old link 404 / stale version 409, enable + ordering toggles, settings conflict, logo/cover upload+removal, dish + category upload -> public menu, presentation PATCH, guest order -> inbox -> edit -> confirm / reject, waiter call -> alerts -> ack, waiter role gets 403 on tables + presentation). Spec lives outside the repo in $HOME/qstaff-tools/live.
- Lead re-run after all agents finished: tsc OK, eslint OK, vitest 70 files / 736 tests OK, vite build OK.

## Not verified
- No browser pass of the staff dialogs, crop tool and print layouts.
- sharp / WebP thumbnail path (sharp not installed in the scratch API).
- Guest-sourced "Guest" chip inside KitchenPage / SessionPanel cards.
