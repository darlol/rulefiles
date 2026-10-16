import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from 'yaml';
import { TARGETS, buildBody, generateFiles, yamlQuote, yamlScalar } from '../src/js/generator-core.js';

const input = {
  projectName: 'Demo', description: 'A demo app.', stack: 'TypeScript\nNode 22',
  installCmd: 'npm ci', buildCmd: 'npm run build', testCmd: 'npm test',
  style: 'Use 2-space indentation', never: 'Commit secrets'
};

test('body has only the sections that were filled in', () => {
  const body = buildBody(input);
  assert.match(body, /^# Demo\n/);
  assert.match(body, /## Stack\n\n- TypeScript\n- Node 22/);
  assert.match(body, /- Install: `npm ci`/);
  assert.match(body, /## Never\n\n- Commit secrets/);
  assert.doesNotMatch(body, /## Ask first/);
  assert.doesNotMatch(body, /Run in development/);
});

test('empty input still gives a valid heading', () => {
  assert.equal(buildBody({}), '# Project\n');
});

/** Splits a generated file into its parsed frontmatter and the Markdown body. */
function split(content) {
  const m = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  assert.ok(m, 'file starts with a frontmatter block');
  return { fm: parse(m[1]), body: m[2] };
}
const mdc = (description, options = {}) => {
  const [f] = generateFiles({ ...input, description }, ['cursor-mdc'], options);
  return split(f.content);
};

test('each target gets the documented path and the expected content', () => {
  const all = TARGETS.map((t) => t.id);
  const files = generateFiles(input, all, { cursorGlobs: 'src/**/*.ts', copilotApplyTo: '**/*.ts', claudeMode: 'full' });
  const byPath = Object.fromEntries(files.map((f) => [f.path, f]));
  assert.deepEqual(Object.keys(byPath).sort(), TARGETS.map((t) => t.path).sort());
  const cursor = split(byPath['.cursor/rules/project.mdc'].content);
  assert.deepEqual(cursor.fm, { description: 'A demo app.', globs: 'src/**/*.ts', alwaysApply: true });
  assert.equal(cursor.body, buildBody(input));
  const copilot = split(byPath['.github/instructions/project.instructions.md'].content);
  assert.deepEqual(copilot.fm, { applyTo: '**/*.ts' });
  assert.equal(copilot.body, buildBody(input));
  assert.equal(byPath['AGENTS.md'].content, buildBody(input));
  assert.equal(byPath['CLAUDE.md'].content, buildBody(input));
  assert.equal(byPath['.github/copilot-instructions.md'].content, buildBody(input));
  assert.match(byPath['.cursorrules'].note, /Legacy/);
});

test('cursor .mdc frontmatter parses as YAML for descriptions with special characters', () => {
  const cases = [
    'A REST API: built with Express',
    '[draft] service',
    'Uses # hash',
    'Says "hello" and uses a \\ backslash',
    "It's a 'quoted' thing",
    '- starts like a list item',
    '> folded? | literal? & anchor *alias !tag %dir @at `tick`',
    'multi\nline\r\ndescription',
    'true',
    '123',
    'null',
    '{ not: a map }',
    'tab\tseparated',
    'unicode \u00e9\u4e2d\ud83d\ude00 \u2028 line separator \u0085 next line'
  ];
  for (const d of cases) {
    const { fm, body } = mdc(d);
    const expected = d.replace(/\s+/g, ' ').trim();
    assert.equal(typeof fm.description, 'string', d);
    assert.equal(fm.description, expected, d);
    assert.equal(fm.alwaysApply, true, d);
    assert.deepEqual(Object.keys(fm), ['description', 'alwaysApply'], d);
    assert.match(body, /^# Demo\n/, d);
  }
});

test('cursor .mdc globs parse back to the same string, quoted when YAML needs it', () => {
  const cases = [
    '**/*.ts',
    '*.ts',
    '*.{ts,tsx}',
    'src/**/*.ts',
    'src/**/*.ts, lib/**/*.ts',
    '[abc]/*.js',
    '!dist/**',
    '#generated/**',
    'docs: v2/**',
    'a "quoted" glob',
    'back\\slash/**',
    '@scope/pkg/**',
    '2024',
    'true',
    '- dash'
  ];
  for (const g of cases) {
    const { fm } = mdc('Desc', { cursorGlobs: g, cursorAlwaysApply: false });
    assert.equal(fm.globs, g, g);
    assert.equal(fm.alwaysApply, false, g);
    assert.equal(fm.description, 'Desc', g);
  }
  // Plain when safe, matching the form used on the Cursor rules page. Quoted when the first character is special.
  const [plain] = generateFiles(input, ['cursor-mdc'], { cursorGlobs: 'src/components/**/*.tsx' });
  assert.match(plain.content, /\nglobs: src\/components\/\*\*\/\*\.tsx\n/);
  const [quoted] = generateFiles(input, ['cursor-mdc'], { cursorGlobs: '**/*.ts' });
  assert.match(quoted.content, /\nglobs: "\*\*\/\*\.ts"\n/);
});

test('cursor .mdc leaves out globs when none are given and stays one block of three keys at most', () => {
  const { fm } = mdc('Desc');
  assert.deepEqual(fm, { description: 'Desc', alwaysApply: true });
});

test('copilot applyTo parses back to the same string for special characters', () => {
  for (const g of ['**', '**/*.ts', 'a"b', 'c:\\dir', 'x # y', '*.{js,ts}', 'src/**,tests/**']) {
    const [f] = generateFiles(input, ['copilot-path'], { copilotApplyTo: g });
    assert.equal(split(f.content).fm.applyTo, g, g);
  }
});

test('YAML helpers: no raw line breaks, and a generated block never needs more than the three keys', () => {
  for (const v of ['a\nb', 'a\u2028b', 'a\u2029b', 'a\u0085b', 'a\rb']) {
    assert.doesNotMatch(yamlQuote(v), /[\n\r\u2028\u2029\u0085]/);
    assert.doesNotMatch(yamlScalar(v), /[\n\r\u2028\u2029\u0085]/);
  }
  assert.equal(yamlScalar('src/**/*.ts'), 'src/**/*.ts');
  assert.equal(yamlScalar('**/*.ts'), '"**/*.ts"');
  assert.equal(yamlScalar(''), '""');
});

test('random printable descriptions and globs always survive a YAML round trip', () => {
  let seed = 12345;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const alphabet = ['a', 'B', '7', ' ', ' ', ':', '#', '"', "'", '\\', '*', '[', ']', '{', '}', ',', '&', '!', '%', '@', '`', '|', '>', '-', '?', '.', '/', '\u00e9', '\n', '\t'];
  for (let i = 0; i < 400; i++) {
    const len = 1 + Math.floor(rnd() * 14);
    let s = '';
    for (let j = 0; j < len; j++) s += alphabet[Math.floor(rnd() * alphabet.length)];
    const expected = s.replace(/\s+/g, ' ').trim();
    if (!expected) continue;
    const { fm } = mdc(s, { cursorGlobs: s });
    assert.equal(fm.description, expected, JSON.stringify(s));
    assert.equal(fm.globs, expected, JSON.stringify(s));
  }
});

test('CLAUDE.md can import AGENTS.md', () => {
  const [f] = generateFiles(input, ['claude-md'], { claudeMode: 'import' });
  assert.equal(f.content, '@AGENTS.md\n');
  const [g] = generateFiles(input, ['claude-md'], { claudeMode: 'full' });
  assert.match(g.content, /^# Demo/);
});

test('only selected targets are produced and output is deterministic', () => {
  const a = generateFiles(input, ['agents-md']);
  assert.equal(a.length, 1);
  assert.deepEqual(generateFiles(input, ['agents-md']), a);
  assert.deepEqual(generateFiles(input, []), []);
});

test('copilot applyTo defaults to **', () => {
  const [f] = generateFiles(input, ['copilot-path'], {});
  assert.deepEqual(split(f.content).fm, { applyTo: '**' });
});

test('by default only AGENTS.md is selected, and CLAUDE.md imports it instead of copying it', () => {
  assert.deepEqual(TARGETS.filter((t) => t.checked).map((t) => t.id), ['agents-md']);
  assert.equal(TARGETS.filter((t) => t.main).length, 1);
  const [f] = generateFiles(input, ['claude-md'], {});
  assert.equal(f.content, '@AGENTS.md\n');
});
