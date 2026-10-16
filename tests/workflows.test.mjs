import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parse } from 'yaml';

const load = (f) => {
  const text = fs.readFileSync(new URL(`../.github/workflows/${f}`, import.meta.url), 'utf8');
  return { text, doc: parse(text) };
};

test('weekly watch: draft pull request, no persisted credentials, timeout and a unique branch name', () => {
  const { text, doc } = load('weekly-watch.yml');
  const job = doc.jobs.watch;
  assert.ok(job['timeout-minutes'] > 0 && job['timeout-minutes'] <= 30);
  const checkout = job.steps.find((s) => String(s.uses).startsWith('actions/checkout@'));
  assert.equal(checkout.with['persist-credentials'], false);
  const pr = job.steps.find((s) => /gh pr create/.test(s.run || ''));
  assert.match(pr.run, /gh pr create --draft /);
  assert.match(pr.run, /branch="watch\/\$\{stamp\}-\$\{GITHUB_RUN_ID\}-\$\{GITHUB_RUN_ATTEMPT\}"/);
  assert.match(pr.run, /extraheader/);
  assert.doesNotMatch(text, /git push origin "\$branch"\s*$/m, 'the push must carry the token explicitly');
  assert.doesNotMatch(text, /ghp_|github_pat_/);
});

test('workflows pin every action to a commit SHA and request only the permissions they use', () => {
  for (const f of ['ci.yml', 'weekly-watch.yml']) {
    const { text, doc } = load(f);
    for (const m of text.matchAll(/uses:\s*(\S+)/g)) assert.match(m[1], /@[0-9a-f]{40}$/, `${f}: ${m[1]}`);
    assert.ok(doc.permissions, `${f} sets permissions`);
  }
  assert.deepEqual(load('ci.yml').doc.permissions, { contents: 'read' });
  assert.deepEqual(load('weekly-watch.yml').doc.permissions, { contents: 'write', 'pull-requests': 'write' });
});

test('CI installs the locked dev dependencies before running the tests', () => {
  const steps = load('ci.yml').doc.jobs.test.steps.map((s) => s.run).filter(Boolean);
  assert.equal(steps[0], 'npm ci');
  assert.ok(steps.includes('npm test'));
});
