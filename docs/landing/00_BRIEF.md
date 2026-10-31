# Manhar Nexus — Launch Landing Page: MASTER BRIEF (shared by all agents)

Owner: Utsav Prajapati, founder of Manhar Creatives (Visnagar, Gujarat, India). Date: 2026-10-31.
Repo: D:\manhar-nexus  (mounted in the device VM at $HOME/mnt/manhar-nexus). Stack: npm workspaces; apps/web = React 18 + Vite 6 + Tailwind v4 + react-router 7 + i18next + lucide-react; apps/api = NestJS + Prisma + Postgres.

## What the owner asked (translated from Hinglish)
- Manhar Nexus is a restaurant-operations SaaS that Manhar Creatives will launch to market as a PRODUCT.
- Today opening the app lands straight on login/registration. There is NO public information page. Build a **single-page marketing website** that contains everything a prospective client needs BEFORE purchasing:
  iconic preloader, iconic hero, a curiosity-driven intro, about, an innovative comparison ("why Nexus is different / why choose us"), features/modules, how it works, pricing plans (in INR), FAQ, blogs/insights, Terms & Conditions, Privacy Policy (and other policy pages that are normally required: refund/cancellation, billing), contact, and a **registration option** (restaurant sign-up / start-trial request).
- Content, titles and descriptions must be **curious, deep, meaningful** (not generic SaaS filler). Every heading should make the reader want to read the next line.
- Visuals: hospitality feel — restaurants, hotels, cafés, cloud kitchens, bakeries. Images are generated with ChatGPT Desktop (image generation) and saved into apps/web/public/landing/.
- Some sections must **feel 3D while scrolling** — but implemented with flat images/layers positioned with CSS 3D transforms (perspective, rotateX/Y, translateZ, parallax, sticky stacking, scroll-linked transforms). NOT real WebGL models.
- Online payment for new restaurants: new restaurants enrol and pay subscription online (payment gateway: Cashfree, registered under Manhar Creatives; billing is centralised on the Manhar Creatives side; this is subscription auto-collection for the software, NOT restaurant bill payments). The landing page must present this flow clearly and honestly (plans -> register -> pay -> workspace provisioned). Do NOT fake a working payment; wire a clean "Register / Start" flow with a clearly marked integration point.
- Pricing/business model: design it yourself in INR (monthly/yearly), sensible for Indian restaurants/cafés/hotels (GST extra, 18%). Owner will refine later.
- Work is divided between agents; each agent owns specific files (see ownership table in 03_PLAN.md once it exists). Never edit files you do not own.
- Final loop required: create -> quality check -> self-critique -> auto-fix -> re-review -> final output + checklist (3-5 iterations or zero critical issues).

## BRAND RULES — Manhar Creatives Brand Colour Guide v2.0 (3 Oct 2026). THIS GUIDE WINS over older code.
- Primary (only green): Manhar Green #1DBA3C. Secondary: Ink #0B0F0E. NEVER use the old greens #22C55E #16A34A #4ADE80 (the current app styles.css still uses them — the landing must NOT).
- Theme: LIGHT base with DARK blocks (hero, enquiry/CTA banner, footer, premium blocks). Balance ~70% light / 20% Ink / 10% green. Green is an accent, never a full-page background.
- Light surfaces: White #FFFFFF (cards), Soft White #F7F9F7 (page canvas), Light Grey #EEF2EF (alt sections), Mist #E3E9E5, Line #D5DDD8, Silver #9AA5A0 (decoration only).
- Dark surfaces: Ink #0B0F0E, Night Panel #121A16, Night Card #1B2620, Night Line #2B3932.
- Green support: Bright #35D445 (button hover / glow edge only), Forest #12802B (green TEXT on light), Deep #106021 (text on Mint tags / link hover), Glow #69F361 (artwork glow only — never text, never flat fill), Mint #C9F2D2 (tag borders), Mint Wash #EAF9ED (callouts/tags).
- Text on light: headings #0B0F0E, body #2B3631, muted #55625B. On dark: #FFFFFF, soft #A7B2AC, muted #8A9690. NEVER pure #000000. No blue-grey slates (#111827 #1F2937).
- Buttons: Manhar Green fill + INK text (never white on green; contrast 2.6). Hover Bright Green #35D445. Second button: transparent, 1px Ink border (on dark: border #8A9690, white text), hover Mint Wash on light.
- Green text on light = Forest #12802B (never #1DBA3C text on light, contrast 2.4). Green text on dark = #1DBA3C OK.
- ONE green accent word per headline max. Only two gradients allowed: #1DBA3C -> #35D445 and #0B0F0E -> #121A16. No neon/teal/yellow-green/rainbow.
- Fonts: headings Clash Display 600/700 (tight tracking -1..-2%), body Satoshi 400/500 (16–18px, line-height 1.5–1.6), labels JetBrains Mono 500 UPPERCASE +10% tracking 10–12px (eyebrows, tags, dates, max 6 words). Buttons Satoshi 700 15–16px sentence case. NO serif, no script, no condensed fonts. Fallbacks: Space Grotesk / Inter / Fira Code. Clash Display + Satoshi woff2 already exist in apps/web/public/fonts. JetBrains Mono must be self-hosted (e.g. npm @fontsource/jetbrains-mono, weight 500) — no third-party font requests.
- Logo: never redraw or retype "Manhar Creatives". Real logo files (Primary_H_Black.png / Primary_H_White.png / BG_Dark_V.png) were NOT supplied; a low-res extract from the guide PDF is at docs/landing/brand/manhar-creatives-logo-on-ink.jpg (use only on Ink blocks, with mix-blend or on an Ink panel). Nexus's own product mark is the existing apps/web/src/brand/Monogram.tsx (ticket-stub N tile) — but recolour its tile to #1DBA3C (not #22C55E) for the landing; keep the geometry.
- Tagline of the studio: "We Design, We Build, You Grow." Product line already in repo: "One Platform. Configure It Your Way." / "Run the floor, the kitchen and the books from one calm place."
- Section map to follow: Header White (line #D5DDD8, green button) -> Hero Ink -> content sections Soft White -> alternate sections Light Grey (numbers/labels Forest) -> enquiry banner Ink with 1px green top edge -> footer Ink. Cards: White, border #D5DDD8, icon tile #1DBA3C. Form fields: White, border #D5DDD8, placeholder #55625B, focus border Forest #12802B. Tags: Mint Wash bg, #C9F2D2 border, Deep Green text. Charts: series #1DBA3C, #0B0F0E, #9AA5A0 only.
- Contrast pairs OK: Ink on Soft White 18.2, body on Soft White 11.9, Forest on Soft White 4.8, Ink on green 7.5, green on Ink 7.5, soft #A7B2AC on Ink 8.8.

## Product terminology (use exactly; see docs/spec-normalized/CANONICAL_GLOSSARY.md): Service Request, Checkout, KOS (kitchen order screen), Sold-Out, Business Workspace, etc.
## Honesty rule: only claim features that exist in the repo/spec. Mark roadmap items as "coming soon". No fake customer logos, fake testimonials, fake awards, fake stats. Use clearly-labelled design-partner/pilot language instead. Legal pages are drafts for lawyer review (add a visible "Draft — pending legal review" note in the owner-facing report, not as ugly banner on the page unless owner wants it).
## Language: page copy in English (Indian-business friendly, warm, a little Gujarati-market flavour allowed e.g. "ji"); keep i18n-ready if cheap, but English is the deliverable.
## Performance/a11y: lazy-load images, width/height set, prefers-reduced-motion respected, keyboard accessible, AA contrast, semantic landmarks, one h1, Lighthouse-minded. Mobile-first responsive (375 / 768 / 1280 / 1920).
