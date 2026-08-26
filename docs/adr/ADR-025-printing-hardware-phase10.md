# ADR-025: Printing & Hardware — Phase 10 Architecture Decisions

- **Status:** ACCEPTED
- **Date:** 2026-08-25

## Context

Phase 10 implements the printing infrastructure described in ADR-007. Several concrete
architectural decisions must be made for the Phase 10 scope.

## Decisions

### 1. Agent polling (not push)

The Local Print Agent polls `GET /agent/print/jobs` periodically. Push via WebSocket or SSE
is deferred until Phase 11 (requires Redis per ADR-006). Polling at ~5s intervals is
operationally acceptable for receipt/KOT printing latency.

### 2. Payload-embedded jobs (agent needs no callback)

The print job `payload` field is built at enqueue time using source data (invoice,
service request, business branding, template config). The agent has everything it needs
to render ESC/POS without further API calls. This makes agent operation resilient to
transient Nexus API unavailability during job delivery.

### 3. Manual print trigger for Phase 10

Print jobs are created via explicit admin API calls (not auto-enqueued on invoice PAID or
order SENT). Auto-enqueue couples printing into the payment/order flow, increasing blast
radius if the print system has issues. Manual trigger is the correct Phase 10 scope;
auto-print-on-event is a Phase 11 configuration feature.

### 4. Agent authentication via sha256 secret

Agents authenticate via `Authorization: Bearer <secret>`. The server stores
`sha256(secret)`. This is appropriate for service-to-service tokens (no user brute-force
risk; tokens are long-random). bcrypt is unnecessary overhead for 64-char random secrets.
Secrets are returned once on creation/rotation and never stored unhashed.

### 5. State machine: QUEUED→SENT→PRINTED|FAILED|OFFLINE

- QUEUED: job created, waiting for agent to claim.
- SENT: agent atomically transitioned the job; it has been dispatched to the printer.
- PRINTED: agent confirmed physical print success.
- FAILED: agent reported failure. If retryCount < maxRetries, job resets to QUEUED
  (retryCount incremented). If maxRetries reached, job stays FAILED permanently.
- OFFLINE: agent reported printer is offline. Job resets to QUEUED for retry when
  the agent next runs (treated like a retryable failure).
- CANCELLED: admin cancelled a QUEUED job before the agent claimed it.

### 6. Reprints create new jobs

Reprinting never mutates the original job. A new PrintJob is created with
`parentJobId` pointing to the original. This preserves the audit trail of what was
actually printed and when.

### 7. Small certified printer list over universal compatibility

Phase 10 certifies a small set of ESC/POS printers (Epson TM-T88V, Star TSP654II,
Generic 80mm ESC/POS). This is a commercial decision: it is better to guarantee a
small set works reliably than to claim untested broad compatibility.

### 8. Template config (not ESC/POS bytes)

PrintTemplate stores layout configuration (showBranding, footerText, etc.), not raw
ESC/POS bytes. The agent renders ESC/POS from the config + payload. This makes
templates human-readable, database-editable, and agent-implementation-independent.

## Consequences

- Agent protocol is polling-based; sub-second push requires Phase 11 (Redis/WS).
- Payload size is bounded by invoice/order size; large orders will have larger payloads
  (acceptable for thermal receipt scope).
- Auto-enqueue is deferred to Phase 11 as a configurable behavior per business/module.
