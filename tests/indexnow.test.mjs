import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { build } from '../scripts/build.mjs';
import { validateConfig } from '../scripts/lib/validate.mjs';
import { run, parseArgs, parseSitemap, buildPayload, DEFAULT_ENDPOINT, MAX_URLS } from '../scripts/indexnow.mjs';

process.env.BUILD_DATE = '2026-10-16';
delete process.env.SITE_URL;
process.env.NEWSLETTER_FORM_ACTION = '';

const ROOT = new URL('..', import.meta.url).pathname;
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));
const KEY = config.indexNowKey;
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'rulefiles-indexnow-'));
const noNetwork = async () => { throw new Error('the network must not be used'); };

test('the committed IndexNow key follows the documented format and carries no personal data', () => {
  assert.match(KEY, /^[A-Za-z0-9-]{8,128}$/);
  assert.match(KEY, /^[0-9a-f]{32}$/);
  assert.deepEqual(validateConfig(config), []);
  assert.ok(validateConfig({ ...config, indexNowKey: 'short' }).some((e) => /indexNowKey/.test(e)));
  assert.ok(validateConfig({ ...config, indexNowKey: 'bad key!!!' }).some((e) => /indexNowKey/.test(e)));
  assert.ok(validateConfig({ ...config, indexNowKey: 'a'.repeat(129) }).some((e) => /indexNowKey/.test(e)));
});

test('the build writes the key file at the root, with the key alone, and nothing else changes', () => {
  const dir = tmp();
  build({ outDir: dir, quiet: true });
  assert.equal(fs.readFileSync(path.join(dir, `${KEY}.txt`), 'utf8'), KEY);
  assert.ok(!fs.readFileSync(path.join(dir, 'sitemap.xml'), 'utf8').includes(KEY), 'the key file is not a page of the sitemap');
  assert.ok(!fs.readFileSync(path.join(dir, '_headers'), 'utf8').toLowerCase().includes('indexnow'), 'the CSP and the headers do not mention IndexNow');
  assert.match(fs.readFileSync(path.join(dir, '_headers'), 'utf8'), /connect-src 'none'/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('without a key in the config the build writes no key file', () => {
  const root = tmp();
  fs.cpSync(path.join(ROOT, 'content'), path.join(root, 'content'), { recursive: true });
  fs.cpSync(path.join(ROOT, 'data'), path.join(root, 'data'), { recursive: true });
  fs.cpSync(path.join(ROOT, 'src'), path.join(root, 'src'), { recursive: true });
  const { indexNowKey, ...rest } = config;
  fs.writeFileSync(path.join(root, 'site.config.json'), JSON.stringify(rest));
  const out = path.join(root, 'dist');
  build({ root, outDir: out, quiet: true });
  assert.ok(!fs.readdirSync(out).some((f) => /^[0-9a-f]{32}\.txt$/.test(f)));
  fs.rmSync(root, { recursive: true, force: true });
});

function fakeDist(lastmods) {
  const root = tmp();
  const dist = path.join(root, 'dist');
  fs.mkdirSync(dist);
  fs.writeFileSync(path.join(root, 'site.config.json'), JSON.stringify({ baseUrl: 'https://rulefiles.dev', indexNowKey: 'testkey-0001' }));
  fs.writeFileSync(path.join(dist, 'testkey-0001.txt'), 'testkey-0001');
  const urls = Object.entries(lastmods).map(([p, d]) => `  <url><loc>https://rulefiles.dev${p}</loc>${d ? `<lastmod>${d}</lastmod>` : ''}</url>`).join('\n');
  fs.writeFileSync(path.join(dist, 'sitemap.xml'), `<?xml version="1.0"?>\n<urlset>\n${urls}\n</urlset>\n`);
  return { root, dist };
}

test('dry run lists the URLs and sends nothing', async () => {
  const { root, dist } = fakeDist({ '/': '2026-10-15', '/matrix/': '2026-10-16' });
  const logs = [];
  const r = await run(['--all', '--dist', dist], { root, fetchImpl: noNetwork, log: (m) => logs.push(m) });
  assert.equal(r.sent, false);
  assert.deepEqual(r.payload.urlList, ['https://rulefiles.dev/', 'https://rulefiles.dev/matrix/']);
  assert.ok(logs.some((l) => /Dry run/.test(l)));
  fs.rmSync(root, { recursive: true, force: true });
});

test('--since keeps the URLs changed on or after the date, and the ones without a lastmod', async () => {
  const { root, dist } = fakeDist({ '/': '2026-10-15', '/matrix/': '2026-10-16', '/old/': '2026-09-01', '/nodate/': '' });
  const r = await run(['--since', '2026-10-15', '--dist', dist], { root, fetchImpl: noNetwork, log: () => {} });
  assert.deepEqual(r.payload.urlList, ['https://rulefiles.dev/', 'https://rulefiles.dev/matrix/', 'https://rulefiles.dev/nodate/']);
  fs.rmSync(root, { recursive: true, force: true });
});

test('--send posts one JSON request in the documented format, with a mocked fetch', async () => {
  const { root, dist } = fakeDist({ '/': '2026-10-15', '/matrix/': '2026-10-16' });
  const calls = [];
  const fetchImpl = async (url, opts) => { calls.push({ url, opts }); return { status: 200 }; };
  const r = await run(['--all', '--send', '--url', 'https://rulefiles.dev/digest/2026-W42/', '--dist', dist], { root, fetchImpl, log: () => {} });
  assert.equal(r.status, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, DEFAULT_ENDPOINT);
  assert.equal(DEFAULT_ENDPOINT, 'https://api.indexnow.org/indexnow');
  assert.equal(calls[0].opts.method, 'POST');
  assert.equal(calls[0].opts.headers['content-type'], 'application/json; charset=utf-8');
  assert.match(calls[0].opts.headers['user-agent'], /^RulefilesIndexNow\//);
  assert.deepEqual(JSON.parse(calls[0].opts.body), { host: 'rulefiles.dev', key: 'testkey-0001', urlList: ['https://rulefiles.dev/', 'https://rulefiles.dev/matrix/', 'https://rulefiles.dev/digest/2026-W42/'] });
  fs.rmSync(root, { recursive: true, force: true });
});

test('202 counts as received, other codes fail with the code', async () => {
  const { root, dist } = fakeDist({ '/': '2026-10-15' });
  const ok = await run(['--all', '--send', '--dist', dist], { root, fetchImpl: async () => ({ status: 202 }), log: () => {} });
  assert.equal(ok.status, 202);
  for (const status of [400, 403, 422, 429, 500]) {
    await assert.rejects(run(['--all', '--send', '--dist', dist], { root, fetchImpl: async () => ({ status }), log: () => {} }), new RegExp(`HTTP ${status}`));
  }
  fs.rmSync(root, { recursive: true, force: true });
});

test('the script refuses a missing key file, a wrong key file and a missing choice of URLs', async () => {
  const { root, dist } = fakeDist({ '/': '2026-10-15' });
  fs.writeFileSync(path.join(dist, 'testkey-0001.txt'), 'something else');
  await assert.rejects(run(['--all', '--dist', dist], { root, fetchImpl: noNetwork, log: () => {} }), /does not hold the key/);
  fs.rmSync(path.join(dist, 'testkey-0001.txt'));
  await assert.rejects(run(['--all', '--dist', dist], { root, fetchImpl: noNetwork, log: () => {} }), /missing/);
  assert.throws(() => parseArgs([]), /choose the URLs/);
  assert.throws(() => parseArgs(['--since', 'yesterday']), /YYYY-MM-DD/);
  assert.throws(() => parseArgs(['--all', '--endpoint', 'http://x.example/indexnow']), /https/);
  assert.throws(() => parseArgs(['--nope']), /unknown argument/);
  fs.rmSync(root, { recursive: true, force: true });
});

test('payload checks: key format, host, duplicates, 10,000 URL limit', () => {
  const base = 'https://rulefiles.dev';
  assert.throws(() => buildPayload({ baseUrl: base, key: 'short', urls: [`${base}/`] }), /8 to 128/);
  assert.throws(() => buildPayload({ baseUrl: base, key: 'abc12345', urls: [] }), /no URL/);
  assert.throws(() => buildPayload({ baseUrl: base, key: 'abc12345', urls: ['https://other.example/'] }), /not on rulefiles\.dev/);
  assert.throws(() => buildPayload({ baseUrl: 'http://rulefiles.dev', key: 'abc12345', urls: ['http://rulefiles.dev/'] }), /https/);
  assert.deepEqual(buildPayload({ baseUrl: base, key: 'abc12345', urls: [`${base}/`, `${base}/`] }).urlList, [`${base}/`]);
  const many = Array.from({ length: MAX_URLS + 1 }, (_, i) => `${base}/p${i}/`);
  assert.throws(() => buildPayload({ baseUrl: base, key: 'abc12345', urls: many }), /at most 10000/);
  assert.equal(buildPayload({ baseUrl: base, key: 'abc12345', urls: many.slice(0, MAX_URLS) }).urlList.length, MAX_URLS);
});

test('parseSitemap reads loc and lastmod, and unescapes ampersands', () => {
  assert.deepEqual(parseSitemap('<urlset><url><loc>https://x.example/a?b=1&amp;c=2</loc><lastmod>2026-10-16</lastmod></url><url><loc>https://x.example/</loc></url></urlset>'), [{ loc: 'https://x.example/a?b=1&c=2', lastmod: '2026-10-16' }, { loc: 'https://x.example/' }]);
});

test('the real build and the real sitemap give a dry-run payload, still without network', async () => {
  const dir = tmp();
  build({ outDir: dir, quiet: true });
  const r = await run(['--all', '--dist', dir], { fetchImpl: noNetwork, log: () => {} });
  assert.equal(r.payload.key, KEY);
  assert.equal(r.payload.host, 'rulefiles.dev');
  assert.ok(r.payload.urlList.includes('https://rulefiles.dev/matrix/'));
  fs.rmSync(dir, { recursive: true, force: true });
});
