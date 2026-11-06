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
| Public | `POST /public/claim/issue` `{referenceCode,phoneLast4,payerSecret}` | The payer's browser asks for the owner link. `phoneLast4` = last 4 digits of the mobile on the request (the secret alone never releases a link). Answers `{status:'ready',token,expiresAt}`, `{status:'pending'}` (still processing) or `{status:'manual'}` (money arrived but a person finishes it). Every wrong proof is the same 404. Limit 120/hour per IP. |
| Public | `POST /public/claim/redeem` `{token,password}` | Sets the password (min 8) and clears `mustChangePassword`. Answers `{email,businessName}`. Works once. |
| Staff | `POST /internal/registrations/:id/claim-link` | A fresh link to send on WhatsApp. Only after the account exists and before the owner has signed in. |
| Cron | `GET /internal/cron/provision` | Vercel Cron once a day (Hobby allows no more) plus `.github/workflows/provision-cron.yml` every 10 minutes. Finishes paid-but-not-created registrations and crashed runs. |
| Staff | `GET /internal/provisioning/attention` | What needs a person: failed jobs, paid but not created, amount mismatches. |

The `payerSecret` is returned once by "Pay now" (only its hash is kept). Whoever holds it is the person who started the
payment and the last 4 digits of the registered mobile; the reference code and email alone never release a link.

## Environment

- `CRON_SECRET` (required for the cron; unset means the route answers 503). Vercel sends it as `Authorization: Bearer ...`.
  Set it in the Vercel project env, then redeploy.

## Before deploying

1. Back up Neon.
2. Apply `20261107100000_auto_provision_claim` (additive: six columns on `business`, one on `registration_payment`, the
   `credential_token` table) with the unpooled URL, after the earlier pending migrations.
3. Deploy, then set `CRON_SECRET`.

## Cases that stay manual (staff see them in the attention list)

- A job that failed with a clear reason (for example the owner email already has an account): fix the email in the
  Create account dialog and retry. The cron does not retry these on its own.
- Paid Many Doors / typed-amount requests: create the account by hand.
- The owner already signed in and lost the password: use "reset password" on their account.

## Known limits

- The guess counter (5 per hour per code and caller IP) lives in memory of one serverless instance; the 256-bit payer secret and the
  per-IP throttle are what really stop guessing.
- An owner email nobody verified: the account is bound to the email on the registration form. Confirm the contact on the
  first call.

## Cron schedule and GitHub secrets

`vercel.json` runs the route daily at 03:00 UTC. For a faster safety net the GitHub workflow `provision-cron` calls it every
10 minutes. Add two repository secrets (Settings > Secrets and variables > Actions): `APP_URL` (production origin, no
trailing slash) and `CRON_SECRET` (same value as on Vercel). If either is missing the job skips cleanly. The route is
idempotent, so overlapping with the Vercel cron is harmless.

## Return page after paying

CUSTOMER payment links are created with `link_meta.return_url = ${QR_PUBLIC_BASE_URL}/pay/return?code=<referenceCode>`
(sandbox accepts and echoes it; what Cashfree appends to the redirect after a real payment is not verified). Without
`QR_PUBLIC_BASE_URL` no return URL is sent.
