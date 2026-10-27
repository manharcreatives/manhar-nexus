# ADR-032: Realtime change notifications over Server-Sent Events

**Status:** Accepted (2026-10-27). Supersedes the transport choice in ADR-006 (WebSocket); keeps its "snapshot on reconnect" model.

## Context

Waiters, kitchen, cashiers and managers work on the same business at the same time. When one of them sends an order, advances a ticket, opens or closes a table, captures a payment or approves an expense, the others must see it within about a second without refreshing.

## Decision

A one-way push channel using Server-Sent Events (SSE) carried over an ordinary authenticated HTTP GET that the web client reads with `fetch` streaming. The server tells clients only THAT a surface changed. Clients refetch through the normal authorised APIs (snapshot model). There is no event replay: after any reconnect the client refetches everything it displays.

Why SSE over fetch rather than WebSocket:

- Traffic is server to client only. Mutations already go through REST.
- No new dependency and no extra port. It is plain HTTP, so Caddy, nginx and every load balancer pass it with one setting.
- The existing bearer JWT guard authenticates it unchanged. The browser `EventSource` API cannot send an `Authorization` header, so the client uses `fetch` and parses the stream. That also avoids putting tokens in URLs or logs.
- Reconnect, auth refresh and token expiry are handled by the client in a few lines.

## Contract

`GET /admin/realtime/stream[?locationId=<uuid>]`, header `Authorization: Bearer <access token>`.

- Any authenticated BUSINESS user. A PLATFORM principal gets 403 (no tenant to subscribe to). No token gives 401.
- `locationId` must be a UUID (400), belong to the business (404) and be inside the caller's location scope (403).
- Response headers: `Content-Type: text/event-stream; charset=utf-8`, `Cache-Control: no-cache, no-transform`, `X-Accel-Buffering: no`, `Connection: keep-alive`.

Frames:

| Frame | Data |
|---|---|
| `event: hello` (first) | `{"serverTime":"<ISO>","heartbeatSeconds":20}` |
| `: ping` (comment, every 20 s) | none |
| `event: change` | `{"topic":"<topic>","locationId":"<uuid>\|null","at":"<ISO>"}` |
| `event: expired` (last) | `{}` the access token expired; re-authenticate and reconnect |
| `event: replaced` (last) | `{}` the per-user stream cap evicted this stream |

Topics (source of truth: `apps/api/src/realtime/realtime.types.ts`, mirrored by the web client):

| Topic | Emitted when |
|---|---|
| `orders` | service request created, sent, line added/changed/removed, cancelled, served; also on kitchen advances |
| `kitchen` | ticket sent, accepted, preparing, ready, served |
| `tables` | table created/updated/deleted, reset, or freed/occupied by session open/close/void/seat or invoice settlement |
| `sessions` | session opened, updated, closed, voided, seated; invoice finalise/void; payment settlement |
| `invoices` | invoice created, finalised, voided, paid |
| `payments` | payment initiated, captured, cancelled, refunded |
| `expenses` | expense created, approved, rejected |
| `notifications` | an alert notification was created (the client refetches its own list) |

Several topics may fire for one action (an order send emits `orders` and `kitchen`). Treat events as hints: refetch the affected surface, debounce bursts.

### Scoping

- Events are delivered only to subscribers of the SAME business.
- A location-restricted token only receives events for locations it may access. Events with `locationId: null` (not tied to a location) go to every subscriber of the business.
- With `?locationId=X` the stream delivers events for X and events with a null location.
- Payloads carry no business data, only topic and location.

### Token expiry

The global `JwtAuthGuard` verifies the token but does not expose `exp`; the controller reads `exp` from the already-verified bearer token's payload and arms a timer. When it fires the server sends `event: expired` and ends the response. The client refreshes its token and reconnects. Revocation of a session mid-stream is bounded by that same access-token lifetime (default 300 s).

### Safety

- At most 5 concurrent streams per user. A sixth evicts the oldest with `event: replaced`.
- Every disconnect (client close, socket error, proxy reset, expiry, eviction) unsubscribes from the bus, clears timers and unregisters the stream. `RealtimeBus.subscriberCount()` returns to zero (covered by e2e).
- Publishing never throws and never awaits: events are emitted after the request handler resolved (after the DB commit) and a failure is swallowed.

## Producers

`RealtimeInterceptor` (global) maps successful mutation routes to topics (one reviewable table in `realtime.interceptor.ts`) and takes `locationId` from the response body when present. Two producers emit directly because the route response lacks the location or the event is not a request: `SessionService.resetTable` (tables) and `AlertDispatcher` (notifications). Failed requests emit nothing.

## Scaling

`RealtimeBus` is in-process (one RxJS Subject per business). With more than one API instance a client only hears events produced by the instance it is connected to. Before scaling out, replace the bus implementation with one that publishes to Redis pub/sub (or Postgres LISTEN/NOTIFY) and re-emits received messages locally. Producers depend on `RealtimeBus.emit` and the `RealtimePublisher.publish(event)` interface only, so the swap is one class. Redis is deliberately not added now.

## Proxy

Caddy: `flush_interval -1` on the `/api/*` proxy, compression excluded for `/api/admin/realtime/*`, no response timeout. nginx: `proxy_buffering off`, long `proxy_read_timeout`. See `docs/runbooks/deploy.md`.

## Consequences

- Browsers hold one long-lived connection per tab (HTTP/2 multiplexing makes this cheap behind Caddy).
- No guaranteed delivery: a missed event is repaired by the refetch on reconnect and by normal page loads.
