# MODULE PRIORITY MATRIX — Manhar Nexus

Priorities: MUST HAVE · IMPORTANT · NICE TO HAVE · FUTURE · AVOID FOR NOW.
Commercial model values are categories only — amounts live exclusively in internal-admin price books (never code).

## Core Platform

| Module/Capability | Purpose | Priority | Can Disable? | Reactivate? | Commercial |
|---|---|---|---|---|---|
| Tenancy & Business Workspace | Client isolation | MUST (Core) | n/a | n/a | Base platform |
| Locations | Site scoping | MUST (Core) | n/a | n/a | Base platform |
| Users & Access | Identity/RBAC/location scope/approvals | MUST (Core) | n/a | n/a | Base platform |
| Configuration Center | No-code behavior control | MUST (Core) | n/a | n/a | Base platform |
| Module Center | Activation/commercial status UI | MUST (Core) | n/a | n/a | Base platform |
| Dashboard Shell | Role-aware home composition | MUST (Core) | n/a | n/a | Base platform |
| Alerts Center (in-app) | Operational notifications | MUST (Core) | n/a | n/a | Base platform |
| Activity History / Audit | Accountability | MUST (Core) | n/a | n/a | Base platform |
| Documents/Files | Attachments | IMPORTANT | yes | yes | Base+ |
| Global Search (federated) | Cross-entity search | NICE TO HAVE (P16; registry seam in Core) | yes | yes | Add-on later |
| Internal Admin & Commercial mgmt | Manhar-side control | MUST (internal realm) | n/a | n/a | internal |

## Restaurant Vertical

| Module | Purpose | Priority | Depends On (capabilities) | Key Config | Key Permissions | Reports | Alerts | Can Disable/Reactivate | Commercial |
|---|---|---|---|---|---|---|---|---|---|
| Catalog (Menu) | Items, variants, modifiers, availability | MUST | core | taxes, pricing, modifier rules | view/create/edit/configure | item performance | sold-out | yes/yes | Pack core |
| Dining Space | Areas, tables, states | MUST (dine-in) | core | layout, capacities, labels | view/manage floor | table/area revenue | — | yes/yes | Pack core |
| Service Console | 3-click order taking | MUST | orderable_lines, identity | favorites, course firing | create/edit/cancel orders | server performance | ready/cancelled | yes/yes | Pack core |
| Service Requests | Order lifecycle engine | MUST | catalog or manual intake | lifecycle rules, cancel policy | cancel/approve voids | order timeline | delays | yes/yes | Pack core |
| Kitchen Operations Screen | Station queues, timers, routing | MUST | service_requests | stations, targets, alert sounds | bump/recall/priority | prep-time perf | late/sold-out | yes/yes | Pack core |
| Checkout & Invoicing | Bill build, taxes, discounts | MUST | billable lines | tax config, round-off, invoice modes | discount/refund/void/reissue | daily closing | high discount | yes/yes | Pack core |
| Payments & Cash | Collection + counter + shift recon | MUST | checkout | methods, partial policy, provider | refund/close shift | payment mix/variance | cash variance | yes/yes | Pack core |
| Printing & Devices | Receipt/KOT via agent | MUST | checkout/kds | templates, routing profiles | reprint | print success | printer offline | yes/yes | Setup fee |
| Guests (basic) | Name/phone/history/tags | MUST-lite MVP → full CRM IMPORTANT | transactions | consent flags | view/edit/export PII | visit history | birthday(later) | yes/yes | Add-on (full CRM) |
| Bookings (manual) | Phone booking entry + availability | IMPORTANT (MVP manual-only per decision) | dining_space | slots, capacity rules | manage bookings | no-show stats | arrival reminders(in-app) | yes/yes | Included |
| Staff Profiles / Team | People records linked to users | MUST-lite | users | roles mapping | manage staff | — | — | yes/yes | Included |
| Operating Costs | Expenses, approvals, recurring | IMPORTANT (P16) | files | categories, thresholds | approve expenses | expense dashboard | approval pending | yes/yes | Add-on |
| Attendance & Leave | Shift attendance | IMPORTANT (P16) | staff | shift templates | manage attendance | attendance summary | — | yes/yes | Add-on |
| Stock Control | Recipes, consumption, counts | IMPORTANT→V2 (schema seam reserved now) | catalog | units, thresholds | adjust stock | variance/wastage | low stock | yes/yes | Add-on |
| Procurement & Vendors | PR→PO→receiving | FUTURE(V2) | stock | vendors, terms | approve POs | spend by vendor | PO pending | yes/yes | Add-on |
| Scan Menu (QR) | Guest self-service channel | NICE TO HAVE (P16) | catalog, orders | approval mode, branding | moderate submissions | channel sales | new QR order | yes/yes | Add-on |
| Offers & Rewards | Coupons, points, happy hours | NICE TO HAVE (P16) | checkout, guests | guardrails, earn rules | configure offers | redemption | — | yes/yes | Add-on |
| Direct Digital Orders | Own ordering channel | FUTURE (P17) | intake abstraction, catalog, KOS | acceptance rules | accept/reject orders | channel mix | new online order | yes/yes | Add-on |
| Dispatch Operations | Zones/handoff/delivery stages | FUTURE (P17) | digital orders | zones, charges | manage dispatch | delivery perf | late dispatch | yes/yes | Add-on |
| Manager Exception Center | Surfaced anomalies | NICE TO HAVE (P16) | audit, transactions | thresholds | review exceptions | exception digest | threshold breach | yes/yes | Add-on |
| Multi-Location Control | Central menu/comparison | FUTURE (P17) | ≥2 locations | central policies | central admin | location comparison | — | yes/yes | Bundle tier |
| Business Intelligence | Dashboards answering business questions | IMPORTANT (basic set in MVP: daily closing + sales/item) | active transaction modules | widget visibility | view/export reports | all | threshold alerts | yes/yes | Tiered |

## AVOID FOR NOW (deliberately not built)

Full HR/payroll suite · accounting/ledger system · AI insights · marketing automation suite · custom fleet logistics · plugin SDK/marketplace · theme/white-label engine · separate per-channel menus.

## Future Vertical Modules (NOT built — architecture must permit)

Manufacturing: Production Jobs · BOM · Quality Control · Machines & Assets · Maintenance · Dispatch. Retail/Service/Hospitality packs reuse the same capability seams (validated by Phase 18 spike).
