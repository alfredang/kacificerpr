# LogiTrack Inventory

A single-file warehouse inventory dashboard: filterable, sortable stock table with
derived stock-status, live summary stats, and an inline add/delete form. No build
step, no runtime dependencies, no framework — the entire app is one `index.html`
(design tokens + CSS, markup, and one IIFE of ES5-flavoured vanilla JS).

**Live demo:** https://alfredang.github.io/kacificlogistics/

## The data is placeholder seed data

`inventory.csv` holds 30 **fictional** records — invented SKUs, suppliers and
Southeast Asian warehouse names (Singapore Hub, Johor DC, Jakarta Depot, Bangkok
Cross-dock). None of it is real inventory, real pricing, or a real supplier list.
Replace it with your own CSV before treating any number on screen as meaningful.

## Running it locally

Two supported modes, and both must keep working:

**`file://` — just double-click `index.html`.** Browsers block `fetch()` on
`file://` URLs, so the app falls back to a copy of the CSV embedded in the page and
shows a degraded-source warning under the table heading. This is a supported path,
not a bug.

**`http://` — serve the folder:**

```
python -m http.server 8000
```

then open <http://localhost:8000/>. Here `inventory.csv` is fetched with
`cache: 'no-store'`, so edits to the file show up on reload.

## The data duplication that will bite you

`inventory.csv` exists **twice**: as the file, and byte-identical inside
`<script type="text/csv" id="embedded-csv">` in `index.html`. Edit one without the
other and `file://` and `http://` will show different data.

After editing `inventory.csv`, run:

```
node tools/sync-embedded-csv.js
```

It rewrites the embedded block from the file, refuses to embed a CSV containing a
`</script` tag, and is idempotent (prints "Already in sync" when there is nothing to
do). This is optional maintenance tooling, **not** a build step — `index.html` runs
exactly as shipped.

## Tests

```
npm install jsdom     # the app has no deps; only the harness needs this
node tools/test.js    # 83 checks, exits non-zero on failure
```

`tools/test.js` drives the real DOM and covers all four load paths (fetch succeeds /
fetch blocked → embedded fallback / malformed CSV / nothing available), plus
rendering, derived status, filtering, sorting, delete, validation and the
accessibility attributes. There is no runner and no watch mode — it is one plain
Node file.

Two things to respect when extending it:

- **Expectations are derived from `inventory.csv`, never hardcoded.** Row counts,
  totals and the SKUs used for each case are computed from the file, so editing the
  data does not break the suite. Keep it that way.
- **Stub `fetch` via JSDOM's `beforeParse`.** The page's script runs at parse time,
  so assigning `window.fetch` after construction is too late; and because the CSV
  load is async, assertions must await a tick first.

## Deployment

Pushing to `main` triggers `.github/workflows/pages.yml`, which uploads the repo root
as-is and deploys it to GitHub Pages. There is no build step to configure — the
static files are the artifact.

**If you fork this, the first run will fail.** The workflow sets
`actions/configure-pages` to `enablement: true`, but creating a Pages site needs
admin rights that the workflow's `GITHUB_TOKEN` does not have, so it dies with
`Create Pages site failed. Error: Resource not accessible by integration`. Enable
Pages once by hand — Settings → Pages → Source: **GitHub Actions**, or
`gh api -X POST repos/OWNER/REPO/pages -f build_type=workflow` — and re-run the
workflow. Every deploy after that works unattended.

## Conventions a contributor could break by accident

The script in `index.html` is split into numbered sections (`1. CONSTANTS` …
`8. INITIALISATION`). The invariants worth knowing before editing:

- **`inventory` is the single source of truth.** Populated once from the CSV at
  startup; nothing re-reads the CSV afterwards. Adds and deletes mutate this array
  and then call `renderAll()`. There is no persistence — a reload discards changes.
- **`COLUMNS` drives both `<thead>` and the sort comparator**, so they cannot drift.
  Adding a column means adding a `COLUMNS` entry *and* the matching `tr.appendChild`
  in `renderTable()`. `type` selects the comparator: `'number'`, `'status'` (ranked
  by urgency via `STATUS_RANK`, not alphabetically), `'text'` (`localeCompare`), or
  `null` for non-sortable. SKU is the stable tiebreaker for every sort.
- **Status is derived, never stored.** `getStatus()` reads `qty` vs `reorder`; do not
  add a `status` field to records.
- **`CATEGORIES` / `WAREHOUSES` constants feed every `<select>`** — the filter
  dropdown and both form dropdowns — through `populateSelects()`.
- **Filters and sort are view-only state** and never touch `inventory`;
  `getVisibleRecords()` returns a fresh filtered+sorted array. Summary stats reflect
  the whole dataset, not the filtered view.
- **Event handling is delegated** on `#header-row` and `#table-body`, because rows
  and their buttons are rebuilt on every render.
- **Vanilla ES5-flavoured JS inside one IIFE with `'use strict'`** — `var`, function
  expressions, no arrow functions, no classes, no imports, no external libraries.
- **Cells are built with `document.createElement` + `textContent`**, never
  `innerHTML` with data. That is what keeps user input inert.
- **No `alert()` / `confirm()`.** Feedback goes to the `#announcer` live region via
  `announce()`; form errors render inline per field via `showError()`.
- **Accessibility is load-bearing:** `aria-sort` on the active header, `aria-invalid`
  + `aria-describedby` on failed fields, focus moved to the first invalid field on
  submit, `aria-label` carrying the SKU on delete buttons, `role="status"`
  announcements. Keep these when touching render or validation code.
- **Colours, spacing and radii come from the `:root` design tokens** — add a token
  rather than hard-coding a value.

Three distinct empty states are rendered in `renderTable()` and saying the wrong one
misleads the user: still loading / CSV loaded nothing / filter matched nothing.
Likewise `loadInventory()` guards `fetch` with a `try`/`catch` because a bare call
throws a synchronous `ReferenceError` where `fetch` is absent, which would escape the
`.catch()`.
