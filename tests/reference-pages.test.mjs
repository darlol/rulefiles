// The reference pages: /files/<id>/ for each instruction file, the /files/ index and /unverified/.
// The expected values come from data/matrix.json, read here directly, and from literal strings: nothing is computed
// with scripts/lib, so a page that drops, adds or swaps a cell disagrees with the test.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { build } from '../scripts/build.mjs';
import { TEST_DATE, addDays } from './helpers/test-date.mjs';

process.env.BUILD_DATE = TEST_DATE;
delete process.env.SITE_URL;
process.env.NEWSLETTER_FORM_ACTION = '';

const ROOT = new URL('..', import.meta.url).pathname;
const MATRIX = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'matrix.json'), 'utf8'));
// The footer links the public repository when repoUrl is set: an address the site already allows on every page.
const REPO_URL = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8')).repoUrl || '';
const BASE = 'https://rulefiles.dev';
const LICENSE = 'https://creativecommons.org/licenses/by/4.0/';
const LABEL = { reads: 'Reads', 'reads-conditionally': 'Reads, with conditions', configurable: 'Only if configured', 'migration-only': 'Migration only', 'not-read': 'Not read', unverified: 'Unverified' };
const NO_SOURCE = 'We then have no source, which says nothing about whether the tool reads it.';

const out = fs.mkdtempSync(path.join(os.tmpdir(), 'rulefiles-ref-'));
before(() => { build({ outDir: out, quiet: true }); });
after(() => fs.rmSync(out, { recursive: true, force: true }));

const read = (rel, dir = out) => fs.readFileSync(path.join(dir, rel), 'utf8');
const unescape = (s) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const text = (html) => unescape(html.replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const max = (dates) => [...dates].sort().at(-1);
const cellsOf = (m, fileId) => m.cells.filter((c) => c.file === fileId);
const ld = (html) => [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map((x) => JSON.parse(x[1]));
const rowsOf = (html) => [...html.matchAll(/<tr data-tool="([^"]+)"(?: data-file="([^"]+)")?>([\s\S]*?)<\/tr>/g)].map((x) => ({ tool: x[1], file: x[2], html: x[3], tds: [...x[3].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map((t) => t[1]) }));
const filePage = (id, dir = out) => read(`files/${id}/index.html`, dir);

test('one page per file id of matrix.json, and no other page under /files/', () => {
  const dirs = fs.readdirSync(path.join(out, 'files'), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
  assert.deepEqual(dirs, MATRIX.files.map((f) => f.id).sort());
  assert.equal(dirs.length, 9);
  for (const f of MATRIX.files) {
    const html = filePage(f.id);
    const title = `Which coding agents read ${f.path}?`;
    assert.equal(unescape(html.match(/<title>(.*?)<\/title>/)[1]), title, f.id);
    assert.equal(text(html.match(/<h1>([\s\S]*?)<\/h1>/)[1]), title, f.id);
    assert.ok(html.includes(`<link rel="canonical" href="${BASE}/files/${f.id}/">`), f.id);
    assert.ok(html.includes(`<meta property="og:url" content="${BASE}/files/${f.id}/">`), f.id);
    assert.ok(html.includes('<meta property="og:type" content="article">'), f.id);
    // The intro is the description of the file as written in the data, then the existing explanation of the two statuses.
    assert.equal(text(html.match(/<p class="lead">([\s\S]*?)<\/p>/)[1]), f.description, f.id);
    assert.ok(text(html).includes(NO_SOURCE), f.id);
  }
});

test('each file page shows every cell of its file: tool, status, note, sourceUrl and verifiedOn, in the order of the tools', () => {
  for (const f of MATRIX.files) {
    const rows = rowsOf(filePage(f.id));
    assert.deepEqual(rows.map((r) => r.tool), MATRIX.tools.map((t) => t.id), f.id);
    for (const r of rows) {
      const c = MATRIX.cells.find((x) => x.file === f.id && x.tool === r.tool);
      const t = MATRIX.tools.find((x) => x.id === r.tool);
      const where = `${f.id} × ${r.tool}`;
      assert.equal(r.tds.length, 4, where);
      assert.ok(text(r.html.match(/<th scope="row">([\s\S]*?)<\/th>/)[1]).startsWith(t.name), where);
      assert.equal(text(r.tds[0]), LABEL[c.status] + (c.version ? ` from v${c.version}` : ''), where);
      assert.ok(r.tds[0].includes(`badge-${c.status}`) && r.tds[0].includes(`#ic-${c.status}`), `${where}: badge with its icon`);
      assert.equal(text(r.tds[1]), c.note.replace(/`([^`\n]+)`/g, '$1'), where);
      assert.equal([...r.tds[2].matchAll(/<a class="src" href="([^"]+)"/g)].map((m) => unescape(m[1])).join(' '), c.sourceUrl, where);
      assert.equal((r.tds[2].match(/<a\b/g) || []).length, 1, `${where}: one link, the source`);
      assert.ok(r.tds[2].includes(`aria-label="Source — ${esc(f.path)} × ${esc(t.name)}"`), where);
      assert.equal(r.tds[3], `<time datetime="${c.verifiedOn}">${c.verifiedOn}</time>`, where);
    }
  }
});

test('file pages link the matrix, matrix.json, /unverified/, every other file page, the citation block and the newsletter form', () => {
  for (const f of MATRIX.files) {
    const html = filePage(f.id);
    for (const href of ['/matrix/', '/data/matrix.json', '/unverified/', '/files/']) assert.ok(html.includes(`href="${href}"`), `${f.id} → ${href}`);
    const others = MATRIX.files.filter((x) => x.id !== f.id).map((x) => `/files/${x.id}/`);
    const linked = [...html.matchAll(/href="(\/files\/[^"]+\/)"/g)].map((m) => m[1]);
    assert.deepEqual([...new Set(linked)].sort(), others.sort(), `${f.id}: links every other file page and not itself`);
    assert.ok(html.includes('<h2 id="cite">How to cite</h2>'), f.id);
    assert.ok(html.includes(`Suggested credit: "Rulefiles data by Rulefiles contributors, ${BASE}/matrix/, last reviewed ${MATRIX.lastReviewed}, licensed under CC BY 4.0 (${LICENSE})."`), f.id);
    assert.equal((html.match(/<form class="nl-form"/g) || []).length, 1, `${f.id}: one newsletter form`);
  }
});

test('file pages carry a TechArticle dated with the newest verifiedOn of the file, and a Home > Matrix > file breadcrumb', () => {
  for (const f of MATRIX.files) {
    const blocks = ld(filePage(f.id));
    assert.deepEqual(blocks.map((b) => b['@type']), ['TechArticle', 'BreadcrumbList'], f.id);
    const [art, crumbs] = blocks;
    assert.equal(art.headline, `Which coding agents read ${f.path}?`);
    assert.equal(art.dateModified, max(cellsOf(MATRIX, f.id).map((c) => c.verifiedOn)), f.id);
    assert.equal(art.mainEntityOfPage, `${BASE}/files/${f.id}/`);
    assert.equal(art.license, LICENSE);
    assert.deepEqual([...art.citation].sort(), [...new Set(cellsOf(MATRIX, f.id).map((c) => c.sourceUrl))].sort(), f.id);
    assert.deepEqual(crumbs.itemListElement.map((i) => [i.position, i.name, i.item]), [[1, 'Home', `${BASE}/`], [2, 'Matrix', `${BASE}/matrix/`], [3, f.path, `${BASE}/files/${f.id}/`]], f.id);
  }
});

test('/unverified/ lists exactly the cells marked unverified, with tool, file page, cited page and date', () => {
  const html = read('unverified/index.html');
  const expected = MATRIX.cells.filter((c) => c.status === 'unverified');
  assert.equal(expected.length, 15, 'the data holds 15 unverified cells on 2026-10-20; update this line with the data');
  assert.equal(unescape(html.match(/<h1>([\s\S]*?)<\/h1>/)[1]), "What the cited official pages don't say");
  assert.ok(text(html).includes(NO_SOURCE));
  const rows = rowsOf(html);
  const key = (c) => `${c.tool}/${c.file}`;
  assert.deepEqual(rows.map((r) => `${r.tool}/${r.file}`).sort(), expected.map(key).sort());
  for (const r of rows) {
    const c = expected.find((x) => key(x) === `${r.tool}/${r.file}`);
    const f = MATRIX.files.find((x) => x.id === c.file);
    assert.ok(text(r.html.match(/<th scope="row">([\s\S]*?)<\/th>/)[1]) === MATRIX.tools.find((t) => t.id === c.tool).name, key(c));
    assert.equal(r.tds[0], `<a href="/files/${c.file}/"><code>${esc(f.path)}</code></a>`, key(c));
    assert.equal([...r.tds[1].matchAll(/<a class="src" href="([^"]+)"/g)].map((m) => unescape(m[1])).join(' '), c.sourceUrl, key(c));
    assert.equal(r.tds[2], `<time datetime="${c.verifiedOn}">${c.verifiedOn}</time>`, key(c));
  }
  assert.doesNotMatch(html, /badge-(reads|configurable|migration-only|not-read)\b/, 'no other status on the page');
});

test('/files/ lists the 9 pages with the path, the description and the count of each status', () => {
  const html = read('files/index.html');
  const items = [...html.matchAll(/<li class="issue">([\s\S]*?)<\/li>\n?(?=<li class="issue">|<\/ul>)/g)].map((m) => m[1]);
  assert.equal(items.length, MATRIX.files.length);
  MATRIX.files.forEach((f, i) => {
    assert.ok(items[i].includes(`<a href="/files/${f.id}/"><code>${esc(f.path)}</code></a>`), f.id);
    assert.ok(items[i].includes(`<p class="muted">${esc(f.description)}</p>`), f.id);
    const shown = Object.fromEntries([...items[i].matchAll(/badge-([a-z-]+)"[\s\S]*?<span class="status-count">(\d+)<\/span>/g)].map((m) => [m[1], Number(m[2])]));
    const counts = {};
    for (const c of cellsOf(MATRIX, f.id)) counts[c.status] = (counts[c.status] || 0) + 1;
    assert.deepEqual(shown, counts, f.id);
  });
});

test('the matrix links each file row and the File column to the reference pages', () => {
  const html = read('matrix/index.html');
  for (const f of MATRIX.files) assert.ok(html.includes(`<tr data-file="${f.id}"><th scope="row"><a href="/files/${f.id}/"><code>${esc(f.path)}</code></a>`), f.id);
  assert.ok(html.includes('<th scope="col"><a href="/files/">File</a></th>'));
  assert.ok(html.includes('href="/unverified/"'));
});

test('the sitemap lists the new URLs with the newest verifiedOn of their cells, never the build date', () => {
  const xml = read('sitemap.xml');
  const lastmod = (p) => (xml.match(new RegExp(`<loc>${BASE}${p.replace(/[.*]/g, '\\$&')}</loc><lastmod>([^<]+)</lastmod>`)) || [])[1];
  const expect = [['/files/', max(MATRIX.cells.map((c) => c.verifiedOn))], ['/unverified/', max(MATRIX.cells.filter((c) => c.status === 'unverified').map((c) => c.verifiedOn))],
    ...MATRIX.files.map((f) => [`/files/${f.id}/`, max(cellsOf(MATRIX, f.id).map((c) => c.verifiedOn))])];
  for (const [p, date] of expect) {
    assert.equal(lastmod(p), date, p);
    assert.notEqual(lastmod(p), TEST_DATE, `${p}: not the build date`);
  }
  // A later build date changes none of them.
  const later = fs.mkdtempSync(path.join(os.tmpdir(), 'rulefiles-ref-later-'));
  process.env.BUILD_DATE = addDays(TEST_DATE, 3);
  try {
    build({ outDir: later, quiet: true });
    assert.equal(read('sitemap.xml', later), xml);
  } finally {
    process.env.BUILD_DATE = TEST_DATE;
    fs.rmSync(later, { recursive: true, force: true });
  }
});

test('llms.txt has one line per new page and llms-full.txt points each file to its page', () => {
  const txt = read('llms.txt');
  for (const f of MATRIX.files) assert.ok(txt.includes(`- [Which coding agents read ${f.path}?](${BASE}/files/${f.id}/): ${f.description}\n`), f.id);
  for (const p of ['/files/', '/unverified/']) assert.equal(txt.split(`](${BASE}${p})`).length - 1, 1, p);
  const full = read('llms-full.txt');
  for (const f of MATRIX.files) assert.ok(full.includes(`### ${f.path}\n\n${f.description}\n\nPage: ${BASE}/files/${f.id}/\n`), f.id);
});

test('the new pages link no external URL other than the sourceUrl of their own cells and the hosts already allowed', () => {
  const allowedHere = (rel) => {
    if (rel === 'unverified/index.html') return MATRIX.cells.filter((c) => c.status === 'unverified').map((c) => c.sourceUrl);
    if (rel === 'files/index.html') return [];
    return cellsOf(MATRIX, rel.split('/')[1]).map((c) => c.sourceUrl);
  };
  const pages = ['files/index.html', 'unverified/index.html', ...MATRIX.files.map((f) => `files/${f.id}/index.html`)];
  for (const rel of pages) {
    const html = read(rel);
    const allowed = new Set([...allowedHere(rel), LICENSE, ...(REPO_URL ? [REPO_URL] : [])]);
    for (const m of html.matchAll(/https?:\/\/[^"'\s<>)\\;]+/g)) {
      const u = unescape(m[0]);
      if (u.startsWith(`${BASE}/`) || u === BASE || u === 'https://schema.org' || u === 'https://static.cloudflareinsights.com') continue;
      assert.ok(allowed.has(u), `${rel}: ${u}`);
    }
    for (const m of html.matchAll(/\b(?:href|src|action)="(https?:[^"]+)"/g)) assert.ok(allowed.has(unescape(m[1])) || unescape(m[1]).startsWith(`${BASE}/`), `${rel}: ${m[1]}`);
  }
});

test('the pages follow the data: a cell that becomes unverified, a new description and a new date show up everywhere', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rulefiles-ref-root-'));
  try {
    fs.cpSync(ROOT, root, { recursive: true, filter: (s) => !/^(node_modules|dist|\.git|\.cache)(\/|$)/.test(path.relative(ROOT, s)) });
    const m = structuredClone(MATRIX);
    const cell = m.cells.find((c) => c.file === 'claude-md' && c.status === 'reads');
    cell.status = 'unverified';
    cell.note = 'Not mentioned on the page we checked. MUTATIONMARKER';
    const newDate = addDays(max(m.cells.map((c) => c.verifiedOn)), 1);
    cell.verifiedOn = newDate;
    // The matrix is reviewed a day after the cell is checked: /unverified/ must keep the cell date, not lastReviewed.
    m.lastReviewed = addDays(newDate, 1);
    // Hostile values: markup, a closing script tag, an ampersand and quotes must come out escaped in HTML and in the JSON-LD.
    const HOSTILE = '</script><img src=x onerror=alert(1)> & "q"';
    const desc = `Changed description MUTATIONMARKER ${HOSTILE}`;
    m.files.find((f) => f.id === 'gemini-md').description = desc;
    m.files.find((f) => f.id === 'claude-md').path = `CLAUDE.md${HOSTILE}`;
    cell.note = `Not mentioned on the page we checked. MUTATIONMARKER ${HOSTILE}`;
    fs.writeFileSync(path.join(root, 'data', 'matrix.json'), JSON.stringify(m, null, 2) + '\n');
    const dir = path.join(root, 'dist');
    build({ root, outDir: dir, quiet: true });
    const unv = rowsOf(read('unverified/index.html', dir));
    assert.equal(unv.length, MATRIX.cells.filter((c) => c.status === 'unverified').length + 1);
    assert.ok(unv.some((r) => r.tool === cell.tool && r.file === 'claude-md'));
    const row = rowsOf(filePage('claude-md', dir)).find((r) => r.tool === cell.tool);
    assert.equal(text(row.tds[0]), 'Unverified');
    assert.equal(row.tds[3], `<time datetime="${newDate}">${newDate}</time>`);
    assert.equal(ld(filePage('claude-md', dir))[0].dateModified, newDate);
    assert.ok(read('sitemap.xml', dir).includes(`<loc>${BASE}/files/claude-md/</loc><lastmod>${newDate}</lastmod>`));
    assert.ok(read('sitemap.xml', dir).includes(`<loc>${BASE}/unverified/</loc><lastmod>${newDate}</lastmod>`));
    assert.ok(!read('sitemap.xml', dir).includes(`<loc>${BASE}/unverified/</loc><lastmod>${m.lastReviewed}</lastmod>`));
    const ESC = '&lt;/script&gt;&lt;img src=x onerror=alert(1)&gt; &amp; &quot;q&quot;';
    const gemini = filePage('gemini-md', dir);
    assert.equal(gemini.match(/<p class="lead">([\s\S]*?)<\/p>/)[1], `Changed description MUTATIONMARKER ${ESC}`);
    const link = /<a href="\/files\/claude-md\/"><code>([\s\S]*?)<\/code><\/a>/.exec(gemini)[1];
    assert.equal(link.replace(/<span class="seg">|<\/span>|<wbr>/g, ''), `CLAUDE.md${ESC}`, 'the other-files list escapes the path');
    assert.ok(row.tds[1].includes(`MUTATIONMARKER ${ESC}`), 'the note is escaped');
    for (const html of [gemini, filePage('claude-md', dir), read('unverified/index.html', dir), read('files/index.html', dir)]) {
      assert.ok(!html.includes('<img src=x'), 'no raw markup from the data');
      for (const block of html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)) assert.ok(!block[1].includes('<'), 'the JSON-LD escapes "<"');
    }
    assert.ok(gemini.includes('\\u003c/script>'), 'the closing script tag in the JSON-LD is written \\u003c/script>');
    assert.equal(ld(gemini)[0].description, desc);
    assert.equal(ld(filePage('claude-md', dir))[1].itemListElement[2].name, `CLAUDE.md${HOSTILE}`);
    assert.ok(read('llms.txt', dir).includes(desc));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('the longest file path cannot push the page sideways on a phone', () => {
  // The repository has no browser in its tests, so the check is on the rules that make the h1 wrap: a <wbr> after each
  // "/" of the path, and overflow-wrap: anywhere on h1 as a backstop for a segment longer than the screen.
  // Measured with headless Chrome at 360 and 390 px: scrollWidth equals the viewport on every /files/ page.
  const css = fs.readFileSync(path.join(ROOT, 'src', 'static', 'style.css'), 'utf8');
  const rule = (sel) => (css.match(new RegExp(`(?:^|\\n)${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]*)\\}`)) || [])[1] || '';
  assert.match(rule('h1'), /overflow-wrap:\s*anywhere/, 'h1 may wrap anywhere');
  assert.match(rule('#cite ~ p'), /overflow-wrap:\s*anywhere/, 'the citation lines wrap their URL');
  assert.match(rule('.ref td.file-col code'), /white-space:\s*nowrap/, 'the File column of /unverified/ keeps each path on one line');
  const longest = [...MATRIX.files].sort((a, b) => b.path.length - a.path.length)[0];
  const h1 = filePage(longest.id).match(/<h1>([\s\S]*?)<\/h1>/)[1];
  assert.equal(h1, esc(`Which coding agents read ${longest.path}?`).replace(/\//g, '/<wbr>'), 'a break opportunity after each "/"');
  assert.doesNotMatch(filePage(longest.id).match(/<title>(.*?)<\/title>/)[1], /<wbr>/, 'the title stays plain text');
  assert.ok(Math.max(...h1.split(/<wbr>| /).map((s) => s.length)) <= 20, 'no unbreakable run longer than 20 characters');
});
