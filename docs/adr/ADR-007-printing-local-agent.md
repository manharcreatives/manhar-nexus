# ADR-007: Printing — Local Print Agent + Certified ESC/POS List

- **Status:** ACCEPTED (product decision)
- **Date:** 2026-08-23

## Context
Printing is the #1 ranked project risk (high likelihood × high impact). Browser/cloud printing is unreliable for thermal printers; universal driver support is impossible.

## Decision
Architecture: `Nexus Cloud → Local Print Agent (small Windows/Android daemon) → certified ESC/POS-compatible thermal printer`. A short certification list is maintained; additional printer drivers can be added later via a driver abstraction. Print jobs carry a truthful state machine: `queued → sent → printed | failed | offline`, with retry/backoff, manual reprint, and pending-print visibility. **An API 2xx NEVER means "printed successfully" — only agent confirmation does.** Hardware targets: Android tablets (frontline), Windows PCs (counter/admin); iPad-specific optimization not in MVP.

## Consequences
- Phase 10 delivers agent protocol + job model; test devices purchased early.
- Degraded modes (queue-and-continue, browser-print fallback) keep service running when printers are down; printer-offline state surfaces in UI and alerts.
