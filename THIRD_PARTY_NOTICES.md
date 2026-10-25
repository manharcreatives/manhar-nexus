# Third-Party Notices

Runtime dependencies of the web app that ship in the built bundle. Licenses verified from the npm registry metadata (2026-10-25). No GPL/AGPL dependency is used in distributed code.

| Package | Version | License | Use |
|---|---|---|---|
| react, react-dom | 18.3.x | MIT | UI runtime |
| react-router-dom | 7.x | MIT | Routing |
| react-i18next, i18next | 15.x / 23.x | MIT | Localisation |
| lucide-react | 1.x | ISC | Icons (single registry: `apps/web/src/ui/icons.ts`) |
| @fontsource-variable/fraunces | 5.x | OFL-1.1 | Display typeface, self-hosted |
| @fontsource-variable/inter-tight | 5.x | OFL-1.1 | UI typeface, self-hosted |
| tailwindcss, @tailwindcss/vite | 4.x | MIT | Styling (build-time) |

Font licenses: SIL Open Font License 1.1 permits embedding and redistribution, including commercially. The license text ships inside each `@fontsource-variable/*` package (`LICENSE`).

Backend and tooling licenses (NestJS, Prisma, etc.) are recorded by `npm ls --long` and should be re-audited before each release (`npx license-checker --production --summary`).

## Container base images (production images, `Dockerfile.api` / `Dockerfile.web` / `docker-compose.prod.yml`)

No npm dependency was added for deployment. The images redistribute these upstream components:

| Image | Used by | License |
|---|---|---|
| `node:22-bookworm-slim` | API build and runtime | Node.js: MIT; Debian packages: various (DFSG-free); `openssl` package: Apache-2.0 |
| `caddy:2.10-alpine` | Web edge / static server | Caddy: Apache-2.0; Alpine packages (incl. `libcap`): various (MIT/BSD/GPL tooling, unmodified) |
| `postgres:16-alpine` | Database service (pulled, not rebuilt) | PostgreSQL License |

Update this file whenever a dependency is added to a distributed package.
