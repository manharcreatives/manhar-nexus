# 03b — Business Model, Pricing & Billing Flow — Manhar Nexus

Prepared 31 Oct 2026 for Utsav Prajapati / Manhar Creatives. Feature truth is aligned to `01_CODEBASE_ANALYSIS.md` (LIVE vs API-only vs SPEC). Market data: `03a_MARKET_PRICING_RESEARCH.md`. All prices INR, **GST 18% extra**. The owner will refine; every number below is a proposal.

## Executive summary (10 lines)
1. **Three public plans, one enquiry tier:** **Counter** ₹599/mo or ₹5,990/yr · **Floor** ₹1,299/mo or ₹12,990/yr · **Pass** ₹2,499/mo or ₹24,990/yr · **Many Doors** (4+ outlets / chains) = "talk to us". Yearly = 10 months paid (2 months free). GST 18% extra.
2. **Positioning:** priced against Zoho POS (₹499–₹1,299/mo) and Petpooja/GoFrugal (~₹9–10k/yr + paid add-ons), but with **KOS, Alerts, Operating Costs and the tamper-checkable Activity History in the price — no add-on stacking** and a published all-in rate card, which most Indian vendors do not offer.
3. **Honesty constraint:** printing is API-only and unvalidated, bookings/guest CRM have no screens, and card payments, discounts, split bills, QR ordering and stock are not built. None of these is sold. They appear as "coming soon" only. Plans differ by outlets, staff logins, modules (Operating Costs), and support — enforced by our team at provisioning, not by software.
4. **Founding Restaurants offer (time-boxed to 31 Jan 2027, IST):** annual plans 25% off the first year, list price locked for the second year, Launch Pack onboarding included; in return: feedback calls and written consent before we ever use your name. No fake scarcity numbers; we say plainly that we set restaurants up by hand, in batches.
5. **Trial logic:** because Workspaces are provisioned manually, there is **no self-serve free trial**. Instead: (a) 14-day money-back guarantee counted from activation, (b) a free live demo, (c) a 14-day **pilot by approval** (commercialStatus TRIAL) for founding restaurants who complete a short call.
6. **Billing flow recommended:** **Yearly = one-time Cashfree payment link (UPI/card/net banking) + manual renewal reminders** (avoids the RBI ₹15,000 AFA ceiling — annual amounts are ₹7k–₹29k incl. GST). **Monthly = UPI AutoPay** (Cashfree Subscriptions), with card SI as fallback; eNACH only where the account is single-signatory; payment link as last resort.
7. **RBI e-mandate framework (effective 21 Apr 2026):** ≤₹15,000 per recurring debit needs no per-debit AFA; ≥24-hour pre-debit notice is mandatory; one-time AFA at mandate registration. All monthly plans incl. GST (₹707 / ₹1,533 / ₹2,949) sit far below the cap.
8. **Launch-day reality (no code needed):** registration request → team confirms → Cashfree payment/subscription link created in the dashboard → paid → team provisions the Workspace via the existing Onboarding screen → owner signs in and changes the temporary password. Automation (RegistrationRequest, webhooks, ActivationRequest transitions) comes later.
9. **Unit economics:** infra ≈ ₹8k/mo fixed to ~25 outlets + ~₹75/outlet marginal; Cashfree ≈ ₹6–18 per UPI AutoPay debit (about 1% of the monthly price) or 2.3% on annual link payments. Infra break-even ≈ 9 outlets; **founder support/onboarding time is the real cost** — Counter (₹599) is thin and should not be discounted below list.
10. **Owner must decide / verify:** GST registration (the "+18% GST" model presumes it), legal entity, Cashfree subscription account setup (AFA/mandate limits, fee GST treatment), hosting region (repo shows two deploy paths), and whether to keep a refund-only trial vs an invited free pilot.

---

## 1. Plan architecture

### 1.1 Principles
- **No add-on stacking for things competitors charge extra for** (KOS, Alerts, Operating Costs, Activity History, role-based access, CSV export). Trust features (Void/Refund reasons, Activity History + Verify) are in **every** plan; safety is not a tier.
- **Plans are separated by things we can honestly meter by hand today:** outlets, staff logins, modules switched on (the module engine really supports per-Business activation), and support level.
- **Only LIVE features are sold.** Roadmap items are labelled "coming soon" and are never a reason to pay.
- **Vertical presets** map to the spec's Café / Restaurant / Pro / Multi-Location packages, but with names that carry a story from the restaurant world.

### 1.2 The plans
| | **Counter** | **Floor** | **Pass** | **Many Doors** |
|---|---|---|---|---|
| Name story | The counter where it all starts: a café, bakery or small eatery | The floor where tables, waiters and kitchen must stay in step | "The pass" is where a plate leaves the kitchen — the busiest room, the highest stakes | A restaurant group with many doors to open |
| Best for | Cafés, bakeries, single-outlet small restaurants | Standard dine-in restaurants | Busy rooms, hotel F&B outlets with table service, small groups (up to 3 outlets) | 4+ outlets, central needs, custom work |
| Monthly (ex-GST) | **₹599** | **₹1,299** | **₹2,499** | Custom quote |
| Yearly (ex-GST) | **₹5,990** (≈₹499/mo) | **₹12,990** (≈₹1,082/mo) | **₹24,990** (≈₹2,083/mo) | Custom quote |
| You save yearly | ₹1,198 | ₹2,598 | ₹4,998 | — |
| Outlets included | 1 | 1 | up to 3 | 4+ |
| Staff logins included | 5 | 15 | 40 | custom |
| Operating Costs + approvals | – | Included | Included | Included |
| Alerts rules / custom roles | – (standard roles, default alerts) | Included | Included | Included |
| Location switcher + location-scoped roles | – | – | Included (up to 3) | Included |
| Support | Email, business hours | Email + WhatsApp, business hours | Priority queue, named contact, quarterly review call | Dedicated |
| Launch Pack onboarding | ₹3,499 | ₹3,499 | **Included** | Quoted |

### 1.3 Incl. GST (18%) reference — exact
| Plan | Monthly | Yearly | Founding yr-1 (yearly) |
|---|---|---|---|
| Counter | ₹599 → **₹706.82** | ₹5,990 → **₹7,068.20** | ₹4,490 → ₹5,298.20 |
| Floor | ₹1,299 → **₹1,532.82** | ₹12,990 → **₹15,328.20** | ₹9,740 → ₹11,493.20 |
| Pass | ₹2,499 → **₹2,948.82** | ₹24,990 → **₹29,488.20** | ₹18,740 → ₹22,113.20 |

### 1.4 Feature mapping (every bullet is LIVE per 01_CODEBASE_ANALYSIS §3.1)
| Capability | Counter | Floor | Pass | Truth-table row |
|---|---|---|---|---|
| Business Workspace + owner sign-in | ✔ | ✔ | ✔ | 1 |
| Menu: categories, items, variants, Add-ons, Sold-Out toggle, tax category | ✔ | ✔ | ✔ | 3 |
| Floor: Dining Areas and Dining Tables with live state (Available / Occupied / Cleaning) | ✔ | ✔ | ✔ | 4, 5 |
| Guest Sessions, Service Requests, multiple Service Rounds | ✔ | ✔ | ✔ | 6, 7 |
| Kitchen Operations Screen (KOS), live in about a second | ✔ | ✔ | ✔ | 8, 9 |
| Checkout, GST per line, cash with change due, UPI with UTR confirmation | ✔ | ✔ | ✔ | 10, 12 |
| Bills: Refund (reason mandatory) and Void | ✔ | ✔ | ✔ | 11 |
| Reports: Daily closing, sales summary, top items, 14-day trend, CSV, browser print | ✔ | ✔ | ✔ | 13 |
| Owner Home "Today" | ✔ | ✔ | ✔ | 14 |
| Roles & permissions: standard system roles | ✔ | ✔ | ✔ | 2 |
| Custom roles | – | ✔ | ✔ | 2 |
| Activity History + Verify (hash-chain check) | ✔ | ✔ | ✔ | 16 |
| Alerts Center (bell) | ✔ (defaults) | ✔ + configurable rules | ✔ + rules | 17 |
| Operating Costs: categories, expenses, approve/reject with reason | – | ✔ | ✔ | 15 |
| Module Center (switch modules on/off) | ✔ | ✔ | ✔ | 18 |
| Multiple Locations + working-location switcher + location-scoped roles | – | – | ✔ up to 3 | 19 (PARTIAL: locations are created by our team; no central menu or comparison yet) |
| Branding: name, accent colour, invoice name/address/GSTIN | ✔ | ✔ | ✔ | 20 |
| Duplicate-tap / double-charge protection; tenant isolation; argon2 passwords | ✔ | ✔ | ✔ | 23, 24 |

### 1.5 Coming soon (visible on the page, **not sold, not priced as value**)
Printer/receipt printing via Local Print Agent (API built, hardware not validated) · bookings screen · guest profiles/CRM screens · QR Scan Menu · discounts and service charge · split/merge checkouts · card payments · Cash Counter/shift reconciliation · stock & recipes, procurement · WhatsApp/SMS messaging · Gujarati/Hindi interface · GST e-invoicing/filing automation · cross-outlet comparison.
**Rule:** if a coming-soon item ships, it becomes included in Floor/Pass unless it carries real third-party cost (WhatsApp/SMS credits), in which case it becomes an add-on. Owner option for Pass: "first access to new modules" as a stated benefit (no dates promised).

### 1.6 Many Doors (enquiry tier)
Triggers: 4+ outlets, central menu or cross-outlet reporting needs, custom roles at scale, procurement/stock needs, delivery/aggregator needs, white-label requests. Quote = Pass price + ₹999/mo per extra outlet as a starting anchor, plus justified custom work (spec: "justified custom work"). Page copy must say honestly that central menu and cross-outlet comparison are not built yet — Many Doors customers help decide the build order.

---

## 2. Add-ons and one-time fees
### 2.1 Recurring add-ons (ex-GST)
| Add-on | Price | Notes / truth |
|---|---|---|
| Extra outlet (Counter/Floor) | +50% of your plan's price per outlet per month | LIVE as Locations, created by our team; central menu not built. Pass: first 3 outlets included, then ₹999/outlet/mo |
| Extra staff logins | ₹49/login/month (₹490/yr) | Policy limit, enforced by us |
| Premium support | ₹799/month (₹7,990/yr); included in Pass | = priority queue + named contact + monthly 30-minute review call. **No numeric response SLA** (none can be proven yet) |
| KOS screens | **Not metered** | KOS is a web screen: any phone/tablet/PC with a browser |
| Printer / kitchen-ticket setup | **Coming soon — not sold** | Printing is API-only; all 3 listed printer models UNVERIFIED |
| WhatsApp/SMS messaging | **Coming soon — not sold** | When built: credits at cost + handling (DLT/Meta approvals add third-party cost) |

### 2.2 One-time onboarding (SETUP_FEE offerings; ex-GST)
| Service | Price | What you get |
|---|---|---|
| Menu upload | ₹1,500 (up to 150 items; ₹5 per extra item) | We enter categories, items, variants, Add-ons, tax categories from your Excel/PDF/photos |
| Floor & table layout | ₹500 | Dining Areas, Dining Tables, capacities |
| Staff, roles & training (remote) | ₹1,500 | 2-hour video session for up to 8 staff, role setup |
| On-site training (Gujarat) | ₹3,500 + travel at actuals | In person, one visit |
| Go-live day check-in | ₹1,000 | We are on call during your first service |
| **Launch Pack** | **₹3,499** (à la carte ≈₹4,500) | Menu ≤150 items + floor + roles + 1 remote training + go-live check-in. **Included with Pass; included for Founding Restaurants** |
| Historic data migration | Not offered at launch | State this honestly in FAQ |
Refund rule for setup fees: full refund before work starts; completed work non-refundable.

---

## 3. Founding Restaurants (Design Partner) offer
**Dates (honest, time-boxed):** applications open **1 Nov 2026 – 31 Jan 2027 (23:59 IST)**. Owner may extend; the page must show the end date, not a counter.

**What the restaurant gets**
- Yearly plan at **25% off the first year** (Counter ₹4,490 · Floor ₹9,740 · Pass ₹18,740, ex-GST).
- **Year-2 renewal at today's list price** (price lock for 24 months).
- **Launch Pack included.**
- A direct line to the builders; your feedback shapes the build order of coming-soon modules.
- 14-day pilot available first (by approval).

**What we ask in return:** two 30-minute feedback calls in the first two months; permission to contact you about issues; your name/logo only with your written consent.

**Honest framing for the page:** "Nexus is new. You would be among our first restaurants. That is why the price is lower, and why we set you up by hand, in batches — a few at a time. We will tell you the wait honestly." No customer counts, no "only 10 spots", no countdown timer.

**Mapping to ADR-026:** founding price = `ClientPriceOverride` (effective-dated, reason "Founding Restaurants 2026"); onboarding = `Offering` type `SETUP_FEE`, grouped as a `Bundle` ("Launch Pack"); pilot = `commercialStatus: TRIAL`.

---

## 4. Trial / pilot / try-before-you-pay logic
Constraint: Workspaces are created by a platform admin (6+ authenticated `/internal/*` calls); there is no self-serve provisioning and no trial time-limit enforcement in code. A "14-day free trial, instant" would be dishonest and expensive to operate.

| Path | Who | How it works |
|---|---|---|
| **A. Live demo** | Anyone | 30-minute walkthrough (screen share) on the demo restaurant. No card, no commitment. Primary CTA for hesitant visitors. |
| **B. Pay and start (default)** | Ready owners | Register → payment link → Workspace within ~1 working day (target) → **14-day money-back** counted from Workspace activation. |
| **C. 14-day pilot (by approval)** | Founding Restaurants who complete a 15-minute call | Team provisions a Workspace with `commercialStatus = TRIAL`, no payment. Day 10: reminder. Day 14: pay or the Workspace goes read-only for 7 days, then export-only, then closes. Limited by how many restaurants we can hand-set-up at once. |
Why not a free trial for everyone: manual provisioning cost (~2 hours per Workspace) and no auto-expiry. **Later**: when RegistrationRequest + webhook provisioning exists, evaluate a self-serve 7-day sandbox.

### 4.1 Trial-to-paid flow
1. Day 0 pilot starts (Workspace + owner login; temporary password must be changed at first sign-in).
2. Day 3 check-in call (WhatsApp/email, manual).
3. Day 10 reminder with plan recommendation and payment link.
4. Day 14 decision: pay → status ACTIVE (`PATCH commercialStatus`). Not paying → read-only 7 days (SUSPENDED), export window as per Terms, then CHURNED and deletion.
5. Founding terms apply only if payment is made by day 21 from pilot start.

---

## 5. Billing flow — recommendation and RBI/Cashfree facts

### 5.1 Facts (see 03a §5 for sources)
- RBI Digital Payments – E-mandate Framework 2026 (issued **21 Apr 2026**, effective immediately): ≤₹15,000 per recurring transaction needs no AFA; above needs AFA; **pre-debit notification ≥24 hours**; post-debit notification; one-time AFA at mandate registration; customer can opt out / revoke; validity period mandatory; no charge to customers. *(Secondary sources; read the RBI text.)*
- Cashfree Subscriptions: UPI AutoPay, eNACH, card SI. UPI AutoPay/cards **disabled by default ≥₹15,000** unless AFA is enabled on our account; eNACH only for **single-signatory** accounts (multi-signatory current accounts need physical NACH). Fees: UPI AutoPay ₹7.5 creation + ₹5 (<₹1,000) or ₹15 (≥₹1,000) per debit; eNACH/card ₹7.5 + ₹7.5; one-time UPI via link/checkout **1.95%** (+GST). No setup fee or AMC. *(Ambiguities in 03a §5 — confirm with account manager.)*

### 5.2 Which rail for which plan
| Case | Rail | Why |
|---|---|---|
| **Yearly plans** (₹7,068–₹29,488 incl. GST) | **Cashfree payment link / hosted checkout, one-time** (UPI, cards, net banking). Renewal: **manual**, reminders at 30/15/7 days | Two of three annual amounts exceed ₹15,000 incl. GST → an automatic yearly debit would need AFA every year and account-level enablement; a user-initiated payment avoids this, has no mandate failure modes, and suits owners who pay once a year |
| **Monthly plans** (₹707 / ₹1,533 / ₹2,949 incl. GST) | **UPI AutoPay** (primary) via Cashfree Subscriptions; **card SI** (≤₹15,000, issuer OTP on registration) as fallback | Well below ₹15,000: no per-debit AFA; issuer sends the 24-hour pre-debit notification; most Indian owners already use UPI apps |
| Owners with a single-signatory current/savings account who prefer bank debit | e-NACH | Restaurants run by partnerships often have multi-signatory accounts → eNACH will fail for them; do not make it the default |
| Failed mandate / fallback | **Manual invoice + payment link** | Always available |
| Setup fees / Launch Pack / add-on one-offs | One-time payment link | — |

Mandate sizing: set the mandate's maximum at plan price + GST + a stated add-on headroom (e.g. +₹1,000) so adding a staff login or support does not require a new mandate — **confirm with Cashfree whether a variable-amount mandate is supported for our category**; otherwise charge add-ons by separate link.

### 5.3 Launch phases (matches codebase reality: no billing code exists)
| Phase | What | Effort |
|---|---|---|
| **0 — Launch day (zero billing code)** | Registration → staff verifies → create Cashfree payment link or subscription link **from the dashboard** → payment confirmed in dashboard → platform admin runs Onboarding → activation recorded in Commercial (ActivationRequest QUOTED→APPROVED→PENDING_SETUP→ACTIVE) | Operations only |
| **1 — Lead capture** | `POST /public/registrations` + RegistrationRequest + staff list (01 §2.4) | Small |
| **2 — Automation** | Cashfree order/subscription created server-side; signature-verified, idempotent webhook (ADR-008 discipline) flips request to PAID and triggers provisioning checklist; GST invoice record with Manhar's GSTIN; dunning jobs | Medium |
| **3 — Self-service** | Owner billing screen (download invoices, cancel, update mandate) | Later |
Note: ADR-008 names Razorpay for guests' restaurant-bill payments; **Cashfree here is only for Nexus's own subscription** — keep the two adapters separate. ADR-026 explicitly rejected a client billing portal for Phase 12, so this is a new decision (suggest ADR-033).

### 5.4 Mapping to the commercial model (ADR-026)
| Concept | Object |
|---|---|
| Counter / Floor / Pass, monthly & yearly | `Offering` type `RECURRING` ×6, `PriceBookEntry.billingPeriodDays` 30 / 365, `amountMinorUnits` in paise (e.g. 59900) |
| Launch Pack, menu upload, training | `Offering` type `SETUP_FEE`; Launch Pack = `Bundle` |
| Pilot | `Offering` type `TRIAL` + `commercialStatus` TRIAL |
| Founding price / referral credit | `ClientPriceOverride` (effective-dated, reason) |
| Priced list shown on landing | Landing copy is static; code has "zero monetary constants" CI guard for billing — landing prices live in the typed content file, so **keep both in sync manually until Phase 2** |
Cashfree calendar-month vs `billingPeriodDays=30`: pick Cashfree "monthly" frequency; treat 30 days as informational.

---

## 6. Policy proposals (consistent with 03d)
### 6.1 Refund & cancellation
- **14-day full refund** of the first payment (monthly or yearly), counted from Workspace activation; once per business.
- Monthly: cancel any time; access until period end; no refund after day 14.
- Yearly: no refund after day 14 except provisioning failure, extended outage by our fault, withdrawn feature, double charge. *(Optional: pro-rata within 30 days.)*
- Setup fees: refundable before work starts; completed work not refundable.
### 6.2 Failed payment (dunning) and grace
Day 0 fail → email/WhatsApp + link · days 1–3 retry · day 7 final notice, **full service through day 7** · days 8–14 **limited mode** (finish open Checkouts, close the day, reports, export; no new Guest Sessions) · day 15 suspended (SUSPENDED) · export window 30 days.
Why: never switch off a live service abruptly; limited mode must be built or enforced by hand (module deactivation is possible; there is no automatic billing-driven suspension).
### 6.3 Data on cancellation
30-day read-only/export window → deletion from live systems within 30 days after → encrypted backups roll off (14-day logical backups; 7-day PITR if a managed DB is used — per `backup-restore.md`). **Gap:** there is no full-Workspace export or deletion feature; CSV from Reports exists; a full dump is a manual job. Build/verify before promising publicly.
### 6.4 Upgrades/downgrades
Upgrade immediately with pro-rata difference; downgrade at next renewal.
### 6.5 Discounts and codes
| Code | Effect | Rules |
|---|---|---|
| (automatic) Yearly | 2 months free | Always on |
| `FOUNDING26` | 25% off first year of a yearly plan + Launch Pack included + year-2 price lock | Until 31 Jan 2027; stacks with nothing |
| `REFER1` | 1 month free for both after the referred restaurant's third successful payment | Referral credit has no cash value; max 3 per account |
| Group | 2nd–3rd outlet at 50% (add-on rule) | Standard |
| Cap | Total discount never above 25% of list in a year | Protects Counter (thin margin) |
Applied manually via `ClientPriceOverride` until Phase 2. Public discount-code input on the page is optional; a plain "Have a referral or founding code?" field in the registration form is enough.

---

## 7. Unit economics sanity check
### 7.1 Assumptions (all unverified estimates)
- Infra, India region (provider **not decided**; DigitalOcean list prices as proxy: app $24 + managed Postgres from $15 + storage $5 ≈ $44 ≈ ₹3,900, plus second environment/monitoring/email/domain/backups): **₹8,000/month fixed up to ~25 outlets; ₹11,000 at 50; ₹15,000 at 100**; marginal ≈ ₹75/outlet. Exchange rate assumed ₹88/USD.
- Payments: UPI AutoPay ₹5–₹15 + 18% GST per debit (+₹7.5 once); annual link payment 1.95% UPI + GST ≈ 2.3%. Card MDR not verified (assume up to ~2.5%).
- Blended collected price per outlet **₹1,000/month ex-GST** after yearly discounts and founding offers (list blend ≈ ₹1,139).
- Founder/support labour valued at ₹400/hour: 1.5 h/outlet/month early, falling to 0.75 h at 100 outlets; onboarding 4 h per new outlet (partly paid by Launch Pack).
### 7.2 Result
| Outlets | Revenue/mo | Infra (fixed + marginal) | Payment fees (~1.5%) | Contribution before labour | Labour | Net |
|---|---|---|---|---|---|---|
| 10 | ₹10,000 | ₹8,750 | ₹150 | ₹1,100 | ₹6,000 | **−₹4,900** |
| 25 | ₹25,000 | ₹9,875 | ₹375 | ₹14,750 | ₹15,000 | ≈ −₹250 |
| 50 | ₹50,000 | ₹14,750 | ₹750 | ₹34,500 | ₹20,000 | **+₹14,500** |
| 100 | ₹100,000 | ₹22,500 | ₹1,500 | ₹76,000 | ₹30,000 | **+₹46,000** |
Infra-only break-even ≈ **9 outlets**; fully loaded break-even ≈ **25–30 outlets**. Conclusions: (1) do not discount below list outside the founding offer; (2) Counter is the acquisition tier — upsell to Floor via Operating Costs, custom roles, WhatsApp support; (3) support time is the lever: write good docs, keep the demo workspace, avoid custom work for small plans; (4) gross margin on a Floor outlet at scale is ~85% before labour.
Per-debit cost vs price: Counter ₹5.9/₹707 ≈ 0.8%; Floor ₹17.7/₹1,533 ≈ 1.2%; Pass ₹17.7/₹2,949 ≈ 0.6%. Annual Floor link payment ≈ ₹353 (2.3%) on ₹15,328.

---

## 8. Positioning vs competitors
| Market habit | Nexus stance |
|---|---|
| No published price, "book a demo" | Published rate card; GST stated |
| Add-ons for KDS, captain app, QR, analytics | KOS, Alerts, Operating Costs, Activity History included (honest caveat: QR, captain app, stock are not built) |
| Opaque renewal, exit fees | Renewal lock for founding; export window; no exit fee |
| Free tier of basic billing (Zoho) | We don't compete on free billing; we compete on what happens between table and report: Service Request → KOS → Checkout → Void/Refund trail → daily closing |
| Hardware lock-in | Browser-based on any device; printing coming soon, honestly labelled |
| "Works offline" claims | We don't claim it (ADR-009). Interruption-tolerant: idempotent retries, resync |
Where we lose today (say it in the FAQ, not hide it): no card payments, no QR ordering, no aggregator integration, no stock, no Gujarati UI, no printing validated, no customers yet. Best-fit buyer: a Gujarat dine-in restaurant or café that wants control and trust in its numbers and is willing to be an early partner.

---

## 9. Marketing-site pricing UI spec
**Component:** monthly/yearly segmented toggle (default **Yearly**, label "Yearly — 2 months free"). Prices show `₹` en-IN grouping, "+ GST" in small text beneath, and a hover/tap line "₹1,532.82 incl. 18% GST". Annual card shows both: big "₹12,990 /year" and small "≈ ₹1,082 a month".

**Founding ribbon** above the grid (Mint Wash, mono eyebrow): `FOUNDING RESTAURANTS · UNTIL 31 JAN 2027` — "25% off your first year, Launch Pack included, price locked for year two." Plan cards show a struck-through list price and the founding price when the yearly toggle is on.

| Card | Eyebrow | Name | Tagline | Badge | CTA |
|---|---|---|---|---|---|
| 1 | FOR CAFÉS AND COUNTERS | **Counter** | One counter, a few tables, and every rupee accounted for. | START SMALL | Start with Counter |
| 2 | FOR DINE-IN RESTAURANTS | **Floor** | Floor and kitchen finally speaking the same language. | BEST FOR MOST DINE-IN ROOMS | Start with Floor |
| 3 | FOR BUSY ROOMS | **Pass** | When plates leave the pass every few seconds, you need no surprises. | ROOM TO GROW | Start with Pass |
| 4 | FOR GROUPS | **Many Doors** | Four outlets or forty? Let's design it together. | TALK TO US | Talk to us |

Feature bullets per plan (6–9, honest) are in 03c §11. Primary CTA goes to `#register?plan=floor&cycle=yearly`; secondary link under every card: "Not sure? Book a live demo". Below the grid: **"Pay online, start with a person"** four-step strip (Register → Pay → Workspace → First order), onboarding table (2.2), add-ons (2.1), comparison note ("what's included that others charge for"), and a billing FAQ block.
**Required footnotes under the grid:** "All prices exclude 18% GST. Staff-login and outlet limits are applied by our team when we set up your Workspace. Printing, QR ordering, bookings screen, stock, WhatsApp messaging and card payments are coming soon and are not part of any plan today."
**Billing FAQ (short list, full answers in 03c §13):** Do you charge GST? Yearly or monthly? How do I pay (UPI AutoPay / link)? What if a payment fails? Can I cancel? Refund? Do you keep my data after I leave? Are there hidden fees? What is the founding offer, really?
**Accessibility:** toggle is a radio group with visible focus (Forest border); prices have `aria-label`s that read "twelve thousand nine hundred ninety rupees per year plus GST".

---

## 10. Decisions and verifications for the owner
1. **GST registration** — "+18% GST" presumes you are registered; otherwise quote inclusive prices (CA).
2. **Legal entity** and Udyam details for invoices and policies.
3. **Hosting region and provider** (Docker+Caddy vs Vercel+Neon) — until decided, do not say "India-hosted".
4. **Cashfree account:** subscriptions enabled? AFA enabled for ≥₹15,000? variable-amount mandates? retry schedule? GST treatment of ₹ fees?
5. **Pilot capacity:** how many hand-setups per week can you honestly do? (Sets the wording of the founding offer.)
6. Whether to keep the **14-day refund** (recommended: it replaces a free trial and fits manual provisioning).
7. **Support hours/channels** to publish; do not publish numeric response SLAs yet.
8. Build list before promising: whole-Workspace export + deletion, registration lead capture, plan-seat counting.
9. Founding offer end date (proposed 31 Jan 2027).
