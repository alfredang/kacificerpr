# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

LogiTrack Inventory — a single-file warehouse inventory dashboard in Kacific livery.
There is no build step, no runtime dependencies and no network requests. The entire
app is [index.html](index.html) (design tokens + CSS, markup, one IIFE of ES5-style
vanilla JS, and the logo/favicon inlined as `data:` URIs), with 30 seed records in
[inventory.csv](inventory.csv).

Page order: ticker → header → hero band → KPI cards → table + add form → FAQ → footer.

`tools/` holds optional Node maintenance scripts that are **not** part of the app and
never run in the browser: [sync-embedded-csv.js](tools/sync-embedded-csv.js) and
[test.js](tools/test.js).

## Running it

Two supported modes, and both must keep working:

- `file://` — double-click `index.html`. `fetch()` is blocked here, so the app falls
  back to the CSV embedded in the page and shows a degraded-source warning.
- `http://` — e.g. `python -m http.server 8000` in the project root, then open
  `http://localhost:8000/`. `inventory.csv` is fetched with `cache: 'no-store'`.

## Tests

```
npm install jsdom        # the app has no deps; only the harness needs this
node tools/test.js       # 83 checks, exits non-zero on failure
```

[tools/test.js](tools/test.js) drives the real DOM and covers all four load paths
(fetch succeeds / fetch blocked → embedded fallback / malformed CSV / nothing
available), plus rendering, derived status, filtering, sorting, delete, validation
and the accessibility attributes.

Two things to respect when extending it:

- **Expectations are derived from `inventory.csv`, never hardcoded** — row counts,
  totals and the SKUs used for each case are computed from the file, so editing the
  data does not break the suite. Keep it that way.
- **Stub `fetch` via JSDOM's `beforeParse`.** The page's script runs at parse time, so
  assigning `window.fetch` after construction is too late; and because the CSV load is
  async, assertions must await a tick first (`settle()`).

There is no runner or watch mode — it is one plain Node file.

For layout, screenshot with `chrome --headless --screenshot --window-size=W,H <url>`.
Headless Chrome clamps its layout viewport to ~497px wide, so narrower "mobile"
screenshots are cropped rather than genuinely reflowed — measure
`document.body.scrollWidth` instead of trusting the image when checking for
horizontal overflow.

## The data duplication that matters

`inventory.csv` exists **twice**: as the file, and byte-identical inside
`<script type="text/csv" id="embedded-csv">` in [index.html](index.html). Any edit to
one must be mirrored to the other, or `file://` and `http://` will show different data.

After editing `inventory.csv`, run:

```
node tools/sync-embedded-csv.js
```

It rewrites the embedded block from the file, refuses to embed a CSV containing a
`</script` tag, and is idempotent (says "Already in sync" when there is nothing to do).
This is optional maintenance tooling, not a build step — `index.html` runs as shipped.

## Architecture (in [index.html](index.html))

The script is split into numbered sections (`1. CONSTANTS` … `8. INITIALISATION`).
The invariants worth knowing before editing:

- **`inventory` is the single source of truth.** It is populated once from the CSV at
  startup; nothing re-reads the CSV afterwards. Adds and deletes mutate this array and
  then call `renderAll()`. There is no persistence — a reload discards changes.
- **`COLUMNS` drives both `<thead>` and the sort comparator**, so they cannot drift.
  Adding a column means adding a `COLUMNS` entry *and* the matching `tr.appendChild`
  in `renderTable()`. `type` selects the comparator: `'number'`, `'status'` (ranked by
  urgency via `STATUS_RANK`, not alphabetically), `'text'` (`localeCompare`), or `null`
  for non-sortable. SKU is the stable tiebreaker for every sort.
- **Status is derived, never stored.** `getStatus()` reads `qty` vs `reorder`; do not
  add a `status` field to records.
- **`CATEGORIES` / `WAREHOUSES` constants feed every `<select>`** (filter dropdown and
  both form dropdowns) through `populateSelects()`.
- **Filters/sort are view-only state** (`filters`, `sort`) and never touch `inventory`;
  `getVisibleRecords()` returns a fresh filtered+sorted array.
- **Event handling is delegated** on `#header-row` and `#table-body`, because rows and
  their buttons are rebuilt on every render.
- **CSV parsing is a hand-rolled RFC 4180 parser** (`parseCSV`) that handles quoted
  fields, embedded commas/newlines, `""` escapes and a UTF-8 BOM. `recordsFromCSV()`
  skips invalid or duplicate-SKU rows and reports the count in the source note rather
  than letting `NaN` reach the table.
- **The four KPI cards reflect the whole dataset**, not the filtered view — a search
  must never make the network look healthier than it is. `renderSummary()` also fills
  the sub-line under each figure, shows `—` plus "Loading…" while the CSV is in
  flight, and flips the reorder card from red to green when nothing is below level.
- **The FAQ and footer are static markup.** No JS touches them; the `<details>`
  accordions are native.

## Conventions to preserve

- Vanilla ES5-flavoured JS inside one IIFE with `'use strict'` — `var`, `function`
  expressions, no arrow functions, no classes, no imports, no external libraries.
- Cells are built with `document.createElement` + `textContent` (never `innerHTML`
  with data), which is what keeps user input inert.
- No `alert()` / `confirm()`. Feedback goes to the `#announcer` live region via
  `announce()`; form errors render inline per field via `showError()`.
- Accessibility is deliberate and load-bearing: `aria-sort` on the active header,
  `aria-invalid` + `aria-describedby` on failed fields, focus moved to the first
  invalid field on submit, `aria-label` carrying the SKU on delete buttons,
  `role="status"` announcements. Keep these when touching render or validation code.
- Comments explain *why* a decision was made (the `fetch()` guard, the status ranking,
  the `novalidate` form). Match that register; do not narrate the obvious.
- Colours, spacing and radii come from the `:root` design tokens — add a token rather
  than hard-coding a value. The blues, greys, type weights and radii are Kacific brand
  values, measured from kacific.com — the `kacific-branding` skill in `.claude/`
  (local only, not committed) holds the source measurements and the logo files.
- **No external resources, ever.** No `<link>` to Google Fonts, no CDN script, no
  hotlinked image — all of it breaks `file://`, and `tools/test.js` fails the build
  if a remote `src`/`href`/`@import`/`url()` appears. Montserrat is used when locally
  installed and falls back to the system stack; the logo is a `data:` URI.
- The status colours are functional, not brand: keep `In Stock` / `Low Stock` /
  `Out of Stock` reading as green/amber/red rather than recolouring them to blue.
- Uppercase is reserved for button labels and table headers; the brand adds no
  letter-spacing to body or headings.
- Motion is decoration: everything animated is disabled under
  `prefers-reduced-motion`, and transitions list their properties rather than
  using `transition: all`.

## Failure paths that must keep working

Three distinct empty states are rendered in `renderTable()` and saying the wrong one
misleads: still loading / CSV loaded nothing / filter matched nothing. Likewise
`loadInventory()` guards `fetch` with a `try/catch` because a bare call throws a
synchronous `ReferenceError` where `fetch` is absent, which would escape the `.catch()`.
