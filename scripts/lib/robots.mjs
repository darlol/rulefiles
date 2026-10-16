// Small robots.txt parser following RFC 9309: longest matching rule wins, Allow wins ties,
// "*" and trailing "$" are supported, an empty Disallow allows everything.

export function parseRobots(text) {
  const groups = [];
  let current = null;
  let lastWasAgent = false;
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    if (!line) continue;
    const i = line.indexOf(':');
    if (i < 0) continue;
    const key = line.slice(0, i).trim().toLowerCase();
    const value = line.slice(i + 1).trim();
    if (key === 'user-agent') {
      if (!current || !lastWasAgent) { current = { agents: [], rules: [] }; groups.push(current); }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if (key === 'allow' || key === 'disallow') {
      lastWasAgent = false;
      if (current) current.rules.push({ type: key, pattern: value });
    } else {
      lastWasAgent = false;
    }
  }
  return groups;
}

function patternToRegex(pattern) {
  let p = pattern;
  let end = false;
  if (p.endsWith('$')) { end = true; p = p.slice(0, -1); }
  const body = p.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*');
  return new RegExp('^' + body + (end ? '$' : ''));
}

// A group applies to us when its user-agent value is our product token or a leading part of it,
// compared without case and without a version suffix such as "/0.1". A value that merely occurs
// inside our token, or that is longer than our token, does not apply.
function matchLength(ruleToken, ourToken) {
  const t = ruleToken.split('/')[0].trim();
  return t.length > 0 && ourToken.startsWith(t) ? t.length : 0;
}

/** @param {string} productToken the product token of our User-Agent, for example "RulefilesWatch" */
export function isAllowed(groups, productToken, pathWithQuery) {
  const token = productToken.toLowerCase();
  let best = -1;
  let selected = [];
  for (const g of groups) {
    for (const a of g.agents) {
      if (a === '*') continue;
      const len = matchLength(a, token);
      if (!len) continue;
      if (len > best) { best = len; selected = [g]; }
      else if (len === best && !selected.includes(g)) selected.push(g);
    }
  }
  if (!selected.length) selected = groups.filter((g) => g.agents.includes('*'));
  if (!selected.length) return true;
  let verdict = { allow: true, len: -1 };
  for (const g of selected) {
    for (const rule of g.rules) {
      if (rule.type === 'disallow' && rule.pattern === '') continue;
      if (rule.pattern === '') continue;
      if (patternToRegex(rule.pattern).test(pathWithQuery)) {
        const len = rule.pattern.length;
        const allow = rule.type === 'allow';
        if (len > verdict.len || (len === verdict.len && allow)) verdict = { allow, len };
      }
    }
  }
  return verdict.allow;
}
