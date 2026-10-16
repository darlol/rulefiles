import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { build } from '../scripts/build.mjs';
import { markerFields, releaseProblems, RELEASE_URL } from '../scripts/lib/placeholders.mjs';

const root = new URL('..', import.meta.url).pathname;
const text = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

// The fields the owner still has to fill in, frozen on purpose. The list is empty: the data controller was
// set on 2026-10-16. A marker that appears makes these tests fail. To add one on purpose, change this list,
// docs/LAUNCH.md and docs/LAUNCH-BLOCKERS.md together, in one commit.
const EXPECTED_MARKERS = [];
// What `npm run build:strict` reports: nothing, so it passes.
const EXPECTED_STRICT_FINDINGS = [];

const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', '.cache']);
function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(full);
    else yield full;
  }
}
// The owner's full name is published on two pages only: the privacy page, as the controller and publisher of the
// newsletter, and the legal notice, as the publisher of the newsletter. It is built from parts so that this file,
// which is scanned like any other, does not hold it. The first name and the surname are refused everywhere else,
// in the sources, the built site, the docs and the commit messages.
const FULL_NAME = ['Tho', 'mas', ' ', 'Ram', 'baut'].join('');
const NAME_PAGES = ['content/privacy.md', 'content/legal.md'];
const NAME_BUILT_PAGES = ['dist/privacy/index.html', 'dist/legal/index.html'];
// The first name is refused whatever the case, with or without accents, joined to other characters by an
// underscore or a digit, or written as an HTML entity. A letter on either side means another word, so a longer
// name that starts with the same letters does not match. The cases are built from parts in the test below.
const FIRST = new RegExp('(?<![A-Za-z])' + ['Tho', 'mas'].join('') + '(?![A-Za-z])', 'i');
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
/** Text as a reader would see it: entities decoded and accents removed, so a pattern cannot be dodged by spelling. */
const plain = (s) => s
  .replace(/&#x([0-9a-f]+);?/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);?/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&([a-z]+);/gi, (m, n) => (ENTITIES[n.toLowerCase()] ?? m))
  .normalize('NFD').replace(/\p{M}/gu, '')
  .replace(/&([A-Za-z])(?:acute|grave|circ|uml|tilde|ring|cedil|caron);/g, '$1');
const SURNAME = new RegExp(['Ram', 'baut'].join(''), 'i');
const HANDLE = new RegExp(['dar', 'lol'].join(''), 'i');
// The workflow bot's own noreply address is not personal. Any other numbered noreply address is.
const NOREPLY = new RegExp('\\d+\\+(?!github-actions)[A-Za-z0-9-]+@' + ['users', 'noreply', 'github', 'com'].join('\\.'), 'i');
/** What a file says about the owner's identity, apart from the full name on the two pages that may carry it. */
function identityHits(rel, body, allowedFiles) {
  const hits = [];
  const rest = plain(allowedFiles.includes(rel) ? body.split(FULL_NAME).join('') : body);
  const all = plain(body);
  for (const [name, re, text] of [['handle', HANDLE, all], ['surname', SURNAME, rest], ['first name', FIRST, rest], ['noreply address', NOREPLY, all]]) if (re.test(text)) hits.push(`${rel}: ${name}`);
  return hits;
}
// Every text file is scanned, whatever its name or extension: a file with no extension (LICENSE), a dotfile and
// package-lock.json included. A file is binary if its first 8000 bytes hold a NUL byte, and is skipped.
const isBinary = (buf) => buf.subarray(0, 8000).includes(0);
const files = () => [...walk(root)].map((f) => [path.relative(root, f), fs.readFileSync(f)]).filter(([, buf]) => !isBinary(buf)).map(([rel, buf]) => [rel, buf.toString('utf8')]);

function strictFindings() {
  process.env.BUILD_DATE = '2026-10-16';
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rulefiles-launch-'));
  try {
    const normal = build({ root, outDir, quiet: true });
    let message = '';
    try { build({ root, outDir, quiet: true, strict: true }); } catch (e) { message = e.message; }
    return { warnings: normal.warnings, message };
  } finally { fs.rmSync(outDir, { recursive: true, force: true }); }
}
const finding = (w) => `${w.split(': ')[0]}: ${markerFields(w).join(', ') || w}`;

test('the markers in the sources are exactly the expected list', () => {
  const found = [];
  for (const [rel, body] of files()) {
    if (rel === 'scripts/lib/placeholders.mjs' || rel.startsWith('tests/') || rel.startsWith('docs/')) continue;
    for (const field of markerFields(body)) found.push({ file: rel, field });
  }
  const sort = (l) => l.map((m) => `${m.file}|${m.field}`).sort();
  assert.deepEqual(sort(found), sort(EXPECTED_MARKERS));
});

test('npm run build:strict passes on the real tree and reports nothing', () => {
  const { warnings, message } = strictFindings();
  assert.deepEqual(warnings.map(finding), EXPECTED_STRICT_FINDINGS);
  assert.equal(message, '');
});

test('the strict build fails again when a marker or a placeholder sentence comes back in a page or in a configuration value', () => {
  process.env.BUILD_DATE = '2026-10-16';
  const cases = [
    ['a marker in a page', (dir) => fs.appendFileSync(path.join(dir, 'content', 'about.md'), '\nOwner: [[TODO-OWNER: new field]].\n'), /TODO-OWNER: new field/],
    ['a placeholder sentence in a page', (dir) => fs.appendFileSync(path.join(dir, 'content', 'legal.md'), '\nThe host will be named here.\n'), /will be named here/],
    ['a marker in a configuration value', (dir) => editConfig(dir, (c) => { c.host.name = '[[TODO-OWNER: host name]]'; }), /site\.config\.json: host\.name still has a placeholder/],
    ['a placeholder sentence in a configuration value', (dir) => editConfig(dir, (c) => { c.host.address = 'To be named'; }), /site\.config\.json: host\.address still has a placeholder/]
  ];
  const editConfig = (dir, change) => {
    const file = path.join(dir, 'site.config.json');
    const c = JSON.parse(fs.readFileSync(file, 'utf8'));
    change(c);
    fs.writeFileSync(file, JSON.stringify(c, null, 2));
  };
  for (const [label, mutate, expected] of cases) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rulefiles-launch-bad-'));
    try {
      for (const d of ['data', 'content', 'src', 'scripts']) fs.cpSync(path.join(root, d), path.join(dir, d), { recursive: true });
      fs.copyFileSync(path.join(root, 'site.config.json'), path.join(dir, 'site.config.json'));
      mutate(dir);
      assert.throws(() => build({ root: dir, outDir: path.join(dir, 'dist'), quiet: true, strict: true }), expected, label);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
});

test('the strict build refuses any base URL other than https://rulefiles.dev, and a preview build is not affected', () => {
  process.env.BUILD_DATE = '2026-10-16';
  assert.equal(RELEASE_URL, 'https://rulefiles.dev');
  assert.deepEqual(releaseProblems({ baseUrl: RELEASE_URL }), []);
  for (const bad of ['http://rulefiles.dev', 'https://www.rulefiles.dev', 'https://example.com', 'http://localhost:8080', 'https://agent-diffs-preview.pages.dev', '']) {
    assert.equal(releaseProblems({ baseUrl: bad }).length, 1, bad);
  }
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rulefiles-release-'));
  try {
    process.env.SITE_URL = 'http://localhost:8080';
    assert.throws(() => build({ root, outDir, quiet: true, strict: true }), /baseUrl must look like https:\/\/example\.com/, 'validation already refuses http://');
    for (const bad of ['https://example.com', 'https://localhost:8080', 'https://agent-diffs-preview.pages.dev']) {
      process.env.SITE_URL = bad;
      assert.throws(() => build({ root, outDir, quiet: true, strict: true }), (e) => e.message.includes('a release must use https://rulefiles.dev') && e.message.includes(bad) && /1 launch problem\(s\) remain/.test(e.message), bad);
      assert.equal(fs.existsSync(outDir), false, 'a failed strict build leaves no dist');
      // The preview build, which has no --strict, goes through with the same value and prints no warning.
      const preview = build({ root, outDir, quiet: true });
      assert.deepEqual(preview.warnings, [], bad);
      assert.ok(fs.readFileSync(path.join(outDir, 'index.html'), 'utf8').includes(`<link rel="canonical" href="${bad}/">`), bad);
      fs.rmSync(outDir, { recursive: true, force: true });
    }
    delete process.env.SITE_URL;
    assert.deepEqual(build({ root, outDir, quiet: true, strict: true }).warnings, []);
  } finally { delete process.env.SITE_URL; fs.rmSync(outDir, { recursive: true, force: true }); }
});

test('the deletion promises on the privacy page match the routine in docs/LAUNCH.md', () => {
  const privacy = text('content/privacy.md');
  const launch = text('docs/LAUNCH.md');
  assert.ok(privacy.includes('within 30 days') && privacy.includes('within 40 days'));
  assert.ok(launch.includes('every 7 days, to delete permanently the addresses that are unsubscribed or blocked, and those that have stayed unconfirmed for more than 30 days'));
  assert.ok(launch.includes('Only the API call `DELETE /v1/subscribers/{id_or_email}` keeps that promise'));
  assert.ok(launch.includes('40 days for an unconfirmed signup'));
  assert.ok(text('docs/LAUNCH-BLOCKERS.md').includes('They do not stop the build or the deploy, and no test fails on them. Whether they hold back the go itself is the owner\'s decision.'));
  assert.ok(launch.includes('the owner, named, is also responsible for the messages sent to the three addresses and for the request logs'));
  assert.ok(launch.includes('the legitimate interest in answering (GDPR, article 6(1)(f))') && launch.includes('both are to be confirmed by a lawyer'));
  assert.ok(launch.includes('The texts that say the signup is off follow `newsletterEnabled(config)`'));
  assert.ok(launch.includes('Also change the `updated` dates of `content/privacy.md` and `content/legal.md`'));
  assert.ok(launch.includes('update the two tests that describe the off state') && launch.includes('Content-Security-Policy meta tag locks scripts, styles and connections to self') && launch.includes('newsletter form is disabled without a provider and enabled with one'));
  assert.ok(launch.includes('item 5 of "Before the publication go" tests it') && launch.includes('5. Check the deletion call on the real Buttondown account.') && launch.includes('create a test subscriber') && launch.includes('call `DELETE /v1/subscribers/{email}`') && launch.includes('switch off the automatic cleanup of the account'));
  assert.ok(launch.includes('these two are the only tests that fail, because the assertions on the privacy and legal wording follow the configuration'));
  assert.ok(text('tests/build.test.mjs').includes('const DATA_WORD ='), 'the privacy and legal assertions follow the form setting');
  assert.ok(text('docs/NEWSLETTER.md').includes('has to be tried on a test subscriber before the go'));
  for (const title of ['Content-Security-Policy meta tag locks scripts, styles and connections to self', 'newsletter form is disabled without a provider and enabled with one']) assert.ok(text('tests/build.test.mjs').includes(`test('${title}'`), `the test named in docs/LAUNCH.md exists: ${title}`);
  assert.ok(launch.includes('the callout on the home page') && launch.includes('`{{dataStatus}}`'));
  assert.ok(launch.includes('Treat any income as a trigger: switch to the full notice (next section) before the first sponsor is booked, paid or invoiced, and before any affiliate link, advertising or paid plan goes live.'));
  assert.ok(launch.includes('Article 1-1 does not define the term.'));
  for (const needle of ['https://www.cloudflare.com/trust-hub/abuse-approach/', 'decision n° 2026-1210 QPC of 25 June 2026', 'https://www.conseil-constitutionnel.fr/decision/2026/20261210QPC.htm', 'Whether French law applies.', 'article 27 of the GDPR', 'L113-6', 'Rulefiles contributors']) assert.ok(launch.includes(needle), needle);
  assert.ok(launch.includes('kept for 12 months after the exchange ends, then deleted'));
  assert.ok(text('content/privacy.md').includes('we keep it for 12 months after the exchange ends, then we delete it'));
});

test('docs/LAUNCH.md and docs/LAUNCH-BLOCKERS.md say that no field remains, name the owner as controller and open the newsletter at the go', () => {
  const launch = text('docs/LAUNCH.md');
  const blockers = text('docs/LAUNCH-BLOCKERS.md');
  assert.equal(EXPECTED_STRICT_FINDINGS.length, EXPECTED_MARKERS.length);
  assert.match(launch, /It passes: no `\[\[TODO-OWNER: \.\.\.\]\]` marker is left/);
  assert.match(blockers, /^None\. No `\[\[TODO-OWNER: \.\.\.\]\]` marker is left/m);
  assert.ok(launch.includes('décret n° 2007-1527 du 24 octobre 2007, article 4') && launch.includes('in the next issue') && launch.includes('within 24 hours (article 6)'), 'LAUNCH.md cites the decree on the right of reply');
  assert.ok(launch.includes('PLACEHOLDER_DOMAIN'), 'LAUNCH.md says the domain guard was removed');
  assert.ok(launch.includes('releaseProblems'), 'LAUNCH.md names the release check');
  // The owner is the named controller and newsletter publisher. The form is disabled until the publication go, as a step.
  assert.ok(launch.includes('replacing the earlier choice of an anonymous controller'));
  assert.ok(launch.includes('The newsletter opens at the publication go. The form stays disabled until then, as a step of the publication.'));
  assert.ok(launch.includes('4. Check the Buttondown settings above. Keep the form disabled until the publication go. At the go, set the form address and enable the form'));
  assert.ok(launch.includes('This is a step of the publication, listed under "Before the publication go", and not a legal lock.'));
  for (const f of ['docs/LAUNCH.md', 'docs/LAUNCH-BLOCKERS.md', 'docs/NEWSLETTER.md', 'docs/OPERATIONS.md']) {
    assert.doesNotMatch(text(f), /\*\*Lock:\*\*|lawyer has confirmed|before a lawyer|until a lawyer|legal review of that wording/, `${f} holds no legal lock on the form`);
  }
  assert.ok(text('docs/LAUNCH.md').includes('Whether the option of article 1-1, II (give only the host\'s details) still fits now that the owner is named as publisher of the site and of the newsletter'));
  assert.ok(text('docs/LAUNCH.md').includes('Whether that route is still the one provided when a name is published is to be confirmed by a lawyer.'));
  for (const f of ['docs/LAUNCH.md', 'docs/LAUNCH-BLOCKERS.md']) assert.doesNotMatch(text(f), /anonymous (publisher of the site|non-professional publisher)|The publisher stays anonymous|keeps an anonymous/, `${f} no longer calls the site's publisher anonymous`);
  assert.ok(text('docs/LAUNCH.md').includes('The controller for the other data. Decided by the owner on 2026-10-16'));
  assert.ok(text('docs/LAUNCH.md').includes('Whether a name with no postal address meets article 13(1)(a) of the GDPR'));
  assert.ok(text('docs/LAUNCH.md').includes('12 months') && text('docs/LAUNCH.md').includes('Cloudflare counts as the host'), 'the 12 months and the host stay flagged for a lawyer');
});

test('the domain is bought: baseUrl is https://rulefiles.dev and canonical, og, sitemap, robots and llms.txt use it', () => {
  delete process.env.SITE_URL;
  process.env.BUILD_DATE = '2026-10-16';
  assert.equal(JSON.parse(text('site.config.json')).baseUrl, 'https://rulefiles.dev');
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rulefiles-domain-'));
  try {
    build({ root, outDir, quiet: true });
    const read = (f) => fs.readFileSync(path.join(outDir, f), 'utf8');
    for (const page of ['index.html', 'legal/index.html', 'privacy/index.html']) {
      const html = read(page);
      assert.match(html, /<link rel="canonical" href="https:\/\/rulefiles\.dev\//, page);
      assert.match(html, /property="og:url" content="https:\/\/rulefiles\.dev\//, page);
      assert.match(html, /property="og:image" content="https:\/\/rulefiles\.dev\/og\.png"/, page);
    }
    assert.match(read('sitemap.xml'), /<loc>https:\/\/rulefiles\.dev\/<\/loc>/);
    assert.doesNotMatch(read('sitemap.xml'), /<loc>(?!https:\/\/rulefiles\.dev\/)/);
    assert.match(read('robots.txt'), /^Sitemap: https:\/\/rulefiles\.dev\/sitemap\.xml$/m);
    assert.match(read('llms.txt'), /https:\/\/rulefiles\.dev\//);
  } finally { fs.rmSync(outDir, { recursive: true, force: true }); }
});

test('no personal data in the repository: only the three role aliases, test addresses and three vendor addresses', () => {
  const ALIASES = ['contact@rulefiles.dev', 'privacy@rulefiles.dev', 'sponsors@rulefiles.dev'];
  const VENDOR = ['support@buttondown.com', 'marketing@anthropic.com', 'noreply@github.com'];
  const TEST_DOMAINS = ['example.org', 'example.com', 'example.test', 'real.example', 'rulefiles.dev'];
  const bad = [];
  for (const [rel, body] of files()) {
    for (const addr of body.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g) || []) {
      const domain = addr.split('@')[1].toLowerCase();
      if (ALIASES.includes(addr) || VENDOR.includes(addr)) continue;
      if (TEST_DOMAINS.includes(domain) && (rel.startsWith('tests/'))) continue;
      bad.push(`${rel}: ${addr}`);
    }
  }
  assert.deepEqual(bad, []);
});

test('the repository holds no personal noreply address, no surname and no first name, except the full name on the privacy page and the legal notice', () => {
  const hits = [];
  for (const [rel, body] of files()) {
    // The handle is not checked here: docs/OPERATIONS.md shows it in the repository path, and the next test
    // checks it on the built site and the public sources.
    hits.push(...identityHits(rel, body, NAME_PAGES).filter((h) => !h.endsWith(': handle')));
  }
  assert.deepEqual(hits, []);
});

test('the built site and the public sources hold no GitHub handle, no surname, no first name and no personal noreply address, except the full name on two pages', () => {
  delete process.env.SITE_URL;
  process.env.BUILD_DATE = '2026-10-16';
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rulefiles-ident-'));
  try {
    build({ root, outDir, quiet: true });
    const inputs = [...walk(outDir)].map((f) => ['dist/' + path.relative(outDir, f), f]);
    for (const dir of ['content', 'src', 'data']) for (const f of walk(path.join(root, dir))) inputs.push([path.relative(root, f), f]);
    inputs.push(['site.config.json', path.join(root, 'site.config.json')]);
    const hits = [];
    let scanned = 0;
    for (const [rel, f] of inputs) {
      if (/\.(png|woff2?|ico|jpg|gif)$/i.test(f)) continue;
      scanned += 1;
      hits.push(...identityHits(rel, fs.readFileSync(f, 'utf8'), [...NAME_PAGES, ...NAME_BUILT_PAGES]));
    }
    assert.ok(scanned > 40, `only ${scanned} files scanned`);
    assert.deepEqual(hits, []);
  } finally { fs.rmSync(outDir, { recursive: true, force: true }); }
});

test('the full name appears on the privacy page and the legal notice and nowhere else: not in the sources, the built site, the docs, the tests or the commit messages', () => {
  delete process.env.SITE_URL;
  process.env.BUILD_DATE = '2026-10-16';
  const where = (rels, read) => rels.filter((rel) => read(rel).includes(FULL_NAME));
  assert.deepEqual(NAME_PAGES.filter((rel) => !text(rel).includes(FULL_NAME)), [], 'both pages carry the name');
  // The privacy page says it is the controller and the publisher of the newsletter, with no postal address.
  assert.ok(text('content/privacy.md').includes(`For the newsletter, the person responsible for personal data (responsable de traitement, in the sense of the GDPR) and its publisher is ${FULL_NAME}. The same person is responsible for the messages sent to the contact addresses and for the request logs described in the next section. No postal address is published.`));
  assert.ok(text('content/legal.md').includes(`The publisher of the site and of the newsletter is ${FULL_NAME}, who is also responsible for the personal data of the newsletter (see [Privacy](/privacy/)).`));
  const tracked = files().map(([rel]) => rel);
  assert.deepEqual(where(tracked, text).sort(), [...NAME_PAGES].sort(), 'every other tracked text file is free of the name');
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rulefiles-name-'));
  try {
    build({ root, outDir, quiet: true });
    const built = [...walk(outDir)].filter((f) => /\.(html|xml|txt|json|svg|js|css)$/.test(f)).map((f) => 'dist/' + path.relative(outDir, f));
    assert.deepEqual(where(built, (rel) => fs.readFileSync(path.join(outDir, rel.slice(5)), 'utf8')).sort(), [...NAME_BUILT_PAGES].sort());
  } finally { fs.rmSync(outDir, { recursive: true, force: true }); }
});

test('the commits that are not on origin/main yet hold neither the full name nor the first name', (t) => {
  // The older commits on main still carry the old marker name in their messages: docs/HISTORY-REWRITE.md plans
  // their rewrite, so only the range origin/main..HEAD is read. The check needs a clone that has origin/main and the
  // whole history. In the CI workflow, actions/checkout fetches one commit and no origin/main, and a checkout of
  // main itself has an empty range: in those cases the test is reported as skipped, not passed.
  const git = (...args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (git('rev-parse', '--git-dir').status !== 0) return t.skip('not a git checkout (an export has no commits to read)');
  if (git('rev-parse', '--is-shallow-repository').stdout.trim() === 'true') return t.skip('shallow clone: origin/main..HEAD cannot be trusted (the CI checkout is shallow)');
  if (git('rev-parse', '--verify', '--quiet', 'origin/main').status !== 0) return t.skip('no origin/main in this checkout');
  const log = git('log', 'origin/main..HEAD', '--format=%an%n%cn%n%B');
  assert.equal(log.status, 0, 'git log origin/main..HEAD runs');
  if (log.stdout.trim() === '') return t.skip('HEAD is on origin/main: no new commit to read');
  assert.equal(log.stdout.includes(FULL_NAME), false, 'a commit message or an author name holds the full name');
  assert.equal(FIRST.test(plain(log.stdout).replace(/TODO-OWNER/g, '')), false, 'a commit message holds the first name');
});

test('the scan reads every text file: files with no extension, dotfiles and package-lock.json included, and skips binary files', () => {
  const rels = files().map(([rel]) => rel);
  for (const rel of ['LICENSE', '.gitignore', 'package-lock.json', 'README.md', '.github/workflows/ci.yml']) assert.ok(rels.includes(rel), `${rel} is scanned`);
  assert.ok(!rels.some((rel) => /\.(png|ico|woff2?)$/.test(rel)), 'binary files are skipped');
  assert.equal(isBinary(Buffer.from([65, 0, 66])), true);
  assert.equal(isBinary(Buffer.from('plain text')), false);
});

test('the identity patterns catch an upper-case first name and a handle in a page, and allow only the exact full name on the two pages', () => {
  assert.ok(FIRST.test(['THO', 'MAS'].join('')));
  assert.ok(FIRST.test('Written by ' + ['tho', 'mas'].join('')));
  assert.ok(HANDLE.test('github.com/' + ['Dar', 'lol'].join('')));
  assert.ok(FIRST.test('[[TODO-' + ['THO', 'MAS'].join('') + ': field]]'), 'the old marker name is refused too');
  assert.equal(FIRST.test('[[TODO-OWNER: field]]'), false, 'the marker is called TODO-OWNER');
  // Spelling tricks: accents, an underscore or a digit next to the name, and HTML entities.
  const first = ['Tho', 'mas'].join('');
  const hit = (body) => identityHits('docs/x.md', body, NAME_PAGES);
  assert.deepEqual(hit(`Ask ${['Tho', 'más'].join('')}.`), ['docs/x.md: first name'], 'an accent does not hide the first name');
  assert.deepEqual(hit(`Ask ${['THO', 'MÀS'].join('')}.`), ['docs/x.md: first name']);
  assert.deepEqual(hit(`${first}_x`), ['docs/x.md: first name'], 'a trailing underscore does not hide it');
  assert.deepEqual(hit(`x_${first}`), ['docs/x.md: first name'], 'a leading underscore does not hide it');
  assert.deepEqual(hit(`${first}2`), ['docs/x.md: first name'], 'a digit does not hide it');
  assert.deepEqual(hit(['Tho', '&#109;', 'as'].join('')), ['docs/x.md: first name'], 'a decimal entity does not hide it');
  assert.deepEqual(hit(['Tho', '&#x6d;', 'as'].join('')), ['docs/x.md: first name'], 'a hexadecimal entity does not hide it');
  assert.deepEqual(hit(['Tho', 'm&aacute;s'].join('')), ['docs/x.md: first name'], 'a named accent entity does not hide it');
  assert.deepEqual(hit(['Tho', 'm&#225;s'].join('')), ['docs/x.md: first name']);
  assert.deepEqual(hit(`${first}ton and ${first}ine`), [], 'another word that starts with the same letters is not the first name');
  assert.deepEqual(hit(`${['Ram', 'bàut'].join('')}`), ['docs/x.md: surname'], 'an accent does not hide the surname');
  // On the two pages the full name passes. The first name alone, the surname alone and the full name elsewhere do not.
  assert.deepEqual(identityHits('content/privacy.md', `is ${FULL_NAME}.`, NAME_PAGES), []);
  assert.deepEqual(identityHits('content/privacy.md', `is ${FULL_NAME}. Ask ${['Tho', 'mas'].join('')}.`, NAME_PAGES), ['content/privacy.md: first name']);
  assert.deepEqual(identityHits('content/legal.md', `${FULL_NAME} and ${['Ram', 'baut'].join('')}`, NAME_PAGES), ['content/legal.md: surname']);
  assert.deepEqual(identityHits('content/about.md', `by ${FULL_NAME}`, NAME_PAGES).sort(), ['content/about.md: first name', 'content/about.md: surname']);
  assert.deepEqual(identityHits('docs/LAUNCH.md', `by ${FULL_NAME}`, NAME_PAGES).sort(), ['docs/LAUNCH.md: first name', 'docs/LAUNCH.md: surname']);
});

test('the history rewrite plan is written, holds no address, and names both options', () => {
  const plan = text('docs/HISTORY-REWRITE.md');
  for (const needle of ['Status: written on 2026-10-16, not executed', 'bundle create', 'git-filter-repo', '--mailmap', 'Option A, without force-push', 'Option B, with force-push', 'refs/pull', 'Keep my email addresses private', 'Block command line pushes that expose my email', 'git grep', '-S"$OLD_EMAIL"', 'Where the address can remain']) {
    assert.ok(plan.includes(needle), needle);
  }
  assert.match(plan, /Option B, with force-push on main \(needs the owner's explicit approval\)/);
  assert.match(plan, /run by the owner only/);
  assert.doesNotMatch(plan, /assistant|this box|\bbox\b/i, 'no internal wording in a file that becomes public');
  assert.ok(plan.includes("git log --all --format='%an%n%cn' | sort -u"), 'author and committer names are checked');
  assert.ok(plan.includes('The plan removes the address, not the name.'));
  assert.ok(plan.includes('The owner\'s civil name is now published on the legal notice and the privacy page'));
  assert.ok(plan.includes('Option A, a new clean repository with the noreply address, stays the recommended path.'));
  assert.ok(plan.includes('--replace-message') && plan.includes('--replace-text') && plan.includes('OLD_MARKER'), 'the plan also rewrites the old marker name');
  assert.ok(plan.includes('only after the bundle of step 2 is verified'));
  const ops = text('docs/OPERATIONS.md');
  assert.ok(ops.includes('reported as skipped with its reason, not passed'), 'the skipped commit-message check is documented');
  assert.doesNotMatch(ops, /assistant|this box|\bbox\b/i, 'no internal wording in docs/OPERATIONS.md');
  assert.ok(ops.includes('which was not installed on the machine used for the checks, so it was not run'));
  assert.ok(plan.includes("grep -o 'TODO-[A-Z][A-Z]*'"), 'the old marker pattern cannot match an empty name');
  assert.doesNotMatch(plan, /TODO-\[A-Z\]\*/);
  assert.ok(plan.includes('unless the old commit held that name'));
  assert.ok(plan.includes('A `TREE DIFFERS` line may appear only for a commit whose files held the old marker name. For each one, `git diff <old> <new>` must show that line and nothing else.'));
  assert.doesNotMatch(plan, /No `TREE DIFFERS` line may appear/);
  assert.ok(plan.includes('`git rev-list --count origin/main` gives 15 commits'));
  assert.ok(plan.includes('so count again before the rewrite'));
  assert.ok(plan.includes('Once every pull request branch is deleted, `origin/main` is the only remote branch and `git log --remotes` gives the same 15 commits.'));
  assert.doesNotMatch(plan, /33 \+ 7|33 on all remote branches|Pull requests #1 to #8/);
  assert.doesNotMatch(plan, /\| 52 \|/, 'the count comes from origin/main, not from the local clone');
});

test('docs/LAUNCH.md covers the publisher who gives only the host\'s details, the switch to a professional status, the aliases and the Buttondown settings', () => {
  const doc = text('docs/LAUNCH.md');
  for (const needle of ['article 1-1, II', 'LEGITEXT000005789847', '## Passage en activité pro', 'SIREN or SIRET', 'director of publication', 'Email Routing', 'open tracking', 'click tracking', 'DELETE /v1/subscribers/{id_or_email}', 'https://docs.buttondown.com/open-tracking', 'https://docs.buttondown.com/click-tracking', 'https://docs.buttondown.com/deleting-and-recovering-data', 'https://buttondown.com/legal/data-processing-agreement', 'https://buttondown.com/legal/subprocessors', 'https://www.cloudflare.com/website-terms/', 'https://www.cloudflare.com/privacypolicy/', '## To validate with an adviser']) {
    assert.ok(doc.includes(needle), needle);
  }
  assert.match(doc, /bought on 2026-10-16/);
});
