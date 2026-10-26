import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { build } from '../scripts/build.mjs';
import { loadData } from '../scripts/lib/data.mjs';
import { MATRIX_COPY } from '../scripts/lib/render.mjs';
import { applyFilters, countMessage, queryWords, notesState } from '../src/js/matrix-filter.js';
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
  // The legend carries caveats that are not in the intro, so it is open by default (content review M1).
  const legendAt = html.indexOf('<details class="legend-box" open><summary>Legend</summary>');
  assert.ok(legendAt !== -1, 'the legend is an open details element');
  assert.ok(legendAt < html.indexOf('<table class="matrix">'), 'the legend comes before the table');
  assert.equal((html.match(/<details class="legend-box"[^>]*>/g) || []).length, 1, 'one legend block');
  assert.equal((html.match(/<p class="cell-tool">/g) || []).length, matrix.cells.length, 'every cell names its tool for the card view');
  assert.match(html, /<ul class="status-counts" aria-label="Cells by status">/);
  // The search and the toggle sit in the filter bar, which stays hidden without JavaScript, so nothing is folded away then.
  const bar = /<div class="filters" id="matrix-filters">([\s\S]*?)\n<\/div>/.exec(html)[1];
  assert.ok(bar.includes('id="matrix-q"') && bar.includes('data-notes'));
  assert.doesNotMatch(html, /class="matrix notes-off"/, 'notes are folded only by the script');
});

test('the stylesheet folds notes only under .notes-off and turns the matrix into cards below 48rem', () => {
  const css = fs.readFileSync(new URL('../src/static/style.css', import.meta.url), 'utf8');
  assert.match(css, /\.notes-off \.note \{ display: none; \}/);
  assert.match(css, /@media \(max-width: 47\.99rem\) \{\n  \.scroll-hint \{ display: none; \}\n  \.table-wrap\.matrix-wrap \{ max-height: none; overflow: visible;/);
  const js = fs.readFileSync(new URL('../src/static/matrix.js', import.meta.url), 'utf8');
  // Notes are visible by default: the class, aria-pressed and disabled all come from notesState, so the button
  // never says "pressed" while the notes show.
  assert.match(js, /let hideNotes = false;/);
  assert.match(js, /const n = notesState\(hideNotes, query\);/);
  assert.match(js, /table\.classList\.toggle\('notes-off', n\.hidden\);/);
  assert.match(js, /notes\.setAttribute\('aria-pressed', String\(n\.pressed\)\);/);
  assert.match(js, /notes\.disabled = n\.disabled;/);
  assert.doesNotMatch(js, /notes\.getAttribute\('aria-pressed'\)/, 'the script keeps the choice in hideNotes, not in the attribute');
  assert.equal(MATRIX_COPY.notesToggle, 'Hide notes');
});

test('the Hide notes button reports the real state of the notes, including during a search', () => {
  assert.deepEqual(notesState(false, ''), { hidden: false, pressed: false, disabled: false }, 'default: notes shown, not pressed');
  assert.deepEqual(notesState(true, ''), { hidden: true, pressed: true, disabled: false }, 'pressed: notes hidden');
  assert.deepEqual(notesState(true, 'glob'), { hidden: false, pressed: false, disabled: true }, 'a search shows the notes, so the button is not pressed');
  assert.deepEqual(notesState(false, 'glob'), { hidden: false, pressed: false, disabled: true });
  assert.deepEqual(notesState(true, '   '), { hidden: true, pressed: true, disabled: false }, 'a blank query is no search');
  for (const [want, q] of [[false, ''], [true, ''], [true, 'x'], [false, 'x']]) {
    const n = notesState(want, q);
    assert.equal(n.pressed, n.hidden, 'aria-pressed always matches whether the notes are hidden');
  }
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

test('without JavaScript the filter bar is hidden by CSS and all 36 notes show; html.js shows the bar', () => {
  const css = fs.readFileSync(new URL('../src/static/style.css', import.meta.url), 'utf8');
  const base = rulesFor(css, '.filters');
  assert.ok(base.length > 0 && base.every((d) => !/display:\s*(grid|flex|block)/.test(d)), 'no rule on .filters alone shows the bar');
  assert.ok(base.some((d) => /display:\s*none/.test(d)), '.filters is display: none by default');
  assert.ok(rulesFor(css, '.js .filters').some((d) => /display:\s*grid/.test(d)), '.js .filters shows the bar');
  assert.ok(rulesFor(css, '#matrix-count').some((d) => /min-height/.test(d)), 'the count line is reserved, so filling it moves nothing');
  assert.doesNotMatch(html, /<html[^>]*class="[^"]*\bjs\b/, 'the js class is never in the markup');
  assert.equal(matrix.cells.length, 36);
  assert.equal((html.match(/<p class="note">/g) || []).length, 36, '36 notes in the markup');
  assert.doesNotMatch(html, /notes-off/, 'nothing folds the notes without the script');
  const js = fs.readFileSync(new URL('../src/static/matrix.js', import.meta.url), 'utf8');
  assert.doesNotMatch(js, /bar\.hidden/, 'the script does not reveal the bar after the first paint');
});
