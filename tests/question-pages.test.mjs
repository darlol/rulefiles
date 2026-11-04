// Question pages (/does/<tool>/read/<file>/) and comparison pages (/compare/<slug>/): SPEC-question-pages.md §9.2.
// The expectations come from data/matrix.json and site.config.json read directly; scripts/lib is only built and run.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { build } from '../scripts/build.mjs';
import { checkInternal } from '../scripts/check-links.mjs';
import { validateMatrix, RESERVED_IDS } from '../scripts/lib/validate.mjs';
import { loadData } from '../scripts/lib/data.mjs';
import { STATUS_LABEL as LABEL } from '../scripts/lib/render.mjs';
import { QUESTION_COPY, COMPARE_COPY, CITE_COPY, SPEC_LABELS } from '../scripts/lib/copy.mjs';
import { TEST_DATE } from './helpers/test-date.mjs';
import { MATRIX, QUESTION_CELLS, QUESTION_STATUSES, COMPARE_SLUGS } from './helpers/pages.mjs';

process.env.BUILD_DATE = TEST_DATE;
delete process.env.SITE_URL;
const ROOT = new URL('..', import.meta.url).pathname;
const BASE = 'https://rulefiles.dev';
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'rulefiles-q-'));
const read = (rel, dir = out) => fs.readFileSync(path.join(dir, rel), 'utf8');
const decode = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const text = (html) => decode(html.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
const tool = (id) => MATRIX.tools.find((t) => t.id === id);
const file = (id) => MATRIX.files.find((f) => f.id === id);
const qrel = (c) => `does/${c.tool}/read/${c.file}/index.html`;
const jsonLd = (html) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].flatMap((m) => {
  const j = JSON.parse(m[1]); return j['@graph'] || (Array.isArray(j) ? j : [j]);
});
const listPages = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir, { recursive: true }).filter((f) => f.endsWith('index.html')).map((f) => f.replace(/\\/g, '/')) : []);
function copyRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rulefiles-q-root-'));
  fs.cpSync(ROOT, root, { recursive: true, filter: (s) => !/^(node_modules|dist|\.git|\.cache)(\/|$)/.test(path.relative(ROOT, s)) });
  return root;
}
// The literal short answers of §9.2 point 3, copied here on purpose.
const STARTS = { reads: 'Yes.', 'reads-conditionally': 'Yes, with conditions.', 'migration-only': 'Only for migration.', 'not-read': 'No.' };

let result;
before(() => { result = build({ outDir: out, quiet: true }); });
after(() => fs.rmSync(out, { recursive: true, force: true }));

test('1. one page per shipped cell, none for unverified or configurable cells, 33 in all', () => {
  assert.deepEqual(QUESTION_STATUSES, ['reads', 'reads-conditionally', 'migration-only', 'not-read']);
  for (const c of MATRIX.cells) {
    const shipped = c.status !== 'unverified' && c.quote && QUESTION_STATUSES.includes(c.status);
    assert.equal(fs.existsSync(path.join(out, qrel(c))), Boolean(shipped), `${c.tool}/${c.file} (${c.status})`);
  }
  assert.deepEqual(listPages(path.join(out, 'does')).sort(), QUESTION_CELLS.map((c) => qrel(c).slice('does/'.length)).sort());
  assert.equal(QUESTION_CELLS.length, 33);
});

test('2-4. title, H1, answer first, quote and source', () => {
  for (const c of QUESTION_CELLS) {
    const t = tool(c.tool); const f = file(c.file); const html = read(qrel(c));
    const title = `Does ${t.name} read ${f.path}?`;
    assert.ok(html.includes(`<title>${esc(title)}</title>`), `${c.tool}/${c.file} title`);
    const h1 = html.match(/<h1>([\s\S]*?)<\/h1>/)[1].replace(/<wbr>/g, '');
    assert.equal(decode(h1), title);
    const after = html.slice(html.indexOf('</h1>') + 5);
    const firstP = after.match(/<p( class="[^"]*")?>[\s\S]*?<\/p>/g).find((p) => !(t.scope && p === `<p class="muted">${esc(t.scope)}</p>`));
    assert.match(firstP, /^<p class="answer">/, `${c.tool}/${c.file}: the answer comes first`);
    const ans = text(firstP);
    assert.ok(ans.startsWith(`${LABEL[c.status]} ${STARTS[c.status]}`), `${c.tool}/${c.file}: ${ans}`);
    assert.ok(ans.includes(c.note.replace(/`|\*\*/g, '')), `${c.tool}/${c.file}: note`);
    const bq = html.match(new RegExp(`<blockquote cite="${esc(c.sourceUrl).replace(/[.?*+^$()[\]{}|\\]/g, '\\$&')}">([\\s\\S]*?)</blockquote>`));
    assert.ok(bq, `${c.tool}/${c.file}: blockquote`);
    assert.equal(bq[1], esc(c.quote).replace(/`([^`]*)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>'));
    assert.ok(html.includes(`href="${esc(c.sourceUrl)}" rel="noopener"`));
    assert.ok(html.includes(`<time datetime="${c.verifiedOn}">`));
  }
});

test('5-6. JSON-LD FAQPage and breadcrumb, canonical, no noindex', () => {
  for (const c of QUESTION_CELLS) {
    const html = read(qrel(c)); const pageUrl = `${BASE}/${qrel(c).replace(/index\.html$/, '')}`;
    const ld = jsonLd(html);
    const faq = ld.filter((x) => x['@type'] === 'FAQPage');
    assert.equal(faq.length, 1);
    assert.equal(faq[0].mainEntity[0].name, `Does ${tool(c.tool).name} read ${file(c.file).path}?`);
    const a = faq[0].mainEntity[0].acceptedAnswer.text;
    assert.ok(a.includes(c.sourceUrl) && a.includes(c.verifiedOn));
    const bc = ld.find((x) => x['@type'] === 'BreadcrumbList');
    assert.equal(bc.itemListElement.at(-1).item, pageUrl);
    assert.ok(html.includes(`<link rel="canonical" href="${pageUrl}">`));
    assert.doesNotMatch(html, /noindex/);
  }
});

test('7-8. sitemap lastmod is the cell date, llms.txt lists questions and comparisons', () => {
  const sm = read('sitemap.xml');
  for (const c of QUESTION_CELLS) {
    const loc = `${BASE}/does/${c.tool}/read/${c.file}/`;
    const entries = [...sm.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => m[1]).filter((u) => u.includes(`<loc>${loc}</loc>`));
    assert.equal(entries.length, 1, loc);
    assert.ok(entries[0].includes(`<lastmod>${c.verifiedOn}</lastmod>`), loc);
  }
  for (const s of COMPARE_SLUGS) assert.ok(sm.includes(`<loc>${BASE}/compare/${s}/</loc>`));
  const llms = read('llms.txt');
  const section = (name) => llms.split(`## ${name}\n`)[1].split('\n## ')[0].split('\n').filter((l) => l.startsWith('- '));
  assert.equal(section('Questions').length, QUESTION_CELLS.length);
  assert.equal(section('Comparisons').length, 3);
  const full = read('llms-full.txt');
  for (const c of QUESTION_CELLS) assert.ok(full.includes(`Page: ${BASE}/does/${c.tool}/read/${c.file}/`));
});

test('9. internal links between question, file and matrix pages, and no dead link', () => {
  for (const c of QUESTION_CELLS) {
    const html = read(qrel(c));
    assert.ok(html.includes(`href="/files/${c.file}/"`));
    assert.ok(html.includes(`href="/matrix/#cell-${c.tool}-${c.file}"`));
    assert.ok(read(`files/${c.file}/index.html`).includes(`href="/does/${c.tool}/read/${c.file}/"`), `files/${c.file} links ${c.tool}`);
    assert.ok(read('matrix/index.html').includes(`href="/does/${c.tool}/read/${c.file}/"`));
  }
  assert.doesNotThrow(() => checkInternal(out));
});

test('10. adding configurable to questionPages.statuses builds the 19 configurable pages (52 in all)', () => {
  const conf = MATRIX.cells.filter((c) => c.status === 'configurable');
  assert.equal(conf.length, 19);
  // With the wave-1 config, nothing links a configurable cell's question page.
  const all = listPages(out).map((p) => read(p)).join('\n');
  for (const c of conf) assert.ok(!all.includes(`/does/${c.tool}/read/${c.file}/`), `${c.tool}/${c.file} is linked`);
  const root = copyRoot(); const dist = path.join(root, 'dist');
  try {
    const cfgPath = path.join(root, 'site.config.json');
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    cfg.questionPages.statuses.push('configurable');
    fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
    build({ root, outDir: dist, quiet: true });
    assert.equal(listPages(path.join(dist, 'does')).length, 52);
    for (const c of conf) assert.ok(fs.existsSync(path.join(dist, qrel(c))), `${c.tool}/${c.file}`);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('11. comparison pages: counts from the data, every tool once, the cursorrules quote before the table', () => {
  for (const s of COMPARE_SLUGS) assert.ok(fs.existsSync(path.join(out, `compare/${s}/index.html`)), s);
  const html = read('compare/claude-md-vs-agents-md/index.html');
  const answers = [...html.matchAll(/<p class="answer">([\s\S]*?)<\/p>/g)].map((m) => text(m[1]));
  ['claude-md', 'agents-md'].forEach((fid, i) => {
    const cs = MATRIX.cells.filter((c) => c.file === fid);
    const n = cs.filter((c) => c.status === 'reads').length; const u = cs.filter((c) => c.status === 'unverified').length;
    assert.ok(answers[i].startsWith(`${n} of ${MATRIX.tools.length} tools read ${file(fid).path} by default`), answers[i]);
    if (u) assert.ok(answers[i].includes(`For ${u}, the official docs say nothing either way.`), answers[i]);
    else assert.ok(!answers[i].includes('say nothing either way'));
  });
  for (const s of COMPARE_SLUGS) {
    const page = read(`compare/${s}/index.html`);
    for (const t of MATRIX.tools) assert.equal(page.split(`<tr data-tool="${t.id}">`).length - 1, 1, `${s}: ${t.id}`);
  }
  const cr = read('compare/cursorrules-still-read/index.html');
  const q = MATRIX.cells.find((c) => c.tool === 'cursor' && c.file === 'cursorrules');
  const at = cr.indexOf(`<blockquote cite="${esc(q.sourceUrl)}">`);
  assert.ok(at > 0 && at < cr.indexOf('<table'));
});

test('13. each question page carries a static embed snippet with the page URL and the source', () => {
  for (const c of QUESTION_CELLS) {
    const html = read(qrel(c));
    const m = html.match(/<pre class="embed"><code>([\s\S]*?)<\/code><\/pre>/);
    assert.ok(m, qrel(c));
    const snippet = decode(m[1]);
    assert.ok(snippet.startsWith('<blockquote class="rulefiles-answer"'));
    assert.ok(snippet.includes(`${BASE}/does/${c.tool}/read/${c.file}/`) && snippet.includes(c.sourceUrl));
    assert.ok(html.includes(esc(CITE_COPY.heading)));
  }
});

test('14. the copy constants have no em or en dashes and no curly quotes', () => {
  const flat = (o) => (typeof o === 'function' ? [o('A', 'B', 'C', 'D')] : typeof o === 'string' ? [o] : Object.values(o).flatMap(flat));
  for (const [name, obj] of Object.entries({ QUESTION_COPY, COMPARE_COPY, CITE_COPY, SPEC_LABELS })) {
    for (const s of flat(obj)) assert.doesNotMatch(s, /[\u2014\u2013\u201c\u201d]/, `${name}: ${s}`);
  }
});

test('15. validator: quote on unverified, a quote over 300 characters, and a shipped cell without a quote', () => {
  const { hosts } = loadData(ROOT);
  const m = structuredClone(MATRIX);
  const u = m.cells.find((c) => c.status === 'unverified'); u.quote = 'x';
  assert.ok(validateMatrix(m, hosts, TEST_DATE).errors.some((e) => /quote/.test(e)));
  const m2 = structuredClone(MATRIX);
  m2.cells.find((c) => c.quote).quote = 'x'.repeat(301);
  assert.ok(validateMatrix(m2, hosts, TEST_DATE).errors.some((e) => /quote/.test(e)));
  const root = copyRoot();
  try {
    const m3 = structuredClone(MATRIX);
    const c = m3.cells.find((x) => x.status === 'reads' && x.quote); delete c.quote;
    fs.writeFileSync(path.join(root, 'data', 'matrix.json'), JSON.stringify(m3, null, 2));
    const r = build({ root, outDir: path.join(root, 'dist'), quiet: true });
    assert.ok(!fs.existsSync(path.join(root, 'dist', qrel(c))));
    assert.ok(r.warnings.some((w) => w.includes(`${c.tool}/${c.file}`) && /no quote/.test(w)), r.warnings.join('\n'));
    assert.throws(() => build({ root, outDir: path.join(root, 'dist2'), quiet: true, strict: true }), /no quote/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('16. does and compare are reserved ids', () => {
  assert.ok(RESERVED_IDS.includes('does') && RESERVED_IDS.includes('compare'));
});

test('no TODO-COPY placeholder is left anywhere in the build', () => {
  for (const f of fs.readdirSync(out, { recursive: true })) {
    const p = path.join(out, f);
    if (fs.statSync(p).isFile() && /\.(html|txt|xml|json|js|css)$/.test(p)) assert.doesNotMatch(fs.readFileSync(p, 'utf8'), /TODO-COPY/, f);
  }
});

test('12. CORS: /data/* is open to any origin, the /* rule keeps its CSP and has no Access-Control header', () => {
  const rules = read('_headers').split(/\n(?=\S)/);
  const data = rules.find((r) => r.startsWith('/data/*\n'));
  assert.ok(data && /\n  Access-Control-Allow-Origin: \*$/m.test(data), read('_headers'));
  const all = rules.find((r) => r.startsWith('/*\n'));
  assert.match(all, /\n  Content-Security-Policy: /);
  assert.doesNotMatch(all, /Access-Control-/);
});
