# ADR-001: Modular Monolith

- **Status:** ACCEPTED
- **Date:** 2026-08-23

## Context
Manhar Nexus must serve many verticals through one configurable platform. Both product specifications explicitly prohibit microservices as a feature and warn against premature distributed architecture.

## Decision
Build a single deployable modular monolith with strictly bounded module boundaries, a metadata-driven module registry, an internal event bus between modules, and shared core services (tenancy, identity, access, config, audit, alerts, files).

## Consequences
- One build, one deployment, simple local dev and ops.
- Module boundaries enforced by convention + registry contracts, not network hops.
- No external plugin SDK and no third-party plugin marketplace (deliberately).
- If scale ever demands extraction, well-bounded modules make that a refactor, not a rewrite.
