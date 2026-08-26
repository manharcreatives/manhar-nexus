# ADR-018: External Order Channels via Intake Abstraction Only

- **Status:** ACCEPTED (product decision)
- **Date:** 2026-08-23

## Context
Zomato/Swiggy integrations introduce certification, support burden, API dependency and scope risk; they are explicitly NOT MVP dependencies.

## Decision
Build an internal intake abstraction (channel → normalized Service Request) that the platform's own channels will use first. Third-party aggregator adapters are FUTURE (Phase 17+) implemented strictly as adapters behind this seam — external models never contaminate the core domain. No aggregator integration code exists in MVP.

## Consequences
- Phase 8's order engine consumes only the internal intake contract.
- Adding an adapter later requires zero changes to kitchen/checkout logic.
