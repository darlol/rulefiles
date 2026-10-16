import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { build } from '../scripts/build.mjs';
import { checkInternal } from '../scripts/check-links.mjs';
import { listFiles } from '../scripts/lib/util.mjs';
import { renderSitemap, renderRobots, renderLlmsTxt, renderFeed, cspFor, inlineHtml, agentsMdSentence } from '../scripts/lib/render.mjs';
import { matrixStats } from '../scripts/lib/validate.mjs';
import { launchWarnings } from '../scripts/lib/placeholders.mjs';
import { OG_WIDTH, OG_HEIGHT } from '../scripts/lib/ogimage.mjs';
import { loadData, publishedDigests } from '../scripts/lib/data.mjs';

process.env.BUILD_DATE = '2026-10-15';
delete process.env.SITE_URL;
delete process.env.NEWSLETTER_FORM_ACTION;
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-diffs-dist-'));
const read = (rel) => fs.readFileSync(path.join(out, rel), 'utf8');
const unescapeAttr = (s) => s.replace(/&#39;/g, "'");
let result;
before(() => { result = build({ outDir: out, quiet: true }); });
after(() => fs.rmSync(out, { recursive: true, force: true }));

const PAGES = ['index.html', 'matrix/index.html', 'generator/index.html', 'digest/index.html', 'digest/2026-W41/index.html', 'digest/2026-W42/index.html', 'about/index.html', 'sponsors/index.html', 'newsletter/index.html', 'privacy/index.html', '404.html'];

test('all expected pages and files exist', () => {
  for (const p of [...PAGES, 'sitemap.xml', 'robots.txt', 'llms.txt', 'llms-full.txt', 'digest/feed.xml', 'data/matrix.json', 'data/digests.json', 'assets/style.css', 'assets/generator.js', 'assets/generator-core.js', '_headers', 'favicon.svg']) {
    assert.ok(fs.existsSync(path.join(out, p)), p);
  }
});

test('every page has a unique title, one h1, description, canonical, Open Graph and lang', () => {
  const titles = new Set();
  for (const p of PAGES) {
    const html = read(p);
    const title = html.match(/<title>(.*?)<\/title>/)[1];
    assert.ok(!titles.has(title), `duplicate title ${title}`);
    titles.add(title);
    assert.equal((html.match(/<h1[ >]/g) || []).length, 1, `${p} h1 count`);
    assert.match(html, /<html lang="en">/);
    assert.match(html, /<meta name="description" content="[^"]{20,}"/);
    const indexable = !/<meta name="robots" content="noindex">/.test(html);
    if (indexable) {
      assert.match(html, /<link rel="canonical" href="https:\/\/agentdiffs\.dev\//, p);
      assert.match(html, /property="og:url"/, p);
    }
    for (const og of ['og:title', 'og:description', 'og:type', 'og:site_name', 'og:image']) assert.match(html, new RegExp(`property="${og}"`), `${p} ${og}`);
  }
});

test('the 404 page has no canonical link and no og:url, and is noindex', () => {
  const html = read('404.html');
  assert.doesNotMatch(html, /rel="canonical"/);
  assert.doesNotMatch(html, /property="og:url"/);
  assert.match(html, /<meta name="robots" content="noindex">/);
});

test('titles stay short: the home title is at most 60 characters and no title passes 70', () => {
  const titleOf = (p) => read(p).match(/<title>(.*?)<\/title>/)[1].replace(/&amp;/g, '&');
  assert.ok(titleOf('index.html').length <= 60, titleOf('index.html'));
  for (const p of PAGES) assert.ok(titleOf(p).length <= 70, `${p}: ${titleOf(p)} (${titleOf(p).length})`);
});

test('og:image points at a built 1200x630 PNG', () => {
  const html = read('index.html');
  assert.match(html, /<meta property="og:image" content="https:\/\/agentdiffs\.dev\/og\.png">/);
  assert.match(html, /<meta property="og:image:width" content="1200">/);
  assert.match(html, /<meta name="twitter:card" content="summary_large_image">/);
  const png = fs.readFileSync(path.join(out, 'og.png'));
  assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.equal(png.readUInt32BE(16), OG_WIDTH);
  assert.equal(png.readUInt32BE(20), OG_HEIGHT);
  assert.ok(png.length > 1000 && png.length < 100_000);
});

test('canonical URL matches the page path', () => {
  assert.match(read('matrix/index.html'), /rel="canonical" href="https:\/\/agentdiffs\.dev\/matrix\/"/);
  assert.match(read('digest/2026-W41/index.html'), /rel="canonical" href="https:\/\/agentdiffs\.dev\/digest\/2026-W41\/"/);
  assert.match(read('index.html'), /rel="canonical" href="https:\/\/agentdiffs\.dev\/"/);
});

test('JSON-LD blocks parse and carry the expected types', () => {
  const types = {};
  for (const p of PAGES) {
    const blocks = [...read(p).matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map((m) => JSON.parse(m[1]));
    types[p] = blocks.map((b) => b['@type']);
    for (const b of blocks) assert.equal(b['@context'], 'https://schema.org');
  }
  assert.ok(types['index.html'].includes('WebSite'));
  assert.ok(types['matrix/index.html'].includes('Dataset'));
  assert.ok(types['generator/index.html'].includes('WebApplication'));
  assert.ok(types['digest/2026-W41/index.html'].includes('Article'));
  assert.ok(types['digest/2026-W41/index.html'].includes('BreadcrumbList'));
});

test('sitemap lists every indexable page and not the 404', () => {
  const xml = read('sitemap.xml');
  const locs = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
  assert.equal(locs.length, PAGES.length - 1);
  assert.ok(locs.includes('https://agentdiffs.dev/matrix/'));
  assert.ok(!locs.some((l) => l.includes('404')));
  assert.match(xml, /<lastmod>2026-10-15<\/lastmod>/);
  for (const l of locs) {
    const p = new URL(l).pathname;
    assert.ok(fs.existsSync(path.join(out, p === '/' ? 'index.html' : path.join(p, 'index.html'))), l);
  }
});

test('sitemap and robots generators escape and point at the sitemap', () => {
  const cfg = { baseUrl: 'https://example.com' };
  assert.match(renderSitemap(cfg, [{ path: '/a&b/' }]), /https:\/\/example\.com\/a&amp;b\//);
  assert.match(renderRobots(cfg), /Sitemap: https:\/\/example\.com\/sitemap\.xml/);
  assert.match(read('robots.txt'), /User-agent: \*\nAllow: \//);
});

test('llms.txt follows the llms.txt layout and links resolve to built pages', () => {
  const txt = read('llms.txt');
  assert.match(txt, /^# Agent Diffs\n\n> /);
  assert.match(txt, /\n## Data\n/);
  assert.match(txt, /\n## Digest\n/);
  const links = [...txt.matchAll(/\]\((https:\/\/agentdiffs\.dev[^)]*)\)/g)].map((m) => new URL(m[1]).pathname);
  assert.ok(links.length >= 8);
  for (const p of links) {
    const file = p.endsWith('/') ? path.join(p, 'index.html') : p;
    assert.ok(fs.existsSync(path.join(out, file)), p);
  }
  const full = read('llms-full.txt');
  assert.match(full, /### AGENTS\.md/);
  assert.match(full, /Source: https:\/\/code\.claude\.com\/docs\/en\/memory/);
  assert.match(full, /Claude Code v2\.1\.293/);
});

test('llms-full.txt carries every matrix cell and every digest item', () => {
  const data = loadData();
  const full = read('llms-full.txt');
  assert.equal((full.match(/ \(checked 2026-10-15\)/g) || []).length, data.matrix.cells.length);
  for (const d of publishedDigests(data)) for (const i of d.items) assert.ok(full.includes(i.sourceUrl), i.id);
});

test('Atom feed is well formed and has one entry per issue', () => {
  const xml = read('digest/feed.xml');
  assert.match(xml, /^<\?xml version="1.0" encoding="utf-8"\?>\n<feed xmlns="http:\/\/www\.w3\.org\/2005\/Atom"/);
  assert.equal((xml.match(/<entry>/g) || []).length, 2);
  assert.equal((xml.match(/<entry>/g) || []).length, (xml.match(/<\/entry>/g) || []).length);
  assert.match(xml, /<updated>2026-10-15T00:00:00Z<\/updated>/);
  assert.doesNotMatch(xml, /<content type="html">[^<]*<ul>/, 'content must be escaped');
  const data = loadData();
  assert.match(xml, /<feed [^>]*>[\s\S]*?<author><name>Agent Diffs<\/name><\/author>[\s\S]*?<entry>/, 'feed-level author');
  assert.equal((xml.match(/<author><name>Agent Diffs<\/name><\/author>/g) || []).length, 3, 'feed plus one per entry');
  assert.doesNotMatch(xml, /<email>|<uri>/, 'no personal data in the author element');
  const one = renderFeed({ config: data.config, digests: [] });
  assert.match(one, /<updated>1970-01-01T00:00:00Z<\/updated>/);
});

test('matrix page shows every cell with its source link and date', () => {
  const html = read('matrix/index.html');
  const data = loadData();
  assert.equal((html.match(/<td class="st-/g) || []).length, data.matrix.cells.length);
  assert.equal((html.match(/checked <time datetime="2026-10-15">/g) || []).length, data.matrix.cells.length);
  assert.match(html, /Unverified/);
  assert.match(html, /<th scope="col">/);
  assert.match(html, /<th scope="row">/);
});

test('digest pages show sourced items', () => {
  const html = read('digest/2026-W41/index.html');
  assert.equal((html.match(/class="item"/g) || []).length, 11);
  assert.equal((html.match(/Source: <a href="https:\/\//g) || []).length, 11);
  assert.match(html, /<h2 id="t-claude-code">Claude Code<\/h2>/);
});

test('no cookies, no external scripts, fonts, images or trackers anywhere in the output', () => {
  for (const f of listFiles(out).filter((x) => /\.(html|js|css)$/.test(x))) {
    const s = fs.readFileSync(f, 'utf8');
    assert.doesNotMatch(s, /document\.cookie|localStorage|sessionStorage|navigator\.sendBeacon|XMLHttpRequest|\bfetch\(/, f);
    assert.doesNotMatch(s, /google-analytics|googletagmanager|plausible|matomo|hotjar|facebook\.net|fonts\.googleapis/i, f);
    assert.doesNotMatch(s, /<script[^>]+src="https?:/i, f);
    assert.doesNotMatch(s, /<link[^>]+href="https?:\/\/[^"]*\.css/i, f);
    assert.doesNotMatch(s, /@import|url\(\s*https?:/i, f);
  }
});

test('Content-Security-Policy meta tag locks scripts, styles and connections to self', () => {
  const html = unescapeAttr(read('index.html'));
  assert.match(html, /http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'none'; base-uri 'none'; form-action 'self'"/);
  assert.match(read('_headers'), /Content-Security-Policy: default-src 'none'/);
  assert.match(cspFor({ newsletter: { formAction: 'https://buttondown.com/api/emails/embed-subscribe/x' } }), /form-action 'self' https:\/\/buttondown\.com/);
});

test('internal links resolve, including anchors', () => {
  const { errors } = checkInternal(out);
  assert.deepEqual(errors, []);
});

test('newsletter form is disabled without a provider and enabled with one', () => {
  const html = read('newsletter/index.html');
  assert.match(html, /<input id="nl-email" name="email" type="email" disabled/);
  assert.match(html, /<button type="button" disabled>Subscribe<\/button>/);
  assert.doesNotMatch(html, /<form[^>]+action=/);
  const out2 = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-diffs-dist2-'));
  process.env.NEWSLETTER_FORM_ACTION = 'https://news.example.com/subscribe';
  try {
    build({ outDir: out2, quiet: true });
    const on = fs.readFileSync(path.join(out2, 'newsletter/index.html'), 'utf8');
    assert.match(on, /<form class="nl-form" method="post" action="https:\/\/news\.example\.com\/subscribe">/);
    assert.match(on, /double opt-in/);
    assert.match(unescapeAttr(fs.readFileSync(path.join(out2, 'index.html'), 'utf8')), /form-action 'self' https:\/\/news\.example\.com/);
  } finally {
    delete process.env.NEWSLETTER_FORM_ACTION;
    fs.rmSync(out2, { recursive: true, force: true });
  }
});

test('SITE_URL changes canonical URLs, sitemap and llms.txt', () => {
  const out3 = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-diffs-dist3-'));
  process.env.SITE_URL = 'https://preview.example.pages.dev/';
  try {
    build({ outDir: out3, quiet: true });
    assert.match(fs.readFileSync(path.join(out3, 'matrix/index.html'), 'utf8'), /rel="canonical" href="https:\/\/preview\.example\.pages\.dev\/matrix\/"/);
    assert.match(fs.readFileSync(path.join(out3, 'sitemap.xml'), 'utf8'), /<loc>https:\/\/preview\.example\.pages\.dev\/<\/loc>/);
    assert.match(fs.readFileSync(path.join(out3, 'llms.txt'), 'utf8'), /https:\/\/preview\.example\.pages\.dev\/matrix\//);
  } finally {
    delete process.env.SITE_URL;
    fs.rmSync(out3, { recursive: true, force: true });
  }
});

test('the build refuses invalid data', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-diffs-root-'));
  fs.cpSync(new URL('..', import.meta.url).pathname, root, { recursive: true, filter: (s) => !/node_modules|\/dist|\.git(\/|$)|\.cache/.test(s) });
  const m = JSON.parse(fs.readFileSync(path.join(root, 'data/matrix.json'), 'utf8'));
  m.cells[0].sourceUrl = 'https://example.com/not-official';
  fs.writeFileSync(path.join(root, 'data/matrix.json'), JSON.stringify(m));
  assert.throws(() => build({ root, outDir: path.join(root, 'dist'), quiet: true }), /refusing to build/);
  fs.rmSync(root, { recursive: true, force: true });
});

test('build output is deterministic', () => {
  const out4 = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-diffs-dist4-'));
  build({ outDir: out4, quiet: true });
  for (const f of listFiles(out)) {
    const rel = path.relative(out, f);
    assert.ok(fs.readFileSync(f).equals(fs.readFileSync(path.join(out4, rel))), rel);
  }
  fs.rmSync(out4, { recursive: true, force: true });
});

test('result reports the pages built', () => {
  assert.equal(result.pages.length, PAGES.length - 1);
});

test('matrix totals on every page come from the data', () => {
  const data = loadData();
  const stats = matrixStats(data.matrix);
  assert.equal(stats.total, data.matrix.cells.length);
  assert.equal(stats.unverified, data.matrix.cells.filter((c) => c.status === 'unverified').length);
  const unverified = String(stats.unverified);
  const migration = String(stats.byStatus['migration-only']);
  const cells = String(stats.total);
  const text = (rel) => read(rel).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  assert.match(text('index.html'), new RegExp(`Each of its ${cells} cells .*? ${unverified} of them are marked unverified .*? ${migration} are marked migration only`));
  assert.match(text('matrix/index.html'), new RegExp(`${cells} cells\\. Last reviewed`));
  assert.match(text('matrix/index.html'), new RegExp(`Unverified: ${unverified}\\b`));
  assert.match(text('matrix/index.html'), new RegExp(`Migration only: ${migration}\\b`));
  assert.match(text('about/index.html'), new RegExp(`${unverified} of ${cells} cells are unverified and ${migration} are migration only`));
  // Same cells, one more migration-only cell: the numbers follow the data.
  const m2 = structuredClone(data.matrix);
  const cell = m2.cells.find((c) => c.status === 'unverified');
  cell.status = 'migration-only';
  assert.equal(matrixStats(m2).unverified, stats.unverified - 1);
  assert.equal(matrixStats(m2).byStatus['migration-only'], stats.byStatus['migration-only'] + 1);
});

test('the three Claude Code cells that /init mentions are migration-only with a note that says so', () => {
  const data = loadData();
  const cells = ['cursorrules', 'cursor-rules-mdc', 'copilot-instructions-md'].map((f) => data.matrix.cells.find((c) => c.tool === 'claude-code' && c.file === f));
  for (const c of cells) {
    assert.equal(c.status, 'migration-only', c.file);
    assert.match(c.note, /\/init migration section/);
    assert.match(c.note, /does not say Claude Code loads/);
    assert.equal(c.sourceUrl, 'https://code.claude.com/docs/en/memory');
    assert.doesNotMatch(c.note, /Not mentioned/);
  }
  assert.match(read('llms-full.txt'), /Claude Code: Migration only\. Mentioned only in the \/init migration section/);
});

test('inlineHtml turns backtick spans into code elements and cannot inject markup', () => {
  assert.equal(inlineHtml('Set `effort` to high'), 'Set <code>effort</code> to high');
  assert.equal(inlineHtml('`onFailure: "block"`'), '<code>onFailure: &quot;block&quot;</code>');
  assert.equal(inlineHtml('`<script>alert(1)</script>`'), '<code>&lt;script&gt;alert(1)&lt;/script&gt;</code>');
  assert.equal(inlineHtml('<img src=x onerror=alert(1)> `a`'), '&lt;img src=x onerror=alert(1)&gt; <code>a</code>');
  assert.equal(inlineHtml('a `b` and `c`'), 'a <code>b</code> and <code>c</code>');
  assert.equal(inlineHtml('unbalanced `tick'), 'unbalanced `tick');
  assert.equal(inlineHtml('` `'), '<code> </code>');
  assert.doesNotMatch(inlineHtml('`x` <b>'), /<b>/);
});

test('built digest pages show source backticks as code and contain no raw backticks in text', () => {
  const w41 = read('digest/2026-W41/index.html');
  assert.match(w41, /<code>claude-haiku-5-5<\/code>/);
  assert.match(w41, /<code>effort<\/code>/);
  const body = w41.replace(/<script[\s\S]*?<\/script>/g, '');
  assert.doesNotMatch(body, /`/);
  assert.match(read('digest/feed.xml'), /&lt;code&gt;/);
});

test('the build warns, without failing, about placeholder text and the placeholder domain', () => {
  const warnings = result.warnings;
  assert.ok(Array.isArray(warnings));
  assert.ok(warnings.some((w) => w.startsWith('/privacy/:') && /will be (named|listed)/.test(w)), warnings.join('\n'));
  assert.ok(warnings.some((w) => w.startsWith('/about/:')), warnings.join('\n'));
  assert.ok(warnings.some((w) => w.startsWith('/sponsors/:')), warnings.join('\n'));
  assert.ok(warnings.some((w) => w.includes('placeholder https://agentdiffs.dev')));
  const clean = launchWarnings([{ path: '/x/', html: '<p>Contact: a@b.example.</p>' }], { baseUrl: 'https://real.example' });
  assert.deepEqual(clean, []);
  const dirty = launchWarnings([{ path: '/x/', html: '<p>A contact address will be listed here when sponsorship opens.</p>' }], { baseUrl: 'https://real.example' });
  assert.equal(dirty.length, 1);
});

test('about page does not invite reuse while no license is chosen, and the JSON-LD names no license', () => {
  const about = read('about/index.html').replace(/<[^>]+>/g, ' ');
  assert.doesNotMatch(about, /reuse a line|you can reuse|free to (use|reuse|copy)/i);
  assert.match(about, /Terms for reusing the data and the code are not set yet/);
  assert.doesNotMatch(read('matrix/index.html'), /"license"/);
  assert.ok(fs.existsSync(new URL('../docs/LAUNCH-BLOCKERS.md', import.meta.url)));
});

test('the generator page names AGENTS.md as the main file and cites the matrix for who reads it', () => {
  const html = read('generator/index.html');
  assert.match(html, /AGENTS\.md is the main file and is always generated\./);
  assert.match(html, /Optional extra files/);
  const sentence = agentsMdSentence(loadData().matrix);
  assert.match(sentence, /According to the <a href="\/matrix\/">matrix<\/a>, Cursor, Codex and GitHub Copilot read it, and Claude Code reads it under the conditions given in the matrix\./);
  assert.ok(html.includes(sentence));
  assert.equal(agentsMdSentence({ tools: [], cells: [] }), '');
  assert.match(html, /<input type="radio" name="claudeMode" value="import" checked>/);
});
