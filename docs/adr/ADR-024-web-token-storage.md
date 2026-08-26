# ADR-024: Web Token Storage — In-Memory Access + HttpOnly Refresh Cookie

- **Status:** ACCEPTED
- **Date:** 2026-08-24

## Context
The React/Vite web app must hold auth tokens. `localStorage` persists a credential an XSS can exfiltrate for durable offline reuse; a cookie is auto-sent and invites CSRF. We need the best XSS/CSRF balance for a browser SPA.

## Decision
- **Access token in JavaScript memory only** (a module variable + React context), never `localStorage`/`sessionStorage`. A page reload silently re-acquires it via the refresh cookie. XSS can still act while the page is live but cannot steal a durable token.
- **Refresh token in an `HttpOnly; SameSite=Strict` cookie** scoped to path `/auth`, `Secure` in production. `HttpOnly` blocks XSS from reading it; `SameSite=Strict` + the fact that all other state-changing calls use the `Authorization: Bearer` header (not auto-sent cross-site) contains CSRF to the single refresh endpoint.
- The client `api()` helper performs **one** silent refresh-and-retry on a 401, then forces re-login on failure. CORS is a strict single-origin allowlist with `credentials: true`.
- The login response also returns the refresh token in its body for non-browser/API clients and tests; browser code ignores it and relies on the cookie.

## Consequences
- No durable token is exfiltratable via XSS; CSRF surface is one hardened endpoint.
- A full CSRF double-submit token on `/auth/refresh` is a future hardening (SameSite=Strict is the current mitigation).
- Server secrets are never bundled: only `VITE_`-prefixed public config reaches the web build (`VITE_API_URL`).
