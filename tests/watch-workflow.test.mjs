import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parse } from 'yaml';

const root = new URL('..', import.meta.url).pathname;
const SCRIPT = path.join(root, 'scripts', 'open-watch-pr.sh');
const sh = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, { encoding: 'utf8', ...opts });
  assert.equal(r.status, 0, `${cmd} ${args.join(' ')}\n${r.stdout}\n${r.stderr}`);
  return r.stdout.trim();
};

/**
 * A clone of a local bare repository, a fake `gh` that logs its arguments, and a helper to run the script.
 * Nothing here talks to GitHub: the remote is a folder and gh is a stub.
 */
function scratch() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-diffs-watchpr-'));
  const remote = path.join(base, 'remote.git');
  const work = path.join(base, 'work');
  const bin = path.join(base, 'bin');
  const ghLog = path.join(base, 'gh.log');
  sh('git', ['init', '-q', '--bare', '-b', 'main', remote]);
  sh('git', ['clone', '-q', remote, work]);
  fs.mkdirSync(path.join(work, 'data', 'drafts'), { recursive: true });
  fs.writeFileSync(path.join(work, 'data', 'watch-state.json'), '{ "seen": {} }\n');
  fs.writeFileSync(path.join(work, 'data', 'drafts', '.gitkeep'), '');
  const g = (...a) => sh('git', ['-C', work, ...a]);
  g('add', '-A');
  g('-c', 'user.name=t', '-c', 'user.email=t@example.test', 'commit', '-q', '-m', 'init');
  g('push', '-q', 'origin', 'main');
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'gh'), `#!/bin/sh\nprintf '%s\\n' "$*" >> "${ghLog}"\n`, { mode: 0o755 });
  const change = (name = 'x') => {
    fs.writeFileSync(path.join(work, 'data', 'drafts', `${name}.draft.json`), '{}\n');
    fs.writeFileSync(path.join(work, 'data', 'watch-state.json'), `{ "seen": { "${name}": "2026-10-16" } }\n`);
  };
  const run = (env) => spawnSync('bash', [SCRIPT], {
    cwd: work, encoding: 'utf8',
    env: { PATH: `${bin}:${process.env.PATH}`, HOME: base, GH_TOKEN: 'ghs_TESTTOKEN123', GITHUB_RUN_ID: '1001', GITHUB_RUN_ATTEMPT: '1', ...env }
  });
  const remoteBranches = () => sh('git', ['-C', remote, 'branch', '--list']).split('\n').map((l) => l.replace('*', '').trim()).filter(Boolean);
  const ghCalls = () => (fs.existsSync(ghLog) ? fs.readFileSync(ghLog, 'utf8').trim().split('\n') : []);
  return { base, work, g, change, run, remoteBranches, ghCalls };
}
const today = () => new Date().toISOString().slice(0, 10);

test('script: no change in data/ means no branch, no push and no pull request', () => {
  const s = scratch();
  try {
    const r = s.run({});
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /No new changes detected/);
    assert.deepEqual(s.remoteBranches(), ['main']);
    assert.deepEqual(s.ghCalls(), []);
    assert.equal(s.g('branch', '--show-current'), 'main');
  } finally { fs.rmSync(s.base, { recursive: true, force: true }); }
});

test('script: dry run commits on a unique branch locally, pushes nothing and never calls gh', () => {
  const s = scratch();
  try {
    s.change();
    const r = s.run({ DRY_RUN: 'true' });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /Dry run: nothing is pushed/);
    assert.ok(r.stdout.includes(`Branch that would be pushed: watch/${today()}-1001-1`), r.stdout);
    assert.equal(s.g('branch', '--show-current'), `watch/${today()}-1001-1`);
    assert.match(s.g('log', '-1', '--format=%s'), /^Add watch draft for /);
    assert.deepEqual(s.remoteBranches(), ['main']);
    assert.deepEqual(s.ghCalls(), []);
  } finally { fs.rmSync(s.base, { recursive: true, force: true }); }
});

test('script: a real run pushes the branch and opens a draft pull request, without storing the token', () => {
  const s = scratch();
  try {
    s.change();
    const r = s.run({ DRY_RUN: 'false' });
    assert.equal(r.status, 0, r.stderr);
    const branch = `watch/${today()}-1001-1`;
    assert.deepEqual(s.remoteBranches(), ['main', branch]);
    const calls = s.ghCalls();
    assert.equal(calls.length, 1);
    assert.match(calls[0], new RegExp(`^pr create --draft --base main --head ${branch} --title Watch draft ${today()} --body `));
    assert.match(calls[0], /does not publish anything/);
    const config = fs.readFileSync(path.join(s.work, '.git', 'config'), 'utf8');
    assert.doesNotMatch(config, /TESTTOKEN|extraheader|AUTHORIZATION/, 'the token is not written to .git/config');
    assert.match(r.stdout, /::add-mask::/);
    assert.ok(!r.stdout.includes('ghs_TESTTOKEN123'));
    const files = sh('git', ['-C', s.work, 'show', '--name-only', '--format=', 'HEAD']).split('\n').sort();
    assert.deepEqual(files, ['data/drafts/x.draft.json', 'data/watch-state.json']);
  } finally { fs.rmSync(s.base, { recursive: true, force: true }); }
});

test('script: a second run on the same day gets another branch name and does not collide', () => {
  const s = scratch();
  try {
    s.change('a');
    assert.equal(s.run({ GITHUB_RUN_ID: '2001', GITHUB_RUN_ATTEMPT: '1' }).status, 0);
    s.g('checkout', '-q', 'main');
    s.change('b');
    assert.equal(s.run({ GITHUB_RUN_ID: '2002', GITHUB_RUN_ATTEMPT: '1' }).status, 0);
    s.g('checkout', '-q', 'main');
    s.change('c');
    assert.equal(s.run({ GITHUB_RUN_ID: '2002', GITHUB_RUN_ATTEMPT: '2' }).status, 0);
    assert.equal(new Set(s.remoteBranches()).size, 4);
    assert.equal(s.ghCalls().length, 3);
  } finally { fs.rmSync(s.base, { recursive: true, force: true }); }
});

test('script: it fails fast when the run id or the token is missing', () => {
  const s = scratch();
  try {
    s.change();
    const noId = s.run({ GITHUB_RUN_ID: '' });
    assert.notEqual(noId.status, 0);
    assert.match(noId.stderr, /GITHUB_RUN_ID is required/);
    const noToken = s.run({ GH_TOKEN: '', GITHUB_RUN_ID: '9' });
    assert.notEqual(noToken.status, 0);
    assert.match(noToken.stderr, /GH_TOKEN is required/);
    assert.deepEqual(s.remoteBranches(), ['main']);
  } finally { fs.rmSync(s.base, { recursive: true, force: true }); }
});

test('workflow: the dry_run input is a boolean that defaults to false and reaches the script', () => {
  const doc = parse(fs.readFileSync(path.join(root, '.github', 'workflows', 'weekly-watch.yml'), 'utf8'));
  const input = doc.on.workflow_dispatch.inputs.dry_run;
  assert.equal(input.type, 'boolean');
  assert.equal(input.default, false);
  const step = doc.jobs.watch.steps.find((x) => /open-watch-pr\.sh/.test(x.run || ''));
  assert.ok(step, 'a step runs scripts/open-watch-pr.sh');
  assert.equal(step.env.DRY_RUN, '${{ inputs.dry_run }}');
  assert.equal(step.env.GH_TOKEN, '${{ secrets.GITHUB_TOKEN }}');
});
