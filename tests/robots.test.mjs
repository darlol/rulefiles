import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseRobots, isAllowed } from '../scripts/lib/robots.mjs';

const fx = (n) => fs.readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8');
const TOKEN = 'RulefilesWatch';

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
  const g = parseRobots('User-agent: *\nDisallow: /\n\nUser-agent: RulefilesWatch\nAllow: /\n');
  assert.equal(isAllowed(g, TOKEN, '/x'), true);
  assert.equal(isAllowed(parseRobots('User-agent: *\nDisallow: /\n'), TOKEN, '/x'), false);
  assert.equal(isAllowed(parseRobots(''), TOKEN, '/x'), true);
  assert.equal(isAllowed(parseRobots('User-agent: *\nDisallow:\n'), TOKEN, '/x'), true);
});

test('user-agent matching follows RFC 9309: the rule token equals our product token or starts it', () => {
  const rules = (agent) => parseRobots(`User-agent: *\nAllow: /\n\nUser-agent: ${agent}\nDisallow: /\n`);
  assert.equal(isAllowed(rules('RulefilesWatch'), TOKEN, '/x'), false, 'equal token, any case');
  assert.equal(isAllowed(rules('rulefileswatch'), TOKEN, '/x'), false);
  assert.equal(isAllowed(rules('Rulefiles'), TOKEN, '/x'), false, 'rule token is a leading part of ours');
  assert.equal(isAllowed(rules('RulefilesWatch/0.1'), TOKEN, '/x'), false, 'version suffix is ignored');
  assert.equal(isAllowed(rules('files'), TOKEN, '/x'), true, 'a token found in the middle of ours does not apply');
  assert.equal(isAllowed(rules('Watch'), TOKEN, '/x'), true, 'a token found at the end of ours does not apply');
  assert.equal(isAllowed(rules('RulefilesWatchPro'), TOKEN, '/x'), true, 'a longer rule token does not apply to us');
  assert.equal(isAllowed(rules('Googlebot'), TOKEN, '/x'), true);
});

test('the longest matching user-agent token wins', () => {
  const g = parseRobots('User-agent: Rule\nDisallow: /\n\nUser-agent: RulefilesWatch\nAllow: /\n');
  assert.equal(isAllowed(g, TOKEN, '/x'), true);
  const g2 = parseRobots('User-agent: Rule\nAllow: /\n\nUser-agent: RulefilesWatch\nDisallow: /\n');
  assert.equal(isAllowed(g2, TOKEN, '/x'), false);
});
