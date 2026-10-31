# W1 report: dark theme, shell and hero sections

Scope: apps/web/src/landing (landing.css, styles/**, components/**, hooks/**, shell, sections Header/Hero/Preloader/Intro/About/Platform/Nexus Menu/Compare/HowItWorks/Trust/BuiltFor/CTA band/Footer and their content).

## What changed
- Tokens: legacy `--lp-*` names remapped to the dark identity (paper #070a09, surface #0f1513, sunken #161e1b, line #222d29, ink #f3f7f5, muted #94a09b, green #1DBA3C family). Added semantic tokens (`--lp-fg/-2/-3`, `--lp-surface`, `--lp-hair`, `--lp-on-accent`, `--lp-gap`, `--lp-head-gap`, shadows). W2 CSS inherits without edits (scanned: only brand gradients as hex).
- Rhythm: one `SectionHead` component (eyebrow with auto CSS-counter number, rule, h2, lede) used by every section; one card system (`.lp-card`, `.lp-glass` mask-composite hairline edge, deep shadows); slow weighted easing.
- Content cut: intro 3 paragraphs, platform 5 core + Nexus Menu headline (+7 listed "also"), compare 5 moments, how 4 steps, trust 4 blocks, card bodies at most 2 lines, shorter heads/ledes/CTA.
- Nexus Menu: `content/flags.ts` (`QR_MENU_LIVE = true`, `QR_MENU_NAME = 'Nexus Menu'`), headline module in platform.ts, `content/menu.ts`, new `sections/NexusMenu.tsx` showcase (CSS phone mockups: menu, live table status, QR tent; scroll-depth scene, flat on phones/reduced motion). No fake metrics; copy states UPI only, staff confirm, card payments coming soon.
- 3D/scroll depth kept and dark-native: hero plane, Nexus Menu scene, Trust room, BuiltFor ring. Platform pinned stack and Compare slider replaced by a bento grid and a scorecard with details disclosure.
- tsc fixes: flags.ts created; platform.ts has `summary`, `headlineIds`, `alsoTitle`.
- Tests updated: sectionsA, sectionsB (new Platform/Nexus Menu/Compare/How/Trust tests + dark-theme CSS hygiene), content.test.ts counts (13 live modules, 7 coming soon, 5 moments, 4 steps, 4 trust blocks; QR scorecard row exempt from "must be not-yet" when `QR_MENU_LIVE`).

## Verification (AGENT=w1 lp-verify.sh)
- tsc OK, eslint OK
- vitest: 12 files, 245 tests pass (src/landing + App.test.tsx)
- vite build OK; entry JS 211.7 kB gz (budget 250); LandingApp chunk 79.3 kB JS + 23.2 kB CSS gz

## Notes for the lead
- compare.ts (W2/lead) sets the "QR ordering / aggregator links" row to `equal` when QR is live; the test was adjusted accordingly.
- hygiene tests deliberately do not police devices.css and preloader.css (lead's files).
- print block in chrome.css flips tokens to light for printing.

## Unverified
- No real-browser visual QA: phone mockup fit, 3D layer depth, `mask-composite` glass edge, `mix-blend-mode` on logo image, CSS-counter section numbers (also numbers W2 sections), preloader dark look.
- Nexus Menu "Live" wording depends on `QR_MENU_LIVE`; flipping to false switches to the "soon" state (tested by content flags only).
