# S3-WEB report: kitchen timeline, checkout method switch, waiter bill + payment QR (Update Round 2, items A4, A5, A7)

Agent S3-WEB. Web side only; the API half (timeline, bill-view, payment-qr, UPI settings, payment idempotency) was already in the repo and was audited, not changed.

## API contracts consumed (read from source)
| Need | Endpoint | Permission |
|---|---|---|
| Order timeline | `GET /admin/kitchen/:id/timeline` -> `{steps[{id,kind,action,at,actor{type,label},sincePreviousMs,sinceStartMs,detail,source}],finished,startedAt,endedAt,totalMs,order,serverTime}` | `restaurant.kitchen.view` |
| Customer bill | `GET /admin/checkout/sessions/:sessionId/bill-view` -> `state: NO_BILL / NOT_FINALISED / READY`, lines (pre-tax), `taxLines` with CGST/SGST halves, rounding, grand total, `paid`, `paymentPending` | `restaurant.bill.show` |
| Payment QR | `GET /admin/checkout/invoices/:invoiceId/payment-qr` -> `ready`, `reason` (NOT_FINALISED / PAID / VOID / UPI_NOT_CONFIGURED / UPI_INVALID), `upi{uri,vpa,payeeName,note,transactionRef}`, amount from the immutable invoice total | `checkout.paymentqr.show` |
| UPI ID | Configuration Center setting `checkout.upi_vpa` (+ `upi_payee_name`), schema-driven, so `/config` already lists them | `core.business.configure` |
| Pay / capture / cancel | `POST invoices/:id/payments` (idempotencyKey UUID), `POST payments/:id/capture`, `POST payments/:id/cancel`, `GET invoices/:id/payments` | `checkout.payment.process` / `.view` |

Role mapping (system-roles.catalog): owner (wildcard), location-manager, checkout-associate and service-team hold `restaurant.bill.show` and `checkout.paymentqr.show`; only owner/manager/checkout-associate hold `checkout.payment.process`. The web only knows role keys, so `bill-show/permissions.ts` mirrors the catalog (same approach as `restaurant/permissions.ts`); the API stays the boundary.

## What was built
### A4 Kitchen timeline (`restaurant/kitchen/**`)
- `ElapsedTimeButton.tsx`: the big elapsed figure on a ticket is now a small underlined-dotted chip ("12 min ago", red when late, clock icon, 32px tall target). `KitchenPage.tsx` edited in place (one element swap + 2 imports).
- Click opens a non-modal card (portal to `body`, so the ticket's perforation mask cannot clip it; bottom sheet under 640px). Contents: action, actor, clock time, "2m 05s after the step before", small facts (edit number, change count, reason), total (live "so far" for an open order, fixed for a finished one).
- States: loading skeleton, empty, error with retry, stale-data warning when a background refresh fails (last good steps stay). Re-reads when the ticket changes while open.
- Dismissal: Esc (focus returns to the chip), Close button, outside press via `useOutsideDismiss` from `ui/useBackdropDismiss.ts` (only the pointer-DOWN origin counts, so a text selection that starts inside and ends outside never closes it; tested). `role="dialog"`, `aria-labelledby`, focus moves into the card.
- Files: `timelineApi.ts`, `timelineFormat.ts`, `useOrderTimeline.ts`, `icons.ts`.

### A5 Checkout back / change method without double payment (`restaurant/checkout/**`, `CheckoutDialog.tsx` edited in place)
- `paymentFlow.ts` (pure): `PaymentKeyRing` = one idempotency key per payment INTENT (invoice + method + amount + cash tendered). Same intent keeps its key (a retry replays); a changed cash amount gets a new key (the API 409s a replay with different cash); a cancelled UPI attempt retires its key (the API would otherwise replay the cancelled payment). `classifyPayments`, `isUnknownOutcome` (no answer / 5xx / 408), `isConflict`.
- `paymentApi.ts`: `list` and `cancel` (own file; `restaurant/api.ts` untouched).
- Dialog behaviour:
  - Single flight kept; while any write is in flight the method buttons, Cancel, the change flow and inputs are all disabled and the dialog will not close from the backdrop.
  - Typed cash and UTR live in dialog state, so switching Cash/UPI before anything is recorded loses nothing.
  - Once a UPI request is recorded (PENDING) the method buttons lock; the only way out is "Change payment method" -> inline confirmation ("only continue if the guest has not already paid by UPI") -> `cancel` -> back to method choice with the typed UTR kept ("kept in case you return to UPI"), then a NEW key for any new UPI request.
  - If the cancel races with a capture (409) or the cancel response is lost, the server is asked (`list`) and the screen follows the truth: paid, still pending (stay, with an explanation), or nothing recorded.
  - Lost response on pay/capture: "Not sure the last attempt was recorded" panel; Retry reuses the same key (safe) after first looking at what the server holds; "Check payment status" does the look without paying. If it turns out recorded, it is adopted (paid, or the pending UPI) and no second payment is sent.
  - A 409 "already an active or captured payment" is shown as the recorded payment, not a bare conflict.
  - Opening the dialog on a bill that already has a PENDING UPI payment (closed mid-way, other device) resumes it with a banner; a CAPTURED one opens as "already paid, nothing charged twice".
  - New optional prop `initialMethod` (used by the waiter QR screen).

### A7 Waiter "Show bill" and "Show payment QR" (`restaurant/bill-show/**`)
- `BillShowActions.tsx` renders the two buttons (role gated) in the table panel footer; one surgical edit in `SessionPanel.tsx` (import + one element after the Checkout button, re-read before write; S2's edits intact).
- `BillShowDialog.tsx` (lazy chunk, ~4.8 kB gz): Bill view (`BillBody.tsx`): restaurant name/legal name/address/GSTIN, table, bill no, date, itemised lines with variant/modifiers/qty x unit, subtotal, GST lines (CGST/SGST halves for plain GST, "Service charge 10%" for others), rounding if any, a very large total (LedgerFigure up to 4.5rem), Paid stamp or "UPI payment is being confirmed". Drafts are never shown ("not ready yet"); no bill gives "ask the cashier".
- QR view (`PaymentQrBody.tsx`): white high-contrast QR (reuses `qr/QrSvg.tsx`, imported not edited) of the server-built UPI URI, exact amount in huge figures, payee, UPI ID, bill reference, table, "Pay with a UPI app on this phone" deep link, live "Waiting for payment" -> "Payment started, waiting for the cashier" -> "Payment received" (realtime `payments`/`invoices` topics plus the shared safety-net poll; stops when paid).
- "Mark as collected" (only if the role holds payment.process, i.e. not waiters) opens the existing `CheckoutDialog` on UPI (single code path). Waiters see "the cashier confirms the payment, this screen updates by itself".
- UPI ID setting: not-configured state explains it; owners/managers get an inline form (`UpiSetupForm.tsx`, same regex as the API, writes `checkout.upi_vpa` through `configApi.setSetting`); waiters are told to ask the owner. The settings are also readable in `/config` with friendly titles (`config.settings.checkout_upi_vpa.*`, group "Checkout and payments").

### i18n
New `apps/web/src/i18n/en.billshow.json` (keys under `restaurant.kitchenTimeline`, `restaurant.checkout` additions, `billShow`, `config.settings.checkout_*`). `i18n/index.ts` already globs `en.*.json` and deep-merges, so no edit to the index was needed.

## Tests added (vitest, 64 new tests)
- `kitchen/timelineFormat.test.ts` (9), `kitchen/ElapsedTimeButton.test.tsx` (10: open/fetch, steps+durations+total, loading, empty, error+retry, Esc+focus return, Close, outside press, drag-select-ends-outside does NOT close, toggle, refresh on ticket change), `kitchen/KitchenTimeline.test.tsx` (1: chip on a real KitchenPage ticket).
- `checkout/paymentFlow.test.ts` (9), `checkout/CheckoutDialog.switch.test.tsx` (13): triple click sends ONE pay and locks controls; lost response retries with the SAME key after looking; lost-but-recorded is adopted without paying again; 409 shows the recorded UPI; resume on open; already paid on open; cash/UTR kept across switches; confirmed cancel -> fresh key, UTR kept; double click on "Yes, change" cancels once; cancel raced with capture -> paid, no cash taken; unconfirmable cancel keeps the request; `initialMethod`.
- `bill-show/permissions.test.ts` (5), `bill-show/BillShowDialog.test.tsx` (17): bill content/GST/rounding/paid/no-bill/not-final/loading/error; QR content (real module matrix, exact amount in label and deep link, payee, VPA, reference), pending/paid/not-configured (owner inline setup incl. validation + retry, waiter message), Mark as collected gating, error retry; action gating by role and hand-over to checkout on UPI.

## Verification (exact)
`bash $HOME/lp-verify.sh full` could not be run as ONE command: the device_bash tool dropped calls at 10 to 100 s and background processes die with the call. I ran the same stages by hand in `$HOME/lpbuild` after `lp-verify.sh sync`:
- tsc --noEmit (apps/web): clean (no output, exit 0), run after the last edit.
- eslint apps/web/src/restaurant: clean. (Whole `apps/web/src` eslint was clean in an earlier `lp-verify.sh quick` run that included all my source files, before the test files were added; the test files are under `restaurant/`, covered by the later run.)
- vitest `src/restaurant src/i18n`: 16 files, 154 tests passed (includes the i18n key-existence test and S2's restaurant tests).
- vitest `src/i18n src/ui src/shell`: 9 files, 63 passed. vitest `App, auth, bills, charts, config, context, home, lib, notifications, onboarding, people, qr, realtime, reports, setup`: 28 files, 179 passed.
- vitest `src/landing`: 3 files FAILED, 10 tests failed of 235 (Compare, Trust and one more in `sectionsB.test.tsx`/sibling files). These are the Website agent's in-progress redesign (content shrank: e.g. "expected 4 to be greater than or equal to 6" pillars); not mine, not touched.
- vite build: OK. Main entry `index-*.js` 216.8 kB gzip (budget 250). `BillShowDialog` is a separate 4.8 kB gzip lazy chunk.

## Not verified / limits
- API side not re-run: no live Postgres in this session; I did not run `apps/api/test/waiter-bill-timeline.e2e-spec.ts` or the API unit specs. Contracts were read from source only.
- No browser run: layout, the card's placement near viewport edges, the bottom-sheet breakpoint, print/visual polish, reduced-motion and an automated contrast/axe pass were not checked in a real browser. Colours use the existing dark tokens; the QR is near-black on white.
- QR scan with a real phone/UPI app not tested (the URI is built by the API and covered by its `upi-uri.spec.ts`).
- "Show payment QR" is not offered inside the cashier's CheckoutDialog (avoided an import cycle with bill-show); cashiers reach it from the table panel button.
- The QR screen finds the invoice via the bill view, so `canShowPaymentQr` requires `restaurant.bill.show` too (true for every shipped role).
- Full `lp-verify.sh full` single-shot result: not obtained (tool limits above).

## Observations for the lead (API)
- `initiatePayment` replays ANY existing payment for the same key, including a CANCELLED one, with a 201. The web now never reuses a cancelled attempt's key, but the API could reject or ignore keys whose payment is CANCELLED/FAILED.
- Timeline `kind` for audit actions it does not know falls to `other` (web shows the title-cased action); S2's order-edit actions containing "edit" map to `edited`, as intended.

## Files
New: `apps/web/src/restaurant/kitchen/{ElapsedTimeButton.tsx,timelineApi.ts,timelineFormat.ts,useOrderTimeline.ts,icons.ts,+3 tests}`, `restaurant/checkout/{paymentApi.ts,paymentFlow.ts,+2 tests}`, `restaurant/bill-show/{BillShowActions,BillShowDialog,BillBody,PaymentQrBody,UpiSetupForm}.tsx,{billShowApi,permissions,useRemote,icons}.ts,+2 tests`, `apps/web/src/i18n/en.billshow.json`.
Edited in place: `restaurant/KitchenPage.tsx` (chip), `restaurant/CheckoutDialog.tsx` (change-method flow), `restaurant/SessionPanel.tsx` (import + `<BillShowActions>`).
