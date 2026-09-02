---
name: kacific-branding
description: |
  Kacific Broadband Satellites brand system — colour tokens, Montserrat type scale, logo assets and
  usage rules, the orbit-curve visual language, and pill-button component specs, all extracted from
  the live kacific.com site.
  Use when: styling or restyling any UI, page, dashboard, slide, report or artifact that should look
  like it belongs to Kacific; picking brand colours or fonts; placing the Kacific logo.
  Provides: verified hex values with WCAG contrast ratings, a drop-in `tokens.css`, local logo files,
  and accessible substitutes for the brand colours that fail contrast.
---

# Kacific Branding

Brand system for **Kacific Broadband Satellites Ltd** — a next-generation broadband satellite
operator serving the Asia Pacific. Tagline: **"the heart of broadband."**

Every value below was extracted from the live site (kacific.com, September 2026) by sampling
computed styles and logo pixels — not guessed. Logo hexes come from the PNG itself.

## Colour palette

### Core

| Token | Hex | Where it comes from | Use for |
|---|---|---|---|
| `--k-blue` | `#034EA2` | The logo wordmark. **The** brand colour. | Headings, primary buttons, key section bands, logo reproduction |
| `--k-grey` | `#A7A9AC` | The logo's orbital swoosh | The swoosh only — see the contrast warning below |

### Supporting blues

| Token | Hex | Use for |
|---|---|---|
| `--k-blue-mid` | `#358CCB` | Nav links, section bands, secondary emphasis |
| `--k-blue-footer` | `#07529E` | Primary footer band |
| `--k-blue-bright` | `#0071BC` | Secondary footer band, accents |
| `--k-blue-sky` | `#52A4CA` | Tooltips, decorative fills |
| `--k-blue-pale` | `#C5D3E9` | Body text *on* dark blue backgrounds |

### Neutrals

| Token | Hex | Use for |
|---|---|---|
| `--k-ink` | `#111111` | Body copy on light backgrounds |
| `--k-muted` | `#929292` | Secondary/meta text |
| `--k-tint` | `#F1F4FA` | Alternating section backgrounds — the pale blue-grey wash |
| `--k-surface` | `#FFFFFF` | Cards, header, page ground |

## Accessibility guardrails

Measured contrast ratios. **The live site ships several failures — do not copy them.**

| Pair | Ratio | Verdict |
|---|---|---|
| `#034EA2` on white | 8.03 | AAA — safe anywhere |
| `#07529E` on white | 7.75 | AAA |
| white on `#034EA2` | 8.03 | AAA |
| `#111111` on white | 18.88 | AAA |
| `#C5D3E9` on `#034EA2` | 5.30 | AA |
| `#0071BC` on white | 5.14 | AA (normal text OK) |
| `#358CCB` on white | 3.64 | **Large text only** (≥24px, or ≥19px bold) |
| `#929292` on white | 3.11 | **Large text only** |
| `#929292` on `#F1F4FA` | 2.82 | **FAILS** |
| `#52A4CA` on white | 2.79 | **FAILS** for text |
| `#A7A9AC` on white | 2.36 | **FAILS** for text |

Rules that follow from this:

- **Never set body text in `#358CCB`.** The site does this for nav links and paragraph text; it
  fails AA. Use `--k-blue` (`#034EA2`) for links and small text instead — it reads as the same
  brand blue and clears AAA.
- **Never set text in `#A7A9AC` or `#52A4CA`.** Those are decorative fills.
- `#929292` is acceptable only for large text on pure white. On the `--k-tint` wash, drop to
  `#6B6B6B` or darker.
- Use `--k-blue-mid` for *backgrounds, borders and large display type* — that is where it works.

## Typography

**Montserrat** is the brand typeface, applied site-wide at `font-family: Montserrat !important`.
Weights 100–900 are loaded; the brand actually uses 300, 400, 500, 600, 700.

`DIN Next LT Pro` (light/300) appears on legacy interior pages for headings, and `Libre Franklin`
is inherited WordPress-theme leftover — **neither is part of the brand going forward.** Use
Montserrat.

### Stack

```css
font-family: 'Montserrat', 'Segoe UI', system-ui, -apple-system, sans-serif;
```

### Scale (as rendered at 1440px)

| Role | Size | Weight | Line height | Colour |
|---|---|---|---|---|
| Hero h1 | 23px (site) → prefer `clamp(1.75rem, 2.4vw, 2.75rem)` | 600 | 1.1 | white on imagery |
| Section h2 | 23px / `clamp(1.35rem, 1.9vw, 2rem)` | 600 | 1.1 | `--k-blue` |
| Eyebrow h2 | 16px | 500 | 1.1 | `--k-blue` |
| Stat figure | 58px | 700 | 1.1 | `--k-blue` |
| Card h5 | 17px | 500 | 1.1 | white on blue |
| Body | 16px | 300–400 | 1.5 | `--k-ink` |
| Button label | 10–12px, uppercase | 500 | — | varies |

Headings run **tight** — line-height ≈ 1.1, noticeably tighter than body at 1.5. Keep that
contrast; it is a real signature of the brand.

Sentence case for headings, **UPPERCASE for button labels**. Nav links are capitalised, weight 300.

## Logo

Files in [assets/](assets/):

| File | What it is | Use on |
|---|---|---|
| `logo-kacific.png` | 350×126 — full lockup: blue wordmark, grey orbital swoosh, tagline | Light backgrounds |
| `logo-kacific-white.png` | All-white reversed lockup | Blue or photographic backgrounds |
| `favicon-192.png` | 192×192 — the "K" mark inside the swoosh | Favicons, avatars, tight squares |
| `reference-homepage.png` | Homepage screenshot | Visual reference for layout and motif |

The wordmark is **KAC<em>i</em>F<em>i</em>C** — capitals with lowercase dotted `i`s, in `#034EA2`,
wrapped by an elliptical grey `#A7A9AC` swoosh that reads as an orbit. Tagline "the heart of
broadband" sits under the wordmark in light grey.

Usage:

- Keep clear space of at least the height of the "K" on all sides.
- Minimum width 120px for the full lockup — below that the tagline stops being legible; use the
  favicon mark instead.
- Never recolour, stretch, rotate, add effects to, or reconstruct the wordmark from live text.
- On busy photography, use the white variant, not the colour one.

## Visual language

**The orbit curve is the brand's signature motif.** The logo swoosh recurs across the site as large
elliptical masks on hero imagery and sweeping arc dividers between sections. When you need visual
interest, reach for a generous curve — not a rectangle, not a hard diagonal.

**Pill buttons.** White fill, uppercase brand-blue label, fully rounded, soft shadow, no border:

```css
.k-btn {
  background: #fff;
  color: var(--k-blue);
  border: 0;
  border-radius: 38px;
  padding: 14px 31px 10px;   /* note the optical bottom-lift */
  font: 500 0.75rem/1 'Montserrat', 'Segoe UI', system-ui, sans-serif;
  text-transform: uppercase;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
  cursor: pointer;
}
```

The asymmetric padding (14px top, 10px bottom) optically centres uppercase text, which has no
descenders. Keep it.

An outline variant exists for secondary actions: `1px solid #358CCB`, matching text colour, `5px`
radius, filling solid on hover.

**Section rhythm.** Full-bleed bands alternate: white → `--k-tint` (`#F1F4FA`) → solid
`--k-blue`/`--k-blue-mid` with white text. Cards sit on white with `5–6px` radius.

**Radii.** `38px` pills, `5–6px` cards and inputs, `4px` form controls.

**Single theme — light only.** The brand has no dark mode. Paint every colour explicitly.

## Voice

Plain, factual, benefit-first. Headlines state the offer directly: *"High-speed Internet. Unlimited
Data. Affordable Prices."* Emphasis lands on access, affordability and reach across the Asia
Pacific. Avoid hype and jargon.

## Applying it

For most work, copy [tokens.css](tokens.css) in and use the variables.

### In this repo specifically

`index.html` forbids any `<link>`, `<script src>` or `https://` URL (see the repo's CLAUDE.md — the
file must work offline from a shared drive). So:

- **Do not load Montserrat from Google Fonts.** Use the stack above unmodified — it renders
  Montserrat where installed and falls back to Segoe UI on Windows, which is a close enough
  grotesque that the layout does not shift meaningfully.
- **Do not `<img src>` the logo files.** Embed as a `data:` URI:

  ```powershell
  $b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes(".claude\skills\kacific-branding\assets\logo-kacific.png"))
  "data:image/png;base64,$b64" | Set-Clipboard
  ```

- Paste the token block into the existing `:root` rather than adding a second one.
- The repo's status pills (green/amber/red) are **semantic, not brand** — leave those colours alone.
  Brand blue applies to chrome, headings, buttons and focus rings.

### In Artifacts

Artifacts *may* load Google Fonts, so there you can add
`<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&display=swap" rel="stylesheet">`
and get the real typeface. Still give every face the fallback stack.
