# ADR-013: Hosting — India Region Preferred

- **Status:** ACCEPTED (product decision)
- **Date:** 2026-08-23

## Context
Client base is Gujarat/India-first; latency and data-residency expectations favor India regions.

## Decision
Prefer India-region infrastructure where practical and commercially appropriate. Deployment configuration remains provider-portable (containers + managed services), keeping future dedicated/private deployments open without rework. Backups/PITR configured in the same region with documented restore drills (Phase 13/14).

## Consequences
- DPDP-conscious PII handling noted in security baseline; consent flags arrive with Guest CRM.
