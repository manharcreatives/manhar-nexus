# ADR-031 — UI design system and routing

**Status:** Accepted · 2026-10-25

## Context
The web app was a generic Tailwind blue/slate admin with inline styling on every page, four copies of the money formatter, state-based view switching (no deep links), and developer-grade flows (`window.prompt`, raw UUID inputs). It was not presentable to a paying restaurant client.

## Decision
1. **Tokens first.** All color, type, radius and motion values are Tailwind v4 `@theme` tokens in `styles.css`. Pages use token utilities (`bg-surface`, `text-muted`, `border-line`, …), not raw palette classes.
2. **Own primitives** in `apps/web/src/ui/` (Button, Field, Select, Textarea, Checkbox, Dialog, Tabs, Table, Panel, StatusPill, StatCard, PageHeader, Toast, ErrorBoundary, states). No component framework (MUI/Chakra/shadcn). Dialog uses native `<dialog>` for focus trapping and Esc handling without an extra dependency.
3. **Routing** with `react-router-dom` (BrowserRouter) so every page has a URL. Role gating in the shell stays a convenience; the API remains the authorization boundary (ADR-004/020).
4. **One money formatter** (`lib/money.ts`), integer minor units per ADR-015.
5. **Fonts** self-hosted via `@fontsource-variable/*` (OFL); icons via lucide-react (ISC) behind a single registry.
6. **Rebrand** via `VITE_BRAND_NAME` / `VITE_BRAND_ACCENT` and token overrides (`lib/brand.ts`).
7. **i18n overlays:** `en.<area>.json` files are deep-merged over `en.json` so areas can change copy without editing one shared file.

## Consequences
- Production deployments need an SPA fallback (all paths serve `index.html`); `vite preview` and `vite dev` already do.
- Adds three dependencies (react-router-dom, lucide-react, two font packages), all permissively licensed (see THIRD_PARTY_NOTICES.md).
- No API contract changed.
