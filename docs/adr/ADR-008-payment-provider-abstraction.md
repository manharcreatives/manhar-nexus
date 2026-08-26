# ADR-008: Payments — Provider Abstraction, Razorpay First, Reversal-Only Corrections

- **Status:** ACCEPTED (product decision)
- **Date:** 2026-08-23

## Context
MVP collects Cash, UPI, Card(manual settlement), other configurable options. Gateway direction is Razorpay but must not leak into domain logic. Payment trust is a ranked risk.

## Decision
`PaymentProvider` abstraction: `initiate / verify / refund / handleWebhook / fetchStatus`. Razorpay = first adapter behind a feature flag enabling dynamic bill-specific UPI QR. Until enabled: static UPI QR display + manual confirmation entry requiring verification. Webhooks are signature-verified, stored, deduplicated, idempotent. A settlement-reconciliation job compares provider settlements vs recorded payments. Refunds/cancellations create reason-bearing reversal records; original financial rows are immutable. Failed/timeout capture never marks a checkout paid or closed.

## Consequences
- No deprecated UPI Collect/VPA-entry assumptions.
- Daily closing report surfaces variances; silent payment edits are structurally impossible.
