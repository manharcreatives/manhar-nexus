# ADR-012: Messaging Abstraction (Meta WhatsApp Cloud Direction)

- **Status:** ACCEPTED (product decision)
- **Date:** 2026-08-23

## Context
Strategic direction is Meta WhatsApp Business Cloud API, but provider lock-in and MVP scope discipline matter.

## Decision
A messaging abstraction (`send(template, recipient, context)` + delivery-status callbacks) with adapters per channel: WhatsApp / SMS / Email / Push. MVP ships only the interface + in-app alerts; no external channel adapter is wired until a paying need appears. Provider credentials live in the integration credential vault, never in code.

## Consequences
- Alerts Center (Phase 11) emits events that channels can subscribe to later without core changes.
