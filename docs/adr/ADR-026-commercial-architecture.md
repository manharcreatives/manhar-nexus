# ADR-026 — Commercial / Add-on Management Architecture

**Date:** 2026-08-25  
**Status:** Accepted  
**Phase:** 12

---

## Context

Manhar Nexus must support a commercial layer where Manhar Creatives staff (PLATFORM realm) manage the client portfolio: define what services can be sold, what they cost, and track the lifecycle of each client's activation from initial request through go-live.

This is exclusively a PLATFORM-realm capability. Business (client) users have no visibility or access to commercial records.

---

## Decision

### 1. Entity model

```
Offering          — a named, typed service unit (SETUP_FEE | RECURRING | ONE_TIME | TRIAL)
PriceBook         — a named price list in a given currency (one may be default)
PriceBookEntry    — one Offering × PriceBook cell, stores amountMinorUnits
ClientPriceOverride — effective-dated per-client price that overrides the price book
Bundle            — a named collection of Offerings sold together
BundleItem        — join table between Bundle and Offering
ActivationRequest — one client asking for a set of modules/bundle to be enabled
ActivationRequestEvent — append-only state transition log (immutable per ADR-016)
DeploymentChecklist    — per-request task list for the Manhar setup team
DeploymentChecklistItem — individual checklist task, completeable/uncomplete-able
```

Business model gains three fields: `commercialStatus` (PROSPECT|TRIAL|ACTIVE|SUSPENDED|CHURNED), `accountNotes`, and `assignedTo`.

### 2. Money representation

All monetary amounts stored as **integer minor units** (paise for INR), satisfying ADR-015.  
No monetary constants appear in application code — amounts live exclusively in the database and arrive via request bodies validated by Zod DTOs.

### 3. Activation state machine

```
REQUESTED → QUOTED → APPROVED → PENDING_SETUP → ACTIVE → SUSPENDED → ACTIVE  (cycle)
                ↘        ↘           ↘              ↘         ↘
                 REMOVED  REMOVED     REMOVED        REMOVED   REMOVED
```

Transitions are enforced by the `VALID_TRANSITIONS` map (exported from `commercial.dto.ts`) on both the API (`activation.service.ts`) and the UI (`ClientsPage.tsx`). Any attempt to transition to a status not in the map for the current state returns HTTP 400.

Every successful transition appends an immutable `ActivationRequestEvent` row, satisfying ADR-016 (append-only audit).

Timestamps are set on transition:
- `quotedAt` when → QUOTED  
- `approvedAt` when → APPROVED  
- `setupAt` when → PENDING_SETUP  
- `goLiveAt` when → ACTIVE  
- `removedAt` when → REMOVED

### 4. Checklist auto-completion

`DeploymentChecklist.completedAt` is set automatically when all child items have `completed=true`, and cleared automatically when any item is uncompleted. This is done inside a `$transaction` in `ActivationService.updateChecklistItem`.

### 5. Permission model

Six new `restricted: true` permissions (not grantable to business roles):

```
platform.commercial.view
platform.commercial.manage
platform.client.view
platform.client.manage
platform.activation.view
platform.activation.manage
```

The existing `platform-admin` wildcard (`*`) covers all of these automatically.

### 6. URL structure

All commercial endpoints live under `/internal/commercial/*`, which is exclusively accessible to PLATFORM-realm users. No `/admin/*` routes are defined for Phase 12.

```
/internal/commercial/offerings[/:id]
/internal/commercial/price-books[/:id[/entries[/:entryId]]]
/internal/commercial/bundles[/:id[/items[/:offeringId]]]
/internal/commercial/clients[/:businessId[/usage|price-overrides|activation-requests]]
/internal/commercial/clients/:businessId/activation-requests/:requestId/transition
/internal/commercial/clients/:businessId/activation-requests/:requestId/checklist[/items/:itemId]
```

---

## Consequences

**Positive**
- Manhar staff have a single pane of glass for commercial portfolio management.
- State machine prevents invalid transitions; event log is tamper-evident.
- Monetary amounts are DB-driven; changing prices requires only DB updates, no deployments.
- Strong boundary between platform and business realms enforced at the permission layer.

**Negative / Trade-offs**
- No self-service for business users — all commercial changes are staff-initiated.
- Price books are currently flat (no tiered pricing, no volume discounts). These can be added as new columns on `price_book_entry` in a future phase.
- Currency is stored as a free-text ISO code; no runtime FX conversion is implemented.

---

## Alternatives Considered

**Client-facing billing portal**: Rejected for Phase 12. The codebase has no payment processor integration yet; adding a client portal would require OAuth flows and webhook handling out of scope for this phase.

**Event sourcing for the offering catalog**: Rejected. The offering/price-book entities change infrequently; append-only event sourcing adds complexity without meaningful benefit at current scale. Only the activation workflow (high change frequency per entity) uses event log.
