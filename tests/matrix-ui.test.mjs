import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { build } from '../scripts/build.mjs';
import { loadData } from '../scripts/lib/data.mjs';
import { MATRIX_COPY, STATUS_LABEL, matrixPage, questionPath } from '../scripts/lib/render.mjs';
import { MATRIX_GRID_COPY } from '../scripts/lib/copy.mjs';
import { applyFilters, countMessage, queryWords } from '../src/js/matrix-filter.js';
import { TEST_DATE } from './helpers/test-date.mjs';

const out = fs.mkdtempSync(path.join(os.tmpdir(), 'matrix-ui-'));
let html;
before(() => { process.env.BUILD_DATE = TEST_DATE; build({ outDir: out, quiet: true }); html = fs.readFileSync(path.join(out, 'matrix', 'index.html'), 'utf8'); });
after(() => fs.rmSync(out, { recursive: true, force: true }));

const { matrix } = loadData();
const fileOf = Object.fromEntries(matrix.files.map((f) => [f.id, f]));
const toolOf = Object.fromEntries(matrix.tools.map((t) => [t.id, t]));
const model = {
  tools: matrix.tools.map((t) => t.id),
  files: matrix.files.map((f) => f.id),
  cells: matrix.cells.map((c) => ({ ...c, text: `${fileOf[c.file].path} ${fileOf[c.file].description} ${toolOf[c.tool].name} ${c.note}` }))
};

test('the search keeps the cells whose text holds every word, in any case, and combines with the other filters', () => {
  assert.deepEqual(queryWords('  Claude.MD   /init '), ['claude.md', '/init']);
  assert.deepEqual(queryWords(''), []);
  const r = applyFilters(model, { query: 'CLAUDE.md' });
  assert.ok(r.active && r.shown > 0 && r.shown < model.cells.length);
  for (const c of model.cells) assert.equal(r.matches.has(`${c.tool}/${c.file}`), c.text.toLowerCase().includes('claude.md'));
  const both = applyFilters(model, { query: 'claude.md', statuses: ['reads'] });
  assert.ok([...both.matches].every((k) => model.cells.find((c) => `${c.tool}/${c.file}` === k).status === 'reads'));
  const none = applyFilters(model, { query: 'no-such-word-anywhere' });
  assert.equal(none.shown, 0);
  assert.equal(none.visibleFiles.size, 0);
  assert.match(countMessage(none), /No cell matches/);
  assert.equal(applyFilters(model, { query: '   ' }).active, false, 'a blank query is no filter');
});

const unescape = (x) => x.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const entries = () => [...html.matchAll(/<li id="cell-([a-z0-9-]+)" class="an-cell" data-tool="([a-z-]+)" data-file="([a-z0-9-]+)" data-status="([a-z-]+)">([\s\S]*?)<\/li>/g)];

test('matrix page: the copy of the compact grid, pasted as reviewed, with N taken from the data', () => {
  assert.equal(MATRIX_GRID_COPY.help, 'Pick a cell for its note and source.');
  assert.equal(MATRIX_GRID_COPY.introFold, 'How to read the matrix');
  assert.equal(MATRIX_GRID_COPY.allNotes(104), 'All 104 notes and sources');
  assert.equal(MATRIX_GRID_COPY.allNotes(7), 'All 7 notes and sources', 'N is a parameter, never written in');
  assert.ok(html.includes(`<h1>Which coding agent reads which instruction file</h1>\n<p class="help">${MATRIX_GRID_COPY.help}</p>`));
  assert.ok(html.includes(`<summary>${MATRIX_GRID_COPY.introFold}</summary>`));
  assert.ok(html.includes(`<summary>${MATRIX_GRID_COPY.allNotes(matrix.cells.length)}</summary>`));
  assert.ok(html.includes(`<label for="matrix-q">${MATRIX_COPY.searchLabel}</label>`));
  assert.ok(html.includes('<input id="matrix-q" type="search"'));
  // The bar sits above the grid in the main column, out of the panel's column; its toggles reuse the group names.
  assert.ok(html.indexOf('<div class="mx-main">\n<div class="filters" id="matrix-filters">') > 0, 'the filter bar opens the main column');
  assert.ok(html.indexOf('id="matrix-filters"') < html.indexOf('id="matrix-grid"'));
  for (const [id, name] of [['matrix-f-tools', 'Tools'], ['matrix-f-status', 'Status']]) {
    assert.ok(html.includes(`<button type="button" class="btn filter-toggle" aria-expanded="false" aria-controls="${id}">${name}</button>`));
    assert.ok(html.includes(`<fieldset class="filter-group" id="${id}" hidden><legend class="sr">${name}</legend>`));
  };
  assert.ok(html.includes(`placeholder="${MATRIX_COPY.searchPlaceholder}"`));
  assert.match(html, /<ul class="status-counts" aria-label="Cells by status">/);
});

test('the "All N notes" fold counts the cells of the data, whatever their number', () => {
  const data = loadData();
  const keep = new Set(data.matrix.tools.slice(0, 3).map((t) => t.id));
  data.matrix.tools = data.matrix.tools.filter((t) => keep.has(t.id));
  data.matrix.cells = data.matrix.cells.filter((c) => keep.has(c.tool));
  const page = matrixPage({ config: data.config, matrix: data.matrix, digests: [], today: TEST_DATE });
  assert.notEqual(data.matrix.cells.length, 104);
  assert.ok(page.includes(`<summary>${MATRIX_GRID_COPY.allNotes(data.matrix.cells.length)}</summary>`), `${data.matrix.cells.length} cells`);
  assert.equal((page.match(/<li id="cell-/g) || []).length, data.matrix.cells.length);
  assert.equal((page.match(/<a class="mt /g) || []).length, data.matrix.cells.length);
});

test('without JavaScript both folds are open; matrix-fold.js closes only the intro, only on a phone', () => {
  assert.match(html, /<details class="fold intro-fold" id="matrix-intro" open><summary>/);
  assert.match(html, /<details class="fold allnotes" id="matrix-notes" open><summary>/);
  assert.match(html, /<\/details>\n<script src="\/assets\/matrix-fold\.js"><\/script>/, 'the fold script runs right after the intro, before the grid paints');
  const fold = fs.readFileSync(new URL('../src/static/matrix-fold.js', import.meta.url), 'utf8');
  assert.match(fold, /matchMedia\('\(max-width: 47\.99rem\)'\)/);
  assert.match(fold, /getElementById\('matrix-intro'\)/);
  assert.doesNotMatch(fold, /matrix-notes/);
});

test('every cell keeps its status, note, quote, source, date, version and answer page in the "All notes" list', () => {
  const list = entries();
  assert.equal(list.length, matrix.cells.length);
  const byKey = new Map(list.map((m) => [`${m[2]}/${m[3]}`, m]));
  let quotes = 0; let versions = 0;
  const answers = new Set();
  for (const c of matrix.cells) {
    const m = byKey.get(`${c.tool}/${c.file}`);
    assert.ok(m, `${c.tool}/${c.file}`);
    const [, id, , , status, body] = m;
    assert.equal(id, `${c.tool}-${c.file}`);
    assert.equal(status, c.status);
    assert.match(body, new RegExp(`<div class="cell" id="d-${c.tool}--${c.file}">`));
    assert.ok(body.includes(`<strong class="an-tool">${toolOf[c.tool].name.replace(/&/g, '&amp;')}</strong>`), 'names its tool');
    assert.match(body, new RegExp(`badge-${c.status}"`));
    assert.match(body, /<p class="note">[^<]/);
    assert.ok(unescape(body).includes(`href="${c.sourceUrl}"`), 'source');
    assert.ok(body.includes(`checked <time datetime="${c.verifiedOn}">`), 'date');
    if (c.quote) { quotes++; assert.match(body, /<blockquote class="quote"/); }
    if (c.version) { versions++; assert.ok(body.includes(`from v${c.version}`), 'version'); }
    if (body.includes(`<a href="${questionPath(c.tool, c.file)}"`)) answers.add(questionPath(c.tool, c.file));
  }
  assert.equal(quotes, matrix.cells.filter((c) => c.quote).length);
  assert.equal(quotes, 52, 'the 52 quoted cells of the data show their quote');
  assert.equal(versions, matrix.cells.filter((c) => c.version).length);
  // Every answer page links back from its cell (33 today), and each one exists in the build.
  const built = fs.readdirSync(path.join(out, 'does'), { recursive: true }).filter((f) => String(f).endsWith('index.html')).length;
  assert.equal(answers.size, built);
  assert.equal(answers.size, 33);
  // Each tile of the grid points at its entry and names file, tool and status.
  for (const c of matrix.cells) {
    const label = `${fileOf[c.file].path} × ${toolOf[c.tool].name}: ${STATUS_LABEL[c.status]}`;
    assert.ok(unescape(html).includes(`href="#d-${c.tool}--${c.file}" data-tool="${c.tool}" data-file="${c.file}" data-status="${c.status}" aria-label="${label}"`), label);
  }
});

test('the "All notes" list is never filtered: the script filters tiles, rows and columns of the grid only', () => {
  const js = fs.readFileSync(new URL('../src/static/matrix.js', import.meta.url), 'utf8');
  assert.doesNotMatch(js, /an-cell|an-list|an-file/, 'the script never selects the list entries');
  assert.match(js, /grid\.querySelectorAll\('\[data-tool\]:not\(a\)'\)/, 'columns are hidden inside the grid only');
  assert.match(js, /const tiles = \[\.\.\.grid\.querySelectorAll\('a\.mt'\)\]/);
  assert.match(js, /const rows = \[\.\.\.grid\.querySelectorAll\('\.mrow\[data-file\]'\)\]/);
  // The list sits outside the grid, so the grid selectors cannot reach it.
  const gridEnd = html.indexOf('<div class="mx-side">');
  assert.ok(html.indexOf('id="matrix-notes"') > gridEnd);
});

// ---------- First render: the filter bar shows at once with JavaScript, never without ----------

function rulesFor(css, selector) {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return [...src.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((m) => m[1].split(',').map((x) => x.trim()).includes(selector)).map((m) => m[2]);
}

test('the matrix and home load assets/js-flag.js synchronously in the head', () => {
  const head = /<head>([\s\S]*?)<\/head>/.exec(html)[1];
  const tag = /<script src="\/assets\/js-flag\.js"><\/script>/.exec(head);
  assert.ok(tag, 'the flag script is in the head');
  assert.doesNotMatch(tag[0], /\b(async|defer|type="module")\b/, 'it runs before the first paint');
  assert.ok(head.indexOf(tag[0]) < head.indexOf('rel="stylesheet"'), 'it does not wait for the stylesheet');
  const flag = fs.readFileSync(new URL('../src/static/js-flag.js', import.meta.url), 'utf8').replace(/\/\/.*$/gm, '').trim();
  assert.equal(flag, "document.documentElement.classList.add('js');", 'the file does one thing');
  const home = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
  assert.match(home, /<script src="\/assets\/js-flag\.js"><\/script>/, 'home loads the flag for digest chips');
  for (const f of fs.readdirSync(out, { recursive: true }).filter((x) => String(x).endsWith('.html') && !String(x).startsWith('matrix') && String(x) !== 'index.html')) {
    assert.ok(!fs.readFileSync(path.join(out, String(f)), 'utf8').includes('js-flag.js'), `${f} does not load the flag`);
  }
  // script-src 'self' allows it, in the meta CSP and in _headers.
  const csp = /http-equiv="Content-Security-Policy" content="([^"]*)"/.exec(html)[1].replace(/&#39;/g, "'");
  assert.match(csp, /script-src 'self'/);
  assert.match(fs.readFileSync(path.join(out, '_headers'), 'utf8'), /script-src 'self'/);
});

test('without JavaScript the filter bar is hidden by CSS and every note shows; html.js shows the bar', () => {
  const css = fs.readFileSync(new URL('../src/static/style.css', import.meta.url), 'utf8');
  const base = rulesFor(css, '.filters');
  assert.ok(base.length > 0 && base.every((d) => !/display:\s*(grid|flex|block)/.test(d)), 'no rule on .filters alone shows the bar');
  assert.ok(base.some((d) => /display:\s*none/.test(d)), '.filters is display: none by default');
  assert.ok(rulesFor(css, '.js .filters').some((d) => /display:\s*grid/.test(d)), '.js .filters shows the bar');
  assert.ok(rulesFor(css, '#matrix-count').some((d) => /min-height/.test(d)), 'the count line is reserved, so filling it moves nothing');
  assert.doesNotMatch(html, /<html[^>]*class="[^"]*\bjs\b/, 'the js class is never in the markup');
  assert.equal(matrix.cells.length, matrix.tools.length * matrix.files.length);
  assert.equal((html.match(/<p class="note">/g) || []).length, matrix.cells.length, 'one note per cell in the markup');
  const js = fs.readFileSync(new URL('../src/static/matrix.js', import.meta.url), 'utf8');
  assert.doesNotMatch(js, /bar\.hidden/, 'the script does not reveal the bar after the first paint');
});
