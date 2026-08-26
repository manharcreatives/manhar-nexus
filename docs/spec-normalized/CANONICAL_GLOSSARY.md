# CANONICAL GLOSSARY — Manhar Nexus

> The single approved vocabulary for code, database, API, and UI. Nexus terminology is intentional — it must NOT be renamed to match other products.
> Naming conventions: DB `snake_case` · TypeScript `camelCase` · module ids `kebab-case` · UI labels use these exact terms (via i18n keys).

## Core Platform Terms

| Term | Meaning | Code identifier |
|---|---|---|
| Manhar Nexus | The platform product | — |
| Business Workspace | One client organization (tenant) | `business` |
| Business Type | Vertical profile selecting defaults/packs | `business_type` |
| Location | Physical operating site; operational scope unit | `location` |
| Pack | Recommended starting module bundle template | `pack_template` |
| Module | Activation-controlled capability unit | `module` |
| Configuration | Typed, scoped settings controlling behavior | `setting` |
| Activity History | Append-only record of important actions/changes | `audit_event` |
| Alerts Center | In-app action-required/informational notifications | `alert` |
| Internal Admin | Manhar Creatives staff realm (clients/pricing/packs) | internal realm |

## People & Access

| Term | Meaning | Code identifier |
|---|---|---|
| Staff Profile | Employee record; may exist WITHOUT login | `staff_profile` |
| User | Login identity; optional 1:0..1 link to Staff Profile | `user` |
| Role / Permission | Named access set / atomic `module.resource.action` grant | `role`, `permission` |
| Approval Policy | Threshold rule forcing authorization for sensitive actions | `approval_policy` |
| Device | Registered frontline device used with PIN login | `device` |

## Restaurant Vertical

| Term | Meaning | Code identifier |
|---|---|---|
| Guest Session | Complete visit: seating → rounds → checkout → settlement | `guest_session` |
| Service Request | Group of requested items sent together | `service_request` |
| Service Round | Distinct addition to an existing session | round # on service_request |
| Service Line | One catalog item within a request (snapshot-priced) | `service_line` |
| Preference / Add-on | Modifier group + options with rules attached to items | `modifier_group`, `modifier_option` |
| Catalog Item | Sellable menu entity incl. variants | `catalog_item` |
| Dining Area / Dining Table | Floor section / live operational table object | `dining_area`, `dining_table` |
| Kitchen Operations Screen (KOS) | Station queue execution screen | KOS (ui), `kds_ticket` |
| Production Area | Kitchen station/routing target | `kitchen_station` |
| Sold-Out | Availability lock synced to all channels | availability state |
| Pass Control | Final quality-control point before serving | pass control state |
| Checkout | Bill generated from a Guest Session | `checkout` |
| Void | Controlled cancellation (records retained; never deleted) | void state/reversal |
| Payment Option | Configured method (cash/UPI/card/…) | `payment_option` |
| Payment Provider | External gateway adapter behind abstraction | payment provider adapter |
| Cash Counter | Counter cash session open→close w/ variance | `cash_counter_session` |
| Shift Reconciliation | Closing + reconciling a cashier/payment shift | shift reconciliation report |
| Local Print Agent | On-site bridge: Nexus Cloud → thermal printer | print agent |
| Print Job State | queued/sent/printed/failed/offline (truthful) | `print_job` |

## Corrections Map (source-doc corruption → canonical)

The two source documents contain find-and-replace artifacts. They are mapped here once and NEVER reintroduced:

| Corrupted source text | Canonical term |
|---|---|
| "dining dining tables" | dining tables |
| "suidining table" | suitable |
| "accoundining table user" | accountable user |
| "a sdining table sales/menu workflow" | a stable sales/menu workflow |
| "Pass Controlrt activity history" | Export activity history |

## Prohibited Synonyms (do NOT introduce)

order (use **Service Request**) · bill (use **Checkout**) · KDS/KOT screens (use **KOS**; printer tickets = production print fallback) · 86'd (use **Sold-Out**) · tenant (use **Business Workspace** in domain language) · POS (avoid as product term).
