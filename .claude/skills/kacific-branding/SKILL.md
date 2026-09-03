---
name: kacific-branding
description: Kacific visual identity for the ERP — design tokens, typography, component idioms and the do/don't list. Use whenever creating or restyling UI so new screens match kacific.com and the existing pages.
---
# Kacific branding

Tokens live in `src/app/globals.css` (`@theme`) and are the only source of colour/radius values — use Tailwind utilities like `bg-blue`, `text-ink-soft`, `border-line`, `rounded-card`, `rounded-pill`, `shadow-card`, `shadow-lift`.

| Token | Value | Use |
| --- | --- | --- |
| `blue` | #034ea2 | primary actions, links, active nav, KPI values (8.03:1 on white) |
| `blue-deep` | #003c72 | pressed / hover on dark |
| `blue-footer` | #07529e | sidebar, hero band, email header (white text 7.75:1) |
| `sky` | #358ccb | eyebrows, secondary accents (not for small body text) |
| `wave` #52a4ca, `cyan` #5dc1d4 | decorative only (orbit arcs) |
| `orbit-grey` | #a7a9ac | dividers, muted icons |
| `ink` #111 / `ink-soft` #616161 / `ink-faint` #767676 | text hierarchy (all AA) |
| `line` #e3e8ef / `line-strong` #cfd7e2 | borders |
| `tint` #f1f4fa / `wash` #f4f4f4 / `accent-tint` #e8f0f8 | section washes, row hover |
| `ok-*`, `warn-*`, `bad-*` | green/amber/red pairs | status only — never brand |

Type: Montserrat via `next/font` — body 300, UI/buttons 500, headings 600, KPI numbers 700. Headings line-height 1.1, no letter-spacing anywhere. Uppercase is reserved for button labels, table headers and eyebrows.

Shapes: buttons and pills `rounded-pill` (38px); cards, inputs `rounded-card` (5px). Primary button is blue fill that inverts to white/blue on hover (`Button variant="primary"`); `secondary` is the outline; `on-blue` for dark bands.

Motifs: the orbit arc (`.orbit-band` in globals.css) behind blue bands; KPI cards lifted over the band with a 4px top border in the semantic colour.

Do: keep status colours traffic-light; keep Recharts colours from `CHART` in `src/components/charts/bar.tsx` (hex, not CSS vars); respect `prefers-reduced-motion`; keep the logo `/kacific-logo.png` (white via `brightness-0 invert` on blue).
Don't: introduce new hex values, shadcn defaults, external fonts/CDNs, or letter-spacing. Don't recolour Low/Out of stock to blue.
