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
import { OG_WIDTH, OG_HEIGHT } from '../scripts/lib/ogimage.mjs';
import { loadData, publishedDigests } from '../scripts/lib/data.mjs';
import { markerFields } from '../scripts/lib/placeholders.mjs';

process.env.BUILD_DATE = '2026-10-16';
delete process.env.SITE_URL;
delete process.env.NEWSLETTER_FORM_ACTION;
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'rulefiles-dist-'));
const read = (rel) => fs.readFileSync(path.join(out, rel), 'utf8');
const unescapeAttr = (s) => s.replace(/&#39;/g, "'");
let result;
before(() => { result = build({ outDir: out, quiet: true }); });
after(() => fs.rmSync(out, { recursive: true, force: true }));

const PAGES = ['index.html', 'matrix/index.html', 'generator/index.html', 'digest/index.html', 'digest/2026-W41/index.html', 'digest/2026-W42/index.html', 'about/index.html', 'sponsors/index.html', 'newsletter/index.html', 'privacy/index.html', 'legal/index.html', '404.html'];

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
      assert.match(html, /<link rel="canonical" href="https:\/\/rulefiles\.dev\//, p);
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
  assert.match(html, /<meta property="og:image" content="https:\/\/rulefiles\.dev\/og\.png">/);
  assert.match(html, /<meta property="og:image:width" content="1200">/);
  assert.match(html, /<meta name="twitter:card" content="summary_large_image">/);
  const png = fs.readFileSync(path.join(out, 'og.png'));
  assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.equal(png.readUInt32BE(16), OG_WIDTH);
  assert.equal(png.readUInt32BE(20), OG_HEIGHT);
  assert.ok(png.length > 1000 && png.length < 100_000);
});

test('canonical URL matches the page path', () => {
  assert.match(read('matrix/index.html'), /rel="canonical" href="https:\/\/rulefiles\.dev\/matrix\/"/);
  assert.match(read('digest/2026-W41/index.html'), /rel="canonical" href="https:\/\/rulefiles\.dev\/digest\/2026-W41\/"/);
  assert.match(read('index.html'), /rel="canonical" href="https:\/\/rulefiles\.dev\/"/);
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
  assert.ok(locs.includes('https://rulefiles.dev/matrix/'));
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
  assert.match(txt, /^# Rulefiles\n\n> /);
  assert.match(txt, /\n## Data\n/);
  assert.match(txt, /\n## Digest\n/);
  const links = [...txt.matchAll(/\]\((https:\/\/rulefiles\.dev[^)]*)\)/g)].map((m) => new URL(m[1]).pathname);
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
  for (const c of data.matrix.cells) assert.ok(full.includes(`(checked ${c.verifiedOn})`), `${c.tool} ${c.file}`);
  assert.equal((full.match(/ \(checked \d{4}-\d\d-\d\d\)/g) || []).length, data.matrix.cells.length);
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
  assert.match(xml, /<feed [^>]*>[\s\S]*?<author><name>Rulefiles<\/name><\/author>[\s\S]*?<entry>/, 'feed-level author');
  assert.equal((xml.match(/<author><name>Rulefiles<\/name><\/author>/g) || []).length, 3, 'feed plus one per entry');
  assert.doesNotMatch(xml, /<email>|<uri>/, 'no personal data in the author element');
  const one = renderFeed({ config: data.config, digests: [] });
  assert.match(one, /<updated>1970-01-01T00:00:00Z<\/updated>/);
});

test('matrix page shows every cell with its source link and date', () => {
  const html = read('matrix/index.html');
  const data = loadData();
  assert.equal((html.match(/<td class="st-/g) || []).length, data.matrix.cells.length);
  assert.equal((html.match(/checked <time datetime="\d{4}-\d\d-\d\d">/g) || []).length, data.matrix.cells.length);
  for (const date of new Set(data.matrix.cells.map((c) => c.verifiedOn))) {
    const n = data.matrix.cells.filter((c) => c.verifiedOn === date).length;
    assert.equal((html.match(new RegExp(`checked <time datetime="${date}">`, 'g')) || []).length, n, date);
  }
  assert.match(html, /Unverified/);
  assert.match(html, /<th scope="col">/);
  assert.match(html, /<th scope="row">/);
});

test('digest pages show sourced items', () => {
  const html = read('digest/2026-W41/index.html');
  assert.equal((html.match(/class="item"/g) || []).length, 11);
  assert.equal((html.match(/<a class="src" href="https:\/\/[^"]+" rel="noopener" aria-label="Source: [^"]+">Source: /g) || []).length, 11);
  assert.equal((html.match(/<time datetime="\d{4}-\d\d-\d\d">\d{1,2} [A-Z][a-z]{2} \d{4}<\/time><span class="tag">/g) || []).length, 11, 'every item shows a date and a tool badge');
  assert.match(html, /<h2 id="t-claude-code">Claude Code <span class="count">4<\/span><\/h2>/);
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
  assert.match(html, /http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'none'; base-uri 'none'; form-action 'self'"/);
  assert.match(read('_headers'), /Content-Security-Policy: default-src 'none'/);
  // Assets keep stable names, so browsers must revalidate them: a cached old stylesheet under new HTML renders unstyled.
  assert.match(read('_headers'), /\/assets\/\*\n\s+Cache-Control: public, max-age=0, must-revalidate/);
  assert.doesNotMatch(read('_headers'), /max-age=(?!0\b)\d+/);
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
  const out2 = fs.mkdtempSync(path.join(os.tmpdir(), 'rulefiles-dist2-'));
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
  const out3 = fs.mkdtempSync(path.join(os.tmpdir(), 'rulefiles-dist3-'));
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
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rulefiles-root-'));
  fs.cpSync(new URL('..', import.meta.url).pathname, root, { recursive: true, filter: (s) => !/node_modules|\/dist|\.git(\/|$)|\.cache/.test(s) });
  const m = JSON.parse(fs.readFileSync(path.join(root, 'data/matrix.json'), 'utf8'));
  m.cells[0].sourceUrl = 'https://example.com/not-official';
  fs.writeFileSync(path.join(root, 'data/matrix.json'), JSON.stringify(m));
  assert.throws(() => build({ root, outDir: path.join(root, 'dist'), quiet: true }), /refusing to build/);
  fs.rmSync(root, { recursive: true, force: true });
});

test('build output is deterministic', () => {
  const out4 = fs.mkdtempSync(path.join(os.tmpdir(), 'rulefiles-dist4-'));
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

test('the build warns, without failing, about the marker that remains and the placeholder domain', () => {
  const warnings = result.warnings;
  assert.ok(Array.isArray(warnings));
  assert.ok(warnings.some((w) => w.startsWith('/privacy/:') && w.includes('[[TODO-OWNER: data controller name]]')), warnings.join('\n'));
  assert.ok(warnings.some((w) => w.includes('placeholder https://rulefiles.dev')));
  for (const page of ['/about/', '/sponsors/', '/legal/', '/newsletter/']) assert.ok(!warnings.some((w) => w.startsWith(`${page}:`)), `${page} carries no marker`);
  assert.equal(warnings.length, 2, warnings.join('\n'));
});

test('about page names both licenses and the suggested credit, and the JSON-LD names the data license', () => {
  const about = read('about/index.html').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  assert.match(about, /The code is under the MIT license\./);
  assert.match(about, /are under CC BY 4\.0/);
  assert.match(about, /Suggested credit: &quot;Rulefiles data by Rulefiles contributors, https:\/\/rulefiles\.dev\/, licensed under CC BY 4\.0 \(https:\/\/creativecommons\.org\/licenses\/by\/4\.0\/\)\.&quot;/);
  assert.match(about, /excerpts quoted from official pages belong to their authors/);
  assert.match(read('matrix/index.html'), /"license":"https:\/\/creativecommons\.org\/licenses\/by\/4\.0\/"/);
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

const textOf = (rel) => read(rel).replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').replace(/&#39;/g, "'").replace(/\s+/g, ' ');

const ALLOWED_EMAILS = ['contact@rulefiles.dev', 'privacy@rulefiles.dev', 'sponsors@rulefiles.dev'];
const emailsIn = (t) => [...new Set(t.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || [])].sort();

test('the legal notice states the anonymous non-professional publisher and the host, with the contact alias and the right of reply', () => {
  const html = read('legal/index.html');
  for (const h of ['Publisher', 'Host', 'Contact and right of reply', 'Names, quotations and independence', 'Personal data and cookies']) {
    assert.match(html, new RegExp(`<h2>${h}</h2>`), h);
  }
  assert.doesNotMatch(html, /<h2>Director of publication<\/h2>/);
  const text = textOf('legal/index.html');
  assert.match(text, /loi n° 2004-575 du 21 juin 2004, article 1-1/);
  assert.match(text, /published by a private individual, on a non-professional basis/);
  assert.match(text, /Article 1-1, II of the law allows a person who publishes on a non-professional basis to stay anonymous and to give only the name and address of the host\. The publisher has chosen to remain anonymous\./);
  assert.match(text, /Name: Cloudflare, Inc\./);
  assert.match(text, /Address: 101 Townsend St, San Francisco, CA 94107, USA/);
  assert.match(text, /Phone: \+1 \(650\) 319-8930/);
  assert.match(text, /right of reply \(article 1-1, III\)/);
  assert.match(text, /the request is sent to the host, which passes it on to the director of publication without delay/);
  assert.match(text, /within three months/);
  assert.match(html, /<a href="mailto:contact@rulefiles\.dev">contact@rulefiles\.dev<\/a>/);
  // No publisher identity on the page: no name, address, phone, registration number or share capital.
  assert.doesNotMatch(text, /\[\[TODO/);
  assert.doesNotMatch(text, /SIRET|SIREN|RCS|share capital|Phone: (?!\+1 \(650\) 319-8930)/);
  assert.deepEqual(emailsIn(text), ['contact@rulefiles.dev']);
});

test('the privacy page covers controller, basis, provider, tracking, retention, rights and the CNIL', () => {
  const text = textOf('privacy/index.html');
  for (const needle of ['responsable de traitement', 'article 6(1)(a)', 'double opt-in', 'Buttondown, LLC', 'Standard Contractual Clauses', 'unsubscribe link', 'We answer within one month', 'CNIL', 'sets no cookies', 'The host is Cloudflare, Inc., 101 Townsend St, San Francisco, CA 94107, USA.']) {
    assert.ok(text.includes(needle), needle);
  }
  assert.ok(text.includes('We do not track them. Our emails carry no tracking pixel, and the links in them are not rewritten.'));
  assert.ok(text.includes('we delete your data within 30 days, unless the law requires us to keep it'));
  // The one field left is the name of the controller.
  assert.deepEqual(markerFields(text), ['data controller name']);
  const html = read('privacy/index.html');
  assert.match(html, /href="https:\/\/buttondown\.com\/legal\/data-processing-agreement"/);
  assert.match(html, /href="https:\/\/buttondown\.com\/legal\/subprocessors"/);
  assert.match(html, /href="https:\/\/docs\.buttondown\.com\/deleting-and-recovering-data"/);
  assert.match(html, /href="https:\/\/www\.cnil\.fr\/fr\/plaintes"/);
  assert.match(html, /<a href="mailto:privacy@rulefiles\.dev">privacy@rulefiles\.dev<\/a>/);
  assert.deepEqual(emailsIn(text), ['privacy@rulefiles.dev']);
});

test('the sponsors page says sponsorship is not open, promises no figure and shows the sponsors alias', () => {
  const html = read('sponsors/index.html');
  const text = textOf('sponsors/index.html');
  assert.match(text, /Sponsorship is not open yet\. No rates are published and no sponsor is booked\./);
  assert.match(html, /<a href="mailto:sponsors@rulefiles\.dev">sponsors@rulefiles\.dev<\/a>/);
  assert.match(text, /Writing there does not book anything\./);
  assert.doesNotMatch(text, /[$€£]\s?\d|\d\s?(EUR|USD|euros?|dollars?)\b|per (month|week|issue)|\d+\s?%/i);
  assert.deepEqual(emailsIn(text), ['sponsors@rulefiles.dev']);
});

test('the only email addresses on the built site are the three role aliases', () => {
  const seen = new Set();
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else if (/\.(html|txt|xml|json|svg)$/.test(e.name)) emailsIn(fs.readFileSync(f, 'utf8')).forEach((m) => seen.add(m)); } };
  walk(out);
  assert.deepEqual([...seen].sort(), ALLOWED_EMAILS);
});

test('every page links the legal notice and the privacy page, and the sitemap and llms.txt list the legal notice', () => {
  for (const p of PAGES) {
    const html = read(p);
    assert.match(html, /<a href="\/privacy\/">Privacy<\/a>/, p);
    assert.match(html, /<a href="\/legal\/">Legal notice<\/a>/, p);
  }
  assert.match(read('sitemap.xml'), /<loc>https:\/\/rulefiles\.dev\/legal\/<\/loc>/);
  assert.match(read('llms.txt'), /\[Legal notice\]\(https:\/\/rulefiles\.dev\/legal\/\)/);
});

test('the old name does not appear anywhere in the built site', () => {
  const old = /agent(?:\s|&nbsp;|&#0*160;|&#x0*a0;|[_\-.·\/])*diffs?\b/i;
  const names = ['site.config.json', 'package.json'];
  for (const v of ['Agent Diffs', 'Agent&nbsp;Diffs', 'Agent&#160;Diffs', 'Agent&#x00A0;Diffs', 'Agent&#0160;Diffs', 'Agent  Diffs', 'Agent·Diffs', 'Agent/Diffs', 'agent_diff', 'agent-diffs', 'AgentDiffs']) {
    assert.match(v, old, `${v} should be flagged`);
  }
  for (const v of ['agent differences', 'Agent Difference', 'agent diffusion', 'agent differs']) {
    assert.doesNotMatch(v, old, `${v} should not be flagged`);
  }
  for (const n of names) assert.doesNotMatch(fs.readFileSync(new URL(`../${n}`, import.meta.url), 'utf8'), old, n);
  for (const f of listFiles(out)) {
    if (/\.(html|xml|txt|json|js|css|svg)$/.test(f)) assert.doesNotMatch(fs.readFileSync(f, 'utf8'), old, `${path.relative(out, f)} carries the former name`);
  }
  assert.equal(JSON.parse(fs.readFileSync(new URL('../site.config.json', import.meta.url), 'utf8')).name, 'Rulefiles');
});
