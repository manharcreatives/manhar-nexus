# Cashfree: owner subscription payments (platform side)

What it does: when a restaurant owner registers on the website, Manhar staff open **Registrations**, check the
details and press **Send payment link**. Cashfree emails the owner a secure link (staff also get it to share on
WhatsApp). When the owner pays, Cashfree calls our webhook, the request shows **Paid**, and staff press **Create
restaurant account**. Creating the account stays a deliberate click; nothing is auto-created from a payment.

This is the *platform's* billing (owners paying Manhar). It is not the restaurants' own table billing, which uses
UPI QR (`checkout.upi_vpa`).

## Keys (never commit them)

Cashfree dashboard > Developers > API Keys. Use the **sandbox (test)** pair first.

| Variable | Value |
|---|---|
| `CASHFREE_CLIENT_ID` | App ID |
| `CASHFREE_CLIENT_SECRET` | Secret Key (also the webhook signing key) |
| `CASHFREE_ENV` | `sandbox` (default) or `production`. Selects the API host; the pair must match. |
| `CASHFREE_API_VERSION` | optional, default `2025-01-01` |
| `CASHFREE_WEBHOOK_URL` | optional; default `${QR_PUBLIC_BASE_URL}/api/public/cashfree/webhook` |

Local: put them in `apps/api/.env` (gitignored). Vercel:

```
npx vercel env add CASHFREE_CLIENT_ID production --scope manhar-creatives-projects
npx vercel env add CASHFREE_CLIENT_SECRET production --scope manhar-creatives-projects
npx vercel env add CASHFREE_ENV production --scope manhar-creatives-projects      # sandbox until go-live
```

Without the two keys the API still boots; **Send payment link** answers 503 "Online payments are not set up".

## Webhook

URL Cashfree must call: `https://<public host>/api/public/cashfree/webhook` (set in the dashboard under
Developers > Webhooks, and/or sent per link as `link_meta.notify_url`, which we do when the URL is known).

- Signature: `x-webhook-signature` = base64(HMAC-SHA256(secret, `x-webhook-timestamp` + raw body)). We verify over the
  **raw** body (`rawBody: true` in `createApp`) and accept the dotted variant that one Cashfree page shows.
  Nothing is applied before it verifies; a bad signature is a 401.
- Idempotent: retries are `duplicate`; six simultaneous retries apply exactly once (compare-and-set on status).
- A wrong or missing paid amount is **not** treated as paid: the link becomes `AMOUNT_MISMATCH` ("Check amount" in
  the UI) for a person to look at.
- `PAID` wins over an earlier `EXPIRED`/`CANCELLED`; an `EXPIRED` after `PAID` changes nothing.
- Unknown links and other event types get 200 so Cashfree stops retrying. Not configured gets 503 so it retries later.

## Database

Migration `20261105170000_registration_payment` adds one table (`registration_payment`). It is additive. Apply with
`npx prisma migrate deploy` (use `DATABASE_URL_UNPOOLED`). Take a backup first on production.

## Testing in sandbox

1. Set the sandbox keys; start the API and web.
2. Registrations > a request > **Send payment link** > amount > **Create link**.
3. Open the link, pay with Cashfree's test card / UPI (sandbox page lists them).
4. For the webhook to reach a local machine you need a public tunnel; otherwise test on the deployed preview.
   Without one, the signed-webhook path is covered by `apps/api/test/cashfree.e2e-spec.ts`.

## Verified against the real Cashfree sandbox (5 Nov 2026)

Done with a test key pair, a Rs 1 link and the sandbox net-banking simulator:

- `POST /pg/links` accepts `x-api-version: 2025-01-01` and returns `cf_link_id`, `link_url` (payments-test.cashfree.com) and `link_status: ACTIVE`.
- After the simulated payment, `GET /pg/links/{id}` returns `link_status: PAID` and `link_amount_paid` (the FAQ's warning that the status may not update did not apply), and `GET /pg/links/{id}/orders` lists the order (`order_status: PAID`, `order_id` like `CFPay_...`).
- Our **Check payment** path ran against those real responses and marked the payment PAID with the real order id.
- The link page shows "Business Name" until the business name/logo is set in the Cashfree dashboard. **Set it before real owners see it.**

## Still unverified: the webhook itself

Cashfree could not reach a local machine, so the real webhook (JSON or form body, exact field names, signature with or without a dot) has not been seen. The code accepts both bodies and both signature forms, and is covered by tests, but check it once on a deployed URL with the sandbox keys: set the webhook URL in Developers > Webhooks (test mode) or rely on `link_meta.notify_url`, pay a Rs 1 link and confirm the request shows **Paid** without pressing Check payment. Until then, **Check payment** is the dependable path.

## Go-live checklist

- [ ] Cashfree KYC/activation done and Payment Links enabled on the live account.
- [ ] Production keys added; `CASHFREE_ENV=production`.
- [ ] Webhook URL set in the live dashboard and a real small payment tested end to end.
- [ ] GST invoice for the subscription (Cashfree does not issue Manhar's tax invoice).
- [ ] Landing/legal copy matches what actually happens (payment link by email/WhatsApp, Cashfree page).
