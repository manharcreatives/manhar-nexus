# MODULE DEPENDENCY MAP — Manhar Nexus

Dependencies are **capability-based**, never name-based: a module declares required *capabilities*; the resolver explains in plain language which activatable module satisfies each.

## Capability DAG

```
CORE (always present, not a module):
  identity · locations · configuration · audit · alerts(in-app) · files

identity ──link── staff_profiles            [Staff ≠ User, optional 1:0..1]

catalog.items ──┬─► CAP orderable_lines ──┐
manual_intake ──┘ (walk-in / phone)        ├─► guest_sessions
bookings(manual) ─► seating(dining_space) ─┘        │
                                                    ▼
                              CAP billable ─► checkout ─► payments ─► cash_reconciliation
                                    │                        │
                                    │                  payment_providers (adapters)
                                    ▼
                              printing (receipts)
service_requests ─► kds_queue ─► kitchen_stations (routing rules from catalog)
service_requests ─► printing (production/KOT fallback)

reports/* ◄── reads ANY ACTIVE transactional module (dynamic composition)
multi_location_control ─ requires ≥2 active locations
messaging_abstraction ─► alerts fanout (channels later)

FUTURE SEAMS (reserved, not built):
stock.items ─► recipes_bom ─► auto_consumption ─► procurement ─► vendors
production_jobs ─ requires stock + bom  → quality → finished_stock → dispatch
intake_channels(qr/online/aggregator) ─► same order engine
```

## Dependency Rules

1. Activation blocked with explanation when a capability is unsatisfied ("Payments needs something that produces billable lines — enable Checkout").
2. Disabling a provider warns and blocks while consumers exist, or cascade-disables only with explicit consent — both audited.
3. Disabling never deletes data; historical reads remain available to reporting/audit.
4. Reactivation restores previous configuration without reinstall.
5. Reports/alerts/dashboards render only from modules that are Active AND permitted AND location-scoped.

## Reference Table

| Module | Requires (capabilities) | Provides (capabilities) |
|---|---|---|
| Catalog | core | `catalog.items`, routing metadata |
| Dining Space | core | `seating` |
| Service Console | `orderable_lines`, identity | frontline UI |
| Service Requests | `orderable_lines` (catalog OR manual intake) | `service_requests`, `billable lines` |
| Kitchen Operations Screen | `service_requests` | production queue UI |
| Checkout & Invoicing | `billable_lines` | `checkout` |
| Payments & Cash | `checkout` | settlement records |
| Printing & Devices | checkout and/or kds outputs | print jobs |
| Guests | transactions (history source) | guest profiles |
| Bookings | `seating` | manual bookings |
| Stock Control (future) | catalog linkage | `stock.items`, consumption |
| Procurement (future) | `stock.items` | purchase flow |
| BI | any transactional module Active | dashboards/reports |

Full per-module matrix: see `MODULE_PRIORITY_MATRIX.md`.
