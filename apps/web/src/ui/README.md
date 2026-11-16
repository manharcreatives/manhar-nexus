# Manhar Nexus design system (apps/web/src/ui)

One place for how every screen looks and behaves. Persona to design for: **tired restaurant staff on a phone in a dim
kitchen**, and an ops person on a laptop. If it works for the first, it works for both.

## Tokens (src/styles.css, `@theme`)

| Token | Value | Use |
|---|---|---|
| `paper` / `surface` / `sunken` | `#070a09` / `#0f1513` / `#161e1b` | page / card / well |
| `ink` / `ink-2` / `muted` | `#f3f7f5` / `#d5ddd9` / `#94a09b` | text (all ≥ 6:1 on paper, surface and sunken) |
| `control` / `control-hover` | white 40% / 62% | border of inputs, selects, textareas (3.8:1; was 1.3:1) |
| `accent` / `accent-strong` / `on-accent` | `#22c55e` / `#4ade80` / `#04120a` | the one primary action; text on accent is `on-accent` (8.4:1) |
| `ok` / `warn` / `bad` / `info` | green / amber / red / blue | status. Never colour alone: see StatusPill |

Contrast rules we hold: text 4.5:1, borders of controls and focus rings 3:1. Check with the numbers above before adding a colour.

Radius: `rounded-control` (inputs, buttons), `rounded-panel` (cards, dialogs). Spacing: 4px steps (`gap-2`, `p-4`, `p-6`).
Type: 16px (`text-base`) in inputs so iOS never zooms; 14px (`text-sm`) for labels and buttons; 12px (`text-xs`) only for pills.

## Components

- **Button** `variant`: `primary` (the one thing to do), `secondary` (everything else), `ghost` (toolbars), `danger`
  (destructive, always behind a confirmation). `size` `md` = 44px, `lg` = 48px. `loading` disables and sets `aria-busy`.
- **Field / Select / Textarea**: label above, hint or error below, linked with `aria-describedby`. Use the component,
  never a bare `<input>`. The border comes from `controlBox()` so all three match.
- **Checkbox**: the whole row is the tap target.
- **Dialog**: native `<dialog>` (focus trap, Esc, return focus). Title and footer stay in view while a long form
  scrolls; the footer clears the phone home indicator. Put the safest action in `data-autofocus`.
- **Toast** (`useToast().show(text, tone, { action?, duration? })`): good news = `status`, problems = `alert` and stay 8s.
  A toast with `action: { label: 'Undo', onClick }` stays 8s and the button is keyboard reachable. Top on phones,
  bottom-centre on desktop.
- **StatusPill**: words first, plus a marker whose shape changes with the tone (disc, triangle, square, diamond, ring).
- **Tabs**: arrow keys, Home and End; only the active tab is in the Tab order.
- **states**: `EmptyState`, `ErrorState` (retry), `Skeleton`. Show one of them, never a blank screen.

## Touch and motion

- On a finger screen (`pointer: coarse`) every button, tab, select and input is at least 44px tall (styles.css). A control
  that must stay small (a chip inside a table cell) opts out with `data-compact`.
- Animation is decoration. `prefers-reduced-motion` turns all of it off globally, and nothing may depend on it.
- A modal locks the page scroll behind it.

## Do / don't

- Do give every icon-only button an `aria-label`. Don't signal state by colour alone.
- Do keep copy in i18n JSON. Don't hard-code English in components.
- Do keep new props backward compatible; other screens depend on these components.
- Don't draw a field with a faint border (`border-white/10`): it disappears in a dim room.
