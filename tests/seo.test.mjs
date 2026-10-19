import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { build } from '../scripts/build.mjs';
import { validateConfig } from '../scripts/lib/validate.mjs';
import { renderHeaders, cspFor } from '../scripts/lib/render.mjs';
import { TEST_DATE } from './helpers/test-date.mjs';

process.env.BUILD_DATE = TEST_DATE;
delete process.env.SITE_URL;
process.env.NEWSLETTER_FORM_ACTION = '';

const ROOT = new URL('..', import.meta.url).pathname;
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'rulefiles-seo-'));
const read = (rel, dir = out) => fs.readFileSync(path.join(dir, rel), 'utf8');
const PAGES = ['index.html', 'matrix/index.html', 'generator/index.html', 'digest/index.html', 'digest/2026-W41/index.html', 'digest/2026-W42/index.html', 'about/index.html', 'sponsors/index.html', 'newsletter/index.html', 'privacy/index.html', 'legal/index.html', '404.html'];
const ldBlocks = (html) => [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map((m) => JSON.parse(m[1]));
const entries = (xml) => [...xml.matchAll(/<url><loc>(.*?)<\/loc>(?:<lastmod>(.*?)<\/lastmod>)?<\/url>/g)].map((m) => ({ loc: m[1], lastmod: m[2] }));
before(() => { build({ outDir: out, quiet: true }); });
after(() => fs.rmSync(out, { recursive: true, force: true }));

test('sitemap: every URL has a lastmod, and the data files and the feed are listed', () => {
  const list = entries(read('sitemap.xml'));
  assert.equal(list.length, 14);
  for (const e of list) assert.match(e.lastmod || '', /^\d{4}-\d{2}-\d{2}$/, e.loc);
  const locs = list.map((e) => e.loc);
  for (const p of ['/data/matrix.json', '/data/digests.json', '/digest/feed.xml']) assert.ok(locs.includes(`https://rulefiles.dev${p}`), p);
  assert.ok(!locs.some((l) => l.includes('.txt') || l.includes('404')));
  const by = Object.fromEntries(list.map((e) => [new URL(e.loc).pathname, e.lastmod]));
  const matrix = JSON.parse(read('data/matrix.json'));
  assert.equal(by['/matrix/'], matrix.lastReviewed);
  assert.equal(by['/data/matrix.json'], matrix.lastReviewed);
  const digests = JSON.parse(read('data/digests.json'));
  assert.equal(by['/data/digests.json'], digests[0].verifiedOn);
  assert.equal(by['/digest/feed.xml'], digests[0].verifiedOn);
  assert.equal(by['/digest/2026-W41/'], digests.find((d) => d.week === '2026-W41').verifiedOn);
  assert.equal(by['/privacy/'], '2026-10-16');
});

test('sitemap lastmod comes from the content, not from the build date', () => {
  const later = fs.mkdtempSync(path.join(os.tmpdir(), 'rulefiles-seo-later-'));
  process.env.BUILD_DATE = '2026-10-20';
  try {
    build({ outDir: later, quiet: true });
    assert.equal(read('sitemap.xml', later), read('sitemap.xml'));
    assert.ok(!read('sitemap.xml', later).includes('2026-10-20'));
  } finally {
    process.env.BUILD_DATE = TEST_DATE;
    fs.rmSync(later, { recursive: true, force: true });
  }
});

test('pageUpdated in the config: valid dates for code-made pages, and bad values are refused', () => {
  assert.deepEqual(validateConfig(config), []);
  assert.ok(validateConfig({ ...config, pageUpdated: { '/generator/': 'yesterday' } }).some((e) => /pageUpdated/.test(e)));
  assert.ok(validateConfig({ ...config, pageUpdated: { generator: '2026-10-16' } }).some((e) => /pageUpdated/.test(e)));
  assert.ok(validateConfig({ ...config, pageUpdated: ['2026-10-16'] }).some((e) => /pageUpdated/.test(e)));
  for (const d of Object.values(config.pageUpdated)) assert.ok(d <= '2026-10-16');
});

test('the digest archive carries a Dataset for digests.json, with its license, dates and download', () => {
  const html = read('digest/index.html');
  const types = ldBlocks(html).map((b) => b['@type']);
  assert.deepEqual(types, ['Dataset', 'CollectionPage', 'BreadcrumbList']);
  const ds = ldBlocks(html)[0];
  const digests = JSON.parse(read('data/digests.json'));
  assert.equal(ds.url, 'https://rulefiles.dev/digest/');
  assert.equal(ds.license, 'https://creativecommons.org/licenses/by/4.0/');
  assert.equal(ds.dateModified, digests[0].verifiedOn);
  assert.equal(ds.temporalCoverage, `${digests[digests.length - 1].start}/${digests[0].end}`);
  assert.deepEqual(ds.distribution, [{ '@type': 'DataDownload', encodingFormat: 'application/json', contentUrl: 'https://rulefiles.dev/data/digests.json' }]);
  const n = digests.reduce((a, d) => a + d.items.length, 0);
  assert.match(ds.description, new RegExp(`^${n} dated changes .* over ${digests.length} weeks`));
  assert.ok(ds.isBasedOn.length > 0 && ds.isBasedOn.every((u) => /^https:\/\//.test(u)));
  // The inline JSON-LD stays the only inline script kind the pages carry.
  assert.doesNotMatch(html, /<script(?![^>]*(\bsrc=|ld\+json))/);
});

test('the Organization logo is the site mark, and that file is built', () => {
  const org = ldBlocks(read('index.html'))[0].publisher;
  assert.equal(org['@type'], 'Organization');
  assert.equal(org.logo, 'https://rulefiles.dev/favicon.svg');
  assert.ok(fs.existsSync(path.join(out, 'favicon.svg')));
});

test('every page has twitter:title and twitter:description equal to the Open Graph ones, and no twitter:site', () => {
  for (const p of PAGES) {
    const html = read(p);
    const meta = (name) => (html.match(new RegExp(`<meta (?:property|name)="${name}" content="([^"]*)">`)) || [])[1];
    assert.ok(meta('twitter:title'), `${p} twitter:title`);
    assert.equal(meta('twitter:title'), meta('og:title'), p);
    assert.equal(meta('twitter:description'), meta('og:description'), p);
    assert.equal(meta('twitter:card'), 'summary_large_image');
    assert.doesNotMatch(html, /twitter:(site|creator)/, p);
  }
});

test('Atom feed: one published date per entry, the check date of the digest', () => {
  const xml = read('digest/feed.xml');
  const digests = JSON.parse(read('data/digests.json'));
  const blocks = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map((m) => m[1]);
  assert.equal(blocks.length, digests.length);
  blocks.forEach((b, i) => {
    assert.match(b, new RegExp(`<published>${digests[i].verifiedOn}T00:00:00Z</published>\\s*<updated>${digests[i].verifiedOn}T00:00:00Z</updated>`));
  });
});

test('the matrix page has a "How to cite" block with the credit line, the license and the review date', () => {
  const html = read('matrix/index.html');
  const matrix = JSON.parse(read('data/matrix.json'));
  assert.match(html, /<h2 id="cite">How to cite<\/h2>/);
  assert.ok(html.includes(`Suggested credit: "Rulefiles data by Rulefiles contributors, https://rulefiles.dev/matrix/, last reviewed ${matrix.lastReviewed}, licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)."`));
  assert.match(html, /<a href="https:\/\/creativecommons\.org\/licenses\/by\/4\.0\/" rel="license">CC BY 4\.0<\/a>/);
});

test('HSTS: sent by the release host only, with no includeSubDomains and no preload, and the CSP is unchanged', () => {
  const headers = read('_headers');
  assert.match(headers, /\nhttps:\/\/rulefiles\.dev\/\*\n  Strict-Transport-Security: max-age=15552000\n$/);
  assert.doesNotMatch(headers, /includeSubDomains|preload/i);
  assert.equal((headers.match(/Strict-Transport-Security/g) || []).length, 1);
  assert.ok(headers.includes(`Content-Security-Policy: ${cspFor({ ...config, newsletter: { formAction: '' } })}\n`), 'the shared build has the form closed; the policy is the one of the closed form');
  // A preview host, and the www host, never get the header.
  assert.doesNotMatch(renderHeaders({ ...config, baseUrl: 'https://preview.example.pages.dev' }), /Strict-Transport-Security/);
  assert.doesNotMatch(headers, /www\.rulefiles\.dev/);
  assert.doesNotMatch(headers, /^\/\*\n(?:  .*\n)*  Strict-Transport-Security/, 'the catch-all rule does not carry it');
});
