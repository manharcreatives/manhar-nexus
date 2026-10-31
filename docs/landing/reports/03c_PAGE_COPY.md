# 03c — Page Copy System — Manhar Nexus Launch Page

Final English copy, section by section. Voice: a calm, curious restaurateur-friend who has watched a lot of Saturday nights. Short sentences. Concrete nouns. No filler.
**Terminology (canonical glossary):** Service Request, Guest Session, Checkout, KOS, Sold-Out, Business Workspace, Activity History, Dining Table. Avoid "order", "bill", "tenant", "86'd". (The product nav says "Bills"; on the page we say "Checkout" and use "bill" only in plain reader-facing prose where a restaurateur would say it.)
**Honesty:** every claim maps to LIVE features in `01_CODEBASE_ANALYSIS.md` §3.1. "Coming soon" items are labelled. No numbers, customers, logos, testimonials, awards. Pricing = `03b`.
**Format notes:** `EYEBROW` = JetBrains Mono label (≤6 words). `[accent: word]` marks the single green accent word allowed per headline. `(alt)` lines are optional alternates.
**Placeholders the owner/developer fills:** `[DOMAIN]`, `[SUPPORT EMAIL]`; contact data below is taken from the live manharcreatives.com site (02_DESIGN_RESEARCH §1.4) — confirm before publishing.

---

## 1. Preloader micro-copy (rotates; 1.7 s max; skipped on reduced-motion/second visit)
1. Laying the tables…
2. Firing the first ticket…
3. Counting the drawer twice…
4. Opening for service.

---

## 2. Header
**Nav labels (in order):** Why Nexus · Platform · How it works · Built for · Pricing · Insights · FAQ
**Secondary link:** Sign in (→ /login)
**Primary CTA:** Register your restaurant (→ #register)
**Mobile menu footer line:** Questions? WhatsApp us — we reply the same working day. *(Owner: only keep if true.)*
**Skip link:** Skip to main content

---

## 3. Hero
**Eyebrow:** `NEXUS · A RESTAURANT OPERATIONS PLATFORM`
**H1:** Every table, every ticket, every rupee — [accent: accounted] for.
(alt) The night ends. Your numbers should [accent: agree].
**Subhead:** Manhar Nexus joins the floor, the kitchen and the counter in one calm workspace — so closing time brings numbers you can trust, not a notebook you have to decode.
**Primary CTA:** Register your restaurant
**Secondary CTA:** See how a night runs ↓
**Under-CTA microcopy:** Pay online. We set up your Business Workspace by hand. 14-day money-back guarantee.
**Three proof-points (all true):**
1. **A record that can check itself.** Every sensitive action goes into Activity History, and a Verify button can prove nothing was altered.
2. **Paid is paid.** A finished Checkout is never edited. A mistake is fixed by a visible refund or Void, with a reason.
3. **Floor and kitchen, live.** Service Requests reach the Kitchen Operations Screen (KOS) while the waiter is still walking away. No refresh button.
**Scroll cue:** Scroll — the night begins at 7:42 pm
**Hero image alt (art-direction note):** "A restaurant pass at dusk: tickets lined up under warm light." (decorative, `alt=""` if purely atmospheric)

---

## 4. The curious intro — "Between the chair and the last report"
**Eyebrow:** `A GUEST SITS DOWN`
**Headline:** Seven minutes after a guest sits down, your restaurant has already made six decisions you won't remember.
**Body (≈180 words):**
A guest sits at Table 6. Someone notes it. Someone else asks for the water. Half-portion or full? "Less spicy" — said once, to one person, in a noisy room.
The slip goes to the kitchen. Or the words do. The cook reads it the way cooks read things at 8:40 on a Saturday. A dish runs out, and only two people know.
Then the guest asks for the bill. The total is right — probably. Cash is counted — roughly. Someone gives a discount, because the guest looked unhappy, and that is a kind thing to do, and nobody writes it down.
At midnight you add it up. The drawer is short by ₹300. The register says one thing; the notebook says another; the WhatsApp group says a third.
Nothing here is dramatic. No one stole. No one lied. A restaurant simply passed through a hundred small hand-offs, and every hand-off was a place where the truth could slip.
**Closing question (large, own line):** So where does the truth of your restaurant actually live — and who is allowed to change it?
**Link under question:** Follow one night, start to finish →

---

## 5. About — "Why Manhar Nexus exists"
**Eyebrow:** `BUILT IN VISNAGAR, GUJARAT`
**Headline:** We build brands and software. We kept noticing the same quiet leak in restaurants.
**Body:**
Manhar Creatives is a small design and software studio in Visnagar, Gujarat. We have spent our days making websites, brand systems and custom software for businesses across the state — including restaurants and cafés.
[OWNER TO CONFIRM OR REWRITE FROM REAL EXPERIENCE — do not publish unless true:] Around restaurants, one pattern keeps repeating. Good food, loyal guests, hard-working teams — and still, at night, a ledger that doesn't quite close. Not because anyone is careless, but because the tools are either too thin (a slip pad and WhatsApp) or too loud (a hundred buttons, hidden prices, an add-on for everything).
So we built Nexus the way we build everything: start with the real hand-offs. The table to the kitchen. The kitchen to the floor. The floor to the Checkout. The Checkout to the day's report. Then make each hand-off boring, visible and hard to get wrong.
**Honest note (a small bordered box):**
Nexus is new. It has been built carefully and tested hard, but it has not yet run a hundred restaurants. We are opening to our first Founding Restaurants, and we will set each one up by hand. If that sounds like the right kind of beginning, we would like to meet you.
**What we believe (3 short lines):**
- Your numbers belong to you. You can take your reports with you.
- A tool should explain itself in words, not just colours.
- Price should be written down where you can see it.
**Founder signature (owner to approve):** — Utsav Prajapati, Founder, Manhar Creatives
**Studio line:** We Design, We Build, You Grow.

---

## 6. Why Nexus is different

### 6.1 Section header
**Eyebrow:** `ONE SATURDAY NIGHT, TWO WAYS`
**Headline:** Same restaurant. Same guests. A different 6 pm to midnight.
**Subhead:** Drag the slider to move through the night. Left is how many restaurants run today — paper, memory, WhatsApp. Right is the same moment with Nexus. We have kept the right-hand side to what the product really does.

### 6.2 Day in the life — 8 moments
| Time | Moment | Without Nexus | With Nexus |
|---|---|---|---|
| **6:30 pm** | A family of five walks in | You glance at the floor and guess which tables are free. Someone is sure Table 4 is clear. It isn't. | The Dining Table board shows every table as Available, Occupied or Needs cleaning — in words, not just colours. You open a Guest Session with the party size. |
| **7:42 pm** | "Half plate, less spicy, extra raita" | It is said once, to one person, over noise. It becomes a scribble. | The waiter picks the item, taps the portion, the spice level and the extra. The Service Request carries exactly that to the kitchen. |
| **8:05 pm** | Two taps on a laggy phone | Two slips go to the kitchen. Two dishes are cooked. One is thrown away. | A repeated tap or a retry is recognised as the same request. One dish is cooked. |
| **8:20 pm** | The kitchen is behind | Nobody knows which ticket is oldest. The loudest table gets food first. | The KOS lists Service Requests oldest-first with waiting time, and flags what is running late. |
| **8:40 pm** | The paneer runs out | You mention it to two people. A third guest orders it. | You mark the dish Sold-Out in the menu — one switch — and everyone works from the same menu. |
| **9:15 pm** | Time for the bill | The total is added on a phone calculator. GST is a rounded guess. | The Checkout is computed on the server in whole paise, with GST by line grouped by rate. Cash shows the change due. |
| **9:50 pm** | A wrong dish, a refund | A note on a chit. The cash comes out of the drawer. Who approved it? Nobody remembers. | A refund or Void needs a reason and is capped at what was paid. The original Checkout stays untouched. |
| **11:45 pm** | Closing | You count the drawer and compare three sources. The gap is an argument. | The Daily Closing report shows sales, tax, payment methods and refunds. Activity History shows who did what — and Verify shows nothing was altered. |
**Slider/range-input label:** Time of night
**Caption under table:** Illustrative night, not a customer story. Nexus today records cash and UPI payments; card payments, discounts and split bills are coming soon.

### 6.3 Scorecard — "Honestly, how do we compare?"
**Eyebrow:** `AN HONEST SCORECARD`
**Intro:** We have marked where Nexus is ahead, where it is equal, and where it is not yet there. "Typical POS" means the common cloud billing software sold in India; "Paper + WhatsApp" means slips, a register and a group chat. Both are fair tools for some restaurants.
| What matters | Paper + WhatsApp | Typical cloud POS | Nexus today |
|---|---|---|---|
| Table-to-kitchen hand-off | Spoken or scribbled | Usually KOT print; screens often a paid add-on | Service Requests to a live KOS, included in every plan |
| Price on the website | None needed | Often "book a demo" | Written down, GST stated |
| Changing a paid bill | Easy and invisible | Often possible with permissions | Not possible — reversal with a reason only |
| Proof that records weren't altered | None | Varies | Activity History with a Verify check |
| Role-based staff access | None | Yes | Yes — the cook never sees sales |
| Double-tap / retry safety | None | Varies | Built in (idempotent requests) |
| Daily closing numbers | Manual | Yes | Yes — sales, tax, payment methods, refunds, CSV |
| Card payments at Checkout | n/a | Usually yes | **Not yet — coming soon** |
| QR ordering / aggregator links | No | Often yes (paid) | **Not yet — coming soon** |
| Receipt printing | Hand-written | Yes | **In validation — coming soon** |
| Stock & recipes | Notebook | Often yes | **Not yet — coming soon** |
| Works with no internet | Yes | Some do | **No.** Needs internet; keep a paper fallback |
| Gujarati / Hindi screens | n/a | Varies | **English only for now** |
| Customers who can vouch for it | — | Many | **Not yet — we are opening to Founding Restaurants** |
**Footnote:** If your restaurant today needs card billing, printed receipts or aggregator links on day one, Nexus is not ready for you yet — and we would rather say so than sell you a promise.

---

## 7. Platform / Modules showcase
**Eyebrow:** `THE PLATFORM`
**Headline:** One platform. Switch on only what your restaurant needs today.
**Subhead:** Nexus is built as a core with modules. Your Business Workspace starts small and grows without a migration.

| # | Module | Curious one-liner | Two-line description | Tiny proof detail |
|---|---|---|---|---|
| 01 | **Floor & Dining Tables** | Which table is really free? | Draw your Dining Areas once. Every Dining Table shows Available, Occupied or Needs cleaning — in words, not just colour. | Table state in text, for any screen and any eyesight. |
| 02 | **Menu & Add-ons** | Half plate, less spicy, extra raita — captured once. | Categories, items, portions and Add-ons with rules (single or multiple, min and max, priced). Mark a dish Sold-Out with one switch. | Variants and Add-ons are validated on the server, not just on the screen. |
| 03 | **Guest Sessions & Service Requests** | One visit, however many rounds. | Open a table with party size, add rounds as the meal goes on, send each Service Request to the kitchen, and mark items served. | Repeated taps are recognised as the same request. |
| 04 | **Kitchen Operations Screen (KOS)** | A kitchen that knows what to cook next. | Service Requests arrive oldest-first with waiting time. Accept, start preparing, mark ready. | Running-late items are flagged automatically. |
| 05 | **Checkout** | The bill that adds up, every time. | One Checkout per Guest Session. GST by line, cash with change due, UPI with a transaction-reference confirmation. | Money is calculated in whole paise, on the server. |
| 06 | **Bills, Refunds & Voids** | Mistakes fixed in the open. | Search every Checkout. Refund with a mandatory reason, capped at what was paid. Void keeps the number consumed. | Refunds can't exceed what was paid — even if two people try at once. |
| 07 | **Reports** | Tonight's truth, tomorrow's decisions. | Daily closing, sales summary, top items, a 14-day trend. Download as CSV or print from the browser. | The first screen the owner sees is "Today". |
| 08 | **Operating Costs** | Where the running costs actually go. | Categories, expenses and an approval flow with a reason when something is rejected. | Approvals are recorded in Activity History. |
| 09 | **Roles & Access** | The cook doesn't need to see sales. | Owner, Manager, Checkout Associate, Service Team, Kitchen Team and more — or build your own role. | Every restricted action is checked on the server, not just hidden on the screen. |
| 10 | **Activity History** | Who did what, and can we prove it? | A timeline of sensitive actions across your Business Workspace. Hit Verify to check the chain is intact. | Records are linked so a silent change breaks the chain. |
| 11 | **Alerts Center** | Told when it matters, quiet when it doesn't. | In-app alerts for things that need attention, with rules you can tune. | The bell shows alerts relevant to your role. |
| 12 | **Locations** | One login, more than one door. | Work in one outlet at a time, with roles scoped to a location. | Our team sets up each location with you. |
**Coming soon row (muted cards, mono tag `COMING SOON`):** Printing & kitchen tickets · Bookings · Guest profiles · QR Scan Menu · Stock & recipes · WhatsApp messaging · Discounts & split Checkouts · Gujarati/Hindi screens.
**Coming-soon microcopy:** These are in design or in the engine. We will not charge for something that isn't here, and we will tell you before it is.

---

## 8. How it works
**Eyebrow:** `FROM HELLO TO FIRST SERVICE REQUEST`
**Headline:** Five steps. A human at every one.
**Subhead:** Nexus isn't instant sign-up software. We set up every restaurant ourselves — that's slower, and it's why the first week works.
| Step | Title | What happens | Time (honest) |
|---|---|---|---|
| 01 | **Register** | Tell us about your restaurant: type, outlets, city, how you'd like to begin. Takes about two minutes. | 2 min |
| 02 | **Pay** | We send a secure payment link (UPI, card or net banking via Cashfree). Yearly is one payment; monthly uses UPI AutoPay. GST invoice by email. | Same day |
| 03 | **Workspace** | We create your Business Workspace, your first location, the owner login and the right modules. You sign in and set your own password. | Target: within one working day |
| 04 | **Menu & tables** | Upload your menu (or let us enter it), draw your Dining Areas and tables, add your team and their roles. | A few hours to a few days — depends on your menu |
| 05 | **First service** | Open a table, send a Service Request, watch it appear on the KOS, take the Checkout. We stay on call for your first service. | Your launch day |
**Under-strip:** Not ready to pay? Ask for a 14-day pilot or a live demo instead. **Changed your mind within 14 days of activation?** Full refund.
**Integration-point label (dev):** `// INTEGRATION POINT: Pay step — Cashfree payment link / subscription link (see 03b §5). Until live, show: "We'll send your payment link by WhatsApp or email within one working day."`

---

## 9. Built for
**Eyebrow:** `BUILT FOR`
**Headline:** From the corner café to the busy dining room.
| Type | One-liner | Status |
|---|---|---|
| **Restaurants** | Tables, rounds, kitchen and Checkout in one flow — the way a dine-in room actually runs. | Available now |
| **Cafés** | Few tables, fast turns, every rupee in the drawer accounted for. | Available now |
| **Bakeries** | Counter-style and seated service, with GST by line and a daily close you can read in a minute. | Available now (seated and counter-style flows; QR and token ordering coming soon) |
| **Hotel restaurants** | A table-service outlet inside a hotel can use Nexus today. Room billing and hotel systems are not part of it. | Available for the F&B outlet only |
| **Cloud kitchens** | Digital orders, aggregator links and stock are what you'll need — they're on our roadmap, not in the product yet. | Coming soon — tell us your needs |
| **Food courts & QSR counters** | Tokens, pickup and fast counter flows are being designed. | Coming soon — tell us your needs |
**Line under table:** Not sure where you fit? Describe your restaurant in the form below — we'll tell you honestly whether Nexus is ready for you.

---

## 10. Trust & engineering
**Eyebrow:** `TRUST, IN PLAIN LANGUAGE`
**Headline:** You shouldn't have to trust us blindly. So we built things you can check.
| Block | Plain-language claim | How we back it |
|---|---|---|
| **A record that proves itself** | Sensitive actions are logged in order, and each entry is chained to the one before. If someone silently changes history, Verify shows the break. | Activity History uses a hash chain; the Verify button re-checks it. |
| **Finished is finished** | Paid Checkouts, payments and refunds are never edited or deleted. Corrections are new, visible entries with a reason. Voided numbers stay used. | No edit or delete paths exist for financial records. |
| **Each person sees their own job** | A waiter, a cook and a cashier see different screens — and the server enforces it, not just the screen. | Role-based permissions; automated tests check that forbidden requests are refused. |
| **Your restaurant is walled off** | Your Business Workspace is separate from every other restaurant's. Your staff can't see anyone else's data, and nobody else's can see yours. | Tenant isolation with an adversarial test sweep. |
| **No double charge, no double dish** | A double-tap, a slow phone or a retry won't create two Service Requests or two payments. | Every money-related and order request carries a unique key the server remembers. |
| **Passwords handled properly** | Passwords are stored as one-way hashes, repeated wrong attempts lock the account for a while, and temporary passwords must be changed at first sign-in. | argon2id hashing, lockout, forced change. |
| **Backups, written down** | Backup and restore steps are documented and have been rehearsed. We'll publish our backup schedule and hosting region before you pay. | Runbooks in the repo. *(Dev note: replace with specific facts once production is final.)* |
| **Built for India** | Rupees, GST, Indian time. Names, number formats and money rules designed for how Indian restaurants work. | Hosting region will be named here when production is final. |
**"What we haven't done yet" box:**
Nexus has not been through an external penetration test or a formal certification. It hasn't been run by a large number of restaurants. We tell you this because you should know exactly what you're trusting.

---

## 11. Pricing copy
**Eyebrow:** `PRICING, WRITTEN DOWN`
**Headline:** One price per outlet. No add-on maze.
**Subhead:** The things other tools sell separately — the kitchen screen, alerts, Activity History, role-based access — are already in. Prices exclude 18% GST.
**Toggle:** Monthly | **Yearly — 2 months free**
**Founding ribbon:** `FOUNDING RESTAURANTS · UNTIL 31 JAN 2027` — 25% off your first year on any yearly plan, Launch Pack included, and your price locked for year two. In return, we ask for honest feedback. Nexus is new; you'd be among our first restaurants.

### Counter — ₹599/month · ₹5,990/year
**Tagline:** One counter, a few tables, and every rupee accounted for. · **Badge:** START SMALL · **For:** cafés, bakeries, small eateries (1 outlet).
- Business Workspace for 1 outlet, up to 5 staff logins
- Menu with portions, Add-ons and a Sold-Out switch
- Floor map with live Dining Table status
- Guest Sessions and Service Requests, round after round
- Kitchen Operations Screen — live, no refresh
- Checkout with GST by line; cash (with change due) and UPI
- Refund and Void, always with a reason
- Daily closing report, sales summary, top items, CSV download
- Roles, Activity History with Verify
**CTA:** Start with Counter

### Floor — ₹1,299/month · ₹12,990/year
**Tagline:** Floor and kitchen finally speaking the same language. · **Badge:** BEST FOR MOST DINE-IN ROOMS · **For:** standard dine-in restaurants (1 outlet).
- Everything in Counter
- Up to 15 staff logins and custom roles
- Operating Costs with approve / reject
- Alerts Center with rules you can tune
- Owner "Today" home with 7-day sparkline and 14-day trend
- Email and WhatsApp support in business hours
- Launch Pack available at ₹3,499
**CTA:** Start with Floor

### Pass — ₹2,499/month · ₹24,990/year
**Tagline:** When plates leave the pass every few seconds, you need no surprises. · **Badge:** ROOM TO GROW · **For:** busy rooms and small groups (up to 3 outlets).
- Everything in Floor
- Up to 3 outlets with a location switcher and location-scoped roles
- Up to 40 staff logins
- Priority support queue with a named contact
- Quarterly review call (30 minutes)
- Launch Pack included
- First access to new modules as they ship (no dates promised)
- Price locked for 24 months for Founding Restaurants
**CTA:** Start with Pass

### Many Doors — Let's talk
**Tagline:** Four outlets or forty? Let's design it together. · **Badge:** TALK TO US
- 4+ outlets, central menu and cross-outlet needs
- Custom roles at scale and custom onboarding
- A conversation about what we should build first
**Note:** Central menu and cross-outlet comparison aren't built yet — Many Doors restaurants help decide the order.
**CTA:** Talk to us

### Below the cards
**Onboarding (one-time):** Launch Pack ₹3,499 — menu upload (up to 150 items), floor layout, staff roles, one remote training, go-live check-in. Or pick à la carte: menu upload ₹1,500 · floor ₹500 · training ₹1,500 · on-site training in Gujarat ₹3,500 + travel.
**Add-ons:** Extra outlet +50% of plan price/month · Extra staff login ₹49/month · Premium support ₹799/month.
**Coming soon (not sold yet):** Printer & kitchen-ticket setup · WhatsApp/SMS messaging.
**Footnote:** All prices exclude 18% GST. Staff-login and outlet limits are applied by our team when we set up your Workspace. Printing, QR ordering, bookings, stock, WhatsApp messaging and card payments are coming soon and aren't part of any plan today.
**Billing mini-FAQ:** (see §13: Q7–Q11)
**Under grid:** Not sure? Book a live demo — no card, no pressure.

---

## 12. Registration section
**Eyebrow:** `REGISTER YOUR RESTAURANT`
**Headline:** Tell us about your restaurant. We'll take it from here.
**Subhead:** Two minutes now. A person from our team replies the same working day with your payment link — or your pilot, or your demo.
**Side panel ("What happens next"):** 1. We read your request. 2. We confirm the plan with you. 3. You pay securely online (Cashfree). 4. We set up your Business Workspace. 5. You open your first table.

### Form fields (label · placeholder · help)
| # | Field | Label | Placeholder | Help / validation |
|---|---|---|---|---|
| 1 | restaurantName | Restaurant name | e.g. Shree Ram Dining | Required. Max 120. |
| 2 | contactName | Your name | e.g. Rajesh Patel | Required. |
| 3 | phone | Mobile number | 98765 43210 | Digits only. +91 selector. We use this to reach you on WhatsApp. |
| 4 | email | Email | you@yourrestaurant.in | Required. Your payment link and invoice go here. |
| 5 | city | City | e.g. Visnagar | Required. |
| 6 | businessKind | Type of business | Restaurant / Café / Bakery / Hotel restaurant / Cloud kitchen / Food court / Other | Select. |
| 7 | outlets | Number of outlets | 1 | 1–500. 4+ → show Many Doors note. |
| 8 | planKey | Plan you're considering | Counter / Floor / Pass / Not sure | Preselected from the pricing button. |
| 9 | billingCycle | Billing | Yearly (2 months free) / Monthly | Default Yearly. |
| 10 | begin | How would you like to begin? | Pay and start / 14-day pilot (we'll call you first) / Live demo first | Required. |
| 11 | code | Founding or referral code (optional) | e.g. FOUNDING26 | Optional. |
| 12 | message | Anything we should know? (optional) | Printers you use, your menu size, your questions… | Max 1000. |
| 13 | consent (checkbox, required) | — | — | See consent text. |
| 14 | updates (checkbox, optional) | — | — | "Send me occasional product updates." |
| hidden | website (honeypot) | — | — | Must stay empty; label hidden from users and screen readers. |
**Submit button:** Send my request  ·  **Loading:** Sending…
**Microcopy under button:** We'll never sell or share your details. You can ask us to delete them any time.
**Fallback line:** Prefer to talk? WhatsApp +91 97145 71522 · info@manharcreatives.com

### Consent text
**Required checkbox:** I agree to the [Terms & Conditions], [Privacy Policy] and [Refund & Cancellation Policy], and I'm happy for Manhar Creatives to contact me about this request by phone, WhatsApp and email.
**Optional checkbox:** Send me occasional product updates. I can unsubscribe at any time.
**Small print:** Manhar Creatives will use these details to respond to your request and set up your account, as described in the Privacy Policy. Payment is made later, on a secure Cashfree page — we never see your card or UPI PIN.

### Success state
**Title:** Request received.
**Body:** Thank you, {contactName}. Your reference is **{referenceCode}**. Someone from Manhar Creatives will message you on WhatsApp or email within one working day with the next step. Keep this reference handy.
**Secondary:** While you wait: read how a night runs → · Add info@manharcreatives.com to your contacts so our email doesn't land in spam.

### Error and validation messages
| Case | Message |
|---|---|
| Required empty | Please fill in {field}. |
| Invalid email | That email doesn't look right. Please check it. |
| Invalid mobile | Enter a 10-digit Indian mobile number. |
| Outlets out of range | Enter a number from 1 to 500. |
| Consent unticked | Please accept the terms to continue. |
| Too many requests (429) | We've received several requests from your network. Please wait a little and try again, or WhatsApp us. |
| Network error | We couldn't reach the server. Check your connection and try again — or WhatsApp us your details. |
| Server error (5xx) | Something went wrong on our side. Your request was not lost if you see a reference; otherwise please try again or write to info@manharcreatives.com. |
| Success but payment link not live (interim) | We'll send your payment link by WhatsApp or email within one working day. |
**Dev notes:** Do not reveal whether an email already exists. Always respond "Request received" + reference. Honeypot hit → same success state, no row.

---

## 13. FAQ (16 questions)
*(Each answer below is also the text used in the FAQPage JSON-LD in §17. Keep both in sync.)*

### Q1. How long does it take to get started?
We create your Business Workspace by hand, and our target is within one working day of payment. Entering your menu and drawing your tables takes anything from a few hours to a few days, depending on the size of your menu — you can do it yourself, or we can do it for you with a Launch Pack. We stay available for your first service.

### Q2. What hardware do I need? Do you support printers?
Nexus runs in a web browser, so any phone, tablet or computer with a modern browser and internet works, including for the Kitchen Operations Screen. Receipt and kitchen-ticket printing through a local print agent is being validated with real printers and is coming soon; today you can print reports from your browser. We will tell you honestly before you pay if your setup needs something that isn't ready.

### Q3. What happens if the internet drops?
Nexus needs an internet connection and is not an offline billing system. Screens show when they are reconnecting, repeated taps and retries are recognised so you do not get duplicate Service Requests or payments, and everything re-syncs when the connection returns. For a long outage, keep a paper pad for kitchen slips and enter them later.

### Q4. Who owns my data?
You do. Menus, tables, Service Requests, Checkouts, reports and staff details in your Business Workspace belong to your business. You can download reports as CSV at any time, and when you leave we give you a 30-day window to export your data before it is deleted. We do not sell your data or your guests' data.

### Q5. How does GST work in Nexus?
You set tax categories and rates; Nexus calculates GST on the server for every line, groups it by rate on the Checkout and shows it in your reports. Prices are tax-exclusive today. Nexus does not file returns or generate e-invoices — it gives you accurate figures to hand to your accountant. This is general information, not tax advice; please confirm your rates with your CA.

### Q6. Can I run more than one outlet?
Yes, in a basic way. One login can work across locations, with a location switcher and roles scoped per location. Our team creates the locations with you. Central menu management and cross-outlet comparison are not built yet — if you run four or more outlets, choose "Many Doors" and tell us what you need.

### Q7. Is there a free trial?
There's no instant self-serve trial, because we set each Workspace up by hand. Instead you can book a free live demo, ask for a 14-day pilot (we'll have a short call first), or pay and use the 14-day money-back guarantee, counted from the day your Workspace is activated.

### Q8. Can I cancel? What happens to my data?
Yes. Monthly plans can be cancelled any time and run to the end of the paid month. Yearly plans run to the end of the term and do not renew. After your subscription ends you have 30 days to export your data; then it is deleted from our live systems, and encrypted backups roll off as they expire. See the Refund & Cancellation Policy for details.

### Q9. Are there hidden fees?
No. Prices are written on this page and exclude 18% GST. One-time onboarding fees (Launch Pack ₹3,499, or à la carte) and add-ons (extra outlet, extra staff logins, premium support) are listed with their prices. Nexus does not take a cut of your sales. Payment-gateway charges on your guests' payments don't apply today because Nexus only records cash and UPI payments you receive directly.

### Q10. How do I pay, and what if a payment fails?
Yearly plans are paid once by UPI, card or net banking through a secure Cashfree payment link, and we remind you before renewal — nothing is debited automatically. Monthly plans use UPI AutoPay (your bank notifies you 24 hours before each debit and you can revoke it any time). If a payment fails you get a reminder and a payment link, a 7-day grace period with full service, then a limited mode while you sort it out.

### Q11. What is the refund policy?
Within 14 days of your Workspace being activated, you can ask for a full refund of your first subscription payment — no reasons needed. After that, monthly plans stop at the end of the month and yearly plans are non-refundable except where we fail to deliver, a feature you paid for is withdrawn, or you were charged in error. Onboarding fees are refundable before work starts.

### Q12. How secure is Nexus?
Each restaurant's data is separated from every other restaurant's, staff only see what their role allows, passwords are stored as one-way hashes with lockout after repeated failures, paid Checkouts can't be edited, and Activity History can be verified for tampering. Nexus hasn't had an external penetration test or formal certification yet, and no system is perfectly secure. We will share hosting and backup details before you pay.

### Q13. What support do I get, and in which languages?
Every plan includes email support in business hours; Floor adds WhatsApp; Pass adds a priority queue and a named contact. We don't promise response-time guarantees we can't prove yet. The screens are in English today; Gujarati and Hindi are planned. [Owner: add which languages your support team can offer, e.g. Gujarati, Hindi, English — only if true.]

### Q14. Can I move over from my current billing software?
Yes for your menu: send us your menu in Excel, PDF or even photos and we'll enter it with the menu-upload service. We don't import your past sales history at launch, so keep exporting from your old system for your records, and run both side by side for a few days if you like.

### Q15. Which payments can I take at Checkout?
Cash, with the amount tendered and change due calculated for you, and UPI, where your staff confirm the payment using the transaction reference. Card payments, online payment links and discounts are coming soon. You remain responsible for confirming that UPI money has actually arrived.

### Q16. Who is Manhar Creatives, and is Nexus ready?
Manhar Creatives is a design and software studio in Visnagar, Gujarat that builds brand systems, websites and custom software. Nexus is our restaurant product. It is built, tested and ready for pilots, but it hasn't yet run many restaurants, which is why we're opening to Founding Restaurants first and setting each up by hand. We'd rather say that plainly than invent customers.

---

## 14. Blogs / Insights
**Section eyebrow:** `INSIGHTS`
**Headline:** Notes from the pass — practical reading for restaurant owners.
**Subhead:** Plain-language pieces on running a tighter, calmer restaurant. No jargon, no hype.
**Cards (in order):**
| # | Title | Dek (2 lines) | Category | Read time |
|---|---|---|---|---|
| 1 | The quiet cost of a wrong dish | A mistake at Table 6 doesn't cost the price of the dish. Here is what it actually costs — and where it starts. | OPERATIONS | 6 min |
| 2 | Seven numbers to read before you sleep | You don't need a hundred reports. You need these seven, in this order, every night. | NUMBERS | 7 min |
| 3 | Why the bill is the most important document in your restaurant | It's a tax record, a promise to the guest and the last word in an argument. Treat it that way. | CHECKOUT | 6 min |
| 4 | QR ordering without losing the human touch | The scan menu is easy. Keeping the hospitality is the hard part. | GUEST EXPERIENCE | 6 min |
| 5 | Kitchen ticket psychology | Why the oldest ticket should shout the loudest — and what a calm kitchen looks like. | KITCHEN | 6 min |
| 6 | GST invoicing mistakes restaurants make | Eight slips that cause headaches at filing time, and how to spot them early. General information. | COMPLIANCE | 7 min |

---

### Article 1 — The quiet cost of a wrong dish
**Category:** Operations · **Read time:** 6 min · **Meta description:** What a wrong or mis-heard order really costs a restaurant in food, labour, time and goodwill — and five practical ways to cut mistakes.

A guest at Table 6 asked for a half plate of paneer butter masala, less spicy. The kitchen sent out a full plate, medium. The guest is polite, says nothing, eats half, and does not come back for three months. What did that cost you?

Most owners count the dish: perhaps ₹180 of food cost and a ₹320 menu price. That is the smallest number in the story.

**The real tally (an illustration, not a statistic)**
Imagine the mistake is noticed and fixed. You pay for the first dish that gets thrown away or comped, which is the food cost. You pay a cook's time to make the second dish, a few minutes of a busy station. You pay a waiter's time to carry it, apologise and re-check the table. And you pay the delay that ripples to the other tickets waiting behind it. If it happens during rush, a six-minute delay on one table can push four other tables from "fine" to "annoyed".

Then there's the part no register records: the guest's trust. A regular who has once been served wrongly and ignored will quietly start choosing elsewhere. You never see this on a report. You only see a table that stopped booking.

**Where the mistake actually starts**
Wrong dishes are rarely "kitchen mistakes". They are hand-off mistakes. A request is spoken over noise. A modification is said once, to one person. A scribble is read under pressure. Every time information moves from one person's head to another's, it loses a little.

**Five practical ways to cut them**
1. **Make the options finite.** If "less spicy", "half plate" and "no onion" are real choices on your menu, define them as choices, so the waiter selects rather than types. Free-text notes are where mistakes breed.
2. **Say it back.** A waiter repeats the order to the guest in one sentence. Ten seconds that save a ten-minute apology.
3. **Send it once, to one place.** If the same request exists as a spoken instruction, a slip and a WhatsApp message, two of them will eventually disagree.
4. **Show the kitchen what's oldest.** A mistaken dish often hides behind a backlog. When the oldest ticket is always visible, delays surface before guests complain.
5. **Write down every remake.** For two weeks, note each remake, the dish and the reason. Patterns show up quickly: one dish with a confusing name, one shift with a new waiter, one modifier nobody understands.

**What to do with the numbers**
After a fortnight of noting remakes, look at three figures: how many, which dish, which hour. Most restaurants find that a handful of dishes and one or two busy hours cause most of the trouble. That is good news: it means the fix is a menu wording change or a rush-hour staffing tweak, not a restaurant-wide overhaul.

**Where software helps — and where it doesn't**
Software cannot cook or listen for you. What it can do is make the hand-off structured: the waiter picks the portion and the Add-ons, the Service Request carries exactly that to the Kitchen Operations Screen, and the kitchen sees what is oldest. It also keeps a record of what was asked, so when a disagreement happens you can check the request rather than argue about memory.

If you take only one idea from this article, take this: a wrong dish is almost never a cooking problem. It is a message problem. Fix the message and the cooking mostly fixes itself.

---

### Article 2 — Seven numbers to read before you sleep
**Category:** Numbers · **Read time:** 7 min · **Meta description:** The seven numbers an Indian restaurant owner should check every night — sales, average bill, refunds, cash variance and more — and what each one is telling you.

Restaurant software can produce fifty reports. A tired owner at 11:45 pm will read perhaps three. So choose them well. Here are seven numbers worth reading every night, in a sensible order, and what each one is quietly telling you.

**1. Net sales today.**
Total sales after refunds and Voids. This is the headline, but read it against something: the same weekday last week, not yesterday. Weekends and weekdays are different restaurants.

**2. Number of Guest Sessions (visits).**
How many parties did you serve? Sales without visits is a half-story. If sales are flat but visits are down, your guests are spending more each — possibly good, possibly one big table distorting the day.

**3. Average bill per visit.**
Net sales divided by visits. Watch it over weeks, not days. A slow rise often means your staff are suggesting well; a slow fall often means a popular cheap item is crowding out the rest.

**4. Payment mix: cash and UPI.**
How much arrived as cash and how much as UPI. This matters for tomorrow morning's drawer and for matching with your bank. A sudden shift can mean a payment-method habit changed — or something else did.

**5. Refunds and Voids: count and value.**
This is the single most underrated number. A few, each with a clear reason, is normal. A rising count, or a pattern around one shift or one staff member, is a conversation waiting to happen. Insist that every refund has a reason written down.

**6. Cash variance.**
What the drawer should contain versus what it does. One small mismatch happens. A repeating mismatch on the same shift is not an accident. Count the drawer at the same time every night, with the same two people.

**7. Top items and dead items.**
Which dishes carried the day and which did not move. Over a month, this tells you what to promote, what to reprice and what to remove. A dish that never sells still costs you prep, storage and menu space.

**A simple routine**
Read them in this order, in under five minutes: 1, 2, 3, then 5 and 6 together, then 4, then 7 once a week. Write one line for tomorrow: "Check refunds on the evening shift", "Promote the thali on Tuesday". A number without a next action is trivia.

**Two warnings**
Don't compare a festival day with an ordinary day. And don't read your numbers from three different places. If sales come from the register, payments from a notebook and refunds from memory, you are not reading numbers; you are reading opinions.

**One source of truth**
The nightly routine only works if all seven numbers come from the same place and cannot be quietly changed afterwards. That is the real reason to put the day on one system: not the dashboards, but the fact that the numbers agree with each other and with themselves tomorrow. Whatever you use, make it so that a paid bill can't be edited and a refund always leaves a trail. Then your seven numbers stop being a debate and become a routine.

---

### Article 3 — Why the bill is the most important document in your restaurant
**Category:** Checkout · **Read time:** 6 min · **Meta description:** The restaurant bill is a tax record, a promise to the guest and the final word in a dispute. What a good bill contains and why it must never be quietly edited.

Ask a restaurateur for the most important document in the building and you may hear "the licence", or "the menu". Look at what you hand to a guest at the end of every meal and you'll see the real answer: the bill.

**It does four jobs at once**
1. **A promise to the guest.** It says: this is what you ordered, this is what it costs, and this is the tax. If the numbers are wrong, trust leaves with the guest.
2. **A tax record.** In India, GST registrants have invoice obligations. The bill — properly numbered, with the right tax shown — is the record that your returns rest on. *(General information; please confirm specifics with your CA.)*
3. **The base of your daily closing.** Your cash count, your UPI matching, your sales report: all of them start with bills. If the bills are unreliable, everything downstream is guesswork.
4. **Evidence.** When a guest says "I was overcharged", or a staff member says "I never gave that discount", the bill and its history are the evidence.

**What a good bill contains**
- A unique, sequential bill number that is never reused.
- The date and time, the table and the party.
- Each item with quantity, price and any portion or Add-on, exactly as ordered.
- Tax shown by rate, with the amounts adding up.
- The total, with rounding rules that are consistent.
- How it was paid, and for cash, the amount tendered and the change.
- Your restaurant's name, address and, if you are registered, GSTIN.

**The most dangerous button: "edit bill"**
Many tools let a bill be edited after it is paid. It feels flexible: the guest remembers a mistake, the owner fixes it. The problem is that the same flexibility lets anyone change history later, silently. Today's honest fix becomes next month's mystery shortfall.

A better rule is the accountant's rule: **never erase, only reverse.** If a paid bill was wrong, you don't change it. You record a refund or a Void against it, with a reason and the name of the person who did it. The original stays. The correction sits beside it. Anyone looking later sees exactly what happened and why.

This has a side effect owners like: it makes honest staff safer. If every correction leaves a trail, nobody can be blamed for something they didn't do, and nobody can quietly do something they shouldn't.

**Numbering matters more than it seems**
Skipped or reused bill numbers are a classic audit question. "Why is number 1042 missing?" is easy to answer if a Void keeps the number used. It is hard to answer if bills can be deleted.

**A short checklist**
- Can a paid bill be edited? It shouldn't be.
- Does every refund need a reason? It should.
- Do voided numbers stay used? They should.
- Do your bill totals match your daily report to the rupee? They must.
- Can you find any bill from last month in under a minute? You should.

**In one line**
A bill is not a printout. It is the point where a guest's trust, your tax and your cash meet. Build your process around protecting it.

---

### Article 4 — QR ordering without losing the human touch
**Category:** Guest experience · **Read time:** 6 min · **Meta description:** How Indian restaurants can use QR-code menus and table ordering without losing warmth, and a short checklist for getting the balance right.

A QR code on the table can feel like a gift or a goodbye. Done well, it gives the guest a clearer menu, faster ordering and fewer misunderstandings. Done badly, it tells the guest that the restaurant would rather not talk to them.

The technology is easy. The hospitality is the hard part.

**What QR ordering is genuinely good at**
- **Showing the real menu.** Photos, ingredients, portion sizes and what is actually available today.
- **Reducing mishearing.** The guest types or taps their own choice, so there's no "did you say paneer or paneer tikka?"
- **Speeding up the quiet moments.** A guest who wants another round of chai doesn't have to wave for five minutes.
- **Serving different guests differently.** Some people love to browse alone; QR gives them privacy.

**Where it quietly goes wrong**
- **Slow phones and patchy data.** A menu that takes forty seconds to load on a weak connection is worse than a printed card.
- **Older or less comfortable guests.** Grandparents who are not comfortable with scanning feel excluded in their own family dinner.
- **No one comes.** If ordering is entirely on the phone, the guest may sit for twenty minutes assuming someone has noticed them.
- **No place for the special request.** "It's my father's birthday, can you bring a candle?" doesn't fit in a dropdown.

**Five rules for keeping the human touch**
1. **Offer both.** QR for those who want it, a waiter for those who don't. Never make a guest feel they must use their phone.
2. **Greet first.** The waiter says hello, offers water and mentions the scan option. A thirty-second welcome changes the entire mood.
3. **Make it a conversation starter, not a replacement.** "Scan whenever you're ready — and I'll check on you in a few minutes."
4. **Keep a visible check-in.** Whatever the system, a human visits each table at predictable moments: after the first dish, before dessert, at the bill.
5. **Show availability honestly.** If the paneer is finished, mark it Sold-Out so the guest never orders something you cannot serve. Nothing damages trust faster than "sorry, we don't have that" after waiting fifteen minutes.

**Think about the kitchen too**
A QR order that arrives with no structure — free text, no portion, no spice level — creates the same wrong-dish problem described in our article on order mistakes. The menu behind the QR should offer finite, clear choices.

**A word on payment**
Many guests are happy to pay by UPI at the table, but some still want a printed bill and a human to say thank you. Keep the exit as warm as the entrance.

**Where Nexus stands**
Nexus's QR Scan Menu is on our roadmap and isn't available yet; we'd rather say so than sell it early. The principles above apply to any QR system you adopt, from any vendor.

**The test**
Imagine your most elderly regular and your most phone-fluent student arriving together. If both feel looked after, your QR ordering is working.

---

### Article 5 — Kitchen ticket psychology
**Category:** Kitchen · **Read time:** 6 min · **Meta description:** Why the oldest kitchen ticket should be the most visible, how queues affect cooks' decisions, and simple ways to run a calmer kitchen during rush hour.

Watch a busy kitchen at 8:40 on a Saturday and you'll see something that isn't about cooking. It's about attention. A cook looks up at a row of tickets and decides, in half a second, what to do next. That decision, repeated two hundred times a night, shapes how the evening feels for every guest.

**What cooks actually respond to**
People don't read queues. They respond to what is loudest, newest and closest. A new ticket arrives with a beep and feels urgent. An older ticket slides left and becomes wallpaper. A table that sent a waiter to the pass twice gets cooked first, whether or not it ordered first.

None of this is a character flaw. It is how human attention works. The fix is not telling cooks to "pay attention" but designing the queue so that the right thing is also the loudest thing.

**Five principles of a calm ticket system**
1. **Oldest first, always visible.** The ticket that has waited longest should be the most prominent. Newness shouldn't win attention.
2. **Show the wait, not just the order.** A ticket that says "14 min" tells the story. A ticket that merely exists doesn't.
3. **Mark lateness quietly but clearly.** A small, consistent flag when a ticket passes your standard time. Avoid alarms that blare for everything; people tune them out.
4. **One owner per state.** Each ticket should be accepted, started and marked ready by a named person or station, so "who has this?" is never a question.
5. **Keep modifications on the ticket, not in the air.** "Less spicy" should be printed or displayed where the cook is looking, not shouted across the pass.

**Why waiting time matters to guests**
Guests don't measure minutes; they measure uncertainty. A dish that takes twenty minutes and was promised in twenty is fine. A dish that takes twelve but was promised in ten feels late. The kitchen's job is not only to be fast but to be predictable, and a visible queue is what makes prediction possible.

**The pass is a decision point**
Everything leaving the kitchen should pass a final look: right table, right dish, right modification, right temperature. A single glance at the pass catches mistakes cheaply. After the food reaches the table, they cost far more.

**Common traps**
- **Printing too much.** Tickets full of unrelated information make cooks stop reading.
- **No end state.** If nobody marks a dish ready, the floor keeps asking and the kitchen keeps answering. Interruptions are the hidden tax on a busy station.
- **Treating rush as normal.** If every Saturday looks like chaos, the problem is capacity or process, not "a busy night".

**A tiny experiment**
For one week, write down the longest wait each evening and which table it was. If it's always the same type of dish or the same station, you've found your bottleneck without any software at all.

**Where tools help**
A good kitchen screen does these things quietly: oldest-first order, visible waiting time, a late flag, and clear states from accepted to ready. It doesn't make anyone cook faster. It makes the right ticket the loudest ticket — and that is most of what a calm kitchen is.

---

### Article 6 — GST invoicing mistakes restaurants make
**Category:** Compliance · **Read time:** 7 min · **Meta description:** Eight common GST invoicing mistakes in Indian restaurants — wrong tax shown, edited bills, missing GSTIN, inconsistent numbering — and how to catch them. General information only.

> **General information, not tax or legal advice.** GST rules, rates and thresholds change and depend on your type of establishment and registration. Please confirm everything with a qualified Chartered Accountant or tax professional.

GST problems in restaurants rarely come from dramatic fraud. They come from small, repeated slips that nobody notices until filing time, or until a notice arrives. Here are eight to watch for.

**1. Charging tax you are not entitled to charge.**
Whether and how a restaurant may collect GST depends on its registration and scheme. For example, a business under the composition scheme generally cannot collect GST from guests as a separate tax on its bills. Know which category you are in, and make sure your bills follow it.

**2. Showing the wrong rate.**
Rates differ by type of establishment and service, and they can be revised. A rate set once in your system and never reviewed can quietly go wrong. Review your tax categories each time you change your menu structure and at least once a year.

**3. Treating service charge casually.**
Service charge and tips are treated differently in practice, and the tax treatment of service charge is a topic where owners often get conflicting advice. Decide with your CA how it should appear on bills, and keep it consistent.

**4. Editing bills after they are issued.**
A bill that can be changed after payment is a bill you can't fully defend. If a correction is genuinely needed, record it as a separate credit or reversal with a reason, rather than overwriting the original.

**5. Gaps and duplicates in bill numbers.**
Invoice numbers should follow a consistent, unique series. Skipped or repeated numbers invite questions. If a bill is cancelled, the number should still be accounted for rather than disappearing.

**6. Missing or wrong details.**
A proper tax invoice carries specific details such as your name and address, GSTIN where registered, the date, the invoice number and the tax breakdown. When a business guest asks for a GST invoice, you need their details recorded correctly at the time, not reconstructed later.

**7. Inconsistent rounding.**
Rounding each line differently from the total produces mismatches between the bill, the report and the return. Pick one rounding method and apply it everywhere, so a bill total can always be recomputed from its lines.

**8. Mismatch between sales records and returns.**
If your daily sales are kept in one place, payments in another, and returns prepared from a third, small differences multiply. Reconcile your daily sales report against the tax figures each month, before filing.

**A simple monthly check**
- Pick five bills at random and recompute the tax by hand.
- Check that the bill series has no unexplained gaps.
- Compare monthly sales by tax rate against what you will report.
- List every refund and Void, with its reason.
- Send the reports to your CA early, not on the last day.

**What software can and can't do**
Good software calculates tax consistently, shows it by rate, never lets a paid bill be rewritten and keeps a reason with every correction. That removes a lot of the small slips above. It doesn't decide your rates or file your return — those remain decisions for you and your CA. Nexus, for instance, calculates GST per line and groups it by rate in reports, but does not file returns or generate e-invoices.

**The takeaway**
Most GST pain is not about knowing a secret rule. It is about consistency: the same rate, the same rounding, the same numbering and the same honesty with corrections, every day. Build the habit, and filing becomes an afternoon rather than an ordeal.

---

## 15. Final CTA banner (Ink block with 1px green top edge)
**Eyebrow:** `READY TO CLOSE THE NIGHT WITH ONE TRUTH?`
**Headline:** Let your next Saturday end with numbers that agree.
**Body:** Register your restaurant today. We'll reply within one working day with your plan, your payment link and a date to set up your Business Workspace.
**Primary CTA:** Register your restaurant
**Secondary CTA:** Book a live demo
**Fine print:** 14-day money-back guarantee · Prices exclude 18% GST · Founding Restaurants offer until 31 Jan 2027.

---

## 16. Footer link set
**Brand block:** Manhar Nexus monogram + "A restaurant operations platform by Manhar Creatives." · *We Design, We Build, You Grow.*
**Columns**
- **Product:** Why Nexus (#why) · Platform (#platform) · How it works (#how) · Built for (#built-for) · Pricing (#pricing) · Insights (#insights) · FAQ (#faq)
- **Company:** About (#about) · Manhar Creatives (https://www.manharcreatives.com) · Contact (#register) · Book a demo (#register?begin=demo)
- **Legal:** Terms & Conditions (/terms) · Privacy Policy (/privacy) · Refund & Cancellation (/refund-cancellation) · Billing & Payments (/billing-payments) · Acceptable Use (/acceptable-use) · Data Processing Summary (/dpa)
- **Account:** Sign in (/login) · Register your restaurant (#register)
**Contact block:** Email info@manharcreatives.com · WhatsApp / Phone +91 97145 71522 · Sona Complex, A-252, Kansa Cross Road, Opp. Khodiyar Hotel, Visnagar, Mehsana, Gujarat 384315 *(from manharcreatives.com; confirm registered address)* · Working across Gujarat and remotely across India.
**Bottom bar:** © 2026 Manhar Creatives. Manhar Nexus is a product of Manhar Creatives. · Privacy · Terms · Refund & Cancellation · Billing · Sitemap
**Chip:** Onboarding new restaurants now — Founding Restaurants offer until 31 Jan 2027.
**Payments line:** Subscriptions are processed securely by Cashfree Payments. *(Do not show Cashfree's logo unless their brand rules/permission allow.)*

---

## 17. SEO

### 17.1 Home page (`/`)
| Item | Value |
|---|---|
| `<title>` (≤60; use "–" or "|" as separator) | Manhar Nexus – Restaurant Software for Indian Restaurants |
| Meta description (≤155) | Manhar Nexus joins floor, kitchen and Checkout in one workspace for Indian restaurants and cafés. Live KOS, GST by line, refunds with reasons. Prices in ₹. |
| Canonical | https://[DOMAIN]/ |
| Robots | index, follow |
| Language | en-IN (`<html lang="en-IN">`) |
| `theme-color` | #FFFFFF (light base) — not the old #070a09 |
| Primary keywords | restaurant software India, restaurant management software Gujarat, KOT/KOS kitchen display India, restaurant billing GST, café software, restaurant software pricing in INR |
| Secondary keywords | restaurant Checkout software, Service Request kitchen screen, restaurant refund and void audit trail, cloud restaurant software India, restaurant software for cafés and bakeries |
| H1 | Every table, every ticket, every rupee — accounted for. |
| OG title | Manhar Nexus — every table, every ticket, every rupee accounted for |
| OG description | A calm restaurant operations platform from Manhar Creatives, Visnagar. Live kitchen screen, GST by line, refunds with reasons and a tamper-checkable Activity History. |
| OG type / url / locale | website · https://[DOMAIN]/ · en_IN |
| OG image | https://[DOMAIN]/landing/og-1200x630.png (1200×630, **new Brand v2 image — the existing og.png uses banned #22c55e**), alt: "Manhar Nexus: a restaurant pass at dusk with tickets lined up." |
| Twitter | summary_large_image · same title/description/image |

### 17.2 Per-page titles and descriptions
| Route | Title | Meta description |
|---|---|---|
| `/` | (above) | (above) |
| `/terms` | Terms & Conditions – Manhar Nexus | The terms for using Manhar Nexus, the restaurant operations platform from Manhar Creatives. Plans, data, cancellation and governing law. |
| `/privacy` | Privacy Policy – Manhar Nexus | How Manhar Creatives handles personal data under India's IT Act and DPDP Act, and the roles of restaurants and Nexus. |
| `/refund-cancellation` | Refund & Cancellation Policy – Manhar Nexus | 14-day money-back guarantee, how to cancel, and what happens to your data. |
| `/billing-payments` | Billing & Payments Policy – Manhar Nexus | How Manhar Nexus subscriptions are billed: GST, UPI AutoPay, payment links, renewals and failed payments. |
| `/acceptable-use` | Acceptable Use Policy – Manhar Nexus | Rules for using Manhar Nexus responsibly. |
| `/dpa` | Data Processing Summary – Manhar Nexus | How Nexus processes personal data on behalf of restaurants. |
| `/blog/hidden-cost-of-order-mistakes` | The quiet cost of a wrong dish – Manhar Nexus Insights | What a wrong or mis-heard order really costs a restaurant in food, labour, time and goodwill. |
| `/blog/seven-numbers-restaurant-owners-read-nightly` | Seven numbers to read before you sleep – Manhar Nexus Insights | The seven numbers an Indian restaurant owner should check every night. |
| `/blog/why-the-bill-is-your-most-important-document` | Why the bill is your restaurant's most important document – Manhar Nexus Insights | A bill is a tax record, a promise and evidence. What a good one contains. |
| `/blog/qr-ordering-without-losing-the-human-touch` | QR ordering without losing the human touch – Manhar Nexus Insights | How to use QR menus in a restaurant and keep the warmth of hospitality. |
| `/blog/kitchen-ticket-psychology` | Kitchen ticket psychology – Manhar Nexus Insights | Why the oldest kitchen ticket should be the most visible and how to run a calmer kitchen. |
| `/blog/gst-invoicing-mistakes-restaurants` | GST invoicing mistakes restaurants make – Manhar Nexus Insights | Eight common GST invoicing slips in restaurants. General information only. |
(Anchor sections on the home page are not separate URLs; blog posts should be real routes or crawlable anchors with their own canonical.)

### 17.3 JSON-LD — paste into `index.html` (replace `[DOMAIN]`; logo URL pending a supplied logo file)
Rules followed: no `aggregateRating` or `review` (none exist); prices are ex-GST (`valueAddedTaxIncluded: false`); FAQ text is identical to visible FAQ.

**Organization**
```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Manhar Creatives",
  "alternateName": "Manhar Nexus",
  "url": "https://www.manharcreatives.com",
  "logo": "https://[DOMAIN]/landing/logo-[CONFIRM].png",
  "slogan": "We Design, We Build, You Grow.",
  "email": "info@manharcreatives.com",
  "telephone": "+91-97145-71522",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "Sona Complex, A-252, Kansa Cross Road, Opp. Khodiyar Hotel",
    "addressLocality": "Visnagar",
    "addressRegion": "Gujarat",
    "postalCode": "384315",
    "addressCountry": "IN"
  },
  "contactPoint": [
    {
      "@type": "ContactPoint",
      "contactType": "sales",
      "telephone": "+91-97145-71522",
      "email": "info@manharcreatives.com",
      "areaServed": "IN",
      "availableLanguage": [
        "English",
        "Hindi",
        "Gujarati"
      ]
    }
  ],
  "sameAs": [
    "https://www.linkedin.com/company/manhar-creatives/",
    "https://www.instagram.com/manhar.creatives"
  ]
}
```

**SoftwareApplication (with offers)**
```json
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Manhar Nexus",
  "applicationCategory": "BusinessApplication",
  "applicationSubCategory": "Restaurant management software",
  "operatingSystem": "Web browser (Chrome, Edge, Safari, Firefox)",
  "description": "Restaurant operations platform for Indian restaurants and cafés: dining tables, Service Requests, a live Kitchen Operations Screen, Checkout with GST, refunds and Voids with reasons, reports, operating costs and a verifiable Activity History.",
  "url": "https://[DOMAIN]/",
  "inLanguage": "en-IN",
  "publisher": {
    "@type": "Organization",
    "name": "Manhar Creatives",
    "url": "https://www.manharcreatives.com"
  },
  "offers": [
    {
      "@type": "Offer",
      "name": "Counter - monthly",
      "description": "1 outlet, up to 5 staff logins. Price excludes 18% GST.",
      "price": "599",
      "priceCurrency": "INR",
      "availability": "https://schema.org/InStock",
      "url": "https://[DOMAIN]/#pricing",
      "priceSpecification": {
        "@type": "UnitPriceSpecification",
        "price": 599,
        "priceCurrency": "INR",
        "billingDuration": "P1M",
        "unitCode": "MON",
        "valueAddedTaxIncluded": false
      }
    },
    {
      "@type": "Offer",
      "name": "Counter - yearly",
      "description": "1 outlet, up to 5 staff logins. 2 months free. Price excludes 18% GST.",
      "price": "5990",
      "priceCurrency": "INR",
      "availability": "https://schema.org/InStock",
      "url": "https://[DOMAIN]/#pricing",
      "priceSpecification": {
        "@type": "UnitPriceSpecification",
        "price": 5990,
        "priceCurrency": "INR",
        "billingDuration": "P1Y",
        "unitCode": "ANN",
        "valueAddedTaxIncluded": false
      }
    },
    {
      "@type": "Offer",
      "name": "Floor - monthly",
      "description": "1 outlet, up to 15 staff logins, Operating Costs, Alerts rules. Price excludes 18% GST.",
      "price": "1299",
      "priceCurrency": "INR",
      "availability": "https://schema.org/InStock",
      "url": "https://[DOMAIN]/#pricing",
      "priceSpecification": {
        "@type": "UnitPriceSpecification",
        "price": 1299,
        "priceCurrency": "INR",
        "billingDuration": "P1M",
        "unitCode": "MON",
        "valueAddedTaxIncluded": false
      }
    },
    {
      "@type": "Offer",
      "name": "Floor - yearly",
      "description": "1 outlet, up to 15 staff logins, Operating Costs, Alerts rules. 2 months free. Price excludes 18% GST.",
      "price": "12990",
      "priceCurrency": "INR",
      "availability": "https://schema.org/InStock",
      "url": "https://[DOMAIN]/#pricing",
      "priceSpecification": {
        "@type": "UnitPriceSpecification",
        "price": 12990,
        "priceCurrency": "INR",
        "billingDuration": "P1Y",
        "unitCode": "ANN",
        "valueAddedTaxIncluded": false
      }
    },
    {
      "@type": "Offer",
      "name": "Pass - monthly",
      "description": "Up to 3 outlets, up to 40 staff logins, priority support. Price excludes 18% GST.",
      "price": "2499",
      "priceCurrency": "INR",
      "availability": "https://schema.org/InStock",
      "url": "https://[DOMAIN]/#pricing",
      "priceSpecification": {
        "@type": "UnitPriceSpecification",
        "price": 2499,
        "priceCurrency": "INR",
        "billingDuration": "P1M",
        "unitCode": "MON",
        "valueAddedTaxIncluded": false
      }
    },
    {
      "@type": "Offer",
      "name": "Pass - yearly",
      "description": "Up to 3 outlets, up to 40 staff logins, priority support. 2 months free. Price excludes 18% GST.",
      "price": "24990",
      "priceCurrency": "INR",
      "availability": "https://schema.org/InStock",
      "url": "https://[DOMAIN]/#pricing",
      "priceSpecification": {
        "@type": "UnitPriceSpecification",
        "price": 24990,
        "priceCurrency": "INR",
        "billingDuration": "P1Y",
        "unitCode": "ANN",
        "valueAddedTaxIncluded": false
      }
    }
  ]
}
```

**FAQPage** (generated from §13)
```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "How long does it take to get started?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "We create your Business Workspace by hand, and our target is within one working day of payment. Entering your menu and drawing your tables takes anything from a few hours to a few days, depending on the size of your menu — you can do it yourself, or we can do it for you with a Launch Pack. We stay available for your first service."
      }
    },
    {
      "@type": "Question",
      "name": "What hardware do I need? Do you support printers?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Nexus runs in a web browser, so any phone, tablet or computer with a modern browser and internet works, including for the Kitchen Operations Screen. Receipt and kitchen-ticket printing through a local print agent is being validated with real printers and is coming soon; today you can print reports from your browser. We will tell you honestly before you pay if your setup needs something that isn't ready."
      }
    },
    {
      "@type": "Question",
      "name": "What happens if the internet drops?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Nexus needs an internet connection and is not an offline billing system. Screens show when they are reconnecting, repeated taps and retries are recognised so you do not get duplicate Service Requests or payments, and everything re-syncs when the connection returns. For a long outage, keep a paper pad for kitchen slips and enter them later."
      }
    },
    {
      "@type": "Question",
      "name": "Who owns my data?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "You do. Menus, tables, Service Requests, Checkouts, reports and staff details in your Business Workspace belong to your business. You can download reports as CSV at any time, and when you leave we give you a 30-day window to export your data before it is deleted. We do not sell your data or your guests' data."
      }
    },
    {
      "@type": "Question",
      "name": "How does GST work in Nexus?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "You set tax categories and rates; Nexus calculates GST on the server for every line, groups it by rate on the Checkout and shows it in your reports. Prices are tax-exclusive today. Nexus does not file returns or generate e-invoices — it gives you accurate figures to hand to your accountant. This is general information, not tax advice; please confirm your rates with your CA."
      }
    },
    {
      "@type": "Question",
      "name": "Can I run more than one outlet?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes, in a basic way. One login can work across locations, with a location switcher and roles scoped per location. Our team creates the locations with you. Central menu management and cross-outlet comparison are not built yet — if you run four or more outlets, choose \"Many Doors\" and tell us what you need."
      }
    },
    {
      "@type": "Question",
      "name": "Is there a free trial?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "There's no instant self-serve trial, because we set each Workspace up by hand. Instead you can book a free live demo, ask for a 14-day pilot (we'll have a short call first), or pay and use the 14-day money-back guarantee, counted from the day your Workspace is activated."
      }
    },
    {
      "@type": "Question",
      "name": "Can I cancel? What happens to my data?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes. Monthly plans can be cancelled any time and run to the end of the paid month. Yearly plans run to the end of the term and do not renew. After your subscription ends you have 30 days to export your data; then it is deleted from our live systems, and encrypted backups roll off as they expire. See the Refund & Cancellation Policy for details."
      }
    },
    {
      "@type": "Question",
      "name": "Are there hidden fees?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "No. Prices are written on this page and exclude 18% GST. One-time onboarding fees (Launch Pack ₹3,499, or à la carte) and add-ons (extra outlet, extra staff logins, premium support) are listed with their prices. Nexus does not take a cut of your sales. Payment-gateway charges on your guests' payments don't apply today because Nexus only records cash and UPI payments you receive directly."
      }
    },
    {
      "@type": "Question",
      "name": "How do I pay, and what if a payment fails?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yearly plans are paid once by UPI, card or net banking through a secure Cashfree payment link, and we remind you before renewal — nothing is debited automatically. Monthly plans use UPI AutoPay (your bank notifies you 24 hours before each debit and you can revoke it any time). If a payment fails you get a reminder and a payment link, a 7-day grace period with full service, then a limited mode while you sort it out."
      }
    },
    {
      "@type": "Question",
      "name": "What is the refund policy?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Within 14 days of your Workspace being activated, you can ask for a full refund of your first subscription payment — no reasons needed. After that, monthly plans stop at the end of the month and yearly plans are non-refundable except where we fail to deliver, a feature you paid for is withdrawn, or you were charged in error. Onboarding fees are refundable before work starts."
      }
    },
    {
      "@type": "Question",
      "name": "How secure is Nexus?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Each restaurant's data is separated from every other restaurant's, staff only see what their role allows, passwords are stored as one-way hashes with lockout after repeated failures, paid Checkouts can't be edited, and Activity History can be verified for tampering. Nexus hasn't had an external penetration test or formal certification yet, and no system is perfectly secure. We will share hosting and backup details before you pay."
      }
    },
    {
      "@type": "Question",
      "name": "What support do I get, and in which languages?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Every plan includes email support in business hours; Floor adds WhatsApp; Pass adds a priority queue and a named contact. We don't promise response-time guarantees we can't prove yet. The screens are in English today; Gujarati and Hindi are planned. [Owner: add which languages your support team can offer, e.g. Gujarati, Hindi, English — only if true.]"
      }
    },
    {
      "@type": "Question",
      "name": "Can I move over from my current billing software?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes for your menu: send us your menu in Excel, PDF or even photos and we'll enter it with the menu-upload service. We don't import your past sales history at launch, so keep exporting from your old system for your records, and run both side by side for a few days if you like."
      }
    },
    {
      "@type": "Question",
      "name": "Which payments can I take at Checkout?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Cash, with the amount tendered and change due calculated for you, and UPI, where your staff confirm the payment using the transaction reference. Card payments, online payment links and discounts are coming soon. You remain responsible for confirming that UPI money has actually arrived."
      }
    },
    {
      "@type": "Question",
      "name": "Who is Manhar Creatives, and is Nexus ready?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Manhar Creatives is a design and software studio in Visnagar, Gujarat that builds brand systems, websites and custom software. Nexus is our restaurant product. It is built, tested and ready for pilots, but it hasn't yet run many restaurants, which is why we're opening to Founding Restaurants first and setting each up by hand. We'd rather say that plainly than invent customers."
      }
    }
  ]
}
```

### 17.4 Technical SEO notes for the developer
- Replace `robots.txt` (`Disallow: /` today) and add `sitemap.xml` (01 §7 R1–R3). Sitemap URLs: `/`, legal pages, blog posts.
- The page is client-rendered; consider a prerendered snapshot for social scrapers (01 R4).
- One `<h1>` only (hero). Sections use `<h2>`, cards `<h3>`.
- Add `width`/`height` to images, descriptive `alt` (decorative → `alt=""`), lazy-load below the fold.
- Add `rel="canonical"` per route via the `useDocumentMeta` hook.

---

## 18. Copy QA checklist (self-review against the brief)
- [x] One accent word per headline; no neon/gradient claims.
- [x] Every product claim maps to a LIVE row in 01 §3.1; printing, bookings, QR, cards, discounts, stock, WhatsApp, Gujarati labelled "coming soon" or "not yet".
- [x] No customer counts, logos, testimonials, awards, ratings, latency/uptime numbers, "offline", "bank-grade", certifications.
- [x] Prices match 03b; GST stated; founding offer time-boxed with date and no scarcity count.
- [x] Placeholders: [DOMAIN], logo URL, owner-confirmation notes (About paragraph, support languages).
- [x] Blog articles 450–700 words; tax content flagged as general information.
- [ ] Owner to confirm contact data, address, support hours/WhatsApp channel, founder signature.
