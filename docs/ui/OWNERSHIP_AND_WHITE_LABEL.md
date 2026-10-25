# Ownership and White-Label

## What is ours
- **UI code:** `apps/web/src` is original. The design system lives in `styles.css` (tokens) and `ui/` (primitives). No template, UI kit, or competitor screens were used.
- **Brand assets:** the monogram mark is generated from the brand name in CSS (`AppShell`, `LoginScreen`); `apps/web/public/favicon.svg` is original SVG. Add a logo file to `apps/web/public/` and swap `BrandMark` if a client wants their own.
- **Fonts:** Fraunces (display) and Inter Tight (UI), both OFL-1.1, installed from npm (`@fontsource-variable/*`) and bundled into `dist/assets`. No runtime Google Fonts request.
- **Icons:** lucide-react (ISC), imported only through `ui/icons.ts`.
- Licenses and versions: see `/THIRD_PARTY_NOTICES.md`.

## Rebranding (no code surgery)
| What | How |
|---|---|
| Product name | Set `VITE_BRAND_NAME` at build time (default "Manhar Nexus"). Shown in the shell, login, and `<title>`. |
| Accent color | Set `VITE_BRAND_ACCENT` (any CSS color, e.g. `#0f766e`). Hover and tint shades are derived automatically. |
| Permanent palette change | Edit the `--color-*` tokens in `apps/web/src/styles.css` `@theme`. |
| Favicon / theme-color | Replace `apps/web/public/favicon.svg`; edit `theme-color` in `apps/web/index.html`. |
| Copy | `apps/web/src/i18n/en.json` and the `en.<area>.json` overlays. |

Example: `VITE_BRAND_NAME="Spice Route" VITE_BRAND_ACCENT="#0f766e" npm run build -w @nexus/web`.

Known limit: the tagline "A Manhar Creatives product" on the login panel is copy in `i18n/en.json` (`auth.heroFootnote`) and must be edited or cleared per client.

## No lock-in
Runs on React, NestJS and PostgreSQL from this repo. Redis and object storage are optional integrations. No hosted UI builder or proprietary service is required.

## Data ownership
Operational data lives in the client's PostgreSQL. Backup and restore are documented in `docs/runbooks/`. A client-facing CSV export exists for Reports (see the page); full JSON export of all entities is **not** built yet. A database dump (`pg_dump`) is the supported full export today.

## License hygiene
Add each new distributed dependency to `THIRD_PARTY_NOTICES.md` and confirm it is not GPL/AGPL before merging.
