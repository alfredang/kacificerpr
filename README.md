# LogiTrack Inventory

A single-file warehouse stock dashboard for tracking regional inventory positions across
a South-East Asia distribution network. Search, filter, sort, add and delete SKU records,
with stock status derived live from quantity against reorder level.

The entire application is one file — [`index.html`](index.html). No build step, no
package manager, no dependencies, no network access. Open it and it runs.

## Run it

```powershell
start index.html
```

Or just double-click the file. It works offline from a local disk or a shared drive,
which is why it deliberately loads nothing external — no CDN scripts, no web fonts.

## What it does

**Summary strip** — headline totals across the whole dataset: total SKUs, total units in
stock, items below reorder level, and warehouse count. These always reflect the full
record set and are *not* affected by the table filters.

**Inventory table** — eleven columns: SKU, Product Name, Category, Warehouse, Quantity,
Reorder Level, Unit Cost (USD), Supplier, Status, Last Updated, and a per-row delete
action. Every column except Actions sorts on click.

**Search and filter** — free-text search across SKU, product name and supplier, plus a
category dropdown. Filtering narrows the table only; the summary totals stay put.

**Add records** — a validated form for new SKUs. Quantity and Reorder Level must be
non-negative integers; Unit Cost accepts decimals and is rounded to 2dp on save; SKU
uniqueness is enforced trimmed and case-insensitively. If the active filters would hide
the row you just added, they are cleared automatically so the submission visibly lands.

**Stock status** is computed on every render, never stored, so it can never go stale:

| Status | Condition | Pill |
| --- | --- | --- |
| Out of Stock | `qty === 0` | red |
| Low Stock | `qty <= reorder` | amber |
| In Stock | otherwise | green |

The zero-check runs first, because `0` also satisfies `qty <= reorder`. Sorting the
Status column uses severity order, not alphabetical.

## Seed data

The app ships with 14 SKUs across 4 warehouses. It should render as:

- **14** total SKUs
- **27,134** total units
- **5** items below reorder level
- **4** warehouses
- **9** green / **4** amber / **1** red status pills

[`inventory.csv`](inventory.csv) is a **static snapshot** of that seed data, not a live
export. It does not track adds or deletes made in the browser, and its `Status` column is
a frozen copy of a derived value. Verify it still agrees with the app:

```powershell
$csv = Import-Csv .\inventory.csv
($csv | Measure-Object -Property Quantity -Sum).Sum   # expect 27134
$csv | Group-Object Status | Select-Object Count,Name # expect 9 / 4 / 1
```

Numbers in the CSV are deliberately unformatted (`12500`, not `12,500`) so spreadsheets
read those columns as numeric. Thousands separators and currency formatting exist only in
the UI layer.

## Design constraints

These are requirements of the project, not incidental choices:

- **One file.** Markup, CSS and JS all live in `index.html`. No bundler, no framework, no
  `<script src>` or `<link>` to anything.
- **No storage APIs.** No `localStorage`, `sessionStorage` or IndexedDB. State is
  in-memory only and **resets on reload** — that is intended behaviour, not a bug.
- **No browser dialogs.** No `alert()` or `confirm()`. Confirmations are announced
  through a polite live region instead.
- **No inline event handlers.** Everything is wired with `addEventListener`.

## Accessibility

Treated as a requirement rather than a nicety:

- A `<label for>` on every form input
- Semantic `<table>` with `<thead>`/`<tbody>` and an off-screen `<caption>`
- Sortable headers are real `<button>`s carrying `aria-sort`
- Field errors linked by `aria-describedby`, with `aria-invalid` on the input
- Visible `:focus-visible` rings throughout
- `role="status" aria-live="polite"` for add and delete confirmations

The design is deliberately single-theme (light). Every colour is painted explicitly from
`:root` custom properties, so no dark-mode variant is expected.

## Repository layout

```
index.html                            the entire application
inventory.csv                         static snapshot of the seed data
CLAUDE.md                             working guidance for Claude Code
.claude/commands/publish-to-github.md  /publish-to-github project command
```

## Development

There is no build, lint or test tooling — verification is manual. Before finishing any
change, confirm none of the banned patterns crept back in:

```powershell
Select-String -Path index.html -Pattern 'onclick=|localStorage|sessionStorage|alert\(|confirm\(|https?://|<script src|<link' -AllMatches
```

Expect zero matches. See [`CLAUDE.md`](CLAUDE.md) for the architecture notes and the
traps worth knowing before editing.
