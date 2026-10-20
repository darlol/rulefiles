import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { build } from '../scripts/build.mjs';
import { loadData } from '../scripts/lib/data.mjs';
import { MATRIX_COPY } from '../scripts/lib/render.mjs';
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

test('matrix page: search field with a label, a notes toggle, a legend above the table and the counts without JavaScript', () => {
  assert.ok(html.includes(`<label for="matrix-q">${MATRIX_COPY.searchLabel}</label><input id="matrix-q" type="search"`));
  assert.ok(html.includes(`placeholder="${MATRIX_COPY.searchPlaceholder}"`));
  assert.ok(html.includes(`<button type="button" class="chip" aria-pressed="false" data-notes>${MATRIX_COPY.notesToggle}</button>`));
  assert.ok(html.indexOf('<details class="legend-box"><summary>Legend</summary>') < html.indexOf('<table class="matrix">'), 'the legend comes before the table');
  assert.equal((html.match(/<p class="cell-tool">/g) || []).length, matrix.cells.length, 'every cell names its tool for the card view');
  assert.match(html, /<ul class="status-counts" aria-label="Cells by status">/);
  // The search and the toggle sit in the filter bar, which stays hidden without JavaScript, so nothing is folded away then.
  const bar = /<div class="filters" id="matrix-filters" hidden>([\s\S]*?)\n<\/div>/.exec(html)[1];
  assert.ok(bar.includes('id="matrix-q"') && bar.includes('data-notes'));
  assert.doesNotMatch(html, /class="matrix notes-off"/, 'notes are folded only by the script');
});

test('the stylesheet folds notes only under .notes-off and turns the matrix into cards below 48rem', () => {
  const css = fs.readFileSync(new URL('../src/static/style.css', import.meta.url), 'utf8');
  assert.match(css, /\.notes-off \.note \{ display: none; \}/);
  assert.match(css, /@media \(max-width: 47\.99rem\) \{\n  \.scroll-hint \{ display: none; \}\n  \.table-wrap\.matrix-wrap \{ max-height: none; overflow: visible;/);
  const js = fs.readFileSync(new URL('../src/static/matrix.js', import.meta.url), 'utf8');
  assert.match(js, /table\.classList\.toggle\('notes-off', notes\.getAttribute\('aria-pressed'\) !== 'true' && query\.trim\(\) === ''\)/);
});
