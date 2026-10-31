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
