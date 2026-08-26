# ADR-014: Branding Scope — Basic Business Branding MVP

- **Status:** ACCEPTED (product decision)
- **Date:** 2026-08-23

## Context
Clients want their identity on receipts/screens, but a full theming engine would be premature.

## Decision
MVP supports business-level branding: logo, business name, invoice identity fields, basic accent/theme color. Receipt templates consume these values. Advanced white-label/custom branding is FUTURE. Do not build a CSS-variable theme engine now.

## Consequences
- Branding fields modeled in Phase 4 (business settings); consumed by printing templates (Phase 10).
