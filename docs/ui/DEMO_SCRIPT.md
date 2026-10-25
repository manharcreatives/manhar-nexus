# 5-Minute Demo Script

**Setup (once):** `npm run db:init` → `npm run db:migrate` → `NEXUS_DEMO_SEED=true npm run demo:seed` → `npm run dev:api` and `npm run dev:web` → open http://localhost:5173.
Demo logins are printed by the seed (owner, cashier, kitchen, waiter). They are development-only credentials.

**Tip:** open the Kitchen screen in a second window logged in as the kitchen user so the order appears live.

| Min | Do | Say |
|---|---|---|
| 0:00 | Sign in as **Demo Owner**. Land on Home. | "This is the owner's morning: today's sales and where to jump in." |
| 0:30 | Tables → open **T2** (party of 2). | "Every table is a clear status in words, not just color. Big targets for a tablet." |
| 1:00 | New order → add 2 Paneer Tikka, 1 Spring Rolls → Send to kitchen. | "Totals and tax are computed on the server, in whole paise." |
| 1:45 | Switch to Kitchen display. Accept → Start preparing → Mark ready. | "Kitchen sees it the moment it is sent, oldest first, with how long it has waited." |
| 2:30 | Back to Tables → T2 → Mark served → Check out. | "One bill: ₹740 + ₹37 GST = ₹777." |
| 3:00 | Cash, tender ₹800 → Collect. Point at "Change given ₹23". Close table. | "Cash change is worked out for the cashier. Double-clicks cannot take payment twice." |
| 3:45 | Reports → Today. Export CSV. | "The sale is already here: payment method, tax breakdown, top items." |
| 4:15 | Activity History → Verify. | "Every action is recorded, and the log can prove it has not been tampered with." |
| 4:45 | Sign out; sign in as **Demo Kitchen**. | "A kitchen user only sees what they need — no sales, no settings." |

**Do not demo:** Card payment (not built), refunds from the floor (use Bills page once shipped), printing (needs a real printer).
