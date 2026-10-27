# Design & Feel Critique Log

Reviewer: independent, adversarial, read-only. Evidence: 35 screenshots in `screens/design-after/` (read in full), a sample of `design-before/` (home, kitchen), and the four builder docs. Nothing here is marked resolved. Status of every item: **Open**.

Limits of this review: stills only. I cannot judge motion (stamp landing, digit rise, ticket arrival), hover states, real touch ergonomics, or live data behaviour. 768/1024 coverage is only the two `t-` shots. Mobile coverage is 8 of 12 routes (no m- shot of bill detail, session, order builder, checkout, onboarding, commercial). Several screens I was asked to judge have no screenshot at all: **bill detail** (no desktop or mobile shot), **empty states** (only one, the "No orders yet" pad), **onboarding go-live and commercial dialogs** (QA_REPORT itself admits they were never driven). `design-before/` is not an original baseline (the "before" home already has the serif/ember direction, and QA_REPORT says before-shots were never captured), so the before/after contrast is weaker than the folder name implies.

---

# 1. Overall verdict against the owner's bar

**Honest read: "Strong, warm, considered, and still a tidy admin app."** It has a real identity on two screens (login, kitchen) and a competent house style everywhere else. It is clearly better than default shadcn/Tailwind and has no "template smell" in the type. But the owner's bar is "this looks expensive / custom", Awwwards-level. Most of the product is the same recipe: cream page, white bordered card, serif H1 with a small ember tick, form fields in a bordered box, a table. The signature moves are concentrated on a handful of screens and mostly absent from the ones a buyer will open most (Bills, Costs, Activity, Settings, Team, Modules, Platform). The first thing a 3-person panel would say is "nice, clean, warm", which is exactly the reaction the owner said is a fail.

- **5-second test: Pass on login only.** The login (ink ledger-ruled panel, big Fraunces headline with italic ember "report.", tilted PAID receipt) says "custom product" instantly. Post-login, the 5-second read is "tasteful cream dashboard"; the home hero figure is strong, but everything around it is conventional. Verdict: partial pass.
- **5-minute test: Partial pass, undermined by demo data.** The flow is learnable and the golden path (floor, order, kitchen, checkout, PAID) is coherent. But the data on the screens contradicts "I know what to do and it feels good": the home headline shows a red "Down ₹34,577.90 (-76.1%)" (partial day vs a full day, designed to alarm), tables are "occupied 46h 42m", kitchen tickets are "45 h 7 min" late, and the kitchen "Late" banner says a ticket has waited 45 hours. A buyer sees a broken restaurant. This is seed staleness, not design, but it is in every hero screenshot, so it is a sales defect.
- **5-day test (trust for a full shift): Cannot fully pass from stills, and several things argue against.** Positives: big touch-sized kitchen actions, clear status words, change-given cash flow. Negatives: Refresh buttons on a floor and kitchen that "refresh every 15 s" (polling, not live), checkout offers only Cash and UPI (card removed), no business/location switcher, platform screens are full of test fixtures, settings page exposes raw keys.
- **Likely 3-person reaction:** (1) "Looks clean and classy, kind of editorial. Is it Notion-ish?" (2) "The login and the kitchen tickets are lovely. The rest looks like a nice back-office." (3) "Why does it say a table's been open 46 hours?" Not one says "this looks expensive". Nobody says "I have never seen a POS like this" except possibly for the login and ticket screens.

Ratings count (30 screens/moments rated, 2 with no evidence): Award-grade 0, Strong 11, Competent-but-forgettable 10, Generic 7, Broken 2 (see section 8).

---

# 2. The 10 highest-impact fixes (sales impact x effort, best ratio first)

1. **Fix the demo data clock** (tables "46h ago", tickets "45 h 7 min" late, "Running late" banner, "Down 76.1%"). Seed sessions/tickets relative to now, and add a time-of-day-fair comparison (same hour last Tuesday) or drop the red delta before ~6pm. Every hero screenshot is currently sabotaged by this. Effort: low. Impact: highest.
2. **Fix the 1024px table tile overflow** (`t-tables.png`): "OCCUPIED" and "AVAILABLE" labels run past the right edge of the tiles (R1, R2, T2, T3). A visible layout bug on the screen the owner calls the floor. Stack label under the number below ~1100px or shrink the tile label. Effort: low.
3. **Make the home headline not alarming** and give Home a second focal element. Today it is the hero figure plus a sidebar-like "Right now" column plus a muted chart. Colour the 7-day bars with the ember day-of-week highlight already used for Tue, but also add the in-progress "today so far" projection. Effort: low-medium.
4. **Carry the signature moves to the dull screens** (Bills, Costs, Activity, Settings, Team, Modules, Commercial, Onboarding): at minimum a LedgerFigure summary strip at the top of Bills ("13 paid, ₹10,866.50"), Costs ("₹1,98,800 awaiting approval"), Team (head count by role), Modules (3 of 7 active). Right now these pages open with a filter form, which is the least inviting thing possible. Effort: medium. Impact: high, this is what moves "forgettable" to "custom".
5. **Redo Bills as a ledger, not a table** (`d-bills.png`): mixed bill-number formats ("376", "RV-0307") look like bad data, the "Open" button repeats 20 times, and the date filter inputs show raw "dd-mm-yyyy". Use a ticket-stub row, date headings ("Today", "Yesterday"), one tap target per row, and right-aligned ledger totals. Effort: medium.
6. **Remove all test fixtures from platform screens** (`p-commercial`, `p-onboarding`: "OnboardTestBiz2 mvnwggky", "P11A BizB mvnwglcc", 50 clients, all "Prospect", 0 locations, unassigned). This is what a prospect-facing demo of the vendor's own admin looks like and it screams "dev database". Seed 6 to 8 realistic clients with varied status. Effort: low.
7. **Give Platform Home content** (`p-home.png`): a greeting and one sentence, then 800px of nothing. "Your dashboard fills in as your role gets access" is an apology. Show client count, onboarding in progress, modules requested. Effort: low-medium.
8. **Settings: stop showing config keys** (`d-config.png`): "Display locale (BCP-47 language tag)", `locale`, `rounding_mode`, "Monetary rounding mode applied at defined points (ADR-015)". An ADR reference in owner UI is the most "built by engineers for engineers" moment in the product. Group, humanise ("Date format: 27/10/2026"), hide internals behind "Advanced". Effort: medium.
9. **Order builder: make it feel like a menu, not a list** (`f-3`): no prices alignment, no photos/colour chips, inconsistent affordance ("Choose" outlined button vs ember "+" square), categories as thin text tabs, no running cart on screen except a "0 items ₹0" footer. For the busiest screen in service this is the weakest hero. Use a two-pane layout (menu grid left, ticket-in-progress right using the stub style), large tap targets, ember count badges. Effort: medium-high, worth it.
10. **Add one memorable "motion + sound of money" payoff** you can screenshot or screen-record: the PAID stamp already exists; make the floor tile for that table visibly flip from ember-edged to clean on close, and let the home hero figure tick up. Currently `f-7-paid-early.png` and `f-8-paid.png` are byte-identical, so the "stamp lands" claim is not even evidenced. Effort: low-medium.

---

# 3. Signature-move audit

| Claimed move | Where actually visible | Verdict |
|---|---|---|
| Ledger figure (raised currency, raised minor units, rule) | Login receipt, Home hero + 2 KPIs + approvals, Reports hero + 5 KPIs, checkout total, paid state, order builder footer | **Real and repeated, the best move.** Reads as Fraunces-on-cream finance, memorable. Missing on Bills, Costs, Team, Platform. |
| Ticket stub (perforation, tear line, notches, mono ticket no) | Login receipt, kitchen tickets, session order rounds, checkout bill | **Real, on the four screens that are about tickets.** Not carried to Bills (where a receipt/ticket is the obvious metaphor). Notches are tiny (half-moons at ~6px) and invisible at a glance in tables. |
| Stamp (PAID) | Login hero, checkout paid state | **Only 2 appearances**, and the claimed second use "waiting for pickup" is a dashed outline check, not a stamp. Bills "Paid" is a plain pill, a missed chance. The landing animation is unprovable from stills. |
| Table tile (ember top edge, occupancy meter, status in text) | Floor only | **Real but undercooked.** Tiles are small, 4 per row on 1440 leaving a dead right third, meter is a 2px line. At 1024 the status text overflows. The "hatched cleaning" state is not in any screenshot. |
| Ember tick under headings | Every page | **Over-repeated to the point of becoming wallpaper**; it is the only decoration on ~15 pages. It is a tell of a design system, not a signature. |
| Monogram (notched N tile) | Header, favicon, login | Good, small, consistent. |
| New-ticket arrival | Not evidenced | Cannot judge from stills. |

Net: 2 real signature moves (ledger figure, ticket stub), 1 half-delivered (stamp), 1 half-delivered (tile), 1 wallpaper (tick). "Unmistakably ours" holds on ~8 of ~27 screens.

---

# 4. Inconsistencies between screens

- **Page header hierarchy**: Home has an eyebrow date + greeting + action buttons; every other page has H1 + grey subtitle + tick. Home is the only page with a button row in the header; Tables/Kitchen put only a lone "Refresh" there (low value as the primary header action).
- **Page-top density**: Tables/Kitchen/Reports titles start at y=90; Modules/Commercial subtitles wrap to two lines and push content down 20px, so the tick line sits at a different Y on different pages.
- **Money**: Home/Reports use raised-minor ledger figures; Bills, Costs, session dialog use plain `₹763.70`, `₹310.00`. Reasonable (tables vs hero) but the session dialog's `₹310.00` next to a checkout `₹325.50`... see Checkout defect.
- **Bill numbers**: `376` and `RV-0307` in the same list (Bills). Two numbering schemes visible to the owner.
- **Date formats**: Bills `27/10/2026, 3:45:21 pm`; Costs `25 Oct 2026`; Activity `27 Oct 2026, 04:12 pm`; Modules `10/25/2026` (US order, in an app whose own date setting is dd/MM/yyyy); filters show `dd-mm-yyyy`. Four formats on four pages. The Modules one is wrong for the locale.
- **Buttons**: Primary ember in headers (Add person) but "Refresh" is a white outlined button where "Approve/Reject" in Costs are bare text links with no affordance. Row action is a bordered "Open"/"Manage"/"Change" button in some tables and a text link ("Details") in Activity.
- **Cards**: Settings uses a bordered card per setting (13+ stacked identical cards), Modules does the same. This is the "generic card list" pattern the owner named as an auto-fail.
- **Selects**: Native OS `<select>` (Status, Category, Location) next to custom styled inputs; they look browser-default. The "Select" placeholder also appears as a value.
- **Table list vs card list**: onboarding uses full-width card rows with progress bars, commercial uses a table, Team a table. No stated rule.
- **Mobile nav**: hamburger + logo + location + search + "Alerts" all in a 390px header; location text truncates ("All locati...", "THE PILOT KIT...") on every mobile screen.
- **Login**: desktop = split ink/paper, mobile = plain cream form with no ink panel, no receipt, no headline: the memorable part disappears at 390 (see Login mobile).

---

# 5. Screen-by-screen

Rating key: Award-grade / Strong / Competent-but-forgettable / Generic / Broken.

## 5.1 Login (1440) — `d-login.png`
**Feel verdict: Strong.** The best frame in the product: ink panel with ledger rules, serif headline with an italic ember "report.", a tilted PAID receipt that tells the story before any copy. A designer would screenshot this. Not award-grade because the right half is an ordinary form floating in cream with a lot of dead air, and the receipt is cramped into the bottom with its PAID stamp overlapping the total label.
Defects:
- Right panel: form is ~385px wide, vertically centred in 900px with ~270px empty above and below, and the paper side has nothing but the form. The two halves have no relationship (no shared rule line, no ticket continuing across the seam). Fix: let the receipt overlap the seam (negative margin, cross into the paper side), or add a quiet footer (version, support, status) at the bottom of the paper side.
- Receipt: the PAID stamp collides with the "TOTAL" label (`TOTAL` partially hidden under the stamp at ~x=430,y=805). Fix: move the stamp up-right, over the figure's top-right, as a real stamp would sit.
- Receipt line items are 13px grey; the mono "No. 0347" is tiny. At the hero position, the receipt should be ~20% larger.
- Empty fields show no focus ring or placeholder in the capture, so the form looks unfinished; "Sign in" has no keyboard hint.
- Hero copy "One calm place to run the floor, the kitchen and the books." is generic marketing text; "calm" is the one word every competitor uses. Fix: something concrete ("Open at 11. Closed by 11:05.").
Status: Open.

## 5.2 Login (390) — `m-login.png`
**Feel verdict: Generic.** The entire signature (ink panel, headline, receipt) vanishes; what remains is a logo, a heading and two fields on beige. This is exactly the "beige safe design with no opinion" case, on the screen a buyer opens first on their phone.
Defects:
- No ink area, no receipt, no headline. Fix: keep a ~220px ink header with the monogram and the headline, and let the form card overlap it.
- 150px of empty space top and bottom; the form is not anchored.
Status: Open.

## 5.3 Home dashboard (1440) — `d-home.png`
**Feel verdict: Strong.** The only screen with a real focal point: a huge Fraunces ₹10,866.50 with a hairline rule, quiet KPIs, a "Right now" rail with big serif numerals. It feels like a morning briefing and is the closest to "expensive". It is then undercut by an alarming red delta, mis-timed demo data and a flat chart.
Defects:
- Delta line: "↓ Down ₹34,577.90 (-76.1%) vs last Tuesday (₹45,444.40)" in red on the hero. It compares a partial day to a full day (the fine print admits it). This makes a healthy morning read like a disaster, and teaches the owner to distrust the number. Fix: compare against the same time-of-day last Tuesday ("vs ₹X by 4 pm last Tuesday") or show neutral grey until the day is ≥80% over.
- "Right now" rail: "oldest 45 h 7 min", "Running late: a ticket has waited over 20 minutes", tables "7 / 13". Stale seed. See Fix 1.
- Toggle "Last Tuesday / Yesterday" is a segmented control with a black active chip that is the heaviest element on the screen (the near-black pill pulls the eye away from the figure). Make it a text toggle.
- Chart: 7 bars in beige-grey, y-axis "Net Revenue (INR)" label, "Show as table" at the bottom. Bars are all the same weight, only Tuesday is ember and tiny. The chart is correct but mute; no labels on values, no hover affordance visible. It reads "chart-kit default". Fix: label the max and today directly on the bars, drop the gridlines to 2, make the bar width 40% narrower with a 7-day average line.
- Header action row ("Seat a table / Bills / Kitchen / Record expense / Reports") sits right beside the H1 at equal weight with 4 outlined white buttons; a classic "button strip". Only "Seat a table" is primary. Fix: keep two (Seat a table, Record expense), push the rest to the sidebar which already has them.
- Quick KPIs ("Paid bills 13", "Average bill ₹835.88") sit in a thin two-cell strip that is visually weaker than the Right-now rail, so the supporting data on the left is less loud than the secondary data on the right. Hierarchy partly inverted.
- Dead space: lower-left under the chart, ~150px; chart ends at y=800 and the page seems unfinished.
Status: Open.

## 5.3b Home (390) — `m-home.png`
**Feel verdict: Strong.** Degrades well: greeting, button wrap, the big figure holds, KPIs stay in the ledger strip. Better than most mobile dashboards.
Defects:
- The 5 quick-action buttons wrap to 3 rows and push the hero figure below the fold's mid-point. Fix: horizontally scroll one row or keep two buttons.
- Same red delta problem; at 390 the explanation paragraph is 4 lines before you see "Paid bills".
- Header: "THE PILOT KIT..." and "All locati..." truncated.
Status: Open.

## 5.4 Tables floor (1440) — `d-tables.png`
**Feel verdict: Competent-but-forgettable.** Warm, readable, status in text. But it is a grid of 14 identical cream cards in 4 columns. No focal point: a buyer cannot tell what needs attention (all three occupied tiles say 46h ago). It reads as "nice card grid", which the brief lists as an auto-fail shape ("generic icon+label card grids", minus the icons).
Defects:
- Tiles are 208x133 on a 1088px content width: the 4-column grid fills 868px, leaving 220px of empty right margin on every row; the floor does not use the space and tiles are smaller than a table-plan ought to be.
- No floor-plan feel at all; "Main Hall / River View / Garden" are headings over rows. A restaurant floor is spatial. Even a simple area-shaped grouping (cluster, differing tile widths by seat count: 2-top narrow, 6-top wide) would add personality and information. Fix: scale tile width to seat count and show seat pips.
- Occupancy meter is a 2px underline; the claimed "two-hour occupancy meter" is unreadable. Ember tint on every occupied tile with the same colour makes occupied tiles loud and available tiles recede, which is inverted for a host who wants to find a free table.
- Status text "OCCUPIED"/"AVAILABLE" in 11px tracking caps in the top-right is the lightest element on a tile whose job is status. Fix: larger status; and show a state that needs attention (food ready, bill requested) differently from "seated".
- Tab row "All areas / Main Hall / River View / Garden / Outdoor Terrace" duplicates the section headings directly below it.
- "Refresh" button as the page action for a floor view is a tell that it is not live.
Status: Open.

## 5.4b Tables (1024) — `t-tables.png`
**Feel verdict: Broken.** Visible layout defect: status labels overflow tiles.
Defects:
- "OCCUPIED" on T1/T3/T4 touches/clips at the tile's right edge; "AVAILABLE" on T2, R1, R2, R4 extends beyond the tile border (visible as text outside the card at x~573 on T2). Fix: wrap status under the table number below 1100px or reduce tracking and size.
- Four tiles at 1024 with right dead space again.
Status: Open.

## 5.4c Tables (390) — `m-tables.png`
**Feel verdict: Strong.** The best breakpoint for the floor: two columns of tiles at touch size, ember edge clear, status text fits. Cleaner than desktop.
Defects:
- Long strings "46h 43m ago" look absurd (stale seed) and wrap awkwardly.
- Tabs scroll off ("Garden", then cut) without a fade hint.
- "Refresh" wastes a full row above the first tile (60px of header chrome).
Status: Open.

## 5.5 Table session dialog — `f-1-open-dialog.png`, `f-2-session-empty.png`
**Feel verdict: Competent-but-forgettable.** Clean dialog, a pleasant line-art order pad, sensible primary action. It is a standard modal with a heading, an empty box and 3 buttons. The two files are identical (same frame), so the evidence is one state.
Defects:
- Modal sits on a blurred backdrop (blur on a service screen costs paint time and loses spatial context; the floor behind is the thing the waiter needs to remember).
- "Check out" is disabled (greyed) with no reason shown. Fix: tooltip/line "Nothing to bill yet".
- Heading "Table T3" and "2 guests - opened 7m ago" are small for a tablet dialog; the table name should be the 32px Fraunces used in the kitchen.
- A session is a ticket pad; it does not use the ticket stub for the dialog itself, only inside the order round (f-5).
Status: Open.

## 5.6 Session with orders — `f-5-session-orders.png`
**Feel verdict: Strong (for the round card).** The round card with "Round 1 · Ticket 4 · Ready", dotted leader line and notches is the right idea and charming at that scale.
Defects:
- Round card shows "1x Paneer Tikka ₹310.00" with no modifiers, so the waiter cannot see what they are serving (Full / Medium / Extra cheese shown in kitchen but not here).
- "Close session" is greyed and "Check out" is active though the order is only "Ready", not served; the line "Orders are still active. Wait until they are served or cancel them before closing" is correct but low contrast, 13px grey.
- The orders area says "Table T6" opened "46h 29m ago". Stale seed again.
- Primary "New order" is ember and focused; "Mark served" is ember too; two primary buttons compete in one dialog. Fix: "Mark served" should be the single primary when something is ready.
Status: Open.

## 5.7 Order builder — `f-3-order-builder.png`
**Feel verdict: Generic.** This is the screen a waiter spends most of service on and it looks like a plain list in a modal: name, price, button. It is functional but forgettable and the least "custom" screen in the golden path.
Defects:
- Two different row affordances: "Choose" (outlined) for items with options vs ember "+" square for simple items. Waiters have to read to know which behaviour they will get. Fix: one affordance, with a small "options" marker.
- Prices are under the name in grey; "from ₹200.00" vs "₹180.00" in the same 13px grey. No visual price column.
- Category tabs are thin text with a 2px ember underline in a modal; at tablet width these are small tap targets (~28px tall). The brief's own rule is 44px minimum.
- No running order: the footer says "0 ITEMS ₹0.00" and a disabled "Send to kitchen" in a washed-out ember. Once items are added you cannot see what you are building without leaving this dialog (the screenshots do not show a populated cart at all, so I cannot confirm there is one).
- The dialog is 670px wide in a 1440 viewport; for a menu of 30 items this is tiny. No search, no favourites, no keyboard shortcut hint.
- Items under "Main Course" are Butter Naan ₹40, Dal Makhani, Jeera Rice, which is a menu-data issue (breads under main) but visible.
Status: Open.

## 5.8 Item dialog (variants/modifiers) — `f-4-item-dialog.png`
**Feel verdict: Competent-but-forgettable.** Clear, well-structured: required vs optional marked in words, selected rows highlighted in sunken beige with an ember radio, price in the CTA. Good function; a stack of full-width outlined boxes is the default pattern.
Defects:
- Stacked dialog on dialog (item dialog over the order dialog over a blurred floor): three layers of depth, the item dialog's backdrop is the previous dialog, harder to read.
- The "Required" tag is grey 12px next to a bold label; a waiter missing it gets a disabled button without a clear reason (not shown).
- Selected state in beige (`#ECE5D8`) is close to the unselected white; selection is carried mostly by the ember radio dot. Fix: heavier border on selected.
- "-" quantity stepper is a faded disabled box at 1; it looks broken rather than disabled.
- Spice "Medium" is pre-selected on a required group; a pre-selected required choice can lead to wrong orders. Product decision, flag for the owner.
Status: Open.

## 5.9 Kitchen display (1440) — `d-kitchen.png`
**Feel verdict: Strong.** The most on-brief screen after login: perforated stubs, mono ticket numbers, 32px serif table names, quantity numerals, big ember action, status via stripe + word. A designer would screenshot this. It reads as paper tickets on a rail.
Defects:
- Ticket "Ready" cards put the elapsed time ("46 h 28 min") on the same line as the ticket number in black, while New/Preparing show it in red, below the number, in a different position. The ticket header layout is inconsistent between columns (`Ticket 4` vs `Ticket RV-K340`, time right vs below).
- Ticket "4" and "5" lack the RV-K prefix: two numbering schemes (seed artefact, visible).
- 45 h 7 min late in red and the "Late" pill; a 45-hour ticket looks like a bug (seed).
- The "Waiting for pickup" outline button looks like a button but is a status; a dashed-border button-shaped box on a screen where buttons mean "act" invites taps.
- "Accepted" column empty "None" gets full column width; on a 1440 display 1/4 of the screen is a dashed box. Collapse empty columns or show a quiet count only.
- Columns: the four column headers are ink-underlined; the count chips (1, 0, 1, 3) are the darkest elements and pull the eye to the counts rather than to the late ticket. Late tickets should dominate the rail (e.g. reorder, ember top edge).
- No audio/flash cue is shown (cannot judge from stills).
Status: Open.

## 5.9b Kitchen (1024) — `t-kitchen.png`
**Feel verdict: Strong.** Reflows to 2 columns without breaking; large action button. Good.
Defects: two-column wrap means "Preparing" and "Ready" fall under the fold at 1024, so a cook must scroll to see Ready; the kitchen's whole point is a rail at a glance. Fix: keep 4 compressed columns at 1024 or sticky column headers.
Status: Open.

## 5.9c Kitchen (390) — `m-kitchen.png`
**Feel verdict: Competent-but-forgettable.** Works as a stack; the ticket card is lovely. One column of stacked sections means "Accepted: None" dashed box before any other tickets.
Defects: empty "Accepted" section takes 100px before "Preparing"; no column jump/tab bar; a long scroll is bad for a phone used one-handed.
Status: Open.

## 5.10 Checkout — `f-6-checkout.png`
**Feel verdict: Strong.** The receipt stub with leader dots, tax lines, double-rule "TOTAL DUE ₹325.50" in a ledger figure is the right emotional moment and feels like a receipt being settled. Not award-grade because the payment controls below are generic.
Defects:
- Line item "Paneer Tikka ₹325.50" shows only "Full (8 pcs)" but the session dialog showed "₹310.00" for the same item, and the invoice line total equals subtotal plus tax (₹310 + ₹15.50), i.e. the line shows the tax-inclusive amount while the Subtotal row shows ₹310. A buyer will see "item ₹325.50, subtotal ₹310.00" on the same bill and think the math is wrong. Confirm and fix: the line should be ₹310.00. (The 709e7c2 "double-charging modifiers" commit suggests this area is fragile; the extra cheese +₹30 is also not itemised on the bill, so ₹280+30=₹310 cannot be reconstructed from the receipt.)
- Payment method as two big outlined toggles with a ● / ○ glyph; fine, but only Cash and UPI. Card removed (honest, but a restaurant buyer will ask "where's card" in the first minute).
- "Cash received" field pre-filled as a grey placeholder `325.50` (looks like a value, is a placeholder), no quick-tender chips (exact / 500 / 1000) which cash-handling staff need.
- Cancel is focused (white button with ember focus ring) and "Collect ₹325.50" is not: for a high-stakes action the default focus on Cancel is safe but makes Enter cancel the checkout; fine, but flagged.
- No discount, no tip, no split, no print/share receipt. For "trust for a full shift", split bills and discounts are unavoidable questions. I could not see these anywhere in the screenshots.
Status: Open.

## 5.11 Paid state — `f-7-paid-early.png`, `f-8-paid.png`
**Feel verdict: Strong.** The PAID rubber stamp, green tinted panel, "Payment received", ₹325.50 ledger figure and a toast: a real moment of delight, the single most "ours" interaction. A designer would screenshot it.
Defects:
- The two files are pixel-identical, so there is no evidence of the claimed 280ms landing; QA never shows the "early" frame.
- Stamp is relatively small (~145px) in a 575px panel and the "Payment received" headline is bigger than the stamp, so the stamp is a garnish. Make the stamp the hero, rotated, with a slight ink texture.
- The toast "Payment of ₹325.50 recorded" repeats the panel content directly above it (redundant).
- "Keep table open" vs "Close table": two buttons, one primary, fine. But "Keep table open" leaves a paid table in limbo; consider auto-close with undo.
- Backdrop shows the floor with T6 still "occupied" (expected).
Status: Open.

## 5.12 Bills list (1440) — `d-bills.png`
**Feel verdict: Generic.** A filter box and a table. Not custom, not premium; a template list view. This is where the "ticket stub / ledger" idea should pay off most (a bill is literally a receipt) and it is unused.
Defects:
- Page begins with a large filter card (Status, From date, To date, Today / Last 7 days / This month) that takes 170px before any bill is visible. Put the totals first.
- Bill number formats mixed: `376`, `RV-0307`, `375`, `RV-0306`. Looks like bad data.
- "Open" outlined button repeated on every row: row noise; make the entire row the target and show a chevron.
- Native date inputs showing `dd-mm-yyyy` placeholder text, native `<select>` "All bills".
- Timestamps `27/10/2026, 3:45:21 pm` including seconds. Nobody needs seconds on a bill list.
- Status pill "Paid" is the same tiny green pill as everywhere; the PAID stamp motif is missing.
- No row totals/footer, no sum of the filtered list (the owner's first question).
Status: Open.

## 5.12b Bills (390) — `m-bills.png`
**Feel verdict: Competent-but-forgettable.** Works; table collapses to 4 columns with the "Paid at/Paid with" columns hidden or scrolled (cannot confirm; the table is cut off at the right edge of the card at "STATUS").
Defects: the filter form takes 320px before the first bill; table horizontally scrolls, no action column is visible, so a row cannot be opened without scrolling sideways (the "Open" button is off-screen).
Status: Open.

## 5.13 Bill detail
**Feel verdict: Cannot judge.** No screenshot of the bill detail exists in `design-after/` (and none among the f- shots). It was one of the screens the brief expected. Refund/void is the highest-risk workflow in the product (money) and has no visual evidence. QA_REPORT says the refund was not submitted in the browser. I will not guess.
Status: Open (evidence missing).

## 5.14 Reports (1440) — `d-reports.png`
**Feel verdict: Strong.** "A page of the ledger" holds: serif hero ₹10,866.50 with a rule, two supporting figures separated by hairlines, then a five-cell KPI row and clean tables. The best data page.
Defects:
- Date control is boxed in a card with 5 buttons (Today, Yesterday, Refresh, Export CSV, Print). It is the most "form-like" element on the page and sits above the hero.
- No chart on the Daily Closing page, the page whose job is "how did the day go". Sales Summary / Top items tabs presumably have more but are not screenshotted.
- Hero figure left, two KPIs right: the right side figures (13, 14) are small and far from the hero; the 2/3 : 1/3 split leaves a wide dead gap.
- 5-cell KPI row is evenly weighted with identical type size: Gross, Tax, Total revenue (equals the hero again, ₹10,866.50), Refunded, Voided. "Total revenue" repeats the hero figure. Redundant.
- "Net revenue" (hero) equals "Total revenue" (card): two names for one number will confuse an owner.
- Print: not evidenced.
Status: Open.

## 5.14b Reports (390) — `m-reports.png`
**Feel verdict: Strong.** The ledger figure scales down beautifully and the KPI cards stack as a list. A good mobile.
Defects: five action buttons take 3 rows in the filter card before the figure.
Status: Open.

## 5.15 Costs (1440) — `d-costs.png`
**Feel verdict: Generic.** A form card on top and a table beneath: the textbook admin screen. Nothing says "restaurant" or "ours".
Defects:
- The first thing seen is an empty "Record expense" form (7 fields), not the money story: ₹1,98,800 pending approval (that figure is on Home as a big ledger figure but absent here).
- Native selects ("Select", "Select"); "Amount (INR)" label; "Optional" helper on Vendor and Description eats vertical space.
- Table: header checkbox plus per-row checkbox, but the second row (Approved) has no checkbox, which breaks the column alignment; "Approve / Reject" are bare text links, "Reject" is not red; no confirm of what Approve does to the record.
- "Show: All" select floating on the page background between two cards.
- Pending expenses ₹29,400 / ₹42,000 labelled "Staff payroll" with vendor "Staff payroll": category and vendor are the same string (demo content).
Status: Open.

## 5.16 Activity history (1440) — `d-activity.png`
**Feel verdict: Competent-but-forgettable.** The "Log integrity / Verify log" idea (hash-chained audit) is a real differentiator, but it is presented as a grey helper card with a small neutral pill "Not verified in this session". The unique selling point looks like boilerplate.
Defects:
- Raw machine strings in the action column: `payment.initiated`, `guest_session.opened`, `service_request.preparation_started`, resource `service_request` + `12161594-f6b9-456e-b160...` UUID. An owner does not read this. Humanise: "Demo Kitchen started preparing T6 ticket", with the technical string behind Details.
- Filter inputs: "For example, invoice.paid" placeholder exposes the dev vocabulary again.
- Filters take 170px before any row; again the table is below the fold's middle.
- Sequence number column `#` header with tiny grey numbers, no meaning for the user.
- The entry list is a plain table; this is the one screen where a vertical timeline (hairline + ticks, matching the heading flourish) would carry the brand.
Status: Open.

## 5.17 Settings — `d-config.png`
**Feel verdict: Generic.** A stack of identical bordered cards, each with a developer description, a code key and a "Change" button. This is the "card grid" pattern with an engineering vocabulary; there is no way to get "premium" out of "Monetary rounding mode applied at defined points (ADR-015)".
Defects:
- Copy leaks internals: "Display locale (BCP-47 language tag)", `locale`, `date_format`, "ADR-015". Fix: "Language", "Date format", hide keys.
- Every setting is a full-width 130px card; 13+ settings = a very long page and nothing prioritised. Group into 4 to 5 sections with inline controls.
- "Built-in default" pill on every card, repeated: noise; show only when overridden.
- "How settings are chosen" explainer is a card that sits at the top of the page and is the first thing read.
- Value "en", "dd/MM/yyyy", "24h": raw format strings instead of showing an example ("27/10/2026", "16:12").
Status: Open.

## 5.18 Modules — `d-modules.png`, `m-modules.png`
**Feel verdict: Competent-but-forgettable.** A clear stacked list with Active pills, dependency lines ("Needs: Restaurant Operations (Already on)") and Switch off. Honest and readable, but it is the "card grid" in list form and it is the screen that should sell the platform (module upsell).
Defects:
- "Switch off" is the primary action repeated on every active module, which invites accidental damage on the highest-impact toggle in the product (turning off Checkout). It is a plain outlined button; no confirm is evidenced.
- Nothing is a toggle, status chips and buttons both say the state.
- Dates `Active since 10/25/2026` in US order while the app locale is dd/MM.
- No pricing, no "what you unlock", no inactive/available modules visible in the shot (below the fold), so the commercial story is invisible. A buyer wants to see "Add Inventory, Loyalty, Reservations".
- Mobile: same cards, same defects; fine.
Status: Open.

## 5.19 Team — `d-team.png`
**Feel verdict: Competent-but-forgettable.** Neat, easy to scan, plain table. Zero personality; avatars absent (initials badge is used top-right only).
Defects:
- Filter card (Search, Status, Role) for a 4-person team: bigger than the data. Hide filters until >8 people.
- Roles are job titles ("Checkout Associate", "Service Team", "Kitchen Team") not people-facing and "All locations" repeated four times.
- "Manage" outlined button on every row, no avatar, no role colour, no last-active indicator beyond text.
- Pagination "Showing 1-4 of 4 / Previous / Next" for four rows.
- "You" pill on Demo Owner is nice; keep.
Status: Open.

## 5.20 Onboarding (platform) — `p-onboarding.png`
**Feel verdict: Generic.** A list of identical cards with thin progress bars, all at "1 of 9 steps done", all named "OnboardTestBiz2 mvn...", all "Next: Location added". It looks like a test database, and it is.
Defects:
- Identical rows hide the meaning: all at 1/9 so progress bars carry no information; seed varied data.
- Test data names (`OnboardTestBiz2 mvnwggky`).
- "Next: Location added" reads as a status, not an action ("Add a location").
- Progress bars are ember on beige at 6px: the only decoration; steps are not named, so no sense of a journey. A stepper with 9 labelled ticks would carry the ledger/ticks motif.
- Go-live / commercial dialogs were never driven in a browser (QA_REPORT) and have no screenshot.
Status: Open.

## 5.21 Commercial (platform) — `p-commercial.png`
**Feel verdict: Generic.** A table of 50 test clients ("P11A BizB mvnwglcc"), 0 locations, all "Prospect", all "Unassigned". It is a database view with no commercial insight: no MRR, no module counts, no price.
Defects:
- Test data (see Fix 6); all rows identical in status and owner; links in ember with no hover cue.
- Four tabs (Clients / Offerings / Price books / Bundles) but the page's "Client accounts / 50 clients" sub-header repeats the tab.
- The module activation dialog (claimed to replace `window.prompt`) has no screenshot.
Status: Open.

## 5.22 Platform home — `p-home.png`
**Feel verdict: Broken (as a product moment).** A greeting and one sentence, then 800px of empty paper. "Your dashboard fills in as your role gets access to sales and operations" is an apology on the first screen the vendor admin sees. It communicates "unfinished".
Defects: empty page; no metrics, no next action; fix per Fix 7.
Status: Open.

## 5.23 Empty states
**Feel verdict: Cannot fully judge.** Only one empty state is in the evidence: the "No orders yet" order pad with a thin line drawing and one ember detail (f-1/f-2). It is tasteful and fits the brand, but one drawing is not a system. The brief says there are four illustrations plus the empty order pad (`EmptyFloorArt`, `EmptyBillsArt`, `AllClearArt`, `EmptyTeamArt`); no screenshot shows any of them, nor the loading (skeleton) or error state.
Defects:
- Floor empty, bills empty, all-clear and team empty not shown, so claims cannot be verified. Add screenshots for each.
- The pad drawing is 80px in a 585px dashed box; the empty state feels as large as the content it replaces but the art is small and light.
- "Quiet and a little witty" (art direction): the copy "No orders yet / Use New order to add items and send them to the kitchen" is instructional, not witty.
Status: Open.

## 5.24 Alerts / notification bell, global header (all desktop shots)
**Feel verdict: Competent-but-forgettable.** A thin header: logo, location selector, search, DEVELOPMENT pill, Alerts, avatar. Polished and consistent.
Defects:
- "DEVELOPMENT" amber pill is on every screenshot, including the "hero" ones; it signals non-production to every viewer. Hide it for demo builds.
- "Alerts" is a text button with no count or dot even though Home says "Alerts 0"; fine, but the 1440 header says "Alerts" at the same weight as a nav.
- Location selector shows "All locations" with a chevron, but QA says a working switcher is not built (FUNCTIONAL_AUDIT: removed the disabled ones, "a working switcher is not built"). The chevron in the screenshot is a live-looking control. I cannot tell from stills whether it works; if it is inert, it is the same fake control the builders claim to have removed.
- Search ("Ctrl K") is a nice touch; no preview of its results in evidence.
Status: Open.

## 5.25 Sidebar / navigation
**Feel verdict: Competent-but-forgettable.** Cream sidebar, clean icons, ember bar on active. Standard.
Defects:
- Nav order is by internal module, not by job: "Home, Module Center, Configuration, Reports, Team, Activity History" first, then "RESTAURANT: Tables, Kitchen, Bills", then "OPERATIONS: Costs". The first thing an owner sees in the nav is Module Center and Configuration, while Tables (the daily tool) is 6th. Reorder: Home, Tables, Kitchen, Bills, Reports, Costs, then admin (Team, Modules, Settings, Activity).
- Icons are generic line icons (grid, gear, bar chart, people, clock): "generic icon + label" nav. A custom icon set (ticket, ledger, table) would help more than any other change in the shell.
- Sidebar is 240px of cream with a left ember bar; active state is a beige pill. The active item is barely distinct from hover.
Status: Open.

---

# 6. Overstatement in the builders' docs

1. **ART_DIRECTION "Signature moves (all implemented)"**: seven moves listed; the stamp appears on two screens, the table "two-hour occupancy meter" is a 2px line, and arrival/hatched cleaning are not evidenced in any screenshot. "Implemented" is true in code, "visible" is not.
2. **ART_DIRECTION "never a dashboard of equal-weight cards"**: Settings, Modules, Onboarding, Team and Costs are exactly stacks of equal-weight cards/rows.
3. **ART_DIRECTION "Home: Morning briefing from a calm colleague"**: a red "-76.1%" headline is the opposite of calm.
4. **ART_DIRECTION table "Tables: the floor at a glance"**: the floor is 14 identical cream tiles; nothing is spatial, and three occupied tables with 46h durations undermine "at a glance".
5. **ART_DIRECTION "Empty states: hand-drawn line art... a little witty"**: one drawing evidenced, copy is instructional.
6. **ART_DIRECTION "Kitchen readable from a metre; 32px table name, 56px action"**: true for the Accept button; the ticket header inconsistency between columns and 11px status pills are not metre-readable.
7. **ART_DIRECTION motion claims** ("stamp lands 280ms", "digits rise 320ms", "arrival wash 2 seconds") cannot be verified from stills; f-7 and f-8 are identical.
8. **QA_REPORT "Screenshots: docs/ui/screens/after/... golden/ features/ roles/"**: the folder given to me is `design-after/`; I could not verify `roles/`. QA states no 768 or 1024 shots, yet `t-kitchen` / `t-tables` exist (and the latter has a visible overflow bug the QA never mentions).
9. **QA_REPORT "Console / network errors across all owner routes: only expected 401"**: OK but no layout/overflow check is listed; the 1024 overflow is missed.
10. **QA_REPORT accessibility**: "final post-fix scan was not repeated across every route" and Lighthouse is login-only: the claimed ≥90/≥95 targets are verified for one route. Contrast of 11px tracking-caps status text (ok green on cream) is not individually measured here.
11. **FUNCTIONAL_AUDIT "Replaced with a real Today dashboard (thin; see CRITIQUE_LOG)"**: this file previously existed and was apparently overwritten; the cross-reference now points to this log.
12. **FUNCTIONAL_AUDIT #1 "Removed (honest)"** vs screenshots: the location selector with a chevron is still in the header on every screen. If inert, the "removed" claim is false; if live, the "not built" claim is false.
13. **DESIGN_SYSTEM "Touch targets: 44px minimum"**: category tabs in the order builder, tab rows and the "-" stepper are visibly smaller (about 28 to 36px).
14. **DESIGN_SYSTEM "Not built: Sheet/Drawer, Tooltip, Avatar, Timeline"**: Activity needs a Timeline, Team needs Avatar, the disabled "Check out" needs a Tooltip; the screens show those gaps.
15. **ART_DIRECTION "No decorative motion on screens used during service"** vs "Stamp lands", "digits rise" at checkout, a service screen: self-contradictory.
16. **ART_DIRECTION "References: Linear, Mercury, Toast"**: the shipped screens resemble a warm, serif-themed shadcn admin; the Toast-style oversized service UI exists only in the kitchen.

---

# 7. What is genuinely good (keep)

- The login split-screen and tilted PAID receipt. Best brand moment; keep and push further.
- The ledger figure typography (Fraunces tabular, raised ₹ and minor units, rule beneath): distinctive and consistent on Home, Reports, checkout and the paid panel.
- The kitchen ticket: perforation, tear line with notches, mono ticket number, big serif table name, one ember action, status in stripe + word. Genuinely designed for the job.
- The checkout receipt stub with leader dots and double-ruled total, then the PAID stamp and toast: a coherent emotional beat.
- Typographic pairing (Fraunces + Inter Tight) and the warm paper/ink/ember palette: a clear, non-default identity.
- Mobile degrade for Home, Tables and Reports: the hero scales, not just reflows.
- Honest scope choices: Card payment removed rather than faked, platform pages split from tenant pages, plain restaurant words (table, ticket, bill).
- Item dialog's Required/Optional wording and the live price in the CTA.
- Hash-chained audit log with a "Verify log" action: real differentiator, deserves a hero treatment.
- Monogram and favicon (notched N tile) are small, memorable and consistent.

---

# 8. Screens per rating

| Rating | Count | Screens |
|---|---|---|
| Award-grade | 0 | none |
| Strong | 11 | Login 1440; Home 1440; Home 390; Tables 390; Session round card (5.6); Kitchen 1440; Kitchen 1024; Checkout; Paid state; Reports 1440; Reports 390 |
| Competent-but-forgettable | 10 | Tables 1440; Session dialog empty; Item dialog; Kitchen 390; Bills 390; Activity; Modules (desktop + mobile counted once); Team; Header/global shell; Sidebar |
| Generic | 7 | Login 390; Order builder; Bills 1440; Costs; Settings; Onboarding; Commercial |
| Broken | 2 | Tables 1024 (status overflow); Platform home (empty) |
| Cannot judge (no evidence) | 2 | Bill detail; Empty-state set (only one drawn) |

Total screens/moments rated: 30, plus 2 with no evidence.
