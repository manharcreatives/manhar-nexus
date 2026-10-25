# Deployment Readiness — web and demo

## Clean-state demo (verified on this machine)
```
npm install
npm run db:init            # portable Postgres on :15432
npm run db:migrate
NEXUS_DEMO_SEED=true npm run demo:seed     # PowerShell: $env:NEXUS_DEMO_SEED='true'; npm run demo:seed
npm run build
npm run dev:api            # :3000
npm run dev:web            # :5173   (or: npm run preview -w @nexus/web)
```
`db:init`/`db:migrate` were not re-run from scratch in this session (the dev database already existed); `demo:seed`, `build`, `dev:web` and `preview` were. Verify the migration chain on a fresh database before release because two migration files carry uncommitted edits in the working tree.

## Web deployment notes
- **SPA fallback required.** Pages now have real URLs (`/tables`, `/reports`, …). The static host must serve `index.html` for unknown paths. `vite dev` and `vite preview` already do.
- `VITE_API_URL` points the app at the API; `VITE_BRAND_NAME` / `VITE_BRAND_ACCENT` rebrand it at build time (see `OWNERSHIP_AND_WHITE_LABEL.md`).
- Fonts are bundled in `dist/assets`; no external requests at runtime.
- `robots.txt` disallows indexing. Favicon is `public/favicon.svg`; `theme-color` is the accent.
- No OG image yet.

## Before the first real client
1. Rotate `PLATFORM_BOOTSTRAP_PASSWORD` and `JWT_ACCESS_SECRET`; never run the demo seed on a real database.
2. Validate a physical ESC/POS printer (roadmap condition, unchanged).
3. Staging restore drill on managed Postgres (roadmap condition, unchanged).
4. Decide card-payment strategy (no provider exists; the option is hidden).
5. Add server-side modifier validation and refund idempotency (see `SECURITY_REVIEW.md`).
6. Clear the tagline "A Manhar Creatives product" on the login panel for white-labelled clients (`auth.heroFootnote`).

## Runbooks
`docs/runbooks/` and `docs/pilot-acceptance-checklist.md` were not re-validated in this pass; the changes here do not alter backup, restore or deployment procedures, but the checklist's UI steps should be re-walked against the new screens.
