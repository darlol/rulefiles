import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseRobots, isAllowed } from '../scripts/lib/robots.mjs';

const fx = (n) => fs.readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8');
const TOKEN = 'AgentDiffsWatch';

test('cursor robots.txt: changelog feed and docs page are allowed, API and locale docs are not', () => {
  const g = parseRobots(fx('robots-cursor.txt'));
  assert.equal(isAllowed(g, TOKEN, '/changelog/rss.xml'), true);
  assert.equal(isAllowed(g, TOKEN, '/docs/context/rules'), true);
  assert.equal(isAllowed(g, TOKEN, '/api/anything'), false);
  assert.equal(isAllowed(g, TOKEN, '/fr/docs/context/rules'), false);
  assert.equal(isAllowed(g, TOKEN, '/dashboard'), false);
});

test('github.com robots.txt disallows .atom feeds', () => {
  const g = parseRobots(fx('robots-github.txt'));
  assert.equal(isAllowed(g, TOKEN, '/anthropics/claude-code/releases.atom'), false);
});

test('longest match wins and Allow wins ties', () => {
  const g = parseRobots('User-agent: *\nDisallow: /a\nAllow: /a/b\nDisallow: /c$\nAllow: /d\nDisallow: /d\n');
  assert.equal(isAllowed(g, TOKEN, '/a/x'), false);
  assert.equal(isAllowed(g, TOKEN, '/a/b/c'), true);
  assert.equal(isAllowed(g, TOKEN, '/c'), false);
  assert.equal(isAllowed(g, TOKEN, '/c/sub'), true);
  assert.equal(isAllowed(g, TOKEN, '/d'), true);
});

test('a group naming our token overrides the wildcard group; empty files allow everything', () => {
  const g = parseRobots('User-agent: *\nDisallow: /\n\nUser-agent: AgentDiffsWatch\nAllow: /\n');
  assert.equal(isAllowed(g, TOKEN, '/x'), true);
  assert.equal(isAllowed(parseRobots('User-agent: *\nDisallow: /\n'), TOKEN, '/x'), false);
  assert.equal(isAllowed(parseRobots(''), TOKEN, '/x'), true);
  assert.equal(isAllowed(parseRobots('User-agent: *\nDisallow:\n'), TOKEN, '/x'), true);
});
