# Runbook: Pilot Restaurant Setup

**Audience:** Manhar Creatives deployment team  
**Updated:** 2026-10-29  
**Prerequisite:** `deploy.ps1` has already run successfully (migrations, seed, health check).

---

## Overview

After `deploy.ps1` succeeds, the database contains:
- Business types (restaurant, café, hotel, …)
- System roles (owner, cashier, kitchen-team, …)
- Platform admin user (credentials from `PLATFORM_BOOTSTRAP_EMAIL` / `PLATFORM_BOOTSTRAP_PASSWORD`)

**Nothing else.** Before the first transaction can be processed, a restaurant must be configured. This runbook covers two paths:

| Path | When to use |
|---|---|
| **[A] Demo seed** | Developer testing / demo environments only |
| **[B] Admin UI (recommended)** | Real restaurant onboarding: platform admin creates the workspace in the app, the owner sets up tables and menu themselves |
| **[C] API** | Scripting / bulk onboarding. Same result as [B] |

---|---|
| **[A] Demo seed** | Developer testing / demo environments only |
| **[B] Manual API setup** | Real pilot restaurant onboarding |

---

## Path A — Demo Seed (Developer / Demo Environments Only)

Creates a synthetic "The Pilot Kitchen" restaurant with users, catalog, tables, and modules activated.

```powershell
# Never run in production — guard enforced in script
$env:NEXUS_DEMO_SEED = "true"
npm run demo:seed
```

Or if in the API workspace directory:

```powershell
$env:NEXUS_DEMO_SEED = "true"
npx ts-node --compiler-options '{"module":"commonjs"}' prisma/demo-seed.ts
```

The script will print the login credentials when complete. Login at http://localhost:5173 with `demo.owner@pilot.nexus` / `PilotOwner@2024`.

> **Warning:** Demo credentials are publicly documented. Never use them in a production-facing environment or with real business data.

---

## Path B — Admin UI (recommended)

### Step 1 — Platform admin creates the restaurant

1. Sign in as the platform admin (`PLATFORM_BOOTSTRAP_EMAIL`).
2. **Onboarding → New restaurant**.
3. Fill in the restaurant name, first location, the owner's name and email, and pick the commercial status (Trial for a free pilot). A strong temporary password is generated; modules Restaurant operations, Menu and Checkout are always included, Reports and Operating costs are optional.
4. **Create restaurant**. The dialog creates the business, location, owner login and modules, and starts the go-live checklist. If a step fails, **Retry** continues from that step (nothing is created twice).
5. Copy the sign-in address, email and temporary password from the final screen. **The password is shown only once.** Send it to the owner over a private channel.

### Step 2 — Owner signs in and sets their own password

1. The owner signs in with the temporary password. The app shows a **Set your own password** screen and nothing else works until it is changed (the API enforces this too).
2. After the change they sign in again. Home shows a **Getting started** checklist (tables, menu, team). Later changes: account menu (initials, top right) → **Change password**.
3. An admin who resets someone's password in Team also marks it temporary, so that person must change it at next sign-in.

### Step 3 — Owner sets up the restaurant (no API needed)

| Where | What |
|---|---|
| **Floor setup** | Add dining areas (Main Hall, Terrace) and tables. **Add many** creates T1…T10 in one go. Hide a table instead of removing it once it has history. |
| **Menu** | Add tax rates first (for example GST 5%), then categories and dishes. Sizes (Half/Full) are added to a dish after it is saved. Untick **Available** when something is sold out. |
| **Add-ons** (on the Menu page) | Groups like *Spice level* (pick one) or *Extra toppings* (pick several, with prices). Create the group, add its choices, then tick it on each dish. |
| **Restaurant profile** (owner only) | Brand colour (applies to every staff member), display name, and the name, address and GST number printed on invoices. |
| **Team** | Add waiters, kitchen and cashier logins with their roles. |

### Step 4 — Smoke test the flow

1. Tables & Sessions: tables visible. Open a session on a table.
2. New order with one dish, send to kitchen.
3. Kitchen Display: ticket appears. Start preparing, Mark ready.
4. Tables: Check out the session (CASH). The bill shows PAID.
5. Close the session. The table shows *Needs cleaning*; **Mark available** returns it to the floor.
6. Reports → Daily closing shows the sale.

An order must be served or cancelled before its session can be closed.

---

## Path C — API (same outcome as B)

All payloads below are validated by strict schemas: unknown fields are rejected.

```bash
# Platform admin token
POST /auth/login                                   { "email": "...", "password": "..." }

POST /internal/businesses                          { "name": "My Restaurant", "businessTypeKey": "restaurant" }      -> { "id": "$BID" }
POST /internal/businesses/$BID/locations           { "name": "Main Location" }
POST /internal/businesses/$BID/provision           { "email": "owner@x.com", "displayName": "Owner", "password": "min 8 chars", "requirePasswordChange": true }

# Modules, in dependency order (restaurant -> catalog -> checkout), then optional ones
POST /internal/businesses/$BID/modules/{restaurant|catalog|checkout|reports|costs}/activate
POST /internal/businesses/$BID/modules/{...}/complete-setup

POST /internal/commercial/clients/$BID             PATCH { "commercialStatus": "TRIAL" }
POST /internal/onboarding/$BID/initialize          { }
```

Then, with the owner's token: `POST /admin/dining/areas { locationId, name }`, `POST /admin/dining/tables { diningAreaId, locationId, code, capacity }`, `POST /admin/catalog/tax-categories { name, rate (0-1, e.g. 0.05) }`, `POST /admin/catalog/categories { name }`, `POST /admin/catalog/items { categoryId, taxCategoryId?, name, basePriceMinorUnits }`, `POST /admin/users { email, displayName, password, roleKeys }`.

---

## Post-Setup Checklist

Before handing off to the pilot client:

- [ ] Rotate the platform admin password (`PLATFORM_BOOTSTRAP_PASSWORD`)
- [ ] Owner changed the temporary password (the app forces this at first sign-in)
- [ ] Restaurant profile filled in (invoice name, address, GST number) before the first real bill
- [ ] Owner has logged in and confirmed they can see their restaurant
- [ ] At least 5 tables visible on the floor
- [ ] At least 3 menu items visible in the order builder
- [ ] Test transaction completed successfully (open → order → kitchen → pay → close)
- [ ] Kitchen staff user tested (login, see queue, cannot see Tables)
- [ ] Cashier user tested (login, can see Tables, can checkout)
- [ ] Printer registered and tested (if hardware available)
- [ ] Backup snapshot taken of the database
- [ ] CORS_ORIGIN set to the actual frontend domain
- [ ] Emergency contact / support escalation path communicated to pilot team

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| 401 on all requests | Token expired or wrong | Re-login, use fresh access token |
| 403 MODULE_DISABLED on catalog | Module not activated | Complete Step 5 for the relevant module |
| 404 on `/admin/dining/tables` | Restaurant module not ACTIVE | Run activate + complete-setup for restaurant |
| Tables show but can't open session | Catalog not activated (needed for ordering) | Activate catalog module |
| Payment fails (no payment method) | Checkout module setup incomplete | Check module status at `GET /admin/modules` |
| Demo seed fails | Main seed not run first | Run `npm run db:seed` then retry |
