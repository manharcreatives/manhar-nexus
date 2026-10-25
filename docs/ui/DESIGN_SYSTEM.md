# Design System

Source of truth: `apps/web/src/styles.css` (tokens) and `apps/web/src/ui/` (primitives). Direction and rationale: `ART_DIRECTION.md`; decision record: `docs/adr/ADR-031-ui-design-system.md`.

## Rules
1. Style with token utilities only (`bg-surface`, `text-muted`, `border-line`, `bg-accent`, …). No raw palette classes (`bg-blue-600`).
2. Money and counts use the `tabular` utility; money text comes only from `lib/money.ts` (`formatMoney`, `parseMoney`).
3. Headings use `font-display`; everything else is the UI face.
4. Status is always text plus shape (`StatusPill`), never color alone.
5. Touch targets: 44px minimum, 48px for POS/KDS primary actions (`Button size="lg"`).
6. Motion: 160ms micro / 280ms surfaces; reduced-motion collapses it globally.
7. Icons come from `ui/icons.ts` only.

## Primitives
| Component | Notes |
|---|---|
| Button | primary, secondary, ghost, danger; `loading` disables and sets `aria-busy` |
| Field, Select, Textarea, Checkbox | Label always rendered; `error` wires `aria-invalid`/`aria-describedby` |
| Dialog | Native `<dialog>`; focus trap and Esc from the platform; nests via top layer |
| Tabs | `role="tablist"`; caller renders the panel |
| Table / Th / Td | Scrolls horizontally on narrow screens; `numeric` right-aligns |
| Panel, PageHeader, StatCard | Layout and KPI blocks |
| StatusPill | tone: neutral, ok, warn, bad, info, accent |
| Skeleton, EmptyState, ErrorState, Spinner | Every list uses loading → empty → error-with-retry |
| Toast (`useToast`) | `aria-live="polite"`, auto-dismiss 4.5s |
| ErrorBoundary | Wraps the routed page area in the shell |

## Not built (deliberately)
Combobox, DataGrid, Sheet/Drawer, Tooltip, Popover, Menu, Command palette, Avatar, Kbd, Timeline, Breadcrumb, a `/_ui` showcase page. They were not needed by any in-scope screen; add them when a screen demands one.

## Dev verification used
- `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`.
- Headless-browser screenshots at 1440 and 390 px of every owner route, the full order-to-payment path, axe-core scans and Lighthouse (see `QA_REPORT.md`).
