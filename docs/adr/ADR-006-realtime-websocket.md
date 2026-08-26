# ADR-006: Realtime — WebSocket Rooms + Snapshot Reconnect

- **Status:** ACCEPTED
- **Date:** 2026-08-23

## Context
Rush-hour operations (KOS queues, table states, ready items) need sub-second propagation and must survive flaky venue Wi-Fi.

## Decision
WebSocket connections join rooms scoped `business:{id}` and `business:{id}:location:{id}`. Server pushes domain events; on reconnect the client requests a snapshot for its visible surface instead of replaying missed events. Server state remains authoritative; UI updates are optimistic only where safe, reconciled by version stamps.

## Consequences
- No event-log replay complexity; snapshot endpoints per surface (KOS queue, floor, checkout list) from Phase 8.
- Idempotency + optimistic concurrency (ADR-017) back every mutation.
