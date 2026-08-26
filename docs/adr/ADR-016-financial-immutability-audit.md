# ADR-016: Financial Immutability & Append-Only Audit

- **Status:** ACCEPTED
- **Date:** 2026-08-23

## Context
Owners must trust numbers. Spec: "a cashier cannot silently erase a payment"; cancelled/voided transactions remain traceable; configuration changes visible in history.

## Decision
- Financial records (payments, checkouts, taxes, refunds, cash movements) are **immutable**: corrections occur exclusively via reason-bearing, permission-gated reversal/void records.
- Audit stream is append-only with hash chaining (each event references previous hash) making silent tampering detectable; sensitive exports are themselves audited.

## Consequences
- No UPDATE/DELETE paths on financial tables in application code (enforced by review + tests).
- Voided invoice/order numbers remain consumed forever.
