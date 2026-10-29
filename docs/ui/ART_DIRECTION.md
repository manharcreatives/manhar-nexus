# Art Direction — "Manhar Night"

**Idea:** Nexus is a Manhar Creatives product, so it looks like one. It shares the dark canvas, the single green accent, the glass surfaces and the Clash Display / Satoshi pair with `manhar-creatives-website-v2` and `manhar-crm`. On top of that family look it keeps the restaurant details that are its own: ticket stubs, the stamp, the ledger figure, the table tile.

(Previous direction "Ledger & Ember", warm paper + serif + orange, was replaced on the `feat/sellable-v1-ui` branch. The restaurant-specific signature moves survived; only the skin changed.)

## Palette
Token names are unchanged from the paper theme, so every utility (`bg-surface`, `text-muted`, `border-line`…) follows the new values. Meaning: `paper` = canvas, `surface` = card, `sunken` = well, `ink` = text.

| Token | Hex | Role |
|---|---|---|
| paper | #070A09 | App canvas (under the aurora + grain) |
| surface | #0F1513 | Solid card / input fill |
| sunken | #161E1B | Wells, hover |
| line | #222D29 | Hairlines |
| ink / ink-2 | #F3F7F5 / #D5DDD9 | Text |
| muted | #94A09B | Secondary text (≥ 6:1 on surface) |
| accent / strong / soft | #22C55E / #4ADE80 / #0E2A1A | Primary action, active nav, accent text |
| ok / warn / bad / info | #4ADE80 / #FBBF24 / #F87171 / #60A5FA | Semantics; used as text + 12% tint, never alone |

One accent hue only. Status colours appear as a dot + word on a tinted chip.

## Type
- **Clash Display** (400–700) for headings and large figures. It sets tight, so display text gets `word-spacing: .08em` and light negative tracking (−0.015 to −0.02em); do not go tighter.
- **Satoshi** (300–700) for all UI text. Tabular numerals (`tabular`) for money and counts.
- Both are self-hosted from `apps/web/public/fonts` (Fontshare, free for commercial use). No third-party font requests. No italics: Clash has none, so the old italic accent became a green gradient word.

## Surfaces, depth, motion
- **Canvas:** `body::before` aurora (three green radial washes, 5–10 % opacity) and `body::after` film grain. Static, hidden in print.
- **`.nx-glass`** cards: white 1.5–4.5 % gradient fill, 1 px white-8 % border, inset top highlight, soft shadow. **`.nx-pop`** for floating layers (dialogs, palette, menus): blurred 86 % panel. `.nx-primary` is the one gradient button with a green glow.
- Radii: 10 px controls, 16 px panels.
- Motion: 160 ms micro, 300–360 ms surfaces, ease-out-expo. Only transform and opacity. `prefers-reduced-motion` collapses everything and the count-up settles instantly.
- Glow budget: at most one hero glow per screen (`.nx-hero-figure`, the Home revenue figure).

## Emotional target per hero screen
| Screen | Should feel | How |
|---|---|---|
| Login | Arriving somewhere premium | Aurora panel with ledger ruling, gradient headline word, a PAID ticket stub already on the desk |
| Home | A morning briefing | One glowing net-revenue figure that counts up, quiet 7-day bars in green, a "Right now" rail |
| Tables | The floor at a glance | Occupied tiles glow green with an edge and a meter; cleaning is hatched |
| Kitchen | Tickets on a rail | Perforated stubs, mono ticket number, 32 px table name; a new ticket drops in with a bounce and a light sweep |
| Checkout | A receipt being settled | Itemised stub, double-ruled total, then the PAID stamp lands |
| Reports | A page of the ledger | Tables on glass, ledger figures, calm empty states with line art |

## Signature moves
1. **Ledger figure** (`LedgerFigure`, `.nx-ledger`): Clash tabular figure with raised currency and minor units; optional single or double rule; `reveal` (digit rise) and `countUp` (counts from the previous value over 0.9 s; screen readers always get the final text).
2. **Ticket stub** (`.nx-stub`, `.nx-tear`, `data-perforated`): perforated edge, notched tear line, mono ticket number.
3. **Stamp** (`Stamp`, `StampCheck`): lands in 280 ms on final moments (payment received).
4. **Table tile** (`.nx-tile`, `.nx-meter`): status in edge, texture and word.
5. **Hero figure glow** (`.nx-hero-figure`): white figure with a soft green halo.
6. **New-ticket arrival** (kitchen): 520 ms drop with overshoot, a one-off light sweep, a static green wash and border for two seconds, plus the screen-reader announcement. The wash is static so nothing depends on motion.
7. **Monogram**: green ticket-stub tile with a drawn serif N (kept from the previous brand; it still reads as a stub).

## Brand assets
`apps/web/src/brand/` holds the Monogram, Wordmark (Clash, second word in accent), the empty-state illustrations and `og-source.html`. `og-source.html` and `public/og.png` still use the old Fraunces/paper look and need regenerating.

## Do
- Put the most important number on the screen in a ledger figure and give it room.
- Use green for the next action and the live thing.
- Pair every colour state with a word or shape.
- Keep motion under ~500 ms and make it explain a state change.
- Write plain restaurant words (table, ticket, bill), not software words.
- Check contrast on dark: text on glass is at least 4.5:1.

## Don't
- No second accent hue, no neon on more than one element per screen, no emoji, no stock illustration.
- No backdrop blur on more than a handful of large layers at once.
- No decorative looping motion on service screens (floor, kitchen, checkout).
- No Tailwind default palette classes; tokens only.
- Dark-on-green text on primary buttons uses `#04120A`; do not use pure black.
