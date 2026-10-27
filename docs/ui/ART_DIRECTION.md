# Art Direction — "Ledger & Ember"

**Idea:** a restaurant runs on paper tickets, ledgers and heat. The product should feel like a well-kept ledger on a warm counter: calm paper, confident ink, one ember accent used sparingly for the thing to do next.

## Palette
| Token | Hex | Role |
|---|---|---|
| paper | #F6F1E9 | App background |
| surface | #FFFDF9 | Cards, inputs |
| sunken | #ECE5D8 | Wells, table headers, hover |
| line | #DDD4C3 | Borders |
| ink | #1B1A17 | Text, login hero |
| muted | #6B6558 | Secondary text |
| accent / strong / soft | #B53A0A / #8F2D07 / #FBE6DA | Primary action, active nav |
| ok / warn / bad / info | #3F6212 / #92600A / #A32119 / #1F5A6B | Semantics, each with a -soft tint |

Semantic colors are never the only signal: every status carries text.

## Type
- **Fraunces** (variable, OFL) for headings and large figures — editorial warmth, real weight contrast.
- **Inter Tight** (variable, OFL) for UI — dense, legible, tabular numerals (`tabular` utility) for all money and counts.

`ember-glow` #F08A5D is the accent for use on ink only (login panel, toasts, OG image): 7.0:1 on ink. Checked pairs: ok on surface 7.0:1, muted on paper 5.2:1, accent on accent-soft 4.9:1.

## Shape, depth, motion
Radii: 8px controls, 14px panels. Borders and tonal layers instead of shadows (the only real shadows are the login ticket and the table-tile hover lift). Micro-interactions 160ms, entrances 220ms, surfaces 280ms; `prefers-reduced-motion` collapses all durations, and the kitchen arrival wash stays as a static tint so nothing depends on motion.

## References (principles only)
- Linear: restraint and keyboard-first density.
- Mercury: calm, trustworthy numeric tables.
- Toast: oversized touch targets for service-time screens.

## Why this works for the sale
Warm and tactile differentiates from the default blue/slate admin look, and large display figures make the owner's daily numbers the visual center of the product.


## Personality: warm precision
A well-kept ledger on a warm counter. Calm paper, confident ink, one ember accent for the next action. Serious about numbers (accountant's rules, tabular figures), human about everything else (serif headings, plain words). It is never cute, never dark-mode-neon, never a dashboard of equal-weight cards.

## Emotional target per hero screen
| Screen | Should feel | How |
|---|---|---|
| Login | Arriving at a trusted house | Ink panel with ledger ruling and grain; one slightly tilted ticket already stamped PAID tells the product story before any copy |
| Home | Morning briefing from a calm colleague | One oversized ledger figure (today's net), a quiet 7-day strip, a "Right now" rail with hairline-and-tick section heads |
| Tables | The floor at a glance | Tiles are tables: occupied ones carry an ember top edge and a two-hour occupancy meter, cleaning is hatched; the lift on hover is 2px |
| Kitchen | Paper tickets on a rail, readable from a metre | Perforated ticket stubs, tear line with notches, monospaced ticket number, 32px table name, 56px action; late is text plus colour |
| Checkout | A receipt being settled | Itemised stub with leader dots, subtotal rule and double-ruled grand total, then the PAID stamp lands |
| Reports | A page of the ledger | Net revenue as the single hero figure, supporting figures in a row, tables under ruled headings |
| Empty states | Quiet and a little witty | Hand-drawn line art (one ember detail), one sentence, one action |

## Signature moves (all implemented)
1. **The ledger figure** (`LedgerFigure`, `.nx-ledger`): Fraunces tabular figure with a raised currency sign and raised minor units; optional single or double accountant's rule; digits rise in once (320ms). Used for revenue, totals, approvals.
2. **The ticket stub** (`.nx-stub`, `.nx-tear`, `data-perforated`): perforated top edge, dashed tear line with half-moon notches, monospaced ticket number (`ticket-no`). On kitchen tickets, order rounds, the checkout bill, the login hero and the OG image.
3. **The stamp** (`Stamp`, `StampCheck`): a double-ruled rubber-stamp mark that lands in 280ms with a drawn check on the moments that become final (payment received; kitchen "waiting for pickup").
4. **The table tile** (`.nx-tile`, `.nx-meter`): status in edge, texture and word, never colour alone.
5. **The hairline with an ember tick** (`rule-tick`, `SectionHeader`): the one decorative flourish under every heading.
6. **The monogram**: an ember tile with a half-moon notch in each side (a ticket stub) and a drawn serif N sitting on a ledger line; the same shape is the favicon.
7. **New-ticket arrival** (kitchen): a 240ms slide-in plus a static ember-soft wash for two seconds and a screen-reader announcement. It never hides the content or delays reading.

## Brand assets
`apps/web/src/brand/` holds the Monogram, Wordmark, four empty-state illustrations plus the empty order pad, and `og-source.html` (the source of `public/og.png`). Rebrands keep the tile and take the initial in Fraunces.

## Do
- Put the single most important number on the screen in a ledger figure and give it room.
- Use the ember accent for the next action and the live thing, nowhere else.
- Pair every colour state with a word or shape.
- Keep motion under 300ms and make it explain a state change.
- Write plain restaurant words (table, ticket, bill), not software words.

## Don't
- No second accent colour, no gradients on surfaces, no glassmorphism, no emoji, no stock illustration.
- No shadows to create hierarchy; use rules, tone and spacing.
- No decorative motion on screens used during service (floor, kitchen, checkout).
- No Tailwind default palette classes; tokens only.
- Do not use the italic anywhere except the brand wordmark and the one headline accent.
