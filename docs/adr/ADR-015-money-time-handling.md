# ADR-015: Money & Time Handling

- **Status:** ACCEPTED
- **Date:** 2026-08-23

## Context
Financial correctness is non-negotiable; historical bills must survive later price/tax changes; multi-location time zones exist.

## Decision
- Money stored as **integer minor units** (paise) + currency code field; floats prohibited in financial math.
- Timestamps stored UTC; displayed per location timezone.
- Transaction lines **snapshot** display name, variant/modifier labels, unit price, and effective tax rate at sale time; masters may change freely afterwards.

## Consequences
- Rounding rules applied once at defined points, configurable, transparent on Checkout.
- Historical reports recompute exactly from snapshots.
