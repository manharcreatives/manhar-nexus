# REQUIREMENT REGISTER — Manhar Nexus

> Classification: CONFIRMED (spec-mandated, accepted) · PROPOSED (engineering addition, accepted via ADR) · ASSUMPTION · FUTURE · DEFERRED · RISK.
> Source docs are READ-ONLY; this register is the working interpretation.

## CONFIRMED REQUIREMENTS

### Platform
- R-P01 Product model: Core → Business Type → Pack → Modules → Configuration → Access → Workflows → Reporting → Expansion
- R-P02 Nexus Core small & universal: Business Workspace, Locations, Users, Access & Responsibility, Configuration Center, Module Center, Dashboard Shell, Global Search*, Alerts Center, Activity History, Documents/Files, Support (*search unified progressively — see Conflict C-01 in roadmap §11)
- R-P03 Module lifecycle: Available/Trial/PendingSetup/Active/Suspended/Disabled/Archived
- R-P04 Disable ≠ delete; reactivation retains configuration; transitions audited; navigation dynamic
- R-P05 Capability-based module dependencies; packs are templates not apps
- R-P06 Module pricing configurable by internal admin; never hard-coded
- R-P07 Internal admin/commercial layer (clients, packs, offerings, overrides, activation requests, deployment checklists, usage status)
- R-P08 Platform Definition of Done (Master doc §18): client/location/module lifecycle without source changes
- R-P09 What NOT to build lists (both docs): HR suite, accounting/ledger, payroll edge cases, fleet mgmt, marketing automation, AI-everywhere, microservices, report sprawl, per-channel menu duplication, mega-admin, per-client codebases

### Restaurant vertical (MVP set per Appendix A + decisions)
- R-R01 Business & location setup guided onboarding checklist
- R-R02 Access & Responsibility roles + granular permissions + approval rules + temporary shift credentials
- R-R03 Catalog: categories/items/variants/modifiers+rules/combos(later)/time menus(later)/location pricing(later)/availability lock/versioning(later)
- R-R04 Dining Space: areas/tables/states/session binding/merge/split/transfer/guest count/notes
- R-R05 Service Console 3-click flow; modifier-first UX; holds; rounds; item status visibility
- R-R06 Service Request engine: full lifecycle, line statuses, cancel-with-reason/approval-after-prep, replace, transfer, split, combine, timeline
- R-R07 KOS: stations, routing, queues, priorities, timers, item-level bump, sold-out sync, delay reasons, pass control, configurable alerts
- R-R08 Checkout: auto-build, taxes, service charge, discounts+approvals, comps, split/merge/hold, round-off, reissue-as-duplicate
- R-R09 Payments: options, split/partial-by-policy, reversal-only refunds w/ authorization, cash counter, Shift Reconciliation, references
- R-R10 Printing: profiles/routing/templates/reissue control (scope narrowed per ADR-007)
- R-R11 Basic Guests (name/phone/history/tags), manual Bookings, basic Staff Profiles (decided MVP additions)
- R-R12 Trust rules (§39): permission boundaries, traceable cancels/refunds, discount thresholds, failed-payment honesty, duplicate-tap protection, network-interruption draft survival, pending/completed/failed distinction
- R-R13 Role-aware UX homes (Owner/Manager/Server/Kitchen/Cashier/Host/Stock)

### Decisions locked by product owner (see roadmap ADR log)
Deployment SaaS-first · Android tablets + Windows PCs · ESC/POS certified list + Local Print Agent · rush-hour budgets · interruption-tolerance only · configurable tax engine · English+i18n-ready · aggregators future · payment provider abstraction (Razorpay direction, dynamic QR, webhook verify) · Staff≠User + PIN frontline · messaging abstraction · India region · basic branding MVP · manual bookings MVP.

## PROPOSED (engineering additions, ACCEPTED via ADRs)
- PR-01 Idempotency keys on write endpoints (ADR-017)
- PR-02 Line-item snapshots at sale time (ADR-015)
- PR-03 Optimistic concurrency version columns (ADR-017)
- PR-04 Financial immutability + reversal-only corrections (ADR-016)
- PR-05 Append-only hash-chained audit stream (ADR-016)
- PR-06 Prisma ORM + versioned migrations (ADR-019)
- PR-07 Performance budgets as acceptance criteria
- PR-08 Money as integer minor units; UTC + location TZ (ADR-015)
- PR-09 CI grep guard against hard-coded prices (P12)

## ASSUMPTIONS
- A-01 Modern browsers/tablets; Android tablet first-class
- A-02 On-site internet available with interruptions (draft-preserving tolerance acceptable for MVP)
- A-03 Staff using system always have User identities when actions need attribution
- A-04 INR default currency; currency stored per business

## FUTURE
F-01 Full offline POS · F-02 E-invoicing/GST filing automation · F-03 Gujarati/Hindi UI · F-04 Zomato/Swiggy adapters · F-05 Direct digital orders/dispatch · F-06 Multi-location central controls · F-07 Advanced BI/AI insights · F-08 White-label theming · F-09 Dedicated/on-prem deployments · F-10 Payroll/accounting integrations · F-11 WhatsApp/SMS/Push fanout beyond in-app · F-12 Manufacturing/Retail/Service/Hospitality packs

## DEFERRED (built later by explicit phase)
D-01 Full Stock Control + recipes/auto-consumption (V2 candidate, P16) · D-02 Procurement/Vendors (P16) · D-03 Scan Menu QR (P16) · D-04 Offers/Rewards (P16) · D-05 Attendance/Leave (P16) · D-06 Operating Costs (P16) · D-07 Exception Center (P16) · D-08 Federated Global Search (P16)

## RISKS
See roadmap §8 register (R01–R10) — printer compatibility, rush reliability, scope creep, engine over-engineering, terminology drift, GST depth, offline gap, pilot timing, payment trust, bus factor.
