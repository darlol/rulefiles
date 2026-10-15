import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseRss, parseGithubReleases, firstSentence, contentLines, groupDrafts } from '../scripts/lib/parsers.mjs';
import { createFetcher, RobotsError } from '../scripts/lib/fetcher.mjs';
import { run } from '../scripts/watch.mjs';
import { validateDigest } from '../scripts/lib/validate.mjs';
import { loadData } from '../scripts/lib/data.mjs';

const FIX = new URL('./fixtures/', import.meta.url).pathname;
const fx = (n) => fs.readFileSync(path.join(FIX, n), 'utf8');
const sources = JSON.parse(fs.readFileSync(new URL('../data/watch-sources.json', import.meta.url), 'utf8'));
const src = (id) => sources.sources.find((s) => s.id === id);
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'agent-diffs-test-'));

test('cursor RSS parses titles, dates and links without inventing text', () => {
  const e = parseRss(fx('cursor-changelog.xml'), src('cursor-changelog'));
  assert.equal(e.length, 3);
  assert.equal(e[0].title, 'Origin App Marketplace');
  assert.equal(e[0].date, '2026-10-13');
  assert.equal(e[0].url, 'https://cursor.com/changelog/origin-app-marketplace');
  assert.match(e[0].firstLine, /^Origin integrates with over 20 apps/);
});

test('copilot RSS: truncated feed descriptions fall back to complete sentences only', () => {
  const e = parseRss(fx('copilot-changelog.xml'), src('copilot-changelog'));
  assert.equal(e.length, 4);
  const dep = e.find((x) => /deprecation/.test(x.title));
  assert.equal(dep.firstLine, '');
  const hydra = e.find((x) => /HydraFusion/.test(x.title));
  assert.equal(hydra.firstLine, 'HydraFusion has an updated model pool, improved orchestration workflows, and introduces HydraFusion Max.');
  assert.equal(firstSentence('Cut off text that never ends… The post X appeared first on The GitHub Blog.'), '');
  assert.equal(firstSentence('First one. Second one… The post X appeared first on The GitHub Blog.'), 'First one.');
});

test('github releases: prereleases and drafts are skipped, version and bullet lines come from the source', () => {
  const rel = JSON.parse(fx('claude-code-releases.json'));
  rel.push({ tag_name: 'v9.9.9', name: 'v9.9.9', draft: false, prerelease: true, published_at: '2026-10-15T00:00:00Z', html_url: 'https://github.com/x/y/releases/tag/v9.9.9', body: '- hi' });
  const e = parseGithubReleases(rel, src('claude-code-releases'));
  assert.equal(e.length, 3);
  assert.equal(e[0].title, 'Claude Code v2.1.301');
  assert.equal(e[0].version, '2.1.301');
  assert.equal(e[0].date, '2026-10-15');
  assert.match(e[0].firstLine, /^Added `CLAUDE_CODE_RETRY_WATCHDOG_MAX_USAGE_LIMIT_WAIT_MS`/);
  assert.ok(e[0].lines.length <= 3);
});

test('codex changelog RSS: release entries get a version and the first list item from the content', () => {
  const e = parseRss(fx('codex-changelog.xml'), src('codex-changelog'));
  const rel = e.find((x) => x.version === '0.163.0');
  assert.equal(rel.title, 'Codex 0.163.0');
  assert.match(rel.firstLine, /^Open \/config to search preferences/);
  assert.doesNotMatch(rel.firstLine, /#\d+/);
  assert.equal(rel.url, 'https://developers.openai.com/codex/changelog/#github-release-414286110');
  assert.deepEqual(contentLines('<ul><li>One. (<a href="x">#1</a>, <a href="y">#2</a>)</li><li>Two</li></ul>'), ['One.', 'Two']);
});

test('draft grouping makes one valid digest-shaped draft per ISO week', () => {
  const entries = [
    ...parseRss(fx('cursor-changelog.xml'), src('cursor-changelog')),
    ...parseGithubReleases(fx('claude-code-releases.json'), src('claude-code-releases'))
  ];
  const drafts = groupDrafts(entries, '2026-10-15');
  assert.deepEqual(drafts.map((d) => d.week), ['2026-W39', '2026-W41', '2026-W42']);
  const { hosts } = loadData();
  for (const d of drafts) {
    assert.equal(d.status, 'draft');
    assert.deepEqual(validateDigest(d, hosts, '2026-10-15'), []);
    for (const i of d.items) assert.match(i.sourceUrl, /^https:\/\//);
  }
});

test('offline run writes drafts, skips items already published, and remembers what it listed', async () => {
  const out = tmp();
  const state = path.join(out, 'state.json');
  const logs = [];
  const args = ['--offline', FIX, '--out', out, '--today', '2026-10-15', '--since', '2026-10-01', '--state', state];
  const r1 = await run(args, { log: (m) => logs.push(m) });
  assert.equal(r1.skipped.length, 0);
  // Items cited by the published digests are not listed again.
  assert.ok(!r1.entries.some((e) => e.url === 'https://cursor.com/changelog/origin-app-marketplace'));
  assert.ok(!r1.entries.some((e) => e.tool === 'claude-code' && e.version === '2.1.301'));
  assert.ok(r1.entries.some((e) => /HydraFusion/.test(e.title)));
  for (const f of r1.written) assert.ok(fs.existsSync(f));
  const r2 = await run([...args, '--no-state'], { log: () => {} });
  assert.ok(r2.entries.length > 0);
  fs.rmSync(out, { recursive: true, force: true });
});

test('a second run with state lists nothing new', async () => {
  const out = tmp();
  const state = path.join(out, 'state.json');
  fs.writeFileSync(state, '{"seen":{},"docs":{}}');
  // offline mode does not write state, so mark entries as seen by hand through a first dry listing.
  const first = await run(['--offline', FIX, '--out', out, '--today', '2026-10-15', '--since', '2026-10-01', '--state', state], { log: () => {} });
  const seen = Object.fromEntries(first.entries.map((e) => [e.id, '2026-10-15']));
  fs.writeFileSync(state, JSON.stringify({ seen, docs: {} }));
  const second = await run(['--offline', FIX, '--out', out, '--today', '2026-10-15', '--since', '2026-10-01', '--state', state], { log: () => {} });
  assert.equal(second.entries.length, 0);
  fs.rmSync(out, { recursive: true, force: true });
});

test('merging into an existing draft keeps reviewer edits', async () => {
  const out = tmp();
  const args = ['--offline', FIX, '--out', out, '--today', '2026-10-15', '--since', '2026-10-14', '--no-state'];
  const r1 = await run(args, { log: () => {} });
  const file = r1.written[0];
  const d = JSON.parse(fs.readFileSync(file, 'utf8'));
  d.items[0].text = 'Edited by a reviewer.';
  fs.writeFileSync(file, JSON.stringify(d));
  await run(args, { log: () => {} });
  const after = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(after.items[0].text, 'Edited by a reviewer.');
  assert.equal(after.items.length, d.items.length);
  fs.rmSync(out, { recursive: true, force: true });
});

function fakeFetch(routes, calls) {
  return async (url, opts) => {
    calls.push({ url, ua: opts.headers['user-agent'], headers: opts.headers });
    const r = routes[url];
    if (!r) return { status: 404, headers: { get: () => null }, text: async () => 'not found' };
    const h = r.headers || {};
    return { status: r.status || 200, headers: { get: (k) => h[k.toLowerCase()] ?? null }, text: async () => r.body };
  };
}

test('fetcher: honest User-Agent, robots.txt first, cache on the second call, conditional request after expiry', async () => {
  const dir = tmp();
  const calls = [];
  let clock = 1_000_000;
  const routes = {
    'https://example.org/robots.txt': { body: 'User-agent: *\nDisallow: /private\n' },
    'https://example.org/feed.xml': { body: '<rss/>', headers: { etag: '"abc"' } }
  };
  const f = createFetcher({ cacheDir: dir, fetchImpl: fakeFetch(routes, calls), now: () => clock, delayMs: 0, minIntervalMs: 1000, sleepImpl: async () => {} });
  const a = await f.get('https://example.org/feed.xml');
  assert.equal(a.body, '<rss/>');
  assert.deepEqual(calls.map((c) => c.url), ['https://example.org/robots.txt', 'https://example.org/feed.xml']);
  assert.match(calls[0].ua, /^AgentDiffsWatch\/0\.1/);
  const b = await f.get('https://example.org/feed.xml');
  assert.equal(b.fromCache, true);
  assert.equal(calls.length, 2);
  clock += 5000;
  routes['https://example.org/feed.xml'] = { status: 304, body: '' };
  const c = await f.get('https://example.org/feed.xml');
  assert.equal(c.body, '<rss/>');
  assert.equal(calls.at(-1).headers['if-none-match'], '"abc"');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('fetcher: a disallowed path is never requested', async () => {
  const dir = tmp();
  const calls = [];
  const routes = { 'https://example.org/robots.txt': { body: 'User-agent: *\nDisallow: /private\n' } };
  const f = createFetcher({ cacheDir: dir, fetchImpl: fakeFetch(routes, calls), delayMs: 0, sleepImpl: async () => {} });
  await assert.rejects(() => f.get('https://example.org/private/feed.xml'), RobotsError);
  assert.deepEqual(calls.map((c) => c.url), ['https://example.org/robots.txt']);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('fetcher: redirects are followed by hand and robots.txt of the new host is checked', async () => {
  const dir = tmp();
  const calls = [];
  const routes = {
    'https://a.example/robots.txt': { body: '' },
    'https://a.example/feed': { status: 308, headers: { location: 'https://b.example/feed.xml' } },
    'https://b.example/robots.txt': { body: 'User-agent: *\nDisallow: /feed.xml\n' }
  };
  const f = createFetcher({ cacheDir: dir, fetchImpl: fakeFetch(routes, calls), delayMs: 0, sleepImpl: async () => {} });
  await assert.rejects(() => f.get('https://a.example/feed'), RobotsError);
  assert.ok(calls.some((c) => c.url === 'https://b.example/robots.txt'));
  assert.ok(!calls.some((c) => c.url === 'https://b.example/feed.xml'));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('fetcher: waits between network requests and a 5xx robots.txt keeps us out', async () => {
  const dir = tmp();
  const calls = [];
  const sleeps = [];
  let clock = 0;
  const routes = {
    'https://e.example/robots.txt': { body: '' },
    'https://e.example/one': { body: '1' },
    'https://e.example/two': { body: '2' },
    'https://down.example/robots.txt': { status: 503, body: 'x' }
  };
  const f = createFetcher({ cacheDir: dir, fetchImpl: fakeFetch(routes, calls), now: () => clock, delayMs: 1500, sleepImpl: async (ms) => { sleeps.push(ms); clock += ms; } });
  await f.get('https://e.example/one');
  await f.get('https://e.example/two');
  assert.ok(sleeps.length >= 2 && sleeps.every((s) => s > 0 && s <= 1500));
  await assert.rejects(() => f.get('https://down.example/x'), RobotsError);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('docs mode detects a changed page by hash of visible text', async () => {
  const out = tmp();
  const docsDir = tmp();
  for (const p of sources.docsPages) fs.writeFileSync(path.join(docsDir, `${p.id}.html`), `<html><body><script>var a=1</script><p>Hello ${p.id}</p></body></html>`);
  for (const s of sources.sources) fs.writeFileSync(path.join(docsDir, `${s.id}.${s.type === 'rss' ? 'xml' : 'json'}`), s.type === 'rss' ? '<rss><channel></channel></rss>' : '[]');
  const state = path.join(out, 'state.json');
  const args = ['--offline', docsDir, '--docs', '--out', out, '--today', '2026-10-15', '--state', state];
  const r1 = await run(args, { log: () => {} });
  assert.ok(r1.docs.every((d) => d.status === 'first-seen'));
  fs.writeFileSync(path.join(docsDir, 'claude-memory-doc.html'), '<p>Different</p>');
  // offline runs do not persist state; seed it from the first run
  fs.writeFileSync(state, JSON.stringify({ seen: {}, docs: r1.state.docs }));
  const r2 = await run(args, { log: () => {} });
  assert.equal(r2.docs.find((d) => d.id === 'claude-memory-doc').status, 'changed');
  assert.equal(r2.docs.find((d) => d.id === 'cursor-rules-doc').status, 'unchanged');
  fs.rmSync(out, { recursive: true, force: true });
  fs.rmSync(docsDir, { recursive: true, force: true });
});
