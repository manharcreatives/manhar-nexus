# ADR-011: Internationalization — English MVP, i18n-Ready Architecture

- **Status:** ACCEPTED (product decision)
- **Date:** 2026-08-23

## Context
MVP language is English; Gujarati and Hindi are future priorities. Hard-coded UI text would block localization later.

## Decision
All user-facing strings live in message-key catalogs from day one (web uses react-i18next; API error codes carry stable machine codes + default English messages). No string concatenation that assumes English grammar where avoidable. Translation files for additional locales are additive — no code changes required.

## Consequences
- Slight upfront discipline cost; prevents a costly retrofit.
- Glossary terms (see CANONICAL_GLOSSARY.md) define the canonical English labels.
