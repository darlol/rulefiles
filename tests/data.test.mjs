import test from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from '../scripts/lib/data.mjs';
import { validateMatrix, validateDigest, validateConfig, validateWatchSources, staleCells } from '../scripts/lib/validate.mjs';
import { isoWeekId, isoWeekRange, isIsoDate } from '../scripts/lib/util.mjs';
import { TEST_DATE, addDays } from './helpers/test-date.mjs';

const TODAY = TEST_DATE;
const data = loadData();

test('shipped data passes validation', () => {
  assert.deepEqual(validateConfig(data.config), []);
  assert.deepEqual(validateMatrix(data.matrix, data.hosts, TODAY).errors, []);
  assert.deepEqual(validateWatchSources(data.watchSources), []);
  for (const d of data.digests) assert.deepEqual(validateDigest(d.data, data.hosts, TODAY, d.file, data.matrix), [], d.file);
});

test('matrix has one cell per tool and file', () => {
  const m = data.matrix;
  assert.equal(m.cells.length, m.tools.length * m.files.length);
  assert.equal(m.tools.length, 4);
  assert.equal(m.files.length, 9);
});

test('every unverified cell says so in its note and carries a date', () => {
  for (const c of data.matrix.cells.filter((x) => x.status === 'unverified')) {
    assert.match(c.note, /Not mentioned|does not say/);
    assert.ok(isIsoDate(c.verifiedOn));
  }
});

test('matrix rejects a missing cell, a bad status, an http URL and an unknown host', () => {
  const m = structuredClone(data.matrix);
  m.cells.pop();
  assert.match(validateMatrix(m, data.hosts, TODAY).errors.join('\n'), /missing cell/);
  const m2 = structuredClone(data.matrix);
  m2.cells[0].status = 'yes';
  assert.match(validateMatrix(m2, data.hosts, TODAY).errors.join('\n'), /invalid status/);
  const m3 = structuredClone(data.matrix);
  m3.cells[0].sourceUrl = 'http://cursor.com/docs';
  assert.match(validateMatrix(m3, data.hosts, TODAY).errors.join('\n'), /https/);
  const m4 = structuredClone(data.matrix);
  m4.cells[0].sourceUrl = 'https://example.com/blog';
  assert.match(validateMatrix(m4, data.hosts, TODAY).errors.join('\n'), /allowed-source-hosts/);
});

test('matrix rejects future and malformed dates and duplicate cells', () => {
  const m = structuredClone(data.matrix);
  m.cells[0].verifiedOn = addDays(TODAY, 1);
  assert.match(validateMatrix(m, data.hosts, TODAY).errors.join('\n'), /future/);
  m.cells[0].verifiedOn = '2026-02-30';
  assert.match(validateMatrix(m, data.hosts, TODAY).errors.join('\n'), /YYYY-MM-DD/);
  const d = structuredClone(data.matrix);
  d.cells.push({ ...d.cells[0] });
  assert.match(validateMatrix(d, data.hosts, TODAY).errors.join('\n'), /duplicate cell/);
});

test('digest rejects out-of-week dates, bad source hosts and duplicate ids', () => {
  const base = structuredClone(data.digests[0].data);
  const a = structuredClone(base); a.items[0].date = '2026-01-01';
  assert.match(validateDigest(a, data.hosts, TODAY).join('\n'), /outside/);
  const b = structuredClone(base); b.items[0].sourceUrl = 'https://random-blog.example/post';
  assert.match(validateDigest(b, data.hosts, TODAY).join('\n'), /allowed-source-hosts/);
  const c = structuredClone(base); c.items[1].id = c.items[0].id;
  assert.match(validateDigest(c, data.hosts, TODAY).join('\n'), /duplicate id/);
  const d = structuredClone(base); d.start = '2026-10-04';
  assert.match(validateDigest(d, data.hosts, TODAY).join('\n'), /start\/end/);
  const e = structuredClone(base); e.items[0].text = 'x'.repeat(401);
  assert.match(validateDigest(e, data.hosts, TODAY).join('\n'), /longer than 400/);
});

test('digest items stay within their week and have sources', () => {
  for (const { data: d } of data.digests) {
    const { start, end } = isoWeekRange(d.week);
    for (const i of d.items) {
      assert.ok(i.date >= start && i.date <= end, `${i.id} outside ${d.week}`);
      assert.match(i.sourceUrl, /^https:\/\//);
    }
  }
});

test('stale cells are reported after the configured number of days', () => {
  // Dates follow the matrix: 30 days after the oldest check nothing is stale yet, 31 days after the newest check all is.
  const checked = data.matrix.cells.map((c) => c.verifiedOn).sort();
  assert.equal(staleCells(data.matrix, addDays(checked[0], 30), 30).length, 0);
  assert.equal(staleCells(data.matrix, addDays(checked.at(-1), 31), 30).length, data.matrix.cells.length);
});

test('ISO week helpers', () => {
  assert.equal(isoWeekId('2026-10-15'), '2026-W42');
  assert.equal(isoWeekId('2026-10-05'), '2026-W41');
  assert.equal(isoWeekId('2026-01-01'), '2026-W01');
  assert.equal(isoWeekId('2027-01-01'), '2026-W53');
  assert.deepEqual(isoWeekRange('2026-W41'), { start: '2026-10-05', end: '2026-10-11' });
});

test('watch sources reject github.com .atom feeds', () => {
  const ws = { sources: [{ id: 'x', tool: 'codex', type: 'rss', url: 'https://github.com/openai/codex/releases.atom' }] };
  assert.match(validateWatchSources(ws).join('\n'), /robots/);
});

test('cells re-checked on 2026-10-16 keep the status and the quoted wording the official pages support', () => {
  const cell = (tool, file) => data.matrix.cells.find((c) => c.tool === tool && c.file === file);
  const claude = cell('cursor', 'claude-md');
  assert.equal(claude.status, 'reads');
  assert.equal(claude.sourceUrl, 'https://cursor.com/help/customization/rules');
  assert.ok(claude.note.includes('"Cursor reads `CLAUDE.md` files the same way it reads `AGENTS.md`."'));
  const legacy = cell('cursor', 'cursorrules');
  assert.equal(legacy.status, 'migration-only');
  assert.ok(legacy.note.includes('"legacy and will be deprecated"'));
  const codexPath = cell('codex', 'copilot-instructions-md');
  assert.equal(codexPath.status, 'unverified', 'the Codex page lists file names per directory, not paths such as .github/');
  for (const c of data.matrix.cells.filter((x) => x.verifiedOn === '2026-10-16')) assert.ok(isIsoDate(c.verifiedOn));
});

test('no cell cites a page that has moved: the Cursor and Codex URLs are the ones the old links redirect to', () => {
  const urls = new Set([...data.matrix.cells.map((c) => c.sourceUrl), ...data.matrix.tools.map((t) => t.docsUrl)]);
  assert.ok(!urls.has('https://cursor.com/docs/context/rules'));
  assert.ok(![...urls].some((u) => u.startsWith('https://developers.openai.com/codex/')));
});
