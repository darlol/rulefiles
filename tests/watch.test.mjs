import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseRss, parseGithubReleases, firstSentence, contentLines, entryDate, groupDrafts } from '../scripts/lib/parsers.mjs';
import { createFetcher, RobotsError, HARD_MAX_BYTES } from '../scripts/lib/fetcher.mjs';
import { run, skippedSummary } from '../scripts/watch.mjs';
import { validateDigest, validateWatchSources } from '../scripts/lib/validate.mjs';
import { loadData } from '../scripts/lib/data.mjs';

const FIX = new URL('./fixtures/', import.meta.url).pathname;
const fx = (n) => fs.readFileSync(path.join(FIX, n), 'utf8');
const sources = JSON.parse(fs.readFileSync(new URL('../data/watch-sources.json', import.meta.url), 'utf8'));
const src = (id) => sources.sources.find((s) => s.id === id);
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'rulefiles-test-'));

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

test('codex changelog RSS in Markdown: lines come from list items, or from paragraphs, with no heading, link syntax or code marks', () => {
  // tests/fixtures/codex-changelog-markdown.xml holds four entries copied unchanged from the live feed on 2026-10-16.
  const e = parseRss(fx('codex-changelog-markdown.xml'), src('codex-changelog'));
  assert.equal(e.length, 4);
  const app = e.find((x) => x.title === 'Codex app');
  assert.equal(app.date, '2026-10-08');
  assert.equal(app.lines.length, 3);
  assert.equal(app.firstLine, 'Fixed queued messages getting stuck on Sending and restored Steer in secondary app windows.');
  assert.match(app.lines[2], /^Added clearer recovery guidance when a tool call needs approval but the chat's permissions prevent approval requests/);
  const retire = e.find((x) => /retirement/.test(x.title));
  assert.match(retire.firstLine, /^Effective October 14, 2026, at noon PDT \(19:00 UTC\), GPT-5\.5 retires from Codex/);
  assert.equal(retire.lines[1].startsWith('Use GPT-6.1 Sol (gpt-6.1-sol) when available'), true);
  const comp = e.find((x) => /Composer/.test(x.title));
  assert.match(comp.lines[2], /^Learn more about composer predictions\.$/);
  for (const x of e) for (const l of x.lines) assert.doesNotMatch(l, /[#`*\]\[]|\]\(/);
});

test('contentLines reads Markdown: nested and numbered items, wrapped lines, fences, PR references, and text in angle brackets', () => {
  const md = '# Title\n\nIntro paragraph.\n\n```\n- not a line\n```\n\n### New features\n\n- Added `/side <prompt>` to start a\n  side conversation. ([#1](https://x/1), [#2](https://x/2))\n  - Nested **bold** detail\n2. Second [link](https://x) item\n- Third\n- Fourth';
  assert.deepEqual(contentLines(md), ['Added /side <prompt> to start a side conversation.', 'Nested bold detail', 'Second link item']);
  assert.deepEqual(contentLines('# Only a heading'), []);
  assert.deepEqual(contentLines(''), []);
  assert.deepEqual(contentLines('First para.\nstill first.\n\nSecond para.'), ['First para. still first.', 'Second para.']);
});

test('contentLines still reads HTML, including text that mentions Markdown marks', () => {
  assert.deepEqual(contentLines('<ul><li>Use <code>a_b</code> and **x**.</li></ul>'), ['Use a_b and **x**.']);
  assert.deepEqual(contentLines('<p>One.</p><p>Two.</p>'), ['One.', 'Two.']);
});

test('codex releases from the GitHub API: the rust- prefix goes, prereleases are skipped, the title matches the digests', () => {
  const e = parseGithubReleases(fx('codex-releases.json'), src('codex-releases'));
  assert.equal(e.length, 1);
  assert.equal(e[0].title, 'Codex 0.162.1');
  assert.equal(e[0].version, '0.162.1');
  assert.equal(e[0].date, '2026-10-09');
  assert.equal(e[0].url, 'https://github.com/openai/codex/releases/tag/rust-v0.162.1');
  assert.match(e[0].firstLine, /^Fixed a TUI crash/);
  assert.doesNotMatch(e[0].firstLine, /#\d+/);
});

test('codex releases source follows the rules of the other GitHub sources: REST API, one request, humanUrl, allowed hosts', () => {
  const s = src('codex-releases');
  assert.equal(s.type, 'github-releases');
  assert.equal(s.url, 'https://api.github.com/repos/openai/codex/releases?per_page=30');
  assert.equal(s.humanUrl, 'https://github.com/openai/codex/releases');
  assert.doesNotMatch(s.url, /\.atom/);
  const { hosts } = loadData();
  assert.ok(hosts.includes('github.com'));
});

test('entry dates: the date in the link wins within one day of the UTC date, otherwise the UTC date stays', () => {
  // The link dates of github.blog match Pacific time (not stated by the site): 02:16 UTC on 16 October is 19:16 on 15 October there.
  assert.equal(entryDate(new Date('Fri, 16 Oct 2026 02:16:00 GMT'), 'https://github.blog/changelog/2026-10-15-copilot-in-slack-and-teams-adds-model-and-repository-updates'), '2026-10-15');
  assert.equal(entryDate(new Date('Fri, 16 Oct 2026 02:16:00 GMT'), 'https://github.blog/changelog/2026-10-15-copilot-in-slack-and-teams-adds-model-and-repository-updates/'), '2026-10-15');
  assert.equal(entryDate(new Date('Thu, 15 Oct 2026 19:35:00 GMT'), 'https://github.blog/changelog/2026-10-15-deprecation'), '2026-10-15');
  assert.equal(entryDate(new Date('Fri, 16 Oct 2026 02:16:00 GMT'), 'https://github.blog/changelog/2026-10-01-old-slug'), '2026-10-16');
  assert.equal(entryDate(new Date('Fri, 16 Oct 2026 02:16:00 GMT'), 'https://github.blog/changelog/2026-02-31-not-a-date'), '2026-10-16');
  assert.equal(entryDate(new Date('Wed, 14 Oct 2026 00:00:00 GMT'), 'https://developers.openai.com/codex/changelog/#codex-2026-10-12-x'), '2026-10-14');
  assert.equal(entryDate(new Date('Tue, 13 Oct 2026 00:00:00 GMT'), 'https://cursor.com/changelog/origin-app-marketplace'), '2026-10-13');
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
  fs.writeFileSync(state, '{"seen":{}}');
  // offline mode does not write state, so mark entries as seen by hand through a first dry listing.
  const first = await run(['--offline', FIX, '--out', out, '--today', '2026-10-15', '--since', '2026-10-01', '--state', state], { log: () => {} });
  const seen = Object.fromEntries(first.entries.map((e) => [e.id, '2026-10-15']));
  fs.writeFileSync(state, JSON.stringify({ seen }));
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
  assert.match(calls[0].ua, /^RulefilesWatch\/0\.1/);
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

const redirectFetch = (routes, calls) => async (url, opts) => {
  calls.push({ url, headers: opts.headers });
  const r = routes[url];
  if (!r) return { status: 404, headers: { get: () => null }, text: async () => '' };
  const h = r.headers || {};
  return { status: r.status || 200, headers: { get: (k) => h[k.toLowerCase()] ?? null }, text: async () => r.body ?? '' };
};
const quick = (dir, routes, calls, extra = {}) => createFetcher({ cacheDir: dir, fetchImpl: redirectFetch(routes, calls), delayMs: 0, sleepImpl: async () => {}, ...extra });

test('fetcher: robots.txt that redirects is followed, and the rules at the end of the chain apply', async () => {
  const dir = tmp();
  const calls = [];
  const routes = {
    'https://r.example/robots.txt': { status: 301, headers: { location: 'https://www.r.example/robots.txt' } },
    'https://www.r.example/robots.txt': { status: 308, headers: { location: '/other-robots.txt' } },
    'https://www.r.example/other-robots.txt': { body: 'User-agent: *\nDisallow: /private\n' },
    'https://r.example/ok': { body: 'fine' }
  };
  const f = quick(dir, routes, calls);
  assert.equal((await f.get('https://r.example/ok')).body, 'fine');
  assert.deepEqual(calls.map((c) => c.url).slice(0, 3), ['https://r.example/robots.txt', 'https://www.r.example/robots.txt', 'https://www.r.example/other-robots.txt']);
  await assert.rejects(() => f.get('https://r.example/private/x'), RobotsError);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('fetcher: up to five robots.txt redirects are followed, a sixth stops the run', async () => {
  const chain = (n) => {
    const routes = { 'https://c.example/page': { body: 'x' } };
    for (let i = 0; i < n; i++) routes[i === 0 ? 'https://c.example/robots.txt' : `https://c.example/r${i}`] = { status: 302, headers: { location: `https://c.example/r${i + 1}` } };
    routes[`https://c.example/r${n}`] = { body: '' };
    return routes;
  };
  const dir5 = tmp();
  assert.equal((await quick(dir5, chain(5), []).get('https://c.example/page')).body, 'x');
  const dir6 = tmp();
  const calls6 = [];
  await assert.rejects(() => quick(dir6, chain(6), calls6).get('https://c.example/page'), RobotsError);
  assert.ok(!calls6.some((c) => c.url === 'https://c.example/page'), 'the page itself is never requested');
  fs.rmSync(dir5, { recursive: true, force: true });
  fs.rmSync(dir6, { recursive: true, force: true });
});

test('fetcher: robots.txt answering 429 or 5xx means skip, and the failure is not cached as "allowed"', async () => {
  for (const status of [429, 500, 502, 503]) {
    const dir = tmp();
    const calls = [];
    const routes = { 'https://t.example/robots.txt': { status, body: '' }, 'https://t.example/page': { body: 'x' } };
    const f = quick(dir, routes, calls);
    await assert.rejects(() => f.get('https://t.example/page'), RobotsError, String(status));
    assert.ok(!calls.some((c) => c.url === 'https://t.example/page'), `${status}: page not requested`);
    // The host recovers: the next run asks robots.txt again instead of reusing a cached "allow all".
    routes['https://t.example/robots.txt'] = { body: 'User-agent: *\nDisallow: /page\n' };
    await assert.rejects(() => f.get('https://t.example/page'), RobotsError);
    assert.equal(calls.filter((c) => c.url === 'https://t.example/robots.txt').length, 2, `${status}: robots.txt asked again`);
    assert.ok(!calls.some((c) => c.url === 'https://t.example/page'));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('fetcher: robots.txt answering 404, 410 or 403 means no restrictions', async () => {
  for (const status of [404, 410, 403]) {
    const dir = tmp();
    const calls = [];
    const routes = { 'https://u.example/robots.txt': { status, body: 'User-agent: *\nDisallow: /\n' }, 'https://u.example/page': { body: 'x' } };
    assert.equal((await quick(dir, routes, calls).get('https://u.example/page')).body, 'x', String(status));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('fetcher: the default delay between network requests is 1500 ms', async () => {
  const dir = tmp();
  const sleeps = [];
  const routes = { 'https://d.example/robots.txt': { body: '' }, 'https://d.example/a': { body: 'a' } };
  const f = createFetcher({ cacheDir: dir, fetchImpl: redirectFetch(routes, []), now: () => 5000, sleepImpl: async (ms) => { sleeps.push(ms); } });
  await f.get('https://d.example/a');
  assert.deepEqual(sleeps, [1500]);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('fetcher: robots.txt is cached for 24 hours and asked again after that', async () => {
  const dir = tmp();
  const calls = [];
  let clock = 1_000_000;
  const routes = { 'https://k.example/robots.txt': { body: '' }, 'https://k.example/a': { body: 'a' }, 'https://k.example/b': { body: 'b' }, 'https://k.example/c': { body: 'c' } };
  const f = createFetcher({ cacheDir: dir, fetchImpl: redirectFetch(routes, calls), now: () => clock, delayMs: 0, sleepImpl: async () => {} });
  const robotsCalls = () => calls.filter((c) => c.url.endsWith('/robots.txt')).length;
  await f.get('https://k.example/a');
  assert.equal(robotsCalls(), 1);
  clock += 24 * 3600 * 1000 - 1;
  await f.get('https://k.example/b');
  assert.equal(robotsCalls(), 1, 'one millisecond before 24 hours the cached file is used');
  clock += 1;
  await f.get('https://k.example/c');
  assert.equal(robotsCalls(), 2, 'at 24 hours robots.txt is fetched again');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('fetcher: GITHUB_TOKEN is sent to api.github.com only', async () => {
  const saved = process.env.GITHUB_TOKEN;
  process.env.GITHUB_TOKEN = 'test-token-not-a-secret';
  try {
    const dir = tmp();
    const calls = [];
    const routes = {
      'https://api.github.com/robots.txt': { body: '' },
      'https://api.github.com/repos/o/r/releases': { body: '[]' },
      'https://api.github.com.evil.example/robots.txt': { body: '' },
      'https://api.github.com.evil.example/x': { body: 'x' },
      'https://github.com/robots.txt': { body: '' },
      'https://github.com/o/r': { body: 'page' },
      'https://example.org/robots.txt': { body: '' },
      'https://example.org/go': { status: 302, headers: { location: 'https://api.github.com.evil.example/x' } }
    };
    const f = quick(dir, routes, calls);
    await f.get('https://api.github.com/repos/o/r/releases');
    await f.get('https://api.github.com.evil.example/x');
    await f.get('https://github.com/o/r');
    await f.get('https://example.org/go');
    const auth = (url) => calls.filter((c) => c.url === url).map((c) => c.headers.authorization);
    assert.deepEqual(auth('https://api.github.com/repos/o/r/releases'), ['Bearer test-token-not-a-secret']);
    for (const url of ['https://api.github.com.evil.example/robots.txt', 'https://api.github.com.evil.example/x', 'https://github.com/robots.txt', 'https://github.com/o/r', 'https://example.org/go']) {
      assert.ok(auth(url).length >= 1 && auth(url).every((a) => a === undefined), url);
    }
    fs.rmSync(dir, { recursive: true, force: true });
  } finally {
    if (saved === undefined) delete process.env.GITHUB_TOKEN; else process.env.GITHUB_TOKEN = saved;
  }
});

test('watch: the docs mode is gone', async () => {
  await assert.rejects(() => run(['--docs', '--offline', FIX]), /Unknown argument --docs/);
  const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.scripts['watch:docs'], undefined);
  assert.equal(sources.docsPages, undefined);
});

// The live GitHub API answer for openai/codex/releases?per_page=30 was 12 009 211 bytes on 2026-10-16
// (30 releases, up to 318 assets each). This builds an answer of that size without committing it.
// The newest 15 releases carry 318 assets and the older ones 176, as on 2026-10-16.
function realisticReleases(count = 30) {
  const user = 'https://api.github.com/users/github-actions%5Bbot%5D';
  const uploader = { login: 'github-actions[bot]', id: 41898282, node_id: 'MDM6Qm90NDE4OTgyODI=', avatar_url: 'https://avatars.githubusercontent.com/in/15368?v=4', gravatar_id: '', type: 'Bot', site_admin: false, html_url: 'https://github.com/apps/github-actions', user_view_type: 'public' };
  for (const k of ['url', 'followers_url', 'following_url', 'gists_url', 'starred_url', 'subscriptions_url', 'organizations_url', 'repos_url', 'events_url', 'received_events_url']) uploader[k] = `${user}/${k.replace('_url', '')}`;
  const asset = (i) => ({
    url: `https://api.github.com/repos/openai/codex/releases/assets/${400000000 + i}`, id: 400000000 + i, node_id: `RA_kwDOPm${'x'.repeat(24)}${i}`,
    name: `codex-${'a'.repeat(40)}-${i}.tar.gz`, label: '', uploader: uploader,
    content_type: 'application/gzip', state: 'uploaded', size: 12345678 + i, digest: `sha256:${'f'.repeat(64)}`, download_count: i, created_at: '2026-10-15T21:30:00Z', updated_at: '2026-10-15T21:30:05Z',
    browser_download_url: `https://github.com/openai/codex/releases/download/rust-v0.163.0/codex-${'a'.repeat(40)}-${i}.tar.gz`
  });
  return Array.from({ length: count }, (_, k) => ({
    url: `https://api.github.com/repos/openai/codex/releases/${300000000 + k}`, html_url: `https://github.com/openai/codex/releases/tag/rust-v0.${200 - k}.0`, id: 300000000 + k,
    tag_name: `rust-v0.${200 - k}.0`, name: `0.${200 - k}.0`, draft: false, prerelease: false, published_at: `2026-10-${String(15 - Math.floor(k / 3)).padStart(2, '0')}T12:00:00Z`,
    body: `## New features\n\n- Added thing number ${k}. (#${1000 + k})\n- Fixed other thing ${k}.`, assets: Array.from({ length: k < 15 ? 318 : 176 }, (_, i) => asset(i))
  }));
}

async function runReleasesWith(body, source = src('codex-releases'), headers = {}) {
  const dir = tmp();
  const routes = { 'https://api.github.com/robots.txt': { body: '' }, [source.url]: { body, headers } };
  const sourcesFile = path.join(dir, 'sources.json');
  fs.writeFileSync(sourcesFile, JSON.stringify({ sources: [source] }));
  const fetcher = createFetcher({ cacheDir: path.join(dir, 'cache'), fetchImpl: redirectFetch(routes, []), delayMs: 0, sleepImpl: async () => {} });
  const res = await run(['--sources', sourcesFile, '--out', path.join(dir, 'out'), '--no-state', '--today', '2026-10-16', '--since', '2026-10-01'], { fetcher, log: () => {} });
  fs.rmSync(dir, { recursive: true, force: true });
  return res;
}

test('codex releases source: a live-sized answer (about 12 MB) is read, not skipped', async () => {
  const body = JSON.stringify(realisticReleases());
  assert.ok(Buffer.byteLength(body) > 11_000_000 && Buffer.byteLength(body) < 14_000_000, 'the generated answer is about as large as the live one');
  assert.ok(Buffer.byteLength(body) > 5_000_000, 'larger than the default limit, so the source needs its own');
  const res = await runReleasesWith(body);
  assert.deepEqual(res.skipped, []);
  assert.ok(res.entries.length > 0);
  assert.ok(src('codex-releases').maxBytes >= 1.5 * Buffer.byteLength(body), 'at least 50 percent room over the live size');
  assert.ok(src('codex-releases').maxBytes <= HARD_MAX_BYTES);
});

test('the same live-sized answer is refused when the source has no maxBytes, and the skip is reported', async () => {
  const { maxBytes, ...plain } = src('codex-releases');
  const res = await runReleasesWith(JSON.stringify(realisticReleases()), plain);
  assert.equal(res.skipped.length, 1);
  assert.match(res.skipped[0].reason, /larger than 5000000 bytes.*maxBytes/);
  const line = skippedSummary(res.skipped, res.sourceCount);
  assert.match(line, /^WARNING: 1 of 1 source\(s\) skipped: codex-releases \(/);
  assert.equal(skippedSummary([], 5), '');
});

test('fetcher: the limit of a source applies, content-length is checked first, and the hard limit cannot be raised', async () => {
  const mk = (routes, calls = []) => createFetcher({ cacheDir: tmp(), fetchImpl: (url, o) => {
    const r = routes[url];
    if (!r) return Promise.resolve({ status: 404, headers: { get: () => null }, text: async () => '' });
    if (!url.endsWith('/robots.txt')) calls.push(url);
    return Promise.resolve({ status: 200, headers: { get: (k) => (r.headers || {})[k.toLowerCase()] ?? null }, text: async () => { if (!url.endsWith('/robots.txt')) calls.push('text'); return r.body; } });
  }, delayMs: 0, sleepImpl: async () => {} });
  const robots = { 'https://l.example/robots.txt': { body: '' } };
  const body = 'x'.repeat(1000);
  assert.equal((await mk({ ...robots, 'https://l.example/a': { body } }).get('https://l.example/a', { maxBytes: 1000 })).body, body);
  await assert.rejects(() => mk({ ...robots, 'https://l.example/a': { body } }).get('https://l.example/a', { maxBytes: 999 }), /larger than 999 bytes/);
  const calls = [];
  await assert.rejects(() => mk({ ...robots, 'https://l.example/a': { body, headers: { 'content-length': '5000' } } }, calls).get('https://l.example/a', { maxBytes: 4000 }), /larger than 4000 bytes/);
  assert.ok(!calls.includes('text'), 'the body is not read when content-length is already too large');
  // Multi-byte text counts in bytes, not characters.
  await assert.rejects(() => mk({ ...robots, 'https://l.example/a': { body: '\u00e9'.repeat(600) } }).get('https://l.example/a', { maxBytes: 1000 }), /larger than 1000 bytes/);
  // A source cannot ask for more than the hard limit.
  await assert.rejects(() => mk({ ...robots, 'https://l.example/a': { body: 'x', headers: { 'content-length': String(HARD_MAX_BYTES + 1) } } }).get('https://l.example/a', { maxBytes: HARD_MAX_BYTES * 2 }), new RegExp(`larger than ${HARD_MAX_BYTES} bytes`));
  assert.equal((await mk({ ...robots, 'https://l.example/a': { body } }).get('https://l.example/a')).body, body, 'no maxBytes: default limit');
  await assert.rejects(() => mk({ ...robots, 'https://l.example/a': { body: 'x', headers: { 'content-length': '5000001' } } }).get('https://l.example/a'), /larger than 5000000 bytes/);
});

test('watch-sources: maxBytes must be a whole number from 1 to the hard limit', () => {
  const base = { id: 'a', tool: 'codex', type: 'rss', url: 'https://x.example/f.xml' };
  assert.deepEqual(validateWatchSources({ sources: [{ ...base, maxBytes: 20_000_000 }, { ...base, id: 'b', maxBytes: HARD_MAX_BYTES }, { ...base, id: 'c' }] }), []);
  for (const bad of [0, -1, 1.5, '20000000', null, HARD_MAX_BYTES + 1]) {
    assert.match(validateWatchSources({ sources: [{ ...base, maxBytes: bad }] }).join('\n'), /maxBytes must be an integer/, String(bad));
  }
});

test('watch: the summary of skipped sources names each source and its reason', () => {
  assert.equal(skippedSummary([{ id: 'a', reason: 'too big' }, { id: 'b', reason: 'HTTP 500' }], 5), 'WARNING: 2 of 5 source(s) skipped: a (too big); b (HTTP 500)');
});
