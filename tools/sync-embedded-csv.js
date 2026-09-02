/*
 * Copies inventory.csv into the <script type="text/csv" id="embedded-csv">
 * block inside index.html.
 *
 * Why this exists: the app is meant to run by double-clicking index.html, but
 * browsers block fetch() on file:// URLs. So the page carries a fallback copy
 * of the CSV. That copy must stay byte-identical to inventory.csv, or the app
 * shows different data over file:// than over http://.
 *
 * This is optional maintenance tooling, NOT a build step — index.html runs as
 * shipped. Run it only after editing inventory.csv:
 *
 *     node tools/sync-embedded-csv.js
 *
 * Requires Node; no packages to install.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CSV = path.join(ROOT, 'inventory.csv');
const HTML = path.join(ROOT, 'index.html');

const csv = fs.readFileSync(CSV, 'utf8').trimEnd();
let html = fs.readFileSync(HTML, 'utf8');

// A CSV containing a script end tag would break out of the block.
if (/<\/script/i.test(csv)) {
  console.error('Refusing to embed: inventory.csv contains a </script tag.');
  process.exit(1);
}

const OPEN = '<script type="text/csv" id="embedded-csv">';
const start = html.indexOf(OPEN);
if (start === -1) {
  console.error('Could not find the embedded-csv block in index.html.');
  process.exit(1);
}
const end = html.indexOf('</script>', start);

const before = html.slice(0, start + OPEN.length);
const after = html.slice(end);
const updated = before + '\n' + csv + '\n  ' + after;

if (updated === html) {
  console.log('Already in sync — no change.');
  process.exit(0);
}

fs.writeFileSync(HTML, updated);
console.log('Embedded ' + (csv.split('\n').length - 1) + ' rows from inventory.csv into index.html.');
