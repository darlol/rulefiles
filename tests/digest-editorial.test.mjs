// Editorial blocks of a digest issue: "In short" (highlights), "Versions this week" and "Instruction files this week"
// (item `matrix`). The W43 issue used here is a test fixture, tests/fixtures/editorial/2026-W43.json. It is copied into a
// temporary copy of the repository and never into data/digest.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { build } from '../scripts/build.mjs';
import { loadData } from '../scripts/lib/data.mjs';
import { validateDigest, validateMatrix, cellAnchor } from '../scripts/lib/validate.mjs';
import { compareVersions } from '../scripts/lib/util.mjs';
import { versionRows, highlightText, VERSIONS_TABLE_FROM } from '../scripts/lib/render.mjs';
import { TEST_DATE } from './helpers/test-date.mjs';

const root = new URL('..', import.meta.url).pathname;
const FIXTURE = JSON.parse(fs.readFileSync(new URL('./fixtures/editorial/2026-W43.json', import.meta.url), 'utf8'));
// W44 test issue: the first week with the versions table. Its dates are after TEST_DATE, so its build uses its own date.
const FIXTURE_W44 = JSON.parse(fs.readFileSync(new URL('./fixtures/editorial/2026-W44.json', import.meta.url), 'utf8'));
const data = loadData(root);
const clone = (o) => JSON.parse(JSON.stringify(o));
/** The fixture without the two new fields: the same issue as a W43 written before the template. */
function withoutNewFields(d) {
  const c = clone(d);
  delete c.highlights;
  for (const i of c.items) delete i.matrix;
  return c;
}
const errorsOf = (d, matrix = data.matrix) => validateDigest(d, data.hosts, TEST_DATE, '2026-W43.json', matrix).join('\n');

// ---------- Validation ----------

test('editorial: the W43 fixture is valid with and without the new fields, and the shipped data still is', () => {
  assert.equal(errorsOf(FIXTURE), '');
  assert.equal(errorsOf(withoutNewFields(FIXTURE)), '');
  for (const d of data.digests) assert.deepEqual(validateDigest(d.data, data.hosts, TEST_DATE, d.file, data.matrix), [], d.file);
});

test('editorial: highlights name 3 to 5 existing items of the issue, each once', () => {
  const ids = FIXTURE.items.map((i) => i.id);
  const set = (hl) => ({ ...clone(FIXTURE), highlights: hl });
  assert.match(errorsOf(set([...ids.slice(0, 2), 'cursor-2026-10-19-missing'])), /highlights names "cursor-2026-10-19-missing", which is not an item of this issue/);
  assert.match(errorsOf(set([ids[0], ids[1], ids[0]])), /highlights names "cursor-2026-10-19-fixture" twice/);
  assert.match(errorsOf(set(ids.slice(0, 2))), /highlights must list 3 to 5 item ids, got 2/);
  assert.match(errorsOf(set([...ids, ids[0]].slice(0, 6))), /highlights must list 3 to 5 item ids, got 6/);
  assert.match(errorsOf(set('cursor-2026-10-19-fixture')), /highlights must be a list of item ids/);
  // An id of another issue does not count, even when it exists in data/digest.
  assert.match(errorsOf(set([ids[0], ids[1], data.digests[0].data.items[0].id])), /which is not an item of this issue/);
  for (const n of [3, 4, 5]) assert.equal(errorsOf(set(ids.slice(0, n))), '', `${n} highlights`);
});

test('editorial: item matrix pairs must exist in matrix.json, without duplicates or free text', () => {
  const withMatrix = (m) => { const d = clone(FIXTURE); d.items[0].matrix = m; return d; };
  assert.match(errorsOf(withMatrix([{ tool: 'cursor', file: 'no-such-file' }])), /matrix entry cursor\/no-such-file is not a cell of data\/matrix\.json/);
  assert.match(errorsOf(withMatrix([{ tool: 'antigravity', file: 'agents-md' }])), /matrix entry antigravity\/agents-md is not a cell/);
  assert.match(errorsOf(withMatrix([{ tool: 'cursor', file: 'agents-md' }, { tool: 'cursor', file: 'agents-md' }])), /matrix entry cursor\/agents-md is listed twice/);
  assert.match(errorsOf(withMatrix([{ tool: 'cursor', file: 'agents-md', note: 'free text' }])), /matrix entry cursor\/agents-md has unknown field\(s\) note/);
  assert.match(errorsOf(withMatrix([])), /matrix must be a non-empty list/);
  assert.match(errorsOf(withMatrix([{ tool: 'cursor' }])), /every matrix entry must be \{ "tool": "\.\.\.", "file": "\.\.\." \}/);
  assert.match(errorsOf(withMatrix('cursor/agents-md')), /matrix must be a non-empty list/);
  assert.match(errorsOf(FIXTURE, null), /matrix cannot be checked without data\/matrix\.json/);
});

test('editorial: every matrix cell has its own anchor, and validation refuses two cells with the same one', () => {
  const anchors = data.matrix.cells.map((c) => cellAnchor(c.tool, c.file));
  assert.equal(new Set(anchors).size, anchors.length);
  const m = clone(data.matrix);
  m.tools.push({ id: 'claude', name: 'X', docsUrl: m.tools[0].docsUrl });
  m.files.push({ id: 'code-agents-md', path: 'X.md', description: 'X' });
  for (const f of m.files) if (!m.cells.some((c) => c.tool === 'claude' && c.file === f.id)) m.cells.push({ ...m.cells[0], tool: 'claude', file: f.id });
  for (const t of m.tools) if (!m.cells.some((c) => c.tool === t.id && c.file === 'code-agents-md')) m.cells.push({ ...m.cells[0], tool: t.id, file: 'code-agents-md' });
  // claude-code × agents-md and claude × code-agents-md both make #cell-claude-code-agents-md.
  assert.match(validateMatrix(m, data.hosts, TEST_DATE).errors.join('\n'), /would share the anchor #cell-claude-code-agents-md/);
});

// ---------- Versions ----------

test('editorial: versions compare as SemVer, not as text', () => {
  assert.ok(compareVersions('2.1.10', '2.1.9') > 0);
  assert.ok(compareVersions('0.164.0', '0.163.0') > 0);
  assert.ok(compareVersions('1.10.0', '1.9.12') > 0);
  assert.equal(compareVersions('v1.4.0', '1.4.0'), 0);
  assert.equal(compareVersions('1.4', '1.4.0'), 0);
  assert.ok(compareVersions('0.164.0', '0.164.0-alpha.1') > 0, 'a release is above its prerelease');
  assert.ok(compareVersions('1.0.0-alpha.2', '1.0.0-alpha.10') < 0);
  assert.ok(compareVersions('1.0.0-alpha.1', '1.0.0-beta') < 0);
  assert.ok(compareVersions('1.0.0-1', '1.0.0-alpha') < 0, 'numeric identifiers sort below alphanumeric ones');
  assert.ok(compareVersions('1.0.0-alpha', '1.0.0-alpha.1') < 0);
  assert.ok(compareVersions('1.0.0+build.5', '1.0.0') === 0, 'build metadata is ignored');
  assert.ok(compareVersions('not a version', '0.0.1') < 0);
});

test('editorial: one version row per tool with a versioned item, holding the highest version and its date and source', () => {
  const rows = versionRows(FIXTURE);
  assert.deepEqual(rows.map((r) => [r.tool, r.item.version, r.item.date]), [['claude-code', '2.1.10', '2026-10-20'], ['codex', '0.164.0', '2026-10-19']]);
  assert.ok(!rows.some((r) => r.tool === 'cursor' || r.tool === 'github-copilot'), 'no row for a tool without a versioned item');
  // A tie on the version goes to the later date.
  const d = clone(FIXTURE);
  d.items.push({ ...d.items[2], id: 'claude-code-2026-10-21-v2.1.10', date: '2026-10-21' });
  assert.equal(versionRows(d)[0].item.id, 'claude-code-2026-10-21-v2.1.10');
  assert.deepEqual(versionRows({ items: [{ id: 'a', tool: 'cursor', date: '2026-10-19' }] }), []);
});

// ---------- Rendering: temporary copies of the repository with the W43 fixture (and the W44 one) ----------

let dir;
const out = {};
before(() => {
  process.env.BUILD_DATE = TEST_DATE;
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rulefiles-editorial-'));
  const variants = [['with', [FIXTURE], TEST_DATE], ['without', [withoutNewFields(FIXTURE)], TEST_DATE], ['w44', [FIXTURE, FIXTURE_W44], FIXTURE_W44.verifiedOn]];
  for (const [variant, digests, buildDate] of variants) {
    const r = path.join(dir, variant);
    for (const d of ['data', 'content', 'src', 'scripts']) fs.cpSync(path.join(root, d), path.join(r, d), { recursive: true });
    fs.copyFileSync(path.join(root, 'site.config.json'), path.join(r, 'site.config.json'));
    for (const digest of digests) fs.writeFileSync(path.join(r, 'data', 'digest', `${digest.week}.json`), JSON.stringify(digest, null, 2) + '\n');
    out[variant] = path.join(r, 'dist');
    process.env.BUILD_DATE = buildDate;
    build({ root: r, outDir: out[variant], quiet: true });
  }
  process.env.BUILD_DATE = TEST_DATE;
});
after(() => fs.rmSync(dir, { recursive: true, force: true }));
const read = (variant, rel) => fs.readFileSync(path.join(out[variant], rel), 'utf8');
const section = (html, cls) => (html.match(new RegExp(`<section class="${cls}"[\\s\\S]*?</section>`)) || [''])[0];

test('editorial: with highlights, "In short" replaces the summary under the lead, one linked bullet per id', () => {
  const html = read('with', 'digest/2026-W43/index.html');
  const s = section(html, 'in-short');
  assert.match(s, /<h2 id="in-short">In short<\/h2>/);
  const bullets = [...s.matchAll(/<li><a href="([^"]+)" rel="noopener">(.*?)<\/a><\/li>/g)];
  assert.equal(bullets.length, FIXTURE.highlights.length);
  const byId = Object.fromEntries(FIXTURE.items.map((i) => [i.id, i]));
  FIXTURE.highlights.forEach((id, n) => {
    assert.equal(bullets[n][1], byId[id].sourceUrl);
    assert.equal(bullets[n][2].replace(/<\/?code>/g, '`'), highlightText(byId[id]));
  });
  assert.equal(bullets[0][2], 'Claude Code v2.1.10 (3 settings)', 'the figure follows the title in parentheses');
  assert.equal(bullets[1][2], 'Codex 0.164.0', 'no parentheses without a figure');
  // The bullets hold nothing but the link.
  assert.equal(s.replace(/<li><a [^>]+>.*?<\/a><\/li>/g, ''), '<section class="in-short" aria-labelledby="in-short"><h2 id="in-short">In short</h2><ul></ul></section>');
  assert.doesNotMatch(html, /<p class="summary">/);
  assert.ok(html.indexOf('<p class="lead">') < html.indexOf('<section class="in-short"'));
  assert.ok(html.indexOf('<section class="in-short"') < html.indexOf('<section class="instruction-files"'));
  assert.ok(html.indexOf('<section class="instruction-files"') < html.indexOf('<section aria-labelledby="t-'));
});

test('editorial: without highlights the summary paragraph stays and there is no "In short"', () => {
  const html = read('without', 'digest/2026-W43/index.html');
  assert.match(html, /<p class="summary">Test fixture for the digest template\./);
  assert.doesNotMatch(html, /in-short|In short/);
  assert.ok(html.indexOf('<p class="summary">') < html.indexOf('<section aria-labelledby="t-'));
});

test('editorial: "Versions this week" starts with W44: absent from W43, with or without the new fields', () => {
  assert.equal(VERSIONS_TABLE_FROM, '2026-W44');
  for (const variant of ['with', 'without', 'w44']) {
    const html = read(variant, 'digest/2026-W43/index.html');
    assert.doesNotMatch(html, /class="versions"|Versions this week/, variant);
  }
  // In short and Instruction files this week stay on W43.
  assert.match(read('with', 'digest/2026-W43/index.html'), /<h2 id="in-short">In short<\/h2>[\s\S]*<h2 id="instruction-files">Instruction files this week<\/h2>/);
});

test('editorial: from W44, "Versions this week" lists the highest version per tool, needs no new field, and never says there was no release', () => {
  const html = read('w44', 'digest/2026-W44/index.html');
  const s = section(html, 'versions');
  assert.match(s, /<h2 id="versions">Versions this week<\/h2>/);
  const rows = [...s.matchAll(/<tr><th scope="row">([^<]+)<\/th><td>([^<]+)<\/td><td><time datetime="([^"]+)">[^<]+<\/time><\/td><td><a class="src" href="([^"]+)"/g)].map((m) => m.slice(1));
  // 2.1.12 wins over 2.1.11 although 2.1.11 is dated later: the row keeps the date of the highest version.
  assert.deepEqual(rows, [['Claude Code', '2.1.12', '2026-10-27', 'https://github.com/anthropics/claude-code/releases'], ['Codex', '0.165.0', '2026-10-28', 'https://github.com/openai/codex/releases']]);
  assert.doesNotMatch(s, /Cursor|GitHub Copilot|no release|none/i);
  // W44 has no highlights and no item matrix: the summary stays, then the table, then the tool sections.
  assert.ok(html.indexOf('<p class="summary">') < html.indexOf('<section class="versions"'));
  assert.ok(html.indexOf('<section class="versions"') < html.indexOf('<section aria-labelledby="t-'));
  assert.doesNotMatch(html, /in-short|instruction-files/);
  // The same W43 rows would be computed; only the start week keeps them off its page.
  assert.deepEqual(versionRows(FIXTURE).map((r) => [r.tool, r.item.version]), [['claude-code', '2.1.10'], ['codex', '0.164.0']]);
  // An issue without any versioned item has no block at all.
  const d = withoutNewFields(FIXTURE);
  for (const i of d.items) delete i.version;
  assert.deepEqual(versionRows(d), []);
});

test('editorial: "Instruction files this week" appears only with item matrix, one line per item linking the cells', () => {
  const html = read('with', 'digest/2026-W43/index.html');
  const s = section(html, 'instruction-files');
  assert.match(s, /<h2 id="instruction-files">Instruction files this week<\/h2>/);
  const lines = s.match(/<li class="item">[\s\S]*?<\/li>/g);
  assert.equal(lines.length, 2);
  // Newest first, as the items of the page: the Copilot item (20 Oct), then the Cursor item (19 Oct).
  assert.match(lines[0], /<q>Fixture wording that stands for a quote of the source\.<\/q>/);
  assert.match(lines[0], /<time datetime="2026-10-20">20 Oct 2026<\/time><a class="src" href="https:\/\/github\.blog\/changelog\/"/);
  assert.match(lines[0], /<a href="\/matrix\/#cell-github-copilot-copilot-instructions-md">Matrix cell GitHub Copilot × <code>\.github\/copilot-instructions\.md<\/code><\/a>/);
  assert.doesNotMatch(lines[1], /<q>/, 'an item with "quote": false is not shown as a quote');
  assert.match(lines[1], /#cell-cursor-cursor-rules-mdc">Matrix cell Cursor × <code>\.cursor\/rules\/\*\.mdc<\/code>/);
  assert.match(lines[1], /#cell-cursor-agents-md">Matrix cell Cursor × <code>AGENTS\.md<\/code>/);
  // Every linked anchor exists on /matrix/.
  const matrixHtml = read('with', 'matrix/index.html');
  for (const [, a] of s.matchAll(/href="\/matrix\/#([^"]+)"/g)) assert.match(matrixHtml, new RegExp(`<td id="${a}" `), a);
  assert.doesNotMatch(read('without', 'digest/2026-W43/index.html'), /instruction-files|Instruction files this week/);
});

test('editorial: /matrix/ gives each cell the anchor #cell-<tool>-<file>', () => {
  const html = read('with', 'matrix/index.html');
  const tds = [...html.matchAll(/<td id="([^"]+)" class="st-[a-z-]+" data-tool="([^"]+)" data-file="([^"]+)"/g)];
  assert.equal(tds.length, data.matrix.cells.length);
  for (const [, id, tool, file] of tds) assert.equal(id, `cell-${tool}-${file}`);
});

test('editorial: the Atom entry and llms-full.txt carry the same "In short" list, only for an issue with highlights', () => {
  const byId = Object.fromEntries(FIXTURE.items.map((i) => [i.id, i]));
  const entryOf = (variant, week) => read(variant, 'digest/feed.xml').match(new RegExp(`<entry>(?:(?!</entry>)[\\s\\S])*digest/${week}</id>[\\s\\S]*?</entry>`))[0];
  const withEntry = entryOf('with', '2026-W43');
  assert.match(withEntry, /&lt;h2&gt;In short&lt;\/h2&gt;&lt;ul&gt;&lt;li&gt;&lt;a href=&quot;https:\/\/github\.com\/anthropics\/claude-code\/releases&quot; rel=&quot;noopener&quot;&gt;Claude Code v2\.1\.10 \(3 settings\)&lt;\/a&gt;/);
  assert.equal((withEntry.match(/&lt;li&gt;&lt;a href=/g) || []).length, FIXTURE.highlights.length);
  assert.doesNotMatch(entryOf('without', '2026-W43'), /In short/);
  for (const w of ['2026-W41', '2026-W42']) assert.doesNotMatch(entryOf('with', w), /In short/, w);

  const full = read('with', 'llms-full.txt');
  const block = full.split('### ').find((b) => b.includes('(2026-W43)'));
  assert.ok(block.includes(['In short:', '', ...FIXTURE.highlights.map((id) => `- ${highlightText(byId[id])}: ${byId[id].sourceUrl}`), ''].join('\n')));
  assert.equal(full.match(/In short:/g).length, 1, 'only W43 has the list');
  assert.doesNotMatch(read('without', 'llms-full.txt'), /In short:/);
});

test('editorial: W41 and W42 keep their summary and get none of the new blocks', () => {
  assert.ok(VERSIONS_TABLE_FROM > '2026-W43');
  for (const variant of ['with', 'without', 'w44']) for (const w of ['2026-W41', '2026-W42']) {
    const html = read(variant, `digest/${w}/index.html`);
    assert.match(html, /<p class="summary">/, w);
    assert.doesNotMatch(html, /class="(in-short|versions|instruction-files)"|In short|Versions this week|Instruction files this week/, w);
  }
  for (const d of data.digests) {
    assert.equal(d.data.highlights, undefined, d.file);
    assert.ok(d.data.items.every((i) => i.matrix === undefined), d.file);
  }
});

// ---------- Titles from W43 ----------

/** From 2026-W43 the title names changes of the issue: at most 90 characters, and no longer "Digest for …". */
function titleProblems(d) {
  if (d.week < '2026-W43') return [];
  const p = [];
  if (d.title.length > 90) p.push(`${d.week}: title is ${d.title.length} characters, more than 90`);
  if (/^Digest for/.test(d.title)) p.push(`${d.week}: title still starts with "Digest for"`);
  return p;
}

test('editorial: from 2026-W43, a digest title is at most 90 characters and does not start with "Digest for"', () => {
  for (const d of data.digests) assert.deepEqual(titleProblems(d.data), [], d.file);
  assert.deepEqual(titleProblems(FIXTURE), []);
  assert.equal(titleProblems({ ...FIXTURE, title: 'x'.repeat(91) }).length, 1);
  assert.equal(titleProblems({ ...FIXTURE, title: 'Digest for 19 to 25 October 2026' }).length, 1);
  assert.deepEqual(titleProblems({ ...FIXTURE, week: '2026-W42', title: 'Digest for 12 to 18 October 2026' }), [], 'W42 and earlier keep their title');
});
