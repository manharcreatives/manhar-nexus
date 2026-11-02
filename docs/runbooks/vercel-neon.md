# Runbook: Vercel + Neon demo deployment

**Audience:** the operator deploying the Hobby demo.
**Scope:** one Vercel project (web + `/api`) and one Neon Postgres database.
**Not for:** commercial production on Hobby, multi-instance realtime, or a custom domain.

The persistent-host procedure is `deploy.md`. The operator checklist is
`docs/ui/DEPLOYMENT_READINESS.md`.

---

## 1. Topology and decisions

```
browser -> https://<project>.vercel.app
              |-- /assets/*, /tables, /reports/* -> Vite static output
              |-- /api/* -> rewrite -> api/index.js -> Nest app (createApp, no listen)
                                                   |-- Neon pooled connection
```

- The web and API share one origin, so the `SameSite=Strict` refresh cookie works
  without cross-site rules. Do not split the API into a second Vercel project.
- `vercel.json` rewrites `/api/(.*)` to `api/index.js` because Vercel's
  non-Next bracket catch-all only matches one path segment. The handler strips
  `/api`, calls `createApp()` once per instance, and delegates to the
  Nest/Express app. There is no `listen()` and no shutdown hook.
- Realtime uses **polling**, not SSE. Vercel may route consecutive requests to
  different function instances, and the current `RealtimeBus` is in-process.
  `VITE_REALTIME_MODE=poll` makes the client subscribe through `PollingClient`
  and refetch every 10 seconds. Do not set this to `sse` on Vercel.
- Keep `regions` in `vercel.json` (`sin1` by default) aligned with the Neon
  region. Change both together if the users or database are elsewhere.
- Hobby is non-commercial and has per-instance limits. Auth rate limiting and
  login lockout are in memory, so they are **per function instance**, not global.
  Move to Vercel Pro + a shared Redis-backed limiter before selling this hosting
  path.

---

## 2. Prerequisites

- [ ] Vercel account and access to the repository.
- [ ] Neon account.
- [ ] Vercel CLI on the operator machine, or use the Vercel dashboard for all
      project/env steps.
- [ ] Node 20+ and the repository checked out at the release commit.
- [ ] The migration chain applies cleanly. CI already proves this on every push.

---

## 3. Create Neon

1. Create a Neon project in the region that matches `vercel.json`.
2. Use the default database (`neondb`) or create a dedicated one.
3. Copy both connection strings from **Connection Details**:
   - **Pooled**: host contains `-pooler`. This becomes `DATABASE_URL`.
   - **Direct**: host has no `-pooler`. This becomes `DATABASE_URL_UNPOOLED`.
4. Keep `sslmode=require`. For the pooled URL, append `pgbouncer=true` and a
   timeout, for example:

```text
postgresql://USER:PASSWORD@ep-xxx-pooler.REGION.aws.neon.tech/neondb?sslmode=require&pgbouncer=true&connect_timeout=15
```

The direct URL must not contain `pgbouncer=true`. URL-encode special characters
in the password.

Neon's pooled endpoint uses PgBouncer. `pgbouncer=true` disables prepared
statements for Prisma. The direct URL is used by migrations and one-off seeds.

---

## 4. Apply migrations and seed (one-off, from the operator machine)

Do **not** run migrations from the Vercel function. Use the direct endpoint for
this shell. Never use `prisma migrate dev` or `prisma db push` against Neon.

```powershell
$env:NODE_ENV = 'production'
$env:DATABASE_URL         = '<direct URL>'   # one-off shell: use direct for both
$env:DATABASE_URL_UNPOOLED = '<direct URL>'
$env:PLATFORM_BOOTSTRAP_EMAIL = '<platform admin email>'
$env:PLATFORM_BOOTSTRAP_PASSWORD = '<16+ character password>'

Push-Location apps/api
npx prisma migrate deploy
npx prisma db seed
Pop-Location
```

- `migrate deploy` applies only committed migrations. A destructive migration
  still needs a Neon branch or dump first.
- `db seed` is idempotent. It creates business types, system roles, and the first
  platform admin. It never resets an existing admin password.
- The platform password must not be the development default and must be at least
  16 characters in production.
- Never set `NEXUS_DEMO_SEED` in Vercel.

### Optional demo data

For a demo/pilot database only, load the synthetic restaurant from the same
machine. The demo seed refuses `NODE_ENV=production`, so run it in a separate
shell after the reference seed:

```powershell
$env:NODE_ENV = 'development'
$env:NEXUS_DEMO_SEED = 'true'
$env:DATABASE_URL = '<direct URL>'
$env:DATABASE_URL_UNPOOLED = '<direct URL>'
npm run demo:seed
```

Demo users and credentials are documented in
`docs/PROJECT_SETUP_AND_TRANSFER_GUIDE.md`. Never use the demo seed on a database
that contains real tenant data.

---

## 5. Create and configure the Vercel project

1. Import the repository in Vercel.
2. Leave **Root Directory** empty. Do not select `apps/web` or `apps/api`.
3. Framework preset: Vite. Build settings come from `vercel.json`:
   - install: `npm ci`
   - build: `npm run build`
   - output: `apps/web/dist`
4. Do not override the build command in the dashboard. The root build generates
   `@nexus/shared`, the Prisma client, and the API `dist` before the handler runs.
5. Ensure Deployment Protection / Vercel Authentication does not block the
   production URL. If it is enabled, `/api/health` and the smoke script will get
   an authentication response instead of the app.

Add these variables to **Production** (and Preview if previews must work). The
`VITE_*` values are build-time and require a redeploy when changed.

| Variable | Value | Notes |
|---|---|---|
| `NODE_ENV` | `production` | Vercel also defaults to production. |
| `LOG_LEVEL` | `info` | |
| `DATABASE_URL` | pooled Neon URL | Runtime queries; include `pgbouncer=true`. |
| `DATABASE_URL_UNPOOLED` | direct Neon URL | Prisma CLI/migrations; no `-pooler`. |
| `CORS_ORIGIN` | `https://<project>.vercel.app` | Exact origin, no trailing slash. |
| `TRUST_PROXY` | `1` | Vercel is one proxy hop. |
| `REFRESH_COOKIE_PATH` | `/api/auth` | The browser sees `/api`, not `/auth`. |
| `HEALTH_INCLUDE_OPTIONAL` | `false` | No Redis/Storage on this deployment. |
| `JWT_ACCESS_SECRET` | 64+ random chars | Generate; never reuse another environment. |
| `PLATFORM_BOOTSTRAP_EMAIL` | platform admin email | Must match the seeded value. |
| `PLATFORM_BOOTSTRAP_PASSWORD` | 16+ random chars | Only used if the admin is created by the seed. |
| `VITE_API_URL` | `/api` | Build-time; same origin. |
| `VITE_REALTIME_MODE` | `poll` | Build-time; 10-second polling. |

Do **not** set `REDIS_URL`, `STORAGE_HEALTH_URL`, `REDIS_REQUIRED`,
`STORAGE_REQUIRED`, or `NEXUS_DEMO_SEED` for this deployment.

Generate the JWT secret without printing it to shell history:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

The first production URL is assigned after the first deployment. If the project
name is not available, Vercel adds a suffix. Set `CORS_ORIGIN` to the final URL
and redeploy. A mismatch produces CORS/login failures even though the page loads.

### CLI equivalent

```powershell
vercel login
vercel link
vercel env add DATABASE_URL production
vercel env add DATABASE_URL_UNPOOLED production
vercel env add JWT_ACCESS_SECRET production
vercel env add PLATFORM_BOOTSTRAP_EMAIL production
vercel env add PLATFORM_BOOTSTRAP_PASSWORD production
vercel env add CORS_ORIGIN production
vercel env add TRUST_PROXY production
vercel env add REFRESH_COOKIE_PATH production
vercel env add HEALTH_INCLUDE_OPTIONAL production
vercel env add VITE_API_URL production
vercel env add VITE_REALTIME_MODE production
vercel --prod
```

Use the dashboard if the CLI prompts differ. `vercel env add` reads the value
interactively, so secrets do not need to appear in the command line.

---

## 6. Deploy and verify the packaged function

```powershell
vercel pull --yes --environment=production
vercel build --prod
vercel deploy --prebuilt --prod
```

`vercel build` is the first real check that the function bundle contains the
generated Prisma client, its Linux engine, `@node-rs/argon2`, and
`packages/shared/dist`. If the bundle is too large or a module is missing, fix
the function `includeFiles` before the first production deploy.

On Windows, local `vercel build` can fail with `spawn cmd.exe ENOENT`. Use the
remote build instead:

```powershell
vercel deploy --prod --yes
```

The remote build runs `npm ci`, `postinstall`, Prisma generation and the Vite
build on Vercel. Confirm the function appears as `λ api/index` in
`vercel inspect <deployment-url>`.

After the URL is known, set `CORS_ORIGIN` to the exact final origin and redeploy.

### Smoke

Use a business user for the read path. A platform admin can do health/login/me
but not `/admin/dining/tables`.

```powershell
$env:NEXUS_BASE_URL = 'https://<project>.vercel.app/api'
$env:NEXUS_SMOKE_EMAIL = '<business user>'
$env:NEXUS_SMOKE_PASSWORD = '<password>'
$env:NEXUS_SMOKE_EXPECT_COOKIE_PATH = '/api/auth'
$env:NEXUS_SMOKE_READ_PATH = '/admin/dining/tables'
powershell -ExecutionPolicy Bypass -File scripts/smoke.ps1
```

Manual checks:

- [ ] `GET /api/health` is 200 and `status` is `ok` (not `degraded`).
- [ ] `GET /api/does-not-exist` returns a JSON Nest 404, not the SPA HTML.
- [ ] `POST /api/auth/login` sets `nexus_refresh` with `Path=/api/auth`,
      `HttpOnly`, `Secure`, `SameSite=Strict`.
- [ ] `POST /api/auth/refresh` succeeds with only that cookie.
- [ ] Deep links such as `/tables` and `/reports/daily` return the SPA shell.
- [ ] A hard refresh after the 5-minute access token expires keeps the session.
- [ ] Two browser contexts show `Live - 10s` and a mutation appears within
      about 10 seconds without a reload.
- [ ] Response headers include HSTS, CSP, `X-Content-Type-Options`,
      `X-Frame-Options: DENY`, and `Referrer-Policy`.
- [ ] Browser console has no CSP violations or failed requests.
- [ ] Vercel function logs show no boot, Prisma, or argon2 errors.

The SPA rewrite excludes `/api/` and `/assets/`, so a missing hashed asset
returns Vercel 404 instead of the app shell. Keep that exclusion when editing
`vercel.json`.

---

## 7. Operations

- **Env changes**: redeploy. `VITE_*` values are inlined at build time.
- **Migrations**: run from the operator machine/CI with the direct URL and
  `prisma migrate deploy`. Never at function start.
- **Rollback**: use Vercel's previous deployment for code. Migrations are
  forward-only; use an expand/contract migration and a Neon branch/restore for
  data. Record the pre-deploy dump or branch for destructive changes.
- **Logs**: use `vercel logs <deployment-url>` and the Vercel dashboard. There is
  no local log shipper in this topology.
- **Health checks**: point uptime monitoring at `/api/health`. Keep
  `HEALTH_INCLUDE_OPTIONAL=false` unless Redis/Storage are actually provisioned.
- **Cold starts**: expect slower first requests. The handler caches `createApp()`
  per warm instance.
- **Limits**: Hobby is non-commercial. Auth rate limits/lockout are per instance;
  do not treat them as global protection. Add shared Redis-backed limiting and a
  real realtime transport before paid production.

---

## 8. Troubleshooting

### Nested `/api/*` routes return Vercel `NOT_FOUND`

Vercel's non-Next bracket catch-all (`api/[...path].js`) only matches one path
segment. Keep the entry point at `api/index.js` and keep this rewrite first:

```json
{ "source": "/api/(.*)", "destination": "/api" }
```

Without it, `/api/health` may work while `/api/auth/login` returns an edge 404
with `X-Vercel-Error: NOT_FOUND` and never invokes Nest.

### Deployment is `BLOCKED` with `TEAM_ACCESS_REQUIRED`

Vercel attributes a CLI deployment to the HEAD commit author. On a Hobby team
only the owner can deploy, so a commit authored by an email Vercel does not map
to a team member is blocked even though the CLI is logged in correctly. Check:

```powershell
git log -1 --format='%an <%ae>'
vercel api /v13/deployments/<id> --scope manhar-creatives-projects
```

The durable fix is to commit under a team-member identity, add the author to the
team, or use Pro. For a one-off demo release, a tree copy without `.git` has no
commit metadata and is not attributed to an outside author; the current release
was deployed this way. Do not deploy under an identity the team has not
approved.

### Login works but the browser loses the session

Check `REFRESH_COOKIE_PATH`. Behind the `/api` rewrite it must be `/api/auth`,
not `/auth`; otherwise the browser stores the cookie where `/api/auth/refresh`
cannot send it. The login response must set
`nexus_refresh; Path=/api/auth; HttpOnly; Secure; SameSite=Strict`.

---

## 9. What this deployment does not cover

- Custom domain, DNS, or public TLS management (Vercel supplies the certificate).
- Redis/Storage health or shared rate limiting.
- Multi-instance SSE. Polling is the only supported realtime mode here.
- Neon backup/retention policy for paid production. Confirm the plan's restore
  window before relying on it.
- Commercial use on Hobby.
