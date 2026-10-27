# QA role sweep (dev only)

`role-sweep.mjs` drives headless Edge through the whole web app once per role (fresh browser context, desktop 1440x900 and phone 390x844, client-side navigation, 1.5 s settle) and reports console errors/warnings, page errors, HTTP >= 400, visible `role=alert` text, raw i18n keys, horizontal overflow on phones and axe-core violations. `--explore` also clicks every non-destructive tab/button on each page once.

```bash
cd scripts/qa && npm i
# credentials: env vars or a gitignored scripts/qa/.env.local (NX_<ROLE>_PASSWORD=...)
node role-sweep.mjs --roles owner,cashier --explore
```

Roles: owner, cashier, kitchen, waiter, platform (the demo seed, `npm run demo:seed`; default passwords are printed by that script) plus optional manager, accountant, host (create them in Team or `POST /admin/users`; emails default to `qa.<role>@pilot.nexus`). Env: `NX_<ROLE>_EMAIL`, `NX_<ROLE>_PASSWORD`, `NX_WEB_URL`, `NX_EDGE`, `NX_OUT`, `NX_SETTLE_MS`, `NX_AXE=0`, `NX_LOGINS_PER_MIN` (the API limits logins to 10/min; the script throttles). Output: `out/sweep.json` + screenshots of failing pages.

Never point it at a real environment: it signs in with real credentials.
