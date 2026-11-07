# Auto-provisioning: payment, account, owner link

Paid in full for Counter, Floor or Pass -> the restaurant account is created by the server -> the owner sets their own
password with a one-time link. No email provider is needed. Staff only step in for the exceptions below.

## How it works

1. A payment is confirmed (webhook, "Check payment", or the first AutoPay debit). The payments code calls
   `AutoProvisionService.autoProvision(registrationId)`, which never throws.
2. It proceeds only when a `registration_payment` is `PAID`, `paidAmountPaise == amountPaise` and `planKey` is a fixed-price
   plan. Typed amounts, `AMOUNT_MISMATCH`, Many Doors, "not sure", free pilots (`allowUnpaid`) and spam/rejected requests
   stay manual.
3. It runs the same resumable job staff use (actor `auto-provision`, audit metadata `autoProvisioned: true`). Business,
   location, owner, modules, commercial and onboarding are created once; a retry resumes. **No password is issued.**
4. The `commercial` step writes `planKey`, `billingCycle`, `billingSource` (LINK | AUTOPAY | MANUAL), `registrationId`,
   `subscriptionId` and `paidUntil` (paid date + 1 month or 12 months) on the business. Each AutoPay debit calls
   `BillingRecordService.extendPaidUntil` (never moves backwards, idempotent). The Clients page shows these.
5. The owner reaches the account through a **one-time link** (`credential_token`): 32 random bytes, only the sha256 is stored,
   valid 72 hours, single use. It is minted on demand, so a lost link is simply re-issued.

## Endpoints

| Who | Endpoint | Purpose |
|---|---|---|
| Public | `POST /public/claim/issue` `{referenceCode,phoneLast4,payerSecret}` | The payer's browser asks for the owner link. `phoneLast4` = last 4 digits of the mobile on the request (the secret alone never releases a link). Answers `{status:'ready',token,expiresAt}`, `{status:'pending',paid}` (still processing; `paid` says whether the money has arrived) or `{status:'manual'}` (money arrived but a person finishes it, including any `AMOUNT_MISMATCH`). Refused (same 404) once the owner has signed in, or once a link was already used to set a password. Every wrong proof is the same 404. Limit 120/hour per IP. |
| Public | `POST /public/claim/redeem` `{token,password}` | Sets the password (min 8) and clears `mustChangePassword`. Answers `{email,businessName}`. Works once. |
| Staff | `POST /internal/registrations/:id/claim-link` | A fresh link to send on WhatsApp. Only after the account exists and before the owner has signed in. |
| Cron | `GET /internal/cron/provision` | Vercel Cron once a day (Hobby allows no more) plus `.github/workflows/provision-cron.yml` every 10 minutes. Finishes paid-but-not-created registrations and crashed runs. |
| Staff | `GET /internal/provisioning/attention` | What needs a person: failed jobs, paid but not created, amount mismatches. |

The `payerSecret` is minted **when the registration form is submitted** and returned once in that response (`POST /public/registrations` ->
`{ok, referenceCode, payerSecret}`); only its sha256 is kept, in `registration_request.payerSecretHash`. It is never returned by
"Pay now" or by the status call, so a stranger who learns the reference code and email cannot grab it by calling Pay now first.
The browser that submitted the form keeps it in localStorage (`nx.payer.<code>`) and removes it as soon as the link is ready (or
after five "not for you" answers). Releasing a link needs the code, the secret AND the last 4 digits of the registered mobile. A
registration made before this change has no secret hash: its claim answers 404 and staff send the link (`claim-link`).
`registration_payment.payerSecretHash` is no longer written or read (the column stays, unused).

## Environment

- `CRON_SECRET` (required for the cron; unset, or shorter than 32 characters, means the route answers 503 and logs why).
  Generate one with `openssl rand -base64 32`. Vercel sends it as `Authorization: Bearer ...`. Set it in the Vercel
  project env, then redeploy.

## Before deploying

0. **A fresh database needs `npx prisma db seed` once** (it creates the business types, roles and the platform admin). Without
   it the very first provisioning fails with "The restaurant business type is not set up on this server". Production already has it.
1. Back up Neon.
2. Apply `20261108100000_registration_payer_secret` (two nullable columns on `registration_request`) and
   `20261107100000_auto_provision_claim` (additive: six columns on `business`, one on `registration_payment`, the
   `credential_token` table) with the unpooled URL, after the earlier pending migrations.
3. Deploy, then set `CRON_SECRET`.

## Cases that stay manual (staff see them in the attention list)

- A job that failed with a clear reason (for example the owner email already has an account): fix the email in the
  Create account dialog and retry. The cron does not retry these on its own.
- Paid Many Doors / typed-amount requests: create the account by hand.
- The owner already signed in and lost the password: use "reset password" on their account.

## Known limits

- The guess counter (5 per hour per code and caller IP) lives in memory of one serverless instance (it resets on a cold start and
  is not shared). Making it shared needs a table or Redis, which is not worth it: the real control is the 256-bit payer secret,
  which cannot be guessed at any rate, plus the last-4-digits check and the per-IP throttle.
- "Pay now" and the AutoPay first-debit write run without holding a transaction across a network call. The Pay now claim is a
  compare-and-set on `registration_request.payLockedAt` (60 s, then stale), so it works with Neon's pooled URL where each
  serverless instance has ONE connection (`test/pool-one.e2e-spec.ts` runs the chain with `connection_limit=1`).
- The creation lock is released only by the request that wrote it (`payLockedAt` must still equal its own value), so a stalled
  request whose claim went stale cannot clear a newer request's lock and let a third one create a second live link. Staff
  "create payment link" claims the same lock: a staff click while the owner's Pay now is creating a link answers 409 ("a payment
  link is being created ... wait a few seconds"). Neither path holds a transaction or advisory lock across the Cashfree call.
- If Cashfree creates a link but recording it in our database fails, the link is cancelled at Cashfree (best effort; only the
  error name is logged) before the error is returned, so nobody can pay a link we do not know about. If that cancel also fails
  the log line "could not cancel an unrecorded payment link" names the link id: cancel it in the Cashfree dashboard.
- `POST /public/payments/status` still answers `{paid}` for anyone who knows a reference code AND its email (the email is not a
  secret). It reveals one boolean and nothing else; the landing page does not send the payer secret there, so it is not required.
  Everything that releases an account (`claim/issue`) needs the payer secret.
- Public responses (`/public/*`) carry `Cache-Control: no-store` by default (a Nest middleware, so it also holds behind Caddy;
  `vercel.json` repeats it for registrations, claim, payments and the Cashfree webhook). The QR menu sets its own ETag
  revalidation and is not affected. The registration and `claim/issue` responses contain one-time secrets and tokens.
- The Cashfree SDK origins are allowed in the CSP only on `/pay/autopay/*` (see `cashfree.md`).
- An owner email nobody verified: the account is bound to the email on the registration form. Confirm the contact on the
  first call.

## Cron schedule and GitHub secrets

`vercel.json` runs the route daily at 03:00 UTC. For a faster safety net the GitHub workflow `provision-cron` calls it every
10 minutes. Add two repository secrets (Settings > Secrets and variables > Actions): `APP_URL` (production origin, no
trailing slash, must start with `https://`: the job fails otherwise, because the secret travels in a header) and `CRON_SECRET`
(same value as on Vercel). If either is missing the job skips cleanly. GitHub disables scheduled workflows after 60 days
without repository activity: re-enable it (Actions tab) if the repo goes quiet; the Vercel daily cron is the backstop, and
`claim/issue` and "Check payment" also start provisioning. The route is
idempotent, so overlapping with the Vercel cron is harmless.

## Return page after paying

CUSTOMER payment links are created with `link_meta.return_url = ${QR_PUBLIC_BASE_URL}/pay/return?code=<referenceCode>`
(sandbox accepts and echoes it; what Cashfree appends to the redirect after a real payment is not verified). Without
`QR_PUBLIC_BASE_URL` no return URL is sent.

## Operator tools (support day to day)

All of these are for platform staff (`platform-admin`); a business user gets 403.

| Need | Call | Notes |
| --- | --- | --- |
| See a client's people, last sign-in, roles, lock state | `GET /internal/businesses/:id/users` | Never returns hashes or tokens. |
| Owner forgot the password | `POST /internal/businesses/:id/users/:userId/reset-link` | Returns `{token, expiresAt}` once. Revokes the user's sessions and older unused links; the user must choose a new password. Works after the owner has signed in (the registration `claim-link` does not). Send `/set-password#t=<token>` on WhatsApp. |
| Typo in a lead's name, email or phone | `PATCH /internal/registrations/:id` with `contactName`, `email`, `phone` | Only while no restaurant account exists (409 after: change the email under Clients > People). A waiting account job follows the correction. The phone's last four digits are the claim proof, so fix a wrong phone before the owner tries to claim. |
| Client paid by UPI / bank transfer / cash | `POST /internal/registrations/:id/manual-payment` | Body: `planKey`, `cycle`, optional `launchPack`, `method` (UPI/BANK/CASH/OTHER), `reference`, optional `paidOn`. Amount is the server quote; a different `amountRupees` needs `overrideReason`. Creates a PAID payment (source MANUAL) and the account follows automatically. The same reference twice, or a second payment, answers 409. |
| Payment flagged "amount does not match" | `POST /internal/registrations/:id/payments/:paymentId/accept` with `reason` | Check the payment in the Cashfree dashboard first (refund the difference, or agree it). Marks it PAID with the amount actually paid, keeps the reason and who accepted, and the account follows automatically. |

Modules enabled by an automatic account follow the plan: Counter = core (restaurant, catalog, checkout) + reports;
Floor and Pass add costs. The Alerts Center is part of the core app (there is no separate module key). Accounts that
staff create by hand keep the wizard default (reports + costs).

Manual payments and accepted mismatches happen before a business exists, so they are recorded in the structured log and
on the payment row (`quote.manual`, `quote.accepted`), and the business activity history shows the account creation.
`QR_PUBLIC_BASE_URL` and `CRON_SECRET` are read through `src/provisioning/runtime-config.ts`.
