import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { build } from '../scripts/build.mjs';
import { checkInternal } from '../scripts/check-links.mjs';
import { listFiles } from '../scripts/lib/util.mjs';
import { renderSitemap, renderRobots, renderLlmsTxt, renderFeed, cspFor } from '../scripts/lib/render.mjs';
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
    assert.match(html, /<link rel="canonical" href="https:\/\/agentdiffs\.dev\//);
    for (const og of ['og:title', 'og:description', 'og:type', 'og:url', 'og:site_name']) assert.match(html, new RegExp(`property="${og}"`), `${p} ${og}`);
  }
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
    assert.equal(fs.readFileSync(f, 'utf8'), fs.readFileSync(path.join(out4, rel), 'utf8'), rel);
  }
  fs.rmSync(out4, { recursive: true, force: true });
});

test('result reports the pages built', () => {
  assert.equal(result.pages.length, PAGES.length - 1);
});
