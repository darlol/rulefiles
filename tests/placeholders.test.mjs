import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { build } from '../scripts/build.mjs';
import { PLACEHOLDER_RE, launchWarnings, markerFields } from '../scripts/lib/placeholders.mjs';
import { TEST_DATE } from './helpers/test-date.mjs';

const root = new URL('..', import.meta.url).pathname;
const hits = (text) => text.match(PLACEHOLDER_RE) || [];
const cfg = { baseUrl: 'https://real.example' };

test('PLACEHOLDER_RE matches TODO-OWNER markers and the older placeholder phrasings', () => {
  const dirty = [
    'Write to [[TODO-OWNER: contact address]] for requests.',
    '[[TODO-OWNER: x]]',
    'The host will be named here before launch.',
    'A contact will be listed on the privacy page.',
    'The terms are not set yet.',
    'Terms to be defined later.',
    'Owner: TODO',
    'Date: TBD',
    'FIXME later'
  ];
  for (const t of dirty) assert.equal(hits(t).length, 1, t);
});

test('PLACEHOLDER_RE leaves ordinary sentences alone', () => {
  const clean = [
    'Contact: hello@real.example.',
    'Sponsorship is not open yet and no rates are published.',
    'A to-do list is not a placeholder, and neither is a todo app.',
    'The page will be updated weekly.',
    'Rules that will apply when it opens.',
    'Use [[wiki-style]] links and [text](/p/).'
  ];
  for (const t of clean) assert.deepEqual(hits(t), [], t);
});

test('markerFields returns the field names in order', () => {
  assert.deepEqual(markerFields('a [[TODO-OWNER: one]] b [[TODO-OWNER:  two words ]] c'), ['one', 'two words']);
  assert.deepEqual(markerFields('nothing'), []);
});

test('launchWarnings reports markers in pages and in the configuration, once each', () => {
  const pages = [
    { path: '/a/', html: '<h1>A</h1><p>Mail [[TODO-OWNER: mail]].</p><p>Mail [[TODO-OWNER: mail]].</p>' },
    { path: '/b/', html: '<p>All set.</p>' }
  ];
  const w = launchWarnings(pages, { ...cfg, sponsorContact: '[[TODO-OWNER: sponsor mail]]', newsletter: { provider: 'ok', hiddenFields: { a: 'TODO' } } });
  assert.equal(w.filter((l) => l.startsWith('/a/:')).length, 1);
  assert.ok(w.some((l) => l.startsWith('site.config.json: sponsorContact')), w.join('\n'));
  assert.ok(w.some((l) => l.startsWith('site.config.json: newsletter.hiddenFields.a')), w.join('\n'));
  assert.equal(w.length, 3);
  assert.deepEqual(launchWarnings([{ path: '/x/', html: '<p>Done.</p>' }], cfg), []);
  assert.deepEqual(launchWarnings([], { baseUrl: 'https://rulefiles.dev' }), [], 'the domain is bought, so baseUrl is not a launch warning');
});

/** A copy of the project inputs in a temporary folder, so a test can edit them. */
function scratchProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rulefiles-strict-'));
  for (const d of ['data', 'content', 'src', 'scripts']) fs.cpSync(path.join(root, d), path.join(dir, d), { recursive: true });
  fs.copyFileSync(path.join(root, 'site.config.json'), path.join(dir, 'site.config.json'));
  return dir;
}
const addMarker = (dir) => fs.appendFileSync(path.join(dir, 'content', 'about.md'), '\nOwner: [[TODO-OWNER: test field]].\n');
const fillMarkers = (dir) => {
  for (const f of fs.readdirSync(path.join(dir, 'content'))) {
    const p = path.join(dir, 'content', f);
    fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(/\[\[TODO-OWNER:[^\]]*\]\]/g, 'filled in'));
  }
};

test('strict build fails and leaves no dist while markers remain, the normal build only warns', () => {
  process.env.BUILD_DATE = TEST_DATE;
  const dir = scratchProject();
  try {
    addMarker(dir);
    const outDir = path.join(dir, 'dist');
    const normal = build({ root: dir, outDir, quiet: true });
    assert.ok(normal.warnings.length > 0);
    assert.ok(fs.existsSync(path.join(outDir, 'index.html')));
    assert.throws(() => build({ root: dir, outDir, quiet: true, strict: true }), (e) => {
      assert.match(e.message, /Strict build failed: \d+ launch problem\(s\) remain/);
      assert.match(e.message, /TODO-OWNER: test field/);
      assert.doesNotMatch(e.message, /baseUrl/);
      return true;
    });
    assert.equal(fs.existsSync(outDir), false, 'dist is removed so a failed release cannot be deployed');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('strict build succeeds on the project as it is, and once a marker that was added is filled', () => {
  process.env.BUILD_DATE = TEST_DATE;
  const dir = scratchProject();
  try {
    assert.deepEqual(build({ root: dir, outDir: path.join(dir, 'dist0'), quiet: true, strict: true }).warnings, []);
    addMarker(dir);
    fillMarkers(dir);
    const outDir = path.join(dir, 'dist');
    const r = build({ root: dir, outDir, quiet: true, strict: true });
    assert.deepEqual(r.warnings, []);
    assert.ok(fs.existsSync(path.join(outDir, 'index.html')));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('strict build also fails on an older-style placeholder sentence', () => {
  process.env.BUILD_DATE = TEST_DATE;
  const dir = scratchProject();
  try {
    fillMarkers(dir);
    const about = path.join(dir, 'content', 'about.md');
    fs.appendFileSync(about, '\nA channel will be named here soon.\n');
    assert.throws(() => build({ root: dir, outDir: path.join(dir, 'dist'), quiet: true, strict: true }), /will be named here/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('the command line honours --strict and RULEFILES_STRICT, and the default run exits 0 with warnings', () => {
  const dir = scratchProject();
  try {
    const run = (args, env = {}) => spawnSync(process.execPath, [path.join(dir, 'scripts', 'build.mjs'), ...args], {
      cwd: dir, encoding: 'utf8', env: { ...process.env, BUILD_DATE: TEST_DATE, SITE_URL: '', RULEFILES_STRICT: '', ...env }
    });
    addMarker(dir);
    const plain = run([]);
    assert.equal(plain.status, 0, plain.stderr);
    assert.match(plain.stderr, /LAUNCH WARNING/);
    assert.ok(fs.existsSync(path.join(dir, 'dist', 'index.html')));
    const flag = run(['--strict']);
    assert.equal(flag.status, 1);
    assert.match(flag.stderr, /Strict build failed/);
    assert.equal(fs.existsSync(path.join(dir, 'dist')), false);
    for (const v of ['1', 'true', 'yes']) assert.equal(run([], { RULEFILES_STRICT: v }).status, 1, v);
    assert.equal(run([], { RULEFILES_STRICT: '0' }).status, 0);
    fillMarkers(dir);
    assert.equal(run(['--strict']).status, 0);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('every marker in the sources is listed in docs/LAUNCH-BLOCKERS.md, and every listed marker exists', () => {
  const sources = [
    ...fs.readdirSync(path.join(root, 'content')).map((f) => path.join('content', f)),
    'scripts/lib/render.mjs', 'site.config.json'
  ];
  const inSources = new Set(sources.flatMap((f) => markerFields(fs.readFileSync(path.join(root, f), 'utf8'))));
  const doc = fs.readFileSync(path.join(root, 'docs', 'LAUNCH-BLOCKERS.md'), 'utf8');
  const listed = new Set([...doc.matchAll(/^- `\[\[TODO-OWNER: ([^\]]+)\]\]`/gm)].map((m) => m[1]));
  assert.deepEqual([...inSources].sort(), [...listed].sort());
});
