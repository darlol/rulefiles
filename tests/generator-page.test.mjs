import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { build } from '../scripts/build.mjs';
import { GENERATOR_COPY } from '../scripts/lib/render.mjs';
import { GENERATOR_PRESETS, PRESET_FIELDS, presetValues } from '../src/js/generator-presets.js';
import { TARGETS, generateFiles } from '../src/js/generator-core.js';
import { TEST_DATE } from './helpers/test-date.mjs';

const out = fs.mkdtempSync(path.join(os.tmpdir(), 'gen-page-'));
let html;
before(() => { process.env.BUILD_DATE = TEST_DATE; build({ outDir: out, quiet: true }); html = fs.readFileSync(path.join(out, 'generator', 'index.html'), 'utf8'); });
after(() => fs.rmSync(out, { recursive: true, force: true }));

test('every preset fills every field the form has, and clear empties them', () => {
  for (const p of GENERATOR_PRESETS) {
    const v = presetValues(p.id);
    assert.deepEqual(Object.keys(v), PRESET_FIELDS, p.id);
    for (const f of ['projectName', 'description', 'testCmd', 'never']) assert.ok(v[f].trim(), `${p.id}: ${f} is filled`);
    assert.match(generateFiles(v, ['agents-md'])[0].content, new RegExp(`^# ${v.projectName}\\n`), `${p.id}: the output uses the preset`);
  }
  assert.ok(Object.values(presetValues('clear')).every((x) => x === ''));
  assert.equal(presetValues('nope'), null);
  for (const f of PRESET_FIELDS) assert.match(html, new RegExp(`name="${f}"`), `the form has ${f}`);
});

test('the preset buttons are disabled until the script runs, so the page does not move, one per preset plus clear', () => {
  assert.match(html, /<div class="gen-presets" id="gen-presets" role="group" aria-labelledby="gen-presets-label">/);
  for (const p of GENERATOR_PRESETS) assert.ok(html.includes(`data-preset="${p.id}" disabled>${p.label}</button>`), p.id);
  assert.ok(html.includes(`data-preset="clear" disabled>${GENERATOR_COPY.clear}</button>`));
  const js = fs.readFileSync(new URL('../src/static/generator.js', import.meta.url), 'utf8');
  assert.match(js, /for \(const b of presetBar\.querySelectorAll\('button'\)\) b\.disabled = false;/);
});

test('each text field has a hint tied to it or an example placeholder, and the hints and steps are on the page', () => {
  for (const m of html.matchAll(/<(input|textarea) id="(\w+)" name="\w+"[^>]*>/g)) {
    if (/type="(hidden|radio|checkbox)"/.test(m[0])) continue;
    assert.ok(/placeholder="e\.g\. /.test(m[0]) || /aria-describedby="/.test(m[0]), `${m[2]} has help`);
    const d = /aria-describedby="([^"]+)"/.exec(m[0]);
    if (d) assert.ok(html.includes(`id="${d[1]}"`), `${m[2]}: the hint ${d[1]} exists`);
  }
  for (const hint of Object.values(GENERATOR_COPY.hints)) assert.ok(html.includes(hint), hint);
  assert.match(html, /<ol class="gen-steps"><li>Save <code>AGENTS\.md<\/code> at the root of your repository and commit it\.<\/li>/);
  assert.ok(html.includes('<a href="/matrix/">the matrix</a>.</li></ol>'));
});

test('the removed controls stay removed: no checkbox for the main file and no always-apply checkbox', () => {
  assert.doesNotMatch(html, /cursorAlwaysApply/);
  assert.doesNotMatch(html, /id="gen-main"/);
  assert.doesNotMatch(html, /<legend>Options<\/legend>/);
  const optionFor = [...html.matchAll(/data-option-for="([\w-]+)"/g)].map((m) => m[1]);
  assert.deepEqual(optionFor, ['claude-md', 'cursor-mdc', 'copilot-path']);
  for (const id of optionFor) assert.ok(TARGETS.some((t) => t.id === id && !t.main), id);
});

test('the browser script derives alwaysApply from the globs and always includes the main file', () => {
  const js = fs.readFileSync(new URL('../src/static/generator.js', import.meta.url), 'utf8');
  assert.match(js, /cursorAlwaysApply: globs === ''/);
  assert.match(js, /targets: main\.concat\(extra\)/);
  const [withGlobs] = generateFiles({}, ['cursor-mdc'], { cursorGlobs: 'src/**', cursorAlwaysApply: false });
  assert.match(withGlobs.content, /alwaysApply: false/);
  const [without] = generateFiles({}, ['cursor-mdc'], { cursorGlobs: '', cursorAlwaysApply: true });
  assert.match(without.content, /alwaysApply: true/);
});
