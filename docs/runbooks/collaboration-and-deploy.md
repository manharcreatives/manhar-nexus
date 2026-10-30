# Collaboration and Deployment

This runbook explains how another developer can edit, test and deploy Manhar Nexus.

## Current setup

- Repository: `https://github.com/manharcreatives/manhar-nexus`
- Production URL: `https://manhar-nexus.vercel.app`
- Vercel team: `Manhar Creatives' projects`
- Vercel project: `manhar-nexus`
- API runtime: Vercel serverless function (`api/index.js`) backed by Neon PostgreSQL
- Frontend: Vite build served by Vercel

At the time of writing, production is deployed manually with the Vercel CLI. The Vercel
project is not connected to GitHub for automatic deployments.

## Credentials and access

Never commit passwords, API keys, database URLs or `.env` files to this repository.
Everything in a pushed commit must be treated as public.

Give collaborators access instead of sharing secrets:

1. Add them to the GitHub organisation `manharcreatives` with repository access.
2. Add them to the Vercel team `Manhar Creatives' projects` with project access.
3. Keep production environment variables in the Vercel project settings, not in Git.
4. Share any application demo accounts or one-off secrets through a password manager,
   never through a committed file, chat message or screenshot.

Production database credentials are available only in the Vercel environment and in
the local `.env.local` file on the machine that manages production. Do not send the
production `DATABASE_URL` to collaborators who only need to work on the UI.

## First-time local setup

Prerequisites: Node.js 20 or newer, npm, Git and access to the repository.

```bash
git clone https://github.com/manharcreatives/manhar-nexus.git
cd manhar-nexus
npm ci
```

Create a local environment file from the examples:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

For frontend-only work, the API is not required. For full-stack work, use a separate
development database or a separate Neon branch. Do not point local tests at the
production database: the e2e suites create tenants, invoices and other real rows.

## Day-to-day development

```bash
git switch main
git pull
git switch -c feat/short-description

# edit files

npm run lint
npm run typecheck
npm test
npm run build
```

Commit and open a pull request:

```bash
git add <files>
git commit -m "feat: describe the change"
git push -u origin feat/short-description
```

Do not push directly to `main` unless it is an emergency. Prefer a pull request so
CI and another developer can review the change.

## Manual production deployment

The person deploying needs the Vercel CLI and access to the Vercel project.

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build

npx vercel login
npx vercel link
# Select the "Manhar Creatives' projects" team and the "manhar-nexus" project.

npx vercel deploy --prod --yes
```

The CLI may print an `ECONNRESET` error while waiting for the build. If that happens,
verify the deployment instead of assuming it failed:

```bash
npx vercel inspect <deployment-id> --wait
```

Production environment variables are read from the Vercel project settings. A local
`.env.local` is not uploaded or needed for the deployment build.

## Database changes

A code deployment does not run database migrations. If `apps/api/prisma/schema.prisma`
changed, apply the migration to Neon separately before or with the deployment:

```bash
cd apps/api
DATABASE_URL="<pooled-url>" DATABASE_URL_UNPOOLED="<direct-url>" npx prisma migrate deploy
```

Use the direct Neon URL for migrations. Verify the migration on a Neon branch first
whenever possible. Never run `prisma migrate dev` against production.

## Recommended: connect GitHub to Vercel

Once GitHub auto-deploy is enabled, normal work becomes:

1. Create a branch.
2. Open a pull request.
3. Wait for lint, typecheck, tests and build.
4. Merge into `main`.
5. Vercel deploys `main` automatically.

To enable it:

1. Open the `manhar-nexus` project in the Vercel dashboard.
2. Go to **Settings → Git**.
3. Connect the GitHub repository `manharcreatives/manhar-nexus`.
4. Set the production branch to `main`.
5. Confirm that pull requests receive preview deployments.

After that, nobody needs to share Vercel credentials to ship a normal change. GitHub
and Vercel team membership is enough.

## Security rules

- Never commit `.env`, `.env.local`, `.env.production.local`, database dumps or keys.
- Keep the production Neon password in Vercel and a password manager only.
- Use separate development credentials and a separate database for local work.
- Rotate any secret that has been pasted into chat, a commit or a shared document.
- Review `git status` and `git diff` before every commit.
