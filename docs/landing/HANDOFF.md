# Manhar Nexus landing — HANDOFF (2026-10-31)

Built inside apps/web (lazy chunk `src/landing/`). Signed-out `/` = website; `/login` = app sign-in; signed-in users unchanged.
Routes: `/`, `/terms`, `/privacy`, `/refund-policy`, `/billing-policy`, `/acceptable-use`, `/data-processing`, `/insights/:slug`.
Registration: web form -> `POST /public/registrations` (new API module, migration `20261031120000_registration_request`, ADR-033). Leads appear via `GET /internal/registrations` (platform admin). No workspace is auto-created; Cashfree is an INTEGRATION POINT (see Register/Pricing code comments).
Verify: `AGENT=you bash $HOME/lp-verify.sh` (device VM script) or locally `npm run typecheck && npm test && npm run build`.

## OWNER ACTION ITEMS before going public
1. Production hostname: placeholder `https://nexus.manharcreatives.com` in index.html, site.ts, robots.txt, sitemap.xml.
2. Deploy target conflict: Docker+Caddy files vs runbook saying Vercel+Neon (Vercel project `manhar-nexus` last prod deploy BLOCKED). Confirm; Vercel needs a vercel.json with SPA rewrites + cache headers.
3. Set `REGISTRATION_IP_SALT` (>=32 chars) in production env — the API refuses to boot in production without it. Run `npx prisma migrate deploy`.
4. Fill the `[…]` placeholders in legal pages (list: content/owner-fill-ins.ts, 35 items: Udyam no., GSTIN, address, grievance officer, courts, etc.) and get a lawyer to review the drafts. Public pages still show highlighted placeholders until filled.
5. Confirm GST registration (pricing shows "+18% GST"), pricing, Founding offer window (1 Nov 2026 – 31 Jan 2027), 14-day guarantee, support hours.
6. Founder paragraph in About is hidden until you approve it (content/about.ts ownerApproved).
7. Real Manhar Creatives logo files (Primary_H_White.png etc.) — footer/About use a low-res JPG extracted from the brand PDF.
8. Image check: `owner-tablet-reports` shows a laptop (alt text says tablet); `restaurant-before-service` resembles `restaurant-dining-golden-hour`; `boutique-hotel-dining` is evening not morning. Regenerate if you want.
9. App itself still uses old green #22C55E (styles.css, favicon, login). Brand guide v2 says #1DBA3C — a separate re-theme task.
10. Add JetBrains Mono (OFL 1.1) to THIRD_PARTY_NOTICES.md. Remove the `.lp-tmp/` folder (git-excluded scratch).
11. Do not claim India data residency until hosting region is confirmed. Printing/QR menu/card payments are labelled Coming soon.

---
## Round 2 addendum (2026-11-01)

Built (all verified by tsc, eslint, 736 web tests, vite build; API suites run on embedded Postgres by the agents):
1. Per-tab sessions (ADR-034) — several roles in one Chrome profile; shared backdrop-dismiss hook fixes "drag-select ends outside closes card".
2. Order edit before kitchen start (append-only, idempotent, optimistic version) + OrderBuilder with separate "Added to order" / "Menu items" panes.
3. Kitchen ticket: small clickable elapsed chip -> timeline card.
4. Checkout: Back / change payment method without data loss or double payment.
5. Waiter: Show bill + Show payment QR (UPI VPA setting `checkout.upi_vpa`, permissions restaurant.bill.show / checkout.paymentqr.show).
6. Nexus Menu (QR digital menu, ADR-035): public /m/:tableToken, SSE live status, self-ordering with waiter confirmation, bill + UPI; staff pages for QR codes, photos, appearance, guest-order inbox.
7. Website re-themed to the dark software palette, restructured, shortened, new plan cards, Nexus Menu headline.

Owner actions:
- Existing DBs: run `prisma db seed` (roles get restaurant.qr.manage / restaurant.guestorder.manage). Apply migrations 20261031150000_order_edit and 20261031170000_qr_digital_menu.
- Production env: `MEDIA_DIR` (+ backup volume), `QR_PUBLIC_BASE_URL`, `REGISTRATION_IP_SALT`; set UPI VPA in Configuration Center.
- Run `prisma migrate diff` once where Prisma engines can download; install `sharp` in the API image path check (resize/WebP untested here).
- Caddy access log records the full URL incl. table token — see runbook.
- Not verified here: real-device UPI scan, 60fps on phones, staff dialogs in a browser, Safari/Firefox, `caddy validate`.
- Housekeeping: delete `.lp-tmp/` (tarballs, screenshots) — deletion is disabled on the mount.
- Two existing concurrency e2e tests fail with ECONNRESET in the VM (identical without the new module).
- Software accent is still old green #22C55E; website/menu use brand #1DBA3C.
