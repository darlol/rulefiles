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
  const step = job.steps.find((s) => /open-watch-pr\.sh/.test(s.run || ''));
  assert.ok(step, 'the pull request step runs scripts/open-watch-pr.sh');
  const script = fs.readFileSync(new URL('../scripts/open-watch-pr.sh', import.meta.url), 'utf8');
  assert.match(script, /gh pr create --draft /);
  assert.match(script, /branch="watch\/\$\{stamp\}-\$\{GITHUB_RUN_ID:\?[^}]*\}-\$\{GITHUB_RUN_ATTEMPT:\?[^}]*\}"/);
  assert.match(script, /extraheader/);
  assert.doesNotMatch(script, /git push origin "\$branch"\s*$/m, 'the push must carry the token explicitly');
  assert.doesNotMatch(text + script, /ghp_|github_pat_/);
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

test('the recommended ruleset is valid JSON and requires exactly the CI checks that ci.yml produces', () => {
  const ruleset = JSON.parse(fs.readFileSync(new URL('../docs/ruleset-main.json', import.meta.url), 'utf8'));
  assert.equal(ruleset.target, 'branch');
  assert.equal(ruleset.enforcement, 'active');
  assert.deepEqual(ruleset.conditions.ref_name.include, ['~DEFAULT_BRANCH']);
  const types = ruleset.rules.map((r) => r.type).sort();
  assert.deepEqual(types, ['deletion', 'non_fast_forward', 'pull_request', 'required_status_checks']);
  const [jobName, job] = Object.entries(load('ci.yml').doc.jobs)[0];
  const expected = job.strategy.matrix.node.map((n) => `${jobName} (${n})`).sort();
  const required = ruleset.rules.find((r) => r.type === 'required_status_checks').parameters.required_status_checks.map((c) => c.context).sort();
  assert.deepEqual(required, expected);
  assert.deepEqual(ruleset.rules.find((r) => r.type === 'pull_request').parameters.allowed_merge_methods, ['squash']);
});
