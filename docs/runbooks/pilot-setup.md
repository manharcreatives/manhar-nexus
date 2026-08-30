# Runbook: Pilot Restaurant Setup

**Audience:** Manhar Creatives deployment team  
**Updated:** 2026-08-30  
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

## Path B — Manual API Setup (Real Pilot Restaurant)

All calls below require a valid access token. Obtain it by logging in as the platform admin:

```bash
POST /auth/login
{ "email": "PLATFORM_BOOTSTRAP_EMAIL", "password": "PLATFORM_BOOTSTRAP_PASSWORD" }
→ { "accessToken": "..." }
```

Set `Authorization: Bearer <accessToken>` on every subsequent request.

---

### Step 1 — Get business type ID

```bash
GET /internal/business-types
```

Find the `id` for `key: "restaurant"` (or whichever type applies). Save it as `$BT_ID`.

---

### Step 2 — Create the business

```bash
POST /internal/businesses
{
  "name": "My Restaurant Name",
  "businessTypeId": "$BT_ID"
}
→ { "id": "$BUSINESS_ID", ... }
```

---

### Step 3 — Create the location

```bash
POST /internal/businesses/$BUSINESS_ID/locations
{
  "name": "Main Location",
  "timezone": "Asia/Kolkata"
}
→ { "id": "$LOCATION_ID", ... }
```

---

### Step 4 — Provision the owner user

```bash
POST /internal/businesses/$BUSINESS_ID/provision
{
  "email": "owner@restaurantname.com",
  "displayName": "Restaurant Owner",
  "password": "StrongPassword@123",
  "roleKey": "owner"
}
→ { "userId": "$OWNER_ID", ... }
```

---

### Step 5 — Activate modules

Activate in dependency order (restaurant → catalog → checkout).

```bash
POST /internal/businesses/$BUSINESS_ID/modules/restaurant/activate
POST /internal/businesses/$BUSINESS_ID/modules/restaurant/complete-setup

POST /internal/businesses/$BUSINESS_ID/modules/catalog/activate
POST /internal/businesses/$BUSINESS_ID/modules/catalog/complete-setup

POST /internal/businesses/$BUSINESS_ID/modules/checkout/activate
POST /internal/businesses/$BUSINESS_ID/modules/checkout/complete-setup
```

Optionally activate Operating Costs (standalone, no dependencies):

```bash
POST /internal/businesses/$BUSINESS_ID/modules/costs/activate
POST /internal/businesses/$BUSINESS_ID/modules/costs/complete-setup
```

---

### Step 6 — Switch to the owner token

Log out the platform admin and log in as the owner:

```bash
POST /auth/login
{ "email": "owner@restaurantname.com", "password": "StrongPassword@123" }
→ { "accessToken": "$OWNER_TOKEN" }
```

All remaining steps use `Authorization: Bearer $OWNER_TOKEN`.

---

### Step 7 — Set up tax categories

```bash
POST /admin/catalog/tax-categories
{ "name": "GST 5%", "rateMinorUnits": 500 }
→ { "id": "$TAX_5_ID" }

POST /admin/catalog/tax-categories
{ "name": "Exempt", "rateMinorUnits": 0 }
→ { "id": "$TAX_EXEMPT_ID" }
```

---

### Step 8 — Create catalog categories and items

```bash
POST /admin/catalog/categories
{ "name": "Main Course", "sortOrder": 10 }
→ { "id": "$CAT_ID" }

POST /admin/catalog/items
{
  "categoryId": "$CAT_ID",
  "taxCategoryId": "$TAX_5_ID",
  "name": "Dal Makhani",
  "basePriceMinorUnits": 22000
}
```

Repeat for each menu item.

---

### Step 9 — Create dining areas and tables

```bash
POST /admin/dining/areas
{ "locationId": "$LOCATION_ID", "name": "Main Hall" }
→ { "id": "$AREA_ID" }

POST /admin/dining/tables
{
  "locationId": "$LOCATION_ID",
  "areaId": "$AREA_ID",
  "code": "T1",
  "seatingCapacity": 4
}
```

Repeat for each table.

---

### Step 10 — Create additional staff users

```bash
POST /admin/users
{
  "email": "cashier@restaurantname.com",
  "displayName": "Cashier Name",
  "password": "CashierPassword@123",
  "roleKeys": ["checkout-associate"]
}

POST /admin/users
{
  "email": "kitchen@restaurantname.com",
  "displayName": "Kitchen Name",
  "password": "KitchenPassword@123",
  "roleKeys": ["kitchen-team"]
}
```

---

### Step 11 — Smoke test the flow

1. Open http://[your-domain]:5173
2. Log in as the owner
3. Navigate to Tables & Sessions → verify tables visible
4. Open a session on Table T1
5. Create an order with one item
6. Send to kitchen → navigate to Kitchen Display → verify ticket appears
7. Mark ticket Ready in kitchen
8. Back to Tables → Checkout the session (test payment: CASH)
9. Verify session closes and table returns to AVAILABLE
10. Navigate to Reports → Daily Report → verify the transaction appears

---

## Post-Setup Checklist

Before handing off to the pilot client:

- [ ] Rotate the platform admin password (`PLATFORM_BOOTSTRAP_PASSWORD`)
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
