import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyFilters, countMessage } from '../src/js/matrix-filter.js';
import { build } from '../scripts/build.mjs';
import { STATUS_LABEL } from '../scripts/lib/render.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'data', 'matrix.json'), 'utf8'));
const model = { tools: data.tools.map((t) => t.id), files: data.files.map((f) => f.id), cells: data.cells };

test('no selection shows every tool, file and cell', () => {
  const r = applyFilters(model, {});
  assert.equal(r.shown, data.cells.length);
  assert.equal(r.total, data.cells.length);
  assert.equal(r.visibleTools.size, data.tools.length);
  assert.equal(r.visibleFiles.size, data.files.length);
  assert.equal(r.active, false);
});

test('a status filter keeps the matching cells and hides rows without a match', () => {
  const r = applyFilters(model, { statuses: ['not-read'] });
  const expected = data.cells.filter((c) => c.status === 'not-read');
  assert.equal(r.shown, expected.length);
  assert.deepEqual([...r.visibleFiles].sort(), [...new Set(expected.map((c) => c.file))].sort());
  for (const c of data.cells) assert.equal(r.matches.has(`${c.tool}/${c.file}`), c.status === 'not-read');
});

test('a tool filter hides the other columns and counts only the cells that are still visible', () => {
  const r = applyFilters(model, { tools: ['codex'] });
  assert.deepEqual([...r.visibleTools], ['codex']);
  assert.equal(r.shown, data.files.length);
  assert.ok(![...r.matches].some((k) => !k.startsWith('codex/')));
});

test('tool and status filters combine, and several values in one group widen the result', () => {
  const both = applyFilters(model, { tools: ['codex', 'cursor'], statuses: ['reads', 'unverified'] });
  const expected = data.cells.filter((c) => ['codex', 'cursor'].includes(c.tool) && ['reads', 'unverified'].includes(c.status));
  assert.equal(both.shown, expected.length);
  const one = applyFilters(model, { tools: ['codex', 'cursor'], statuses: ['reads'] });
  assert.ok(one.shown < both.shown);
});

test('a combination with no match says so and leaves no visible row', () => {
  const r = applyFilters({ tools: ['a'], files: ['x'], cells: [{ tool: 'a', file: 'x', status: 'reads' }] }, { statuses: ['not-read'] });
  assert.equal(r.shown, 0);
  assert.equal(r.visibleFiles.size, 0);
  assert.match(countMessage(r), /No cell matches/);
});

test('the count message is a plain sentence for screen readers', () => {
  assert.equal(countMessage(applyFilters(model, {})), `Showing all ${data.cells.length} cells.`);
  const r = applyFilters(model, { statuses: ['reads'] });
  assert.equal(countMessage(r), `Showing ${r.shown} of ${data.cells.length} cells.`);
});

test('applyFilters does not change the model it is given', () => {
  const copy = JSON.stringify(model);
  applyFilters(model, { tools: ['codex'], statuses: ['reads'] });
  assert.equal(JSON.stringify(model), copy);
});

const out = fs.mkdtempSync(path.join(os.tmpdir(), 'matrix-filter-dist-'));
before(() => { build({ outDir: out, quiet: true }); });
after(() => fs.rmSync(out, { recursive: true, force: true }));

test('matrix page: filter bar is hidden until the script runs, and every control is a real button', () => {
  const html = fs.readFileSync(path.join(out, 'matrix', 'index.html'), 'utf8');
  assert.match(html, /<div class="filters" id="matrix-filters" hidden>/);
  for (const t of data.tools) assert.match(html, new RegExp(`<button type="button" class="chip" aria-pressed="false" data-filter-tool="${t.id}">`));
  for (const k of Object.keys(STATUS_LABEL)) assert.match(html, new RegExp(`<button type="button" class="chip chip-${k}" aria-pressed="false" data-filter-status="${k}">`));
  assert.match(html, /id="matrix-count" class="muted" role="status" aria-live="polite"/);
  assert.match(html, /<script type="module" src="\/assets\/matrix\.js"><\/script>/);
  // Without the script the table is complete: no row, column or cell is hidden in the markup.
  assert.doesNotMatch(html, /<(tr|th|td)\b[^>]*\bhidden\b/);
  assert.equal((html.match(/<td class="st-[a-z-]+" data-tool="[a-z-]+" data-file="[a-z0-9-]+" data-status="[a-z-]+">/g) || []).length, data.cells.length);
});

test('every status badge carries an icon and the status text, never colour alone', () => {
  const html = fs.readFileSync(path.join(out, 'matrix', 'index.html'), 'utf8');
  for (const [k, label] of Object.entries(STATUS_LABEL)) {
    assert.match(html, new RegExp(`<span class="badge badge-${k}"><svg class="ic" aria-hidden="true" focusable="false"><use href="#ic-${k}"/></svg>${label}</span>`), k);
    assert.match(html, new RegExp(`<symbol id="ic-${k}"`), `sprite has ${k}`);
  }
});

test('the browser filter script uses no storage, network or inline code, and only imports the shared module', () => {
  const js = fs.readFileSync(path.join(root, 'src', 'static', 'matrix.js'), 'utf8');
  assert.doesNotMatch(js, /localStorage|sessionStorage|document\.cookie|fetch\(|XMLHttpRequest|sendBeacon|eval\(|innerHTML|location\./);
  assert.deepEqual([...js.matchAll(/from '([^']+)'/g)].map((m) => m[1]), ['./matrix-filter.js']);
  assert.ok(fs.existsSync(path.join(out, 'assets', 'matrix-filter.js')));
});
