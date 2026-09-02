/*
 * Behaviour tests for LogiTrack Inventory.
 *
 * The app itself has no dependencies; this harness needs jsdom, which is the
 * only way to exercise the real DOM without a browser. Install it wherever you
 * like — it deliberately is not a dependency of the app:
 *
 *     npm install jsdom          (in this folder, or anywhere on NODE_PATH)
 *     node tools/test.js
 *
 * Two things about the page shape the harness:
 *   1. Its <script> runs at parse time, so any fetch stub must be installed via
 *      JSDOM's beforeParse hook — assigning window.fetch afterwards is too late.
 *   2. The CSV load is async, so assertions must await a tick first.
 */
'use strict';

const fs = require('fs');
const path = require('path');

let JSDOM;
try {
  ({ JSDOM } = require('jsdom'));
} catch (e) {
  console.error('jsdom is not installed. Run:  npm install jsdom');
  process.exit(2);
}

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const csv = fs.readFileSync(path.join(ROOT, 'inventory.csv'), 'utf8');

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail !== undefined ? '  -> ' + detail : '')); }
}
const cellsOf = tr => [...tr.children].map(td => td.textContent.trim());

// Builds a page whose fetch() behaves however the test needs.
function makePage(pageHtml, url, fetchImpl) {
  return new JSDOM(pageHtml, {
    runScripts: 'dangerously',
    url: url,
    beforeParse(w) { w.fetch = fetchImpl; }
  });
}
const serves = text => () => Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(text) });
const settle = () => new Promise(r => setTimeout(r, 250));

async function main() {

  // ------------------------------------------------------------ CSV file
  console.log('\n== inventory.csv ==');
  const lines = csv.trim().split('\n');
  check('header is the 9 expected columns',
    lines[0] === 'sku,name,category,warehouse,qty,reorder,cost,supplier,updated', lines[0]);
  const skus = lines.slice(1).map(l => l.split(',')[0]);
  check('every SKU is unique', new Set(skus).size === skus.length,
    skus.length - new Set(skus).size + ' duplicate(s)');
  check('every row has 9 fields', lines.slice(1).every(l => l.split(',').length === 9),
    lines.slice(1).find(l => l.split(',').length !== 9));

  const embedded = html.match(/<script type="text\/csv" id="embedded-csv">\n([\s\S]*?)\n  <\/script>/);
  check('embedded CSV block present', !!embedded);
  check('embedded copy matches inventory.csv byte for byte',
    embedded && embedded[1].trim() === csv.trim(),
    'run: node tools/sync-embedded-csv.js');

  // Everything below is derived from the CSV, so the suite never hardcodes
  // counts that go stale the moment someone edits a row.
  const seed = lines.slice(1).map(l => {
    const c = l.split(',');
    return { sku: c[0], name: c[1], category: c[2], warehouse: c[3],
             qty: +c[4], reorder: +c[5], cost: +c[6], supplier: c[7] };
  });
  const N = seed.length;
  const units = seed.reduce((s, r) => s + r.qty, 0);
  const below = seed.filter(r => r.qty <= r.reorder).length;
  const warehouses = new Set(seed.map(r => r.warehouse)).size;
  const fmt = n => n.toLocaleString('en-US');

  // ------------------------------------------- load path: fetch succeeds
  console.log('\n== load path: fetch succeeds (http://) ==');
  const dom = makePage(html, 'http://localhost/index.html', serves(csv));
  const document = dom.window.document;
  const $ = id => document.getElementById(id);
  const rows = () => [...document.querySelectorAll('#table-body tr')];
  const col = i => rows().map(tr => cellsOf(tr)[i]);
  const rowFor = sku => rows().find(tr => cellsOf(tr)[0] === sku);
  const fire = (el, type) => el.dispatchEvent(new dom.window.Event(type, { bubbles: true }));
  const click = el => el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));

  await settle();

  check(N + ' rows rendered from fetched CSV', rows().length === N, rows().length);
  check('11 columns', rows()[0].children.length === 11, rows()[0].children.length);
  check('source note names the csv', /inventory\.csv/.test($('data-source').textContent),
    $('data-source').textContent);
  check('source note is not a warning', !$('data-source').className.includes('source-note--warn'));

  console.log('\n== summary strip ==');
  check('SKUs = ' + N, $('stat-skus').textContent === fmt(N), $('stat-skus').textContent);
  check('units = ' + fmt(units), $('stat-units').textContent === fmt(units), $('stat-units').textContent);
  check('below reorder = ' + below, $('stat-low').textContent === fmt(below), $('stat-low').textContent);
  check('warehouses = ' + warehouses, $('stat-warehouses').textContent === String(warehouses),
    $('stat-warehouses').textContent);

  console.log('\n== derived status ==');
  const zero = seed.find(r => r.qty === 0);
  const low = seed.find(r => r.qty > 0 && r.qty <= r.reorder);
  const ok = seed.find(r => r.qty > r.reorder);
  check('qty 0 -> Out of Stock', cellsOf(rowFor(zero.sku))[8] === 'Out of Stock', zero.sku);
  check('0 < qty <= reorder -> Low Stock', cellsOf(rowFor(low.sku))[8] === 'Low Stock', low.sku);
  check('qty > reorder -> In Stock', cellsOf(rowFor(ok.sku))[8] === 'In Stock', ok.sku);
  check('out-of-stock pill is red', rowFor(zero.sku).children[8].querySelector('.pill').className.includes('pill--out'));
  check('low pill is amber', rowFor(low.sku).children[8].querySelector('.pill').className.includes('pill--low'));
  check('in-stock pill is green', rowFor(ok.sku).children[8].querySelector('.pill').className.includes('pill--in'));

  console.log('\n== formatting ==');
  check('cost rendered as USD with 2dp', /^\$[\d,]+\.\d\d$/.test(cellsOf(rowFor(ok.sku))[6]),
    cellsOf(rowFor(ok.sku))[6]);
  const big = seed.filter(r => r.qty >= 1000).sort((a, b) => b.qty - a.qty)[0];
  if (big) check('qty >= 1000 uses thousands separator',
    cellsOf(rowFor(big.sku))[4] === fmt(big.qty), cellsOf(rowFor(big.sku))[4]);

  console.log('\n== search + category filter ==');
  const supplier = seed[0].supplier;
  const expectSupplier = seed.filter(r =>
    [r.sku, r.name, r.supplier].some(f => f.toLowerCase().includes(supplier.toLowerCase()))).length;
  $('search').value = supplier.toLowerCase(); fire($('search'), 'input');
  check('supplier search matches ' + expectSupplier, rows().length === expectSupplier, rows().length);

  $('search').value = seed[0].name.toUpperCase(); fire($('search'), 'input');
  check('product search is case-insensitive', rows().length >= 1, rows().length);

  $('search').value = 'zzzznope'; fire($('search'), 'input');
  check('no match shows the filter empty state',
    rows().length === 1 && cellsOf(rows()[0])[0] === 'No records match', cellsOf(rows()[0])[0]);
  check('empty row spans all columns', rows()[0].children[0].colSpan === 11, rows()[0].children[0].colSpan);

  $('search').value = ''; fire($('search'), 'input');
  check('clearing search restores ' + N, rows().length === N, rows().length);

  const cat = seed[0].category;
  const inCat = seed.filter(r => r.category === cat).length;
  $('filter-category').value = cat; fire($('filter-category'), 'change');
  check('category filter -> ' + inCat + ' rows', rows().length === inCat, rows().length);
  check('result count reflects filter',
    new RegExp('Showing ' + inCat + ' of ' + N).test($('result-count').textContent),
    $('result-count').textContent);
  $('filter-category').value = '__all'; fire($('filter-category'), 'change');
  check('filters cleared -> ' + N + ' rows', rows().length === N, rows().length);

  console.log('\n== sorting ==');
  const header = key => document.querySelector('button[data-sort-key="' + key + '"]');
  click(header('qty'));
  const q1 = col(4).map(v => Number(v.replace(/,/g, '')));
  check('qty ascending is numeric, not lexicographic',
    q1.every((v, i) => i === 0 || q1[i - 1] <= v), q1.join(','));
  check('ascending arrow shown', header('qty').querySelector('.sort-arrow').textContent === '\u25B2');
  check('aria-sort=ascending', header('qty').closest('th').getAttribute('aria-sort') === 'ascending');
  click(header('qty'));
  const q2 = col(4).map(v => Number(v.replace(/,/g, '')));
  check('second click flips to descending', q2.every((v, i) => i === 0 || q2[i - 1] >= v));
  check('descending arrow shown', header('qty').querySelector('.sort-arrow').textContent === '\u25BC');
  click(header('cost'));
  const c1 = col(6).map(v => Number(v.replace(/[$,]/g, '')));
  check('cost ascending is numeric', c1.every((v, i) => i === 0 || c1[i - 1] <= v));
  check('previous column cleared its aria-sort',
    header('qty').closest('th').getAttribute('aria-sort') === null);
  click(header('status'));
  check('status sorts by urgency, not alphabetically',
    col(8)[0] === 'Out of Stock' && col(8)[N - 1] === 'In Stock', col(8)[0] + ' .. ' + col(8)[N - 1]);
  click(header('name'));
  check('text column sorts alphabetically', col(1)[0] < col(1)[N - 1], col(1)[0] + ' .. ' + col(1)[N - 1]);
  check('actions column is not sortable', document.querySelector('button[data-sort-key="actions"]') === null);
  click(header('sku'));

  console.log('\n== delete (event delegation) ==');
  /* Not seed[0] — the duplicate-SKU test below reuses that one, and deleting it
     first would make the "duplicate" genuinely unique. */
  const victim = seed.slice(1).find(r => r.qty > r.reorder);
  click(rowFor(victim.sku).querySelector('button[data-action="delete"]'));
  check('row removed', rows().length === N - 1, rows().length);
  check('deleted sku gone', !col(0).includes(victim.sku));
  check('summary SKUs decremented', $('stat-skus').textContent === fmt(N - 1), $('stat-skus').textContent);
  check('summary units recalculated',
    $('stat-units').textContent === fmt(units - victim.qty), $('stat-units').textContent);
  check('inline confirmation names the sku', $('announcer').textContent.includes(victim.sku),
    $('announcer').textContent);
  check('announcer is an aria-live region', $('announcer').getAttribute('aria-live') === 'polite');

  console.log('\n== form validation ==');
  const submit = () => fire($('add-form'), 'submit');
  const setForm = o => { for (const k in o) $('f-' + k).value = o[k]; };
  submit();
  check('empty submit -> 8 field errors',
    document.querySelectorAll('.error-msg.is-visible').length === 8,
    document.querySelectorAll('.error-msg.is-visible').length);
  check('no row added on invalid submit', rows().length === N - 1, rows().length);
  check('failed field gets aria-invalid', $('f-sku').getAttribute('aria-invalid') === 'true');
  check('failed field gets aria-describedby', $('f-sku').getAttribute('aria-describedby') === 'err-sku');
  check('category placeholder is empty-valued so it can fail validation', $('f-category').value === '');

  setForm({ sku: seed[0].sku, name: 'Dup Test', category: cat, warehouse: seed[0].warehouse,
            qty: '5', reorder: '2', cost: '1.50', supplier: 'Acme' });
  submit();
  const dupErrs = [...document.querySelectorAll('.error-msg.is-visible')];
  check('duplicate SKU -> exactly one error, on SKU',
    dupErrs.length === 1 && dupErrs[0].id === 'err-sku', dupErrs.map(e => e.id).join(','));
  $('f-sku').value = seed[0].sku.toLowerCase(); submit();
  check('duplicate check is case-insensitive', $('err-sku').classList.contains('is-visible'));
  $('f-sku').value = 'NEW-9001'; $('f-qty').value = '-5'; submit();
  check('negative quantity rejected', $('err-qty').classList.contains('is-visible'));

  console.log('\n== valid submit ==');
  $('f-qty').value = '0';
  submit();
  check('row added', rows().length === N, rows().length);
  const added = rowFor('NEW-9001');
  check('new record present', !!added);
  check('qty 0 -> Out of Stock', cellsOf(added)[8] === 'Out of Stock', cellsOf(added)[8]);
  const t = new Date();
  const iso = t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') +
              '-' + String(t.getDate()).padStart(2, '0');
  check('last updated is today', cellsOf(added)[9] === iso, cellsOf(added)[9]);
  check('cost formatted', cellsOf(added)[6] === '$1.50', cellsOf(added)[6]);
  check('new row highlighted', added.classList.contains('row-new'));
  check('errors cleared after success', document.querySelectorAll('.error-msg.is-visible').length === 0);
  check('form reset', $('f-sku').value === '' && $('f-name').value === '');
  check('confirmation announced', /NEW-9001/.test($('announcer').textContent));

  setForm({ sku: 'BND-1', name: 'Boundary', category: cat, warehouse: seed[0].warehouse,
            qty: '10', reorder: '10', cost: '2', supplier: 'Acme' });
  submit();
  check('qty exactly == reorder -> Low Stock', cellsOf(rowFor('BND-1'))[8] === 'Low Stock',
    cellsOf(rowFor('BND-1'))[8]);

  console.log('\n== clear button ==');
  setForm({ sku: 'X', name: 'Y' });
  submit();
  click($('clear-form'));
  check('clear empties the fields', $('f-sku').value === '' && $('f-name').value === '');
  check('clear removes errors', document.querySelectorAll('.error-msg.is-visible').length === 0);
  check('clear resets aria-invalid', $('f-sku').getAttribute('aria-invalid') === null);

  console.log('\n== structure / accessibility ==');
  check('one table with thead and tbody',
    document.querySelectorAll('table').length === 1 &&
    !!document.querySelector('thead') && !!document.querySelector('tbody'));
  check('every th has scope=col',
    [...document.querySelectorAll('thead th')].every(th => th.getAttribute('scope') === 'col'));
  check('every delete button has an aria-label',
    rows().every(tr => tr.querySelector('button[data-action="delete"]').hasAttribute('aria-label')));
  check('no inline event handlers', !/\son(click|change|submit|input)\s*=/i.test(html));
  check('every form control has a label',
    [...document.querySelectorAll('input,select')]
      .every(el => !!document.querySelector('label[for="' + el.id + '"]')));
  check('no storage APIs', !/localStorage|sessionStorage|indexedDB/.test(html));
  check('no external resources', !/<script src|<link |https?:\/\//.test(html));

  // ------------------------------- load path: fetch blocked (file://)
  console.log('\n== load path: fetch blocked (file://) -> embedded fallback ==');
  const domA = makePage(html, 'file:///c:/x/index.html',
    () => Promise.reject(new TypeError('Failed to fetch')));
  await settle();
  const dA = domA.window.document;
  check(N + ' rows rendered from the embedded copy',
    [...dA.querySelectorAll('#table-body tr')].length === N,
    [...dA.querySelectorAll('#table-body tr')].length);
  check('degraded notice explains file://', /file:\/\//.test(dA.getElementById('data-source').textContent),
    dA.getElementById('data-source').textContent);
  check('degraded notice styled as a warning',
    dA.getElementById('data-source').className.includes('source-note--warn'));

  // ------------------------------------- load path: malformed CSV
  console.log('\n== load path: malformed / hostile CSV ==');
  const bad = 'sku,name,category,warehouse,qty,reorder,cost,supplier,updated\n' +
              'OK-1,Good Row,Packaging,Johor DC,10,5,1.50,Acme,2026-01-01\n' +
              'BAD-1,Negative Qty,Packaging,Johor DC,-4,5,1.50,Acme,2026-01-01\n' +
              'BAD-2,Not A Number,Packaging,Johor DC,abc,5,1.50,Acme,2026-01-01\n' +
              'OK-1,Duplicate Sku,Packaging,Johor DC,7,5,1.50,Acme,2026-01-01\n' +
              ',Missing Sku,Packaging,Johor DC,7,5,1.50,Acme,2026-01-01\n' +
              '\n' +
              '"QT-1","Quoted, With Comma",Packaging,Johor DC,3,5,"2.25","O""Brien Supply",2026-01-01\n';
  const domC = makePage(html, 'http://localhost/index.html', serves(bad));
  await settle();
  const dC = domC.window.document;
  const rowsC = [...dC.querySelectorAll('#table-body tr')].map(cellsOf);
  check('only the 2 valid rows survive', rowsC.length === 2, rowsC.map(r => r[0]).join(','));
  check('quoted field containing a comma parsed', rowsC.some(r => r[1] === 'Quoted, With Comma'));
  check('"" escape parsed', rowsC.some(r => r[7] === 'O"Brien Supply'));
  check('skipped rows reported to the user',
    /4 row\(s\) skipped/.test(dC.getElementById('data-source').textContent),
    dC.getElementById('data-source').textContent);

  // --------------------------------- load path: nothing available
  console.log('\n== load path: no CSV and no fallback ==');
  const stripped = html.replace(/<script type="text\/csv" id="embedded-csv">[\s\S]*?<\/script>/, '');
  const domD = makePage(stripped, 'http://localhost/index.html',
    () => Promise.reject(new Error('network down')));
  await settle();
  const dD = domD.window.document;
  check('renders an empty table rather than crashing',
    [...dD.querySelectorAll('#table-body tr')].length === 1);
  check('explains the load failure', /Could not load data/.test(dD.getElementById('data-source').textContent),
    dD.getElementById('data-source').textContent);
  check('says "no data loaded", not "No records match"',
    dD.querySelector('#table-body tr').textContent.trim() === 'No inventory data loaded',
    dD.querySelector('#table-body tr').textContent.trim());

  console.log('\n' + (fail === 0
    ? 'ALL ' + pass + ' CHECKS PASSED'
    : pass + ' passed, ' + fail + ' FAILED'));
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
