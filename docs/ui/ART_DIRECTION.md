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

## Shape, depth, motion
Radii: 8px controls, 14px panels. Borders and tonal layers instead of shadows. Micro-interactions 160ms, surfaces 280ms; `prefers-reduced-motion` collapses all durations.

## References (principles only)
- Linear: restraint and keyboard-first density.
- Mercury: calm, trustworthy numeric tables.
- Toast: oversized touch targets for service-time screens.

## Why this works for the sale
Warm and tactile differentiates from the default blue/slate admin look, and large display figures make the owner's daily numbers the visual center of the product.
