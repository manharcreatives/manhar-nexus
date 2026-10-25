# Positioning

## Buyer
Owner or operator of a single- or multi-location restaurant in India (INR, GST), plus the Manhar Creatives admin who onboards them.

## Promise
> Run a full service — table, order, kitchen, bill, payment, report — from one calm place that is fully yours.

## What the first ten minutes must show
1. A product that feels designed for a restaurant (warm, legible, large touch targets), not a generic admin.
2. One live story: seat a table, send an order, watch it appear on the kitchen screen, take payment, see the sale in Reports.
3. Trust: every action is in the activity log, roles limit what each person sees, the bill math is exact.

## What is in V1 (and honestly what is not)
| In | Not yet |
|---|---|
| Tables and sessions, order building, kitchen display, checkout (cash, UPI with UTR), close table | Card payments (no provider; the button was removed rather than faked) |
| Reports (daily, sales, top items) with CSV export and print | Digital orders, delivery, aggregators, marketplace |
| Operating costs with approvals | AI insights, native mobile apps |
| Activity log with integrity check, roles, settings, alert rules | Full JSON data export (database dump is the supported export today) |
| Guided client onboarding to go-live | Client self-service rebranding UI (config-level rebrand only) |

## Likely objections
- **"We already use X."** Show the golden path timing; the kitchen screen and bill are the differentiators, plus data ownership.
- **"What if the internet drops?"** Printing and offline tolerance are designed (ADR-007/009); the UI shows an honest retry state rather than failing silently. Real-printer validation is still a pilot condition.
- **"Who owns the data?"** The client's own PostgreSQL; backup/restore runbooks exist.
