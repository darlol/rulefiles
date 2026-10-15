import test from 'node:test';
import assert from 'node:assert/strict';
import { TARGETS, buildBody, generateFiles } from '../src/js/generator-core.js';

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

test('each target gets the documented path and format', () => {
  const all = TARGETS.map((t) => t.id);
  const files = generateFiles(input, all, { cursorGlobs: 'src/**/*.ts', copilotApplyTo: '**/*.ts' });
  const byPath = Object.fromEntries(files.map((f) => [f.path, f]));
  assert.deepEqual(Object.keys(byPath).sort(), TARGETS.map((t) => t.path).sort());
  assert.match(byPath['.cursor/rules/project.mdc'].content, /^---\ndescription: A demo app\.\nglobs: src\/\*\*\/\*\.ts\nalwaysApply: true\n---\n# Demo/);
  assert.match(byPath['.github/instructions/project.instructions.md'].content, /^---\napplyTo: "\*\*\/\*\.ts"\n---\n/);
  assert.equal(byPath['AGENTS.md'].content, buildBody(input));
  assert.equal(byPath['.github/copilot-instructions.md'].content, buildBody(input));
  assert.match(byPath['.cursorrules'].note, /Legacy/);
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

test('copilot applyTo defaults to ** and escapes quotes', () => {
  const [f] = generateFiles(input, ['copilot-path'], {});
  assert.match(f.content, /applyTo: "\*\*"/);
  const [g] = generateFiles(input, ['copilot-path'], { copilotApplyTo: 'a"b' });
  assert.match(g.content, /applyTo: "a\\"b"/);
});
