import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { build } from '../scripts/build.mjs';
import { loadData } from '../scripts/lib/data.mjs';
import { validateMatrix, validateDigest } from '../scripts/lib/validate.mjs';
import { groupDrafts } from '../scripts/lib/parsers.mjs';
import { DATA_LICENSE, DATA_LICENSE_URL, DATA_ATTRIBUTION, licenseFields, licenseProblems } from '../scripts/lib/license.mjs';
import { TEST_DATE } from './helpers/test-date.mjs';

const root = new URL('..', import.meta.url).pathname;
const text = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const TODAY = TEST_DATE;

// The MIT text as the SPDX license list gives it (https://spdx.org/licenses/MIT.html), with the year and the
// holder filled in. Written out here so a change to LICENSE shows up as a difference in this test.
const mitText = (year, holder) => `MIT License

Copyright (c) ${year} ${holder}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;
const words = (s) => s.replace(/\s+/g, ' ').trim();
const isMit = (lic) => words(lic) === words(mitText(2026, 'Rulefiles contributors'));

test('LICENSE is the model MIT text, warranty clause included, with the year and the holder filled in', () => {
  const lic = text('LICENSE');
  assert.ok(isMit(lic), 'LICENSE differs from the model MIT text');
  assert.ok(lic.includes('THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND'));
  assert.ok(lic.includes('IN NO EVENT SHALL THE\nAUTHORS OR COPYRIGHT HOLDERS BE LIABLE'));
  assert.doesNotMatch(lic, /<year>|<copyright holder>|TODO/);
  assert.equal(JSON.parse(text('package.json')).license, 'MIT');
});

test('the MIT comparison fails when the warranty clause, the notice clause or the holder is changed', () => {
  const lic = text('LICENSE');
  const warranty = lic.slice(lic.indexOf('THE SOFTWARE IS PROVIDED'));
  assert.equal(isMit(lic.replace(warranty, '')), false, 'warranty clause removed');
  assert.equal(isMit(lic.replace('IN NO EVENT SHALL THE\nAUTHORS OR COPYRIGHT HOLDERS BE LIABLE', 'IN NO EVENT SHALL THE\nAUTHORS BE LIABLE')), false, 'liability wording changed');
  assert.equal(isMit(lic.replace('The above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n\n', '')), false, 'notice clause removed');
  assert.equal(isMit(lic.replace('Rulefiles contributors', 'Someone else')), false, 'holder changed');
  assert.equal(isMit(lic), true);
});

test('the CC BY 4.0 legal code is the unchanged official text, and LICENSE-DATA.md points to it', () => {
  const legal = fs.readFileSync(path.join(root, 'docs/licenses/CC-BY-4.0.txt'));
  const sha = crypto.createHash('sha256').update(legal).digest('hex');
  assert.equal(sha, '9ba9550ad48438d0836ddab3da480b3b69ffa0aac7b7878b5a0039e7ab429411');
  const doc = text('LICENSE-DATA.md');
  assert.ok(doc.includes(sha));
  for (const needle of ['https://creativecommons.org/licenses/by/4.0/', 'https://creativecommons.org/licenses/by/4.0/legalcode', 'docs/licenses/CC-BY-4.0.txt', 'Rulefiles contributors', 'Suggested credit', 'belong to their authors', 'src/static/fonts/OFL.txt']) {
    assert.ok(doc.includes(needle), needle);
  }
});

test('README and LICENSE-DATA.md state both licenses and the credit', () => {
  const readme = text('README.md');
  assert.match(readme, /Code: MIT, see \[LICENSE\]/);
  assert.match(readme, /Data and text: CC BY 4\.0, see \[LICENSE-DATA\.md\]/);
  assert.match(readme, /Suggested credit for reusing the data/);
  assert.ok(readme.includes('By contributing, you license your contribution under the same terms: MIT for code, CC BY 4.0 for text and data.'));
});

test('matrix.json and every digest carry the license fields, with the one allowed value', () => {
  const data = loadData(root);
  const files = [['matrix.json', data.matrix], ...data.digests.map((d) => [d.file, d.data])];
  assert.ok(files.length >= 3);
  for (const [name, obj] of files) {
    assert.deepEqual([obj.license, obj.licenseUrl, obj.attribution], [DATA_LICENSE, DATA_LICENSE_URL, DATA_ATTRIBUTION], name);
    assert.deepEqual(licenseProblems(obj, name), []);
  }
  assert.equal(DATA_LICENSE, 'CC-BY-4.0');
  assert.equal(DATA_LICENSE_URL, 'https://creativecommons.org/licenses/by/4.0/');
});

test('the validators reject a missing or wrong license field', () => {
  const data = loadData(root);
  const m = structuredClone(data.matrix);
  delete m.license;
  assert.match(validateMatrix(m, data.hosts, TODAY).errors.join('\n'), /matrix\.json: license must be "CC-BY-4\.0"/);
  const m2 = structuredClone(data.matrix);
  m2.licenseUrl = 'https://example.com/';
  assert.match(validateMatrix(m2, data.hosts, TODAY).errors.join('\n'), /licenseUrl must be/);
  const m3 = structuredClone(data.matrix);
  m3.attribution = ' ';
  assert.match(validateMatrix(m3, data.hosts, TODAY).errors.join('\n'), /attribution is required/);
  const d = structuredClone(data.digests[0].data);
  delete d.license;
  assert.match(validateDigest(d, data.hosts, TODAY).join('\n'), /license must be "CC-BY-4\.0"/);
});

test('drafts written by the watch script carry the license fields and validate', () => {
  const data = loadData(root);
  const [draft] = groupDrafts([{ date: '2026-10-13', tool: 'cursor', title: 'T', firstLine: 'Text', lines: ['Text'], url: 'https://cursor.com/changelog', sourceLabel: 'Cursor changelog' }], TODAY);
  assert.deepEqual({ license: draft.license, licenseUrl: draft.licenseUrl, attribution: draft.attribution }, licenseFields());
  assert.deepEqual(validateDigest(draft, data.hosts, TODAY), []);
});

test('the built site publishes the license in the JSON files, the JSON-LD, the footer, llms.txt and the About page', () => {
  process.env.BUILD_DATE = TODAY;
  const out = fs.mkdtempSync(path.join(fs.realpathSync(process.env.TMPDIR || '/tmp'), 'rulefiles-license-'));
  try {
    build({ root, outDir: out, quiet: true });
    const rd = (rel) => fs.readFileSync(path.join(out, rel), 'utf8');
    const matrix = JSON.parse(rd('data/matrix.json'));
    assert.equal(matrix.license, DATA_LICENSE);
    const digests = JSON.parse(rd('data/digests.json'));
    assert.ok(digests.length >= 2);
    for (const d of digests) assert.deepEqual([d.license, d.licenseUrl, d.attribution], [DATA_LICENSE, DATA_LICENSE_URL, DATA_ATTRIBUTION]);
    for (const page of ['index.html', 'about/index.html', 'matrix/index.html', 'digest/index.html', 'privacy/index.html']) {
      assert.match(rd(page), /Code under the <a href="\/about\/">MIT license<\/a>\. Data and text under <a href="https:\/\/creativecommons\.org\/licenses\/by\/4\.0\/" rel="license">CC BY 4\.0<\/a>\./, page);
    }
    const ld = (html) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
    const matrixLd = JSON.stringify(ld(rd('matrix/index.html')));
    assert.match(matrixLd, /"@type":"Dataset"[^]*"license":"https:\/\/creativecommons\.org\/licenses\/by\/4\.0\/"/);
    const week = fs.readdirSync(path.join(out, 'digest')).find((f) => /^\d{4}-W\d{2}$/.test(f));
    assert.match(JSON.stringify(ld(rd(`digest/${week}/index.html`))), /"@type":"Article"[^]*"license":"https:\/\/creativecommons\.org\/licenses\/by\/4\.0\/"/);
    assert.match(rd('llms.txt'), /\[License\]\(https:\/\/creativecommons\.org\/licenses\/by\/4\.0\/\): the data and the text are CC BY 4\.0, credit "Rulefiles contributors"/);
    // No external resource is loaded for the license: it is a plain link.
    assert.doesNotMatch(rd('index.html'), /<(img|script|link)[^>]+creativecommons/);
  } finally { fs.rmSync(out, { recursive: true, force: true }); }
});
