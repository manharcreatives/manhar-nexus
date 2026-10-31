# 12 - S2-WEB report: order-taking redesign + edit order (update round 2, A2 web + A3)

Agent S2-WEB. API side (order-edit controller/dto/service/plan, `order-edit.e2e-spec.ts`) was already done and is untouched.

## What was built

### 1. Order taking: "Added" and "Menu" never mix (A3)
- `OrderBuilder.tsx` rewritten around three new parts under `restaurant/order/`:
  - `MenuPane.tsx` (zone b): search, category chips, big add buttons (48 px). A dish that is in the order only shows an accent badge "n in order"; the menu has NO quantity controls.
  - `OrderPane.tsx` (zone a): its own sunken surface with an accent hairline. Per line: state chip, variant/option detail, inline note editor, 48 px quantity stepper, trash, line total; empty state; scrolls inside the pane.
  - `OrderZones.tsx`: desktop (lg+) two side-by-side panes; phones show the menu with a sticky bottom bar "Order (n)" that opens the added list, and "Back to menu" returns. Both zones stay mounted (scroll/typing survive); focus moves to the revealed zone heading.
- Running total (LedgerFigure) + item count always visible in the dialog footer, `aria-live`.
- Per-line chips (`LineChip.tsx`, text + dot, never colour alone): New, Saved/not sent, Sent to kitchen, Preparing, Ready, Served, Removing.
- Keyboard/AA: real buttons with names, `region` landmarks "Menu items" / "Added to order", Esc cancels note edit without closing the dialog, dark tokens only (no raw colours).
- `cart.ts`: appended pure helpers `removeLine`, `setLineQuantity`, `setLineNote` (re-keys and merges on collision), `lineDetail`, `lineSubtotal`.
- `order/useModifierGroups.ts`: modifier-group loading extracted from the builder (shared with the edit dialog).

### 2. Edit order before the kitchen starts (A2)
- `SessionPanel.tsx`: "Edit order" on each order card.
  - Enabled for DRAFT and SENT with no line past PENDING (mirror of the API rule in `order/editRules.ts`).
  - Disabled with a visible reason (`aria-describedby`) for ACCEPTED/PREPARING/READY (kitchen started), SERVED, and a partially accepted SENT order. Hidden for CANCELLED (nothing left to edit) and for roles without `restaurant.order.edit`.
  - Cards show an "Edited" flag (editCount) and per-line "Added"/"Changed" marks plus line notes.
- `order/OrderEditDialog.tsx` (same two-zone layout; saved lines show their live state chip, new ones "New"):
  - Opens by fetching fresh `GET /admin/orders/:id` + `GET /admin/orders/:id/edits`; if the server says not editable it opens read-only with the reason (KITCHEN_STARTED, ORDER_SERVED, ORDER_CANCELLED, SESSION_NOT_OPEN, INVOICE_EXISTS).
  - Ops sent are the diff only (`add` / `update{quantity?,notes?}` / `remove`) + optional order note + optional reason, with `expectedVersion` and a client `idempotencyKey` (`POST /admin/orders/:id/edit`).
  - Idempotency key is kept while the edit is unchanged (network drop then Save again replays safely) and renewed when the edit or the base version changes. Single-flight Save.
  - 409 VERSION_CONFLICT: reloads the order, rebases the user's changes onto it (`rebase()`), shows an alert ("Someone else changed this order...", and how many changes no longer apply), next Save uses the new version and a new key.
  - 409 ORDER_EDIT_LOCKED: reloads state, flips to the read-only explanation, says changes were not saved.
  - Emptying the order is blocked client-side with the server's rule (EMPTY_ORDER); NO_CHANGES is prevented by the disabled Save.
  - Realtime: `useLiveRefresh(['orders','kitchen'])` (SSE, 15 s safety poll): pristine editor takes the new version silently with a notice; dirty editor rebases; kitchen starting the order flips to read-only. The API interceptor already publishes `orders`+`kitchen` for `POST /admin/orders/:id/edit`.
  - Variant/add-on change of a SAVED line = remove it and add a new configured line (the API's `update` supports variant/modifier re-pricing, but that needs the item catalog per line; the add/remove route gives the same audited result and the same server-side repricing). This is the one place I did less than the API allows.
- `order/orderEditApi.ts` (typed client; kept out of `api.ts` to avoid the shared file), `order/editDraft.ts` (pure draft/diff/rebase), `order/editRules.ts`, `order/lineState.ts`.

### 3. Permissions and i18n
- `permissions.ts`: new `canEditOrders` (`restaurant.order.edit` = owner, location-manager, service-team, same as the API role catalog). `permissions.test.ts` updated.
- `api.ts`: only optional type fields added (`ServiceRequest.version/editCount/lastEditedAt`, line `kitchenNote/editedAt/editKind`). No behaviour change.
- `i18n/en.orderedit.json` (new). The i18n index auto-merges `en.*.json` via `import.meta.glob`, so no index edit was needed. Keys: `restaurant.orderZones.*`, `restaurant.orderEdit.*`.

## Tests (vitest + testing-library)
New: `cart.lines.test.ts` (7), `order/editDraft.test.ts` (18), `OrderBuilder.test.tsx` (11), `order/OrderEditDialog.test.tsx` (19), `SessionPanel.edit.test.tsx` (16), +1 in `permissions.test.ts`. Covers: cart logic, zone separation (no controls in menu, no lines in menu), totals, notes, phone bar toggle, edit diff/ops, idempotency key reuse/renewal, single-flight, VERSION_CONFLICT rebase, ORDER_EDIT_LOCKED, read-only reasons, live refresh, button enabled/disabled/hidden by status and role.

## Verification (lp-verify toolchain, AGENT=s2, repo synced to $HOME/lpbuild)
- `tsc --noEmit -p apps/web`: OK (an earlier run showed errors only in `landing/content/platform.ts`, another agent's file; they were gone on the final run).
- `eslint apps/web/src`: OK.
- `vitest run src/restaurant src/i18n`: 16 files, 154 tests, all pass (includes S3's restaurant tests and `i18n/keys.test.ts`).
- Full `vitest run` (whole apps/web): all `restaurant/*` and `i18n` tests pass; the only failures are in `src/landing/{content,sections}` (Website agent's in-progress files: content.test.ts 2, sectionsA 2, sectionsB 6). Not mine; not touched.
- `vite build`: OK, entry chunk 216.75 kB gzip (budget 250 kB). Note the entry is shared with every agent.

## Not verified / limits
- No real browser: layout (desktop two panes, phone bar, sticky behaviour, 48 px targets, contrast) is verified by class/DOM assertions and by construction from the design tokens, not visually or with an axe run. Please eyeball it once at 390 px and 1280 px.
- The API e2e for order edit was not re-run (not my change; no live Postgres here). The web client was written against the contract in the controller/dto/service files, and all 409/400 `code` values come from `common/errors.ts`. `details.reason` is not exposed by `auth/api.ts` (ApiError keeps only status+code), so lock reasons come from `GET .../edits` instead.
- Sold-out marking from the plan: the staff catalog has no sold-out field (only `isActive`, which is filtered out), so nothing to mark yet.
- `ItemConfigDialog.tsx` is unchanged and reused as-is.
- The full lp-verify.sh run was done in pieces (quick, vitest, build) because a single call is capped near 180 s and a detached background run was killed between calls.

## Files
Edited: `restaurant/{OrderBuilder.tsx, SessionPanel.tsx, cart.ts, api.ts, permissions.ts, permissions.test.ts}`.
New: `restaurant/cart.lines.test.ts`, `restaurant/OrderBuilder.test.tsx`, `restaurant/SessionPanel.edit.test.tsx`, `restaurant/order/{LineChip,MenuPane,OrderPane,OrderZones,OrderEditDialog}.tsx`, `restaurant/order/{editDraft,editRules,lineState,orderEditApi,useModifierGroups,testFixtures}.ts`, `restaurant/order/{editDraft.test.ts,OrderEditDialog.test.tsx}`, `i18n/en.orderedit.json`.
