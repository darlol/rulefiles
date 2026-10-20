import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from '../scripts/build.mjs';
import { listFiles } from '../scripts/lib/util.mjs';
import { itemHtml } from '../scripts/lib/render.mjs';
import { TEST_DATE } from './helpers/test-date.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const css = fs.readFileSync(path.join(root, 'src', 'static', 'style.css'), 'utf8');
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'design-dist-'));
// A fixed build date that follows the data, so the build does not depend on the day the tests run.
before(() => { process.env.BUILD_DATE = TEST_DATE; build({ outDir: out, quiet: true }); });
after(() => fs.rmSync(out, { recursive: true, force: true }));
const pages = () => listFiles(out).filter((f) => f.endsWith('.html')).map((f) => [path.relative(out, f), fs.readFileSync(f, 'utf8')]);

// ---------- Colour contrast (WCAG 2.x) computed from the tokens in style.css ----------

function tokens(block) {
  return Object.fromEntries([...block.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})\b/gi)].map((m) => [m[1], m[2].toLowerCase()]));
}
function block(from) {
  const start = css.indexOf('{', from);
  let depth = 0;
  for (let i = start; i < css.length; i++) {
    if (css[i] === '{') depth++;
    if (css[i] === '}' && --depth === 0) return css.slice(start + 1, i);
  }
  throw new Error('unbalanced CSS');
}
const light = tokens(block(css.indexOf(':root {')));
const dark = tokens(block(css.indexOf(':root {', css.indexOf('prefers-color-scheme: dark'))));

function luminance(hex) {
  const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
}
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// [foreground, background, minimum ratio, what it is]
const TEXT = 4.5;
const UI = 3;
const PAIRS = [
  ['ink', 'bg', TEXT, 'body text'], ['ink', 'surface', TEXT, 'text on cards'], ['ink', 'sunken', TEXT, 'text on tags and hovered rows'],
  ['muted', 'bg', TEXT, 'secondary text'], ['muted', 'surface', TEXT, 'secondary text on cards'], ['muted', 'sunken', TEXT, 'secondary text on sunken areas'],
  ['accent', 'bg', TEXT, 'links'], ['accent', 'surface', TEXT, 'links on cards'], ['accent', 'sunken', TEXT, 'quiet buttons on hover'],
  ['accent-hover', 'bg', TEXT, 'link hover'], ['accent-hover', 'surface', TEXT, 'link hover on cards'], ['accent-hover', 'sunken', TEXT, 'quiet button hover text'],
  ['on-accent', 'accent', TEXT, 'primary button'], ['on-accent', 'accent-hover', TEXT, 'primary button hover'],
  ['on-mark', 'mark', TEXT, 'Latest tag and text selection'],
  ['bg', 'ink', TEXT, 'pressed filter chip'],
  ['reads-fg', 'reads-bg', TEXT, 'status: reads'], ['cond-fg', 'cond-bg', TEXT, 'status: reads with conditions'],
  ['config-fg', 'config-bg', TEXT, 'status: configurable, notices, stale flag'], ['migration-fg', 'migration-bg', TEXT, 'status: migration only'],
  ['notread-fg', 'notread-bg', TEXT, 'status: not read'], ['unverified-fg', 'unverified-bg', TEXT, 'status: unverified'],
  ['unverified-fg', 'surface', UI, 'unverified dashed border on cards'],
  ['control', 'bg', UI, 'input and button borders on the page'], ['control', 'surface', UI, 'input and button borders on cards'],
  ['accent', 'bg', UI, 'focus ring on the page'], ['accent', 'surface', UI, 'focus ring on cards'], ['accent', 'sunken', UI, 'focus ring on sunken areas']
];

for (const [name, set] of [['light', light], ['dark', dark]]) {
  test(`colour contrast, ${name} theme: every text pair is at least 4.5:1 and every UI pair at least 3:1`, () => {
    const report = [];
    for (const [fg, bg, min, what] of PAIRS) {
      assert.ok(set[fg] && set[bg], `${name}: token ${fg} or ${bg} is missing`);
      const ratio = contrast(set[fg], set[bg]);
      report.push(`${what}: ${fg} ${set[fg]} on ${bg} ${set[bg]} = ${ratio.toFixed(2)}`);
      assert.ok(ratio >= min, `${name}: ${what}: ${fg} ${set[fg]} on ${bg} ${set[bg]} is ${ratio.toFixed(2)}:1, needs ${min}:1`);
    }
    if (process.env.CONTRAST_REPORT) console.log(`# ${name}\n${report.join('\n')}`);
  });
}

test('the dark theme redefines every colour token of the light theme', () => {
  assert.deepEqual(Object.keys(dark).sort(), Object.keys(light).sort());
});

test('the theme-color metas match the page background tokens', () => {
  const html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
  assert.match(html, new RegExp(`<meta name="theme-color" content="${light.bg}" media="\\(prefers-color-scheme: light\\)">`));
  assert.match(html, new RegExp(`<meta name="theme-color" content="${dark.bg}" media="\\(prefers-color-scheme: dark\\)">`));
});

// ---------- Motion, focus, colour scheme ----------

// Reads the stylesheet as a flat list of rules: { selectors, props, decls, reduce }, where decls keeps every
// declaration in source order (props keeps the last one per name) and reduce says the rule sits
// inside @media (prefers-reduced-motion: reduce). @keyframes and @font-face bodies are skipped.
function parseRules(text, inReduce = false, rules = []) {
  const src = text.replace(/\/\*[\s\S]*?\*\//g, '');
  let i = 0;
  while (i < src.length) {
    const open = src.indexOf('{', i);
    if (open < 0) break;
    let depth = 0, close = open;
    for (; close < src.length; close++) {
      if (src[close] === '{') depth++;
      if (src[close] === '}' && --depth === 0) break;
    }
    const prelude = src.slice(i, open).trim();
    const body = src.slice(open + 1, close);
    if (/^@media\b/.test(prelude)) parseRules(body, inReduce || /prefers-reduced-motion:\s*reduce/.test(prelude), rules);
    else if (!prelude.startsWith('@')) {
      const props = Object.fromEntries(body.split(';').map((d) => d.split(/:(.*)/s)).filter((d) => d[1] !== undefined).map((d) => [d[0].trim(), d[1].trim()]));
      const decls = body.split(';').map((d) => d.split(/:(.*)/s)).filter((d) => d[1] !== undefined).map((d) => [d[0].trim(), d[1].trim()]);
      rules.push({ selectors: prelude.split(',').map((x) => x.trim().replace(/\s+/g, ' ')), props, decls, reduce: inReduce });
    }
    i = close + 1;
  }
  return rules;
}

const MOTION_PROPS = ['transform', 'translate', 'scale', 'rotate'];

// Lists what the stylesheet animates without a matching reduced-motion override.
function reducedMotionGaps(text) {
  const rules = parseRules(text);
  const normal = rules.filter((r) => !r.reduce);
  const reduced = rules.filter((r) => r.reduce);
  const gaps = [];
  const resets = (selector, prop, value) => reduced.some((r) => r.selectors.includes(selector) && r.props[prop] === value);
  // 1. A catch-all rule shortens every transition and animation, delays included.
  const all = reduced.find((r) => r.selectors.includes('*'));
  for (const prop of ['transition-duration', 'animation-duration']) {
    if (!(all && /^0\.01ms !important$/.test(all.props[prop] || ''))) gaps.push(`no catch-all ${prop}: 0.01ms !important`);
  }
  if (!(all && all.props['animation-delay'] === '0s !important')) gaps.push('no catch-all animation-delay: 0s !important');
  // 2. Each rule that starts a keyframe animation is switched off by its own selector.
  for (const r of normal) {
    if (!/^animation(-name)?$/.test(Object.keys(r.props).find((k) => /^animation(-name)?$/.test(k)) || '')) continue;
    for (const sel of r.selectors) if (!resets(sel, 'animation', 'none')) gaps.push(`animation on ${sel} is not switched off`);
  }
  // 3. Each hover or press state that moves an element is put back by its own selector, property by property:
  //    transform, and the individual translate, scale and rotate properties, which transform: none does not reset.
  for (const r of normal) {
    for (const prop of MOTION_PROPS) {
      if (!r.props[prop] || r.props[prop] === 'none') continue;
      for (const sel of r.selectors.filter((x) => /:(hover|active|focus)/.test(x))) if (!resets(sel, prop, 'none')) gaps.push(`${prop} on ${sel} is not reset`);
    }
  }
  // 4. The checks above must have something to check.
  if (!normal.some((r) => 'animation' in r.props)) gaps.push('no animation found: the check is empty');
  if (!normal.some((r) => 'transition' in r.props)) gaps.push('no transition found: the check is empty');
  if (!normal.some((r) => MOTION_PROPS.some((p) => r.props[p]) && /:(hover|active)/.test(r.selectors.join()))) gaps.push('no moving state found: the check is empty');
  return gaps;
}

test('every animation, transition and moving state is neutralised in a prefers-reduced-motion block', () => {
  assert.deepEqual(reducedMotionGaps(css), []);
});

test('the reduced-motion check fails when a neutralisation is removed', () => {
  const mutations = {
    'tile animation switched off': ['.tile { animation: none; }', ''],
    'catch-all transition duration': ['transition-duration: 0.01ms !important;', ''],
    'catch-all animation duration': ['animation-duration: 0.01ms !important;', ''],
    'catch-all animation delay': ['animation-delay: 0s !important;', ''],
    'button press reset': [', button:active, .btn:active { transform: none; }', ' { transform: none; }'],
    'arrow nudge reset': ['.cta .btn-primary:hover .ic { transform: none; }', '']
  };
  for (const [name, [from, to]] of Object.entries(mutations)) {
    const mutated = css.replace(from, to);
    assert.notEqual(mutated, css, `${name}: the mutation matched nothing`);
    assert.ok(reducedMotionGaps(mutated).length > 0, `${name}: removing it must fail the check`);
  }
  // The individual transform properties are covered like transform: a hover state that sets one needs its own reset.
  const REDUCE_END = '.mark, .brand:hover .mark, button:active, .btn:active { transform: none; }\n}';
  assert.ok(css.includes(REDUCE_END), 'the reduce block ends where the test expects');
  for (const prop of ['translate', 'scale', 'rotate']) {
    const value = prop === 'translate' ? '0 -2px' : prop === 'scale' ? '1.05' : '4deg';
    const moving = `${css}\n.card:hover { ${prop}: ${value}; }\n.card:active { ${prop}: ${value}; }`;
    assert.ok(reducedMotionGaps(moving).some((g) => g.startsWith(`${prop} on .card:hover`)), `${prop} on hover without a reset must fail`);
    assert.ok(reducedMotionGaps(moving).some((g) => g.startsWith(`${prop} on .card:active`)), `${prop} on active without a reset must fail`);
    const wrongReset = moving.replace(REDUCE_END, `.mark, .brand:hover .mark, button:active, .btn:active { transform: none; }\n.card:hover, .card:active { transform: none; }\n}`);
    assert.ok(reducedMotionGaps(wrongReset).length > 0, `transform: none does not reset ${prop}`);
    const reset = moving.replace(REDUCE_END, `.mark, .brand:hover .mark, button:active, .btn:active { transform: none; }\n.card:hover, .card:active { ${prop}: none; }\n}`);
    assert.deepEqual(reducedMotionGaps(reset), [], `${prop}: none inside the reduce block is a valid reset`);
    const outside = moving.replace(REDUCE_END, REDUCE_END + `\n.card:hover, .card:active { ${prop}: none; }`);
    assert.ok(reducedMotionGaps(outside).length > 0, `a ${prop} reset outside the reduce block does not count`);
  }
  // Moving the override out of the reduce block counts as removing it.
  const moved = css.replace('@media (prefers-reduced-motion: reduce) { .tile { animation: none; }', '@media (min-width: 1px) { .tile { animation: none; }');
  assert.notEqual(moved, css);
  assert.ok(reducedMotionGaps(moved).length > 0);
});

test('the stylesheet shows a focus ring and follows the system colour scheme', () => {
  assert.match(css, /:focus-visible\s*\{[^}]*outline:\s*3px solid/);
  assert.match(css, /color-scheme:\s*light dark/);
  // The only rule that clears an outline is the stretched card link, which draws its ring on ::after instead.
  assert.deepEqual([...css.matchAll(/([^{}]+)\{[^}]*outline:\s*none/g)].map((m) => m[1].trim()), ['.stretch:focus-visible']);
  assert.match(css, /\.stretch:focus-visible::after\s*\{[^}]*outline:\s*3px solid/);
});

// ---------- No external resource, no inline code ----------

test('no page loads anything from another origin', () => {
  const isExternal = (u) => /^(https?:)?\/\//i.test(u);
  for (const [file, html] of pages()) {
    for (const m of html.matchAll(/<(link|script|img|source|iframe|video|audio|embed|object)\b[^>]*>/gi)) {
      const tag = m[0];
      const rel = (/\brel="([^"]*)"/.exec(tag) || [])[1] || '';
      if (/^link$/i.test(m[1]) && /\b(canonical|alternate)\b/.test(rel)) continue; // metadata, not loaded
      for (const a of tag.matchAll(/\b(?:src|href|data|poster|srcset)="([^"]*)"/gi)) assert.ok(!isExternal(a[1]), `${file}: ${tag} loads ${a[1]}`);
    }
  }
  for (const f of listFiles(out).filter((x) => /\.(css|js|svg)$/.test(x))) {
    const s = fs.readFileSync(f, 'utf8');
    assert.doesNotMatch(s, /@import/, f);
    for (const m of s.matchAll(/url\(\s*['"]?([^'")]+)/g)) assert.ok(!isExternal(m[1]) && !m[1].startsWith('data:'), `${f}: url(${m[1]})`);
    for (const m of s.matchAll(/\bimport\s*(?:[^'"]*from\s*)?['"]([^'"]+)['"]/g)) assert.ok(!isExternal(m[1]), `${f}: imports ${m[1]}`);
  }
});

test('the CSP stays strict and the pages need no inline style or script', () => {
  for (const [file, html] of pages()) {
    const csp = /http-equiv="Content-Security-Policy" content="([^"]*)"/.exec(html);
    assert.ok(csp, `${file} has a CSP`);
    csp[1] = csp[1].replace(/&#39;/g, "'");
    assert.doesNotMatch(csp[1], /unsafe-inline|unsafe-eval|\*|data:|blob:/, file);
    assert.match(csp[1], /default-src 'none'/);
    assert.match(csp[1], /font-src 'self'/);
    assert.doesNotMatch(html, /<style\b/i, `${file}: inline <style>`);
    assert.doesNotMatch(html, /<[a-z][^>]*\sstyle=/i, `${file}: style attribute`);
    assert.doesNotMatch(html, /<[a-z][^>]*\son[a-z]+=/i, `${file}: inline event handler`);
    for (const m of html.matchAll(/<script\b([^>]*)>/gi)) assert.ok(/\bsrc="\/assets\//.test(m[1]) || /type="application\/ld\+json"/.test(m[1]), `${file}: inline script ${m[0]}`);
  }
});

test('fonts are served from the site, licensed and referenced by the stylesheet', () => {
  assert.match(css, /@font-face\s*\{[^}]*url\("\/assets\/fonts\/hanken-grotesk\.woff2"\)/);
  assert.ok(fs.existsSync(path.join(out, 'assets', 'fonts', 'hanken-grotesk.woff2')));
  assert.match(fs.readFileSync(path.join(out, 'assets', 'fonts', 'OFL.txt'), 'utf8'), /SIL OPEN FONT LICENSE Version 1\.1/);
});

// ---------- Accessibility tags and landmarks ----------

test('every page has a language, a title, one h1, one main landmark, a skip link and named navigation', () => {
  for (const [file, html] of pages()) {
    assert.match(html, /<html lang="[a-z-]+">/, file);
    assert.equal((html.match(/<title>[^<]+<\/title>/g) || []).length, 1, `${file} title`);
    assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1">/, file);
    assert.equal((html.match(/<h1\b/g) || []).length, 1, `${file} h1`);
    assert.equal((html.match(/<main\b/g) || []).length, 1, `${file} main`);
    assert.match(html, /<a class="skip" href="#main">Skip to content<\/a>/, file);
    assert.match(html, /<main id="main"/, file);
    assert.equal((html.match(/<header\b/g) || []).length, 1, `${file} banner`);
    assert.equal((html.match(/<footer\b/g) || []).length, 1, `${file} contentinfo`);
    const labels = [...html.matchAll(/<nav aria-label="([^"]+)"/g)].map((m) => m[1]);
    assert.equal((html.match(/<nav\b/g) || []).length, labels.length, `${file}: every nav has a label`);
    assert.equal(new Set(labels).size, labels.length, `${file}: nav labels are distinct`);
    assert.ok(labels.includes('Main'), file);
  }
});

test('headings never skip a level and ids are unique', () => {
  for (const [file, html] of pages()) {
    let prev = 0;
    for (const m of html.matchAll(/<h([1-6])\b/g)) {
      const level = Number(m[1]);
      assert.ok(level <= prev + 1, `${file}: h${level} after h${prev}`);
      prev = level;
    }
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
    assert.equal(new Set(ids).size, ids.length, `${file}: duplicate ids ${ids.filter((x, i) => ids.indexOf(x) !== i)}`);
  }
});

test('icons are decorative, buttons and links have names, and fields have labels', () => {
  for (const [file, html] of pages()) {
    for (const m of html.matchAll(/<svg\b[^>]*>/g)) assert.match(m[0], /aria-hidden="true"/, `${file}: ${m[0]}`);
    for (const m of html.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)) assert.ok(m[1].replace(/<[^>]+>/g, '').trim().length > 0, `${file}: button without text`);
    for (const m of html.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/g)) {
      const hasName = m[1].replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, '').trim().length > 0 || /aria-label=/.test(m[0]);
      assert.ok(hasName, `${file}: link without a name: ${m[0].slice(0, 80)}`);
    }
    for (const m of html.matchAll(/<(input|textarea)\b([^>]*)>/g)) {
      if (/type="(hidden|radio|checkbox)"/.test(m[2])) continue;
      const id = /\bid="([^"]+)"/.exec(m[2]);
      assert.ok(id && new RegExp(`<label for="${id[1]}"`).test(html), `${file}: field without a label: ${m[0]}`);
    }
    assert.doesNotMatch(html, /tabindex="[1-9]/, `${file}: positive tabindex`);
  }
});

// ---------- Icons keep a size when the stylesheet does not apply ----------

// An inline SVG without width and height fills its container (300 by 150 pixels at best), so an icon
// becomes huge whenever style.css is blocked, not yet loaded or an old cached copy. Every svg therefore
// carries width and height attributes, and the stylesheet sizes the three classes explicitly as well.
function svgSizeProblems(html, cssText, file = 'page') {
  const problems = [];
  const svgs = [...html.matchAll(/<svg\b[^>]*>/g)].map((m) => m[0]);
  if (!svgs.length) problems.push(`${file}: no svg found, the check is empty`);
  for (const tag of svgs) {
    for (const attr of ['width', 'height']) {
      const v = new RegExp(`\\s${attr}="([^"]*)"`).exec(tag)?.[1];
      if (v === undefined || !/^\d+(\.\d+)?$/.test(v) || Number(v) > 64) problems.push(`${file}: ${tag} needs a numeric ${attr} of at most 64`);
    }
  }
  const rules = parseRules(cssText).filter((r) => !r.reduce);
  for (const cls of ['.ic', '.mark', '.sprite']) {
    const rule = rules.find((r) => r.selectors.includes(cls));
    if (!rule || !rule.props.width || !rule.props.height) problems.push(`style.css: ${cls} has no explicit width and height`);
  }
  return problems;
}

test('every inline svg has width and height attributes, and the stylesheet sizes .ic, .mark and .sprite', () => {
  for (const [file, html] of pages()) assert.deepEqual(svgSizeProblems(html, css, file), []);
});

test('the svg size check fails when an attribute or a rule is missing', () => {
  const html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
  const mutations = {
    'icon without width': [html, '<svg class="ic" width="20" ', '<svg class="ic" '],
    'icon without height': [html, 'width="20" height="20" aria-hidden', 'width="20" aria-hidden'],
    'mark without size': [html, '<svg class="mark" width="32" height="32" ', '<svg class="mark" '],
    'sprite without size': [html, '<svg class="sprite" width="0" height="0" ', '<svg class="sprite" '],
    'giant attribute': [html, '<svg class="ic" width="20"', '<svg class="ic" width="300"'],
    'percentage attribute': [html, '<svg class="ic" width="20"', '<svg class="ic" width="100%"']
  };
  for (const [name, [text, from, to]] of Object.entries(mutations)) {
    const mutated = text.replace(from, to);
    assert.notEqual(mutated, text, `${name}: the mutation matched nothing`);
    assert.ok(svgSizeProblems(mutated, css).length > 0, `${name}: must fail the check`);
  }
  for (const cls of ['\\.ic', '\\.mark', '\\.sprite']) {
    const mutated = css.replace(new RegExp(`(^${cls} \\{[^}]*?)width: [^;]+; height: [^;]+;`, 'm'), '$1');
    assert.notEqual(mutated, css, `${cls}: the mutation matched nothing`);
    assert.ok(svgSizeProblems(html, mutated).length > 0, `${cls}: a rule without size must fail`);
  }
});

// ---------- Older engines: fallbacks and no very recent CSS ----------

// A declaration the engine does not understand is dropped, so a newer value needs an older one before it.
// Returns the declarations that would leave a property unset in an older engine.
function fallbackProblems(cssText) {
  const problems = [];
  const sides = { 'margin-inline': ['margin-left', 'margin-right'], 'padding-inline': ['padding-left', 'padding-right'], inset: ['top', 'right', 'bottom', 'left'] };
  for (const r of parseRules(cssText)) {
    r.decls.forEach(([prop, value], i) => {
      const before = r.decls.slice(0, i);
      const where = `${r.selectors.join(', ')} { ${prop}: ${value} }`;
      if (/dvh\b/.test(value) && !before.some(([p, v]) => p === prop && !/dvh\b/.test(v))) problems.push(`${where}: no vh fallback before the dvh value`);
      if (sides[prop]) for (const side of sides[prop]) if (!before.some(([p]) => p === side)) problems.push(`${where}: no ${side} fallback before it`);
    });
  }
  return problems;
}

// Features that reached the major engines only in the last few years. None is used; adding one means
// adding a fallback or an @supports block and a row in the Browser support table of docs/DESIGN.md.
const RECENT_CSS = [':has(', '@layer', '@container', 'color-mix(', 'oklch(', 'oklab(', 'lab(', 'lch(', 'light-dark(', '@property', 'view-transition', 'subgrid', '@scope', 'anchor-name', 'position-anchor', 'field-sizing', 'interpolate-size', 'sibling-index(', 'aspect-ratio', ':is(', ':where(', 'svh', 'lvh'];
const recentCss = (cssText) => RECENT_CSS.filter((f) => cssText.replace(/\/\*[\s\S]*?\*\//g, '').includes(f));
// True when a style rule (not an at-rule such as @media) contains another block: CSS nesting.
function nestedRules(cssText) {
  const src = cssText.replace(/\/\*[\s\S]*?\*\//g, '');
  const stack = [];
  let start = 0;
  for (let i = 0; i < src.length; i++) {
    if (src[i] === '{') {
      if (stack.length && !stack[stack.length - 1].startsWith('@')) return true;
      stack.push(src.slice(start, i).trim());
      start = i + 1;
    } else if (src[i] === '}') { stack.pop(); start = i + 1; } else if (src[i] === ';' && !stack.length) start = i + 1;
  }
  return false;
}

test('newer CSS values have an older fallback before them and no very recent feature is used', () => {
  assert.deepEqual(fallbackProblems(css), []);
  assert.deepEqual(recentCss(css), []);
  assert.equal(nestedRules(css), false, 'CSS nesting is not used');
  assert.match(fs.readFileSync(path.join(root, 'docs', 'DESIGN.md'), 'utf8'), /^## Browser support$/m, 'docs/DESIGN.md has a Browser support section');
});

test('the fallback check fails when a fallback is removed or a recent feature is added', () => {
  const mutations = {
    'body vh fallback': ['min-height: 100vh; min-height: 100dvh;', 'min-height: 100dvh;'],
    'table-wrap vh fallback': ['max-height: 64rem; max-height: min(82vh, 64rem); max-height: min(82dvh, 64rem);', 'max-height: min(82dvh, 64rem);'],
    'generator vh fallback': ['max-height: calc(100vh - 6rem); max-height: calc(100dvh - 6rem);', 'max-height: calc(100dvh - 6rem);'],
    'wrap margin fallback': ['margin-left: auto; margin-right: auto; margin-inline: auto;', 'margin-inline: auto;'],
    'wrap padding fallback': ['padding-left: var(--s4); padding-right: var(--s4); padding-inline: var(--s4);', 'padding-inline: var(--s4);'],
    'button padding fallback': ['padding-left: var(--s4); padding-right: var(--s4); padding-inline: var(--s4); }', 'padding-inline: var(--s4); }'],
    'inset without sides': ['top: 0; right: 0; bottom: 0; left: 0;', 'inset: 0;']
  };
  for (const [name, [from, to]] of Object.entries(mutations)) {
    const mutated = css.replace(from, to);
    assert.notEqual(mutated, css, `${name}: the mutation matched nothing`);
    assert.ok(fallbackProblems(mutated).length > 0, `${name}: must fail the check`);
  }
  for (const feature of ['.item:has(a) { color: red; }', '@layer base { a { color: red; } }', 'a { color: color-mix(in srgb, red, blue); }', 'a { color: oklch(0.5 0.1 200); }', '@container (min-width: 20rem) { a { color: red; } }', 'a { grid-template-rows: subgrid; }', 'a { aspect-ratio: 1; }', 'a:is(.b) { color: red; }', 'a { min-height: 100svh; }']) {
    assert.ok(recentCss(`${css}\n${feature}`).length > 0, `${feature}: must be flagged`);
  }
  assert.ok(nestedRules(`${css}\n.item { & a { color: red; } }`), 'nesting must be flagged');
});

// ---------- Browser scripts: no syntax or API newer than the support floor ----------

// The scripts in src/static and src/js run unbundled in the browser. A regex lookbehind alone is a
// SyntaxError in Safari before 16.4, which would stop the whole module from loading, so the sources avoid
// the syntax and APIs below. Each entry is [pattern, what it is, first versions that have it per MDN].
const NEWER_THAN_FLOOR = [
  [/\(\?<[=!]/, 'regex lookbehind', 'Chrome 62, Firefox 78, Safari 16.4'],
  [/\?\?/, 'nullish coalescing', 'Chrome 80, Firefox 72, Safari 13.1'],
  [/\?\.(?!\d)/, 'optional chaining', 'Chrome 80, Firefox 74, Safari 13.1'],
  [/(\?\?|\|\||&&)=/, 'logical assignment', 'Chrome 85, Firefox 79, Safari 14'],
  [/\.replaceChildren\(/, 'replaceChildren()', 'Chrome 86, Firefox 78, Safari 14'],
  [/\.replaceAll\(/, 'replaceAll()', 'Chrome 85, Firefox 77, Safari 13.1'],
  [/\.at\(/, 'Array and String at()', 'Chrome 92, Firefox 90, Safari 15.4'],
  [/\bstructuredClone\(/, 'structuredClone()', 'Chrome 98, Firefox 94, Safari 15.4'],
  [/\bObject\.hasOwn\(/, 'Object.hasOwn()', 'Chrome 93, Firefox 92, Safari 15.4'],
  [/\bimport\.meta\b/, 'import.meta', 'Chrome 64, Firefox 62, Safari 11.1'],
  [/^\s*static\s*\{/m, 'class static blocks', 'Chrome 94, Firefox 93, Safari 16.4'],
  [/\s#[a-z_]\w*\s*[=;(]/i, 'private class members', 'Chrome 74, Firefox 90, Safari 14.1']
];
// Known limit: comments are removed with a regular expression, not a parser, so a `//` inside a string or
// a regex literal hides the rest of its line. `const a = 'x // y'; b ?? c` passes unflagged. Keep one
// statement per line and avoid `//` inside literals in the browser scripts; a parser would be a dependency.
function scriptSyntaxProblems(name, source) {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  return NEWER_THAN_FLOOR.filter(([re]) => re.test(code)).map(([, what, versions]) => `${name}: ${what} (${versions})`);
}
// Every .js file in the two folders is scanned, so a new script is covered without editing this list.
const scriptFiles = ['src/static', 'src/js'].flatMap((dir) => fs.readdirSync(path.join(root, dir)).filter((f) => f.endsWith('.js')).map((f) => `${dir}/${f}`)).sort();

test('the browser scripts avoid syntax and APIs that older engines cannot parse', () => {
  assert.ok(scriptFiles.length >= 4, `found ${scriptFiles.join(', ')}`);
  for (const f of scriptFiles) assert.deepEqual(scriptSyntaxProblems(f, fs.readFileSync(path.join(root, f), 'utf8')), []);
  // The built copies are the same files, and the built folder holds no script that was not scanned.
  for (const f of scriptFiles) assert.ok(fs.existsSync(path.join(out, 'assets', path.basename(f))), f);
  const built = fs.readdirSync(path.join(out, 'assets')).filter((f) => f.endsWith('.js')).sort();
  assert.deepEqual(built, scriptFiles.map((f) => path.basename(f)).sort(), 'every built script comes from a scanned folder');
});

test('the script check flags each newer feature', () => {
  const samples = ['x.replace(/(?<!a)b/g, "")', 'const a = b ?? c;', 'const a = b?.c;', 'a ||= 1;', 'el.replaceChildren();', 's.replaceAll("a", "b");', 'xs.at(-1);', 'structuredClone(x);', 'Object.hasOwn(o, "k");', 'class A { #x = 1; }'];
  for (const sample of samples) assert.ok(scriptSyntaxProblems('sample.js', sample).length > 0, `${sample}: must be flagged`);
  assert.deepEqual(scriptSyntaxProblems('sample.js', 'const a = b ? .5 : 1; // x ?? y\n/* a?.b */ const c = a == null ? "" : a;'), [], 'ternaries and comments are not flagged');
});

test('the current page is marked in the main navigation and tables have a caption and header scopes', () => {
  const html = fs.readFileSync(path.join(out, 'matrix', 'index.html'), 'utf8');
  const main = /<nav aria-label="Main">([\s\S]*?)<\/nav>/.exec(html)[1];
  assert.equal((main.match(/aria-current="page"/g) || []).length, 1);
  assert.match(main, /<a href="\/matrix\/" aria-current="page">Matrix<\/a>/);
  assert.match(html, /<caption class="sr">/);
  assert.match(html, /<div class="table-wrap matrix-wrap" tabindex="0" role="region" aria-label="Instruction file matrix">/);
  assert.ok(!/<th>/.test(html), 'every th declares a scope');
});

test('every Source link in the matrix has its own accessible name and a target of at least 24 by 24 pixels', () => {
  const html = fs.readFileSync(path.join(out, 'matrix', 'index.html'), 'utf8');
  const matrix = JSON.parse(fs.readFileSync(path.join(root, 'data', 'matrix.json'), 'utf8'));
  const unescape = (x) => x.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  const links = [...html.matchAll(/<td[^>]*data-tool="([^"]+)" data-file="([^"]+)"[\s\S]*?<a class="src"([^>]*)>([\s\S]*?)<\/a>/g)];
  assert.equal(links.length, matrix.cells.length);
  const labels = [];
  for (const [, tool, file, attrs, inner] of links) {
    const label = unescape(/aria-label="([^"]*)"/.exec(attrs)?.[1] ?? '');
    assert.ok(label, `${tool}/${file}: Source link without aria-label`);
    assert.equal(inner.replace(/<[^>]+>/g, '').trim(), 'Source', 'the visible text stays "Source"');
    const t = matrix.tools.find((x) => x.id === tool);
    const f = matrix.files.find((x) => x.id === file);
    assert.equal(label, `Source — ${f.path} × ${t.name}`);
    labels.push(label);
  }
  assert.equal(new Set(labels).size, labels.length, 'accessible names are unique');
  // The accessible name starts with the visible text (WCAG 2.5.3).
  assert.ok(labels.every((l) => l.startsWith('Source')));
  const rule = parseRules(css).find((r) => !r.reduce && r.selectors.includes('.cell-foot .src'));
  assert.ok(rule, 'a rule sizes .cell-foot .src');
  for (const prop of ['min-width', 'min-height']) assert.ok(parseFloat(rule.props[prop]) >= 24 && /px$/.test(rule.props[prop]), `${prop} is at least 24px`);
});

// Digest cards: the visible text is "Source: <label>" and several items share a label, so the accessible
// name adds the item title. It starts with the visible text (WCAG 2.5.3) and is unique on its page.
const unescapeHtml = (x) => x.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
function digestSourceLinkProblems(html, items, file = 'page') {
  const problems = [];
  const links = [...html.matchAll(/<p class="item-foot">[\s\S]*?<a class="src"([^>]*)>([\s\S]*?)<\/a>/g)];
  if (links.length !== items.length) problems.push(`${file}: ${links.length} item links for ${items.length} items`);
  const expected = new Set(items.map((it) => `Source: ${it.sourceLabel} — ${it.title.replace(/`/g, '')}`));
  const names = [];
  links.forEach(([, attrs, inner], i) => {
    const name = unescapeHtml(/aria-label="([^"]*)"/.exec(attrs)?.[1] ?? '');
    const visible = unescapeHtml(inner.replace(/<[^>]+>/g, '').trim());
    if (!name) { problems.push(`${file}: link ${i + 1} has no aria-label`); return; }
    if (!name.startsWith('Source')) problems.push(`${file}: "${name}" does not start with Source`);
    if (!name.startsWith(visible)) problems.push(`${file}: "${name}" does not contain the visible text "${visible}"`);
    if (!expected.has(name)) problems.push(`${file}: "${name}" does not name any item of this page`);
    names.push(name);
  });
  if (new Set(names).size !== names.length) problems.push(`${file}: accessible names are not unique`);
  return problems;
}
const digestOf = (week) => JSON.parse(fs.readFileSync(path.join(root, 'data', 'digest', `${week}.json`), 'utf8'));

test('every Source link on the digest cards has a unique accessible name that starts with its visible text', () => {
  // Published weeks only: a *.draft.json file has no page.
  const weeks = fs.readdirSync(path.join(root, 'data', 'digest')).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(fs.readFileSync(path.join(root, 'data', 'digest', f), 'utf8'))).filter((dg) => dg.status === 'published').map((dg) => dg.week).sort();
  assert.ok(weeks.length >= 2);
  for (const week of weeks) assert.deepEqual(digestSourceLinkProblems(fs.readFileSync(path.join(out, 'digest', week, 'index.html'), 'utf8'), digestOf(week).items, week), []);
  const latest = weeks[weeks.length - 1];
  const home = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
  assert.deepEqual(digestSourceLinkProblems(home, digestOf(latest).items.slice(0, 4), 'home'), []);
  // The count comes from the week's own data file, so a week with another number of items still passes.
  const latestItems = digestOf(latest).items;
  assert.ok(latestItems.length > 0, 'the latest week has items');
  const latestHtml = fs.readFileSync(path.join(out, 'digest', latest, 'index.html'), 'utf8');
  assert.equal((latestHtml.match(/<p class="item-foot">/g) || []).length, latestItems.length, 'one item card per item in the data');
  assert.equal((latestHtml.match(/<a class="src"/g) || []).length, latestItems.length, 'one Source link per item in the data');
  const rule = parseRules(css).find((r) => !r.reduce && r.selectors.includes('.item-foot .src'));
  assert.ok(rule, 'a rule sizes .item-foot .src');
  for (const prop of ['min-width', 'min-height']) assert.ok(parseFloat(rule.props[prop]) >= 24 && /px$/.test(rule.props[prop]), `${prop} is at least 24px`);
});

test('the digest link check follows the number of items in the data, whether 3 or 8', () => {
  const base = digestOf('2026-W42').items;
  for (const count of [3, 8]) {
    const items = Array.from({ length: count }, (_, i) => ({ ...base[i % base.length], id: `item-${i}`, title: `${base[i % base.length].title} ${i}` }));
    const html = `<ul class="items">${items.map(itemHtml).join('\n')}</ul>`;
    assert.deepEqual(digestSourceLinkProblems(html, items, `${count} items`), [], `${count} items must pass`);
    assert.ok(digestSourceLinkProblems(html, items.slice(1), `${count} items`).length > 0, `${count} items against one item fewer in the data must fail`);
    assert.ok(digestSourceLinkProblems(html.replace('<li class="item" id="item-0">', '<li class="item" id="item-0" hidden>').replace(/<p class="item-foot">[\s\S]*?<\/p>/, ''), items, `${count} items`).length > 0, 'a card without its Source link must fail');
  }
});

test('the digest link check fails on a missing, shared or mismatched name and on a small target', () => {
  const week = '2026-W42';
  const items = digestOf(week).items;
  const html = fs.readFileSync(path.join(out, 'digest', week, 'index.html'), 'utf8');
  const first = /aria-label="(Source: [^"]*)"/.exec(html)[1];
  const mutations = {
    'aria-label removed': html.replace(` aria-label="${first}"`, ''),
    'name not starting with Source': html.replace(`aria-label="${first}"`, 'aria-label="Open the changelog"'),
    'name without the visible text': html.replace(`aria-label="${first}"`, 'aria-label="Source — Origin App Marketplace"'),
    'same name twice': html.replace(/aria-label="(Source: Claude Code release notes — [^"]*)"/g, 'aria-label="Source: Claude Code release notes — Claude Code"'),
    'name of another item': html.replace(`aria-label="${first}"`, 'aria-label="Source: Codex release notes — Codex 0.163.0"')
  };
  for (const [name, mutated] of Object.entries(mutations)) {
    assert.notEqual(mutated, html, `${name}: the mutation matched nothing`);
    assert.ok(digestSourceLinkProblems(mutated, items, week).length > 0, `${name}: must fail the check`);
  }
  assert.ok(digestSourceLinkProblems(html, items.slice(1), week).length > 0, 'a missing item must fail');
  const smaller = css.replace('.cell-foot .src, .item-foot .src { min-width: 24px; min-height: 24px; }', '.cell-foot .src { min-width: 24px; min-height: 24px; }');
  assert.notEqual(smaller, css);
  assert.ok(!parseRules(smaller).some((r) => r.selectors.includes('.item-foot .src')), 'dropping the rule must be visible to the check');
});

test('the home page leads with the promise and the three entry points, in tab order', () => {
  const html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
  assert.match(html, /<h1 id="hero-title">What changed in AI coding tools, with sources\.<\/h1>/);
  const order = [...html.matchAll(/<a class="btn[^"]*" href="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(order, ['/matrix/', '/generator/', '/digest/']);
  // Document order is tab order: skip link, brand, nav, then the hero actions.
  const idx = (s) => html.indexOf(s);
  assert.ok(idx('class="skip"') < idx('class="brand"') && idx('class="brand"') < idx('<nav aria-label="Main">') && idx('<nav aria-label="Main">') < idx('class="btn btn-primary"'));
});

test('favicon and share image use the same mark and the pages announce both', () => {
  const svg = fs.readFileSync(path.join(out, 'favicon.svg'), 'utf8');
  assert.match(svg, /prefers-color-scheme:dark/);
  assert.match(svg, /fill="#ffe066"/);
  const html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
  assert.match(html, /<link rel="icon" href="\/favicon\.svg" type="image\/svg\+xml">/);
  assert.match(html, /<meta property="og:image:alt" content="[^"]+: What changed in AI coding tools, with sources\.">/);
});

// ---------- Home mini-matrix: always 36 visible tiles ----------

// True when a declaration block leaves its element invisible, collapsed or clipped away, in any of the spellings
// that matter: opacity below 1 (a number, a percentage, a var() or calc(), with or without !important), visibility,
// display: none, a zero scale, clip-path or clip, and a zero width, height or font size.
function hidesContent(props) {
  const v = (name) => (props[name] === undefined ? undefined : props[name].replace(/\s*!important\s*$/i, '').trim().toLowerCase());
  const opacity = v('opacity');
  if (opacity !== undefined) {
    if (/var\(|calc\(|env\(/.test(opacity)) return true; // cannot be proved to stay visible
    const n = opacity.endsWith('%') ? parseFloat(opacity) / 100 : Number(opacity);
    if (!(n >= 1)) return true; // below 1, or not a number at all
  }
  if (/^(hidden|collapse)$/.test(v('visibility') || '') || v('display') === 'none') return true;
  const zero = /^0(\.0+)?[a-z%]*$/;
  for (const name of ['width', 'height', 'max-width', 'max-height', 'font-size']) if (v(name) !== undefined && zero.test(v(name))) return true;
  const isZero = (arg) => /^[-+]?0*\.?0+%?$/.test(arg.trim());
  const scaleArgs = [];
  for (const m of (v('transform') || '').matchAll(/scale[xyz3d]*\(([^)]*)\)/g)) scaleArgs.push(...m[1].split(/[\s,]+/).filter(Boolean));
  if (v('scale') !== undefined) scaleArgs.push(...v('scale').split(/\s+/).filter(Boolean));
  if (scaleArgs.some(isZero)) return true;
  if (v('clip-path') !== undefined && v('clip-path') !== 'none') return true;
  if (v('clip') !== undefined && v('clip') !== 'auto') return true;
  return false;
}

// A tile hidden by an entry animation (opacity 0 with a delay and a filled start state) stays invisible
// whenever the animation does not advance: an instant screenshot, a background tab, a slow device.
// Returns what in the stylesheet or the home page would leave the mini-matrix partly or fully hidden.
function specimenHidingProblems(cssText, html) {
  const problems = [];
  const tiles = [...html.matchAll(/<span class="tile tile-[a-z-]+ c(\d)">/g)].map((m) => Number(m[1]));
  if (tiles.length !== 36) problems.push(`${tiles.length} tiles instead of 36`);
  for (let col = 0; col < 4; col++) {
    const n = tiles.filter((c) => c === col).length;
    if (n !== 9) problems.push(`column c${col} has ${n} tiles instead of 9`);
  }
  if (tiles.some((c) => c > 3)) problems.push('a tile sits outside the four columns');
  const hides = hidesContent;
  const rules = parseRules(cssText).filter((r) => !r.reduce);
  for (const r of rules) {
    const sel = r.selectors.filter((s) => /(^|[\s,>+~])\.(tile|specimen|hero)|^\.c[0-9]\b/.test(s));
    if (sel.length && hides(r.props)) problems.push(`${sel.join(', ')} hides its content`);
  }
  // Every keyframe set that a tile or specimen rule starts must leave the tile visible at every step.
  const names = new Set();
  for (const r of rules) {
    if (!r.selectors.some((s) => /^\.(tile|c[0-9])\b|^\.specimen/.test(s))) continue;
    for (const [k, v] of Object.entries(r.props)) {
      if (!/^animation(-name)?$/.test(k)) continue;
      const name = v.split(/\s+/).find((w) => new RegExp(`@keyframes\\s+${w}\\s*\\{`).test(cssText));
      if (name) names.add(name);
    }
  }
  if (!names.size) problems.push('no tile animation found: the check is empty');
  for (const name of names) {
    const m = cssText.match(new RegExp(`@keyframes\\s+${name}\\s*\\{([^]*?\\})\\s*\\}`));
    if (!m) { problems.push(`@keyframes ${name} not found`); continue; }
    for (const step of m[1].matchAll(/([^{}]+)\{([^}]*)\}/g)) {
      const props = Object.fromEntries(step[2].split(';').map((d) => d.split(/:(.*)/s)).filter((d) => d[1] !== undefined).map((d) => [d[0].trim(), d[1].trim()]));
      if (hides(props)) problems.push(`@keyframes ${name} step "${step[1].trim()}" hides the tile`);
    }
  }
  return problems;
}

test('the home mini-matrix has 36 tiles in 4 columns of 9, and nothing in the stylesheet hides them', () => {
  const html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
  assert.deepEqual(specimenHidingProblems(css, html), []);
});

test('the mini-matrix check fails when the hiding entry animation comes back', () => {
  const html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
  const mutations = {
    'opacity 0 in the keyframes': [css, '@keyframes tile-in { from { transform:', '@keyframes tile-in { from { opacity: 0; transform:'],
    'opacity 0 in the 0% step': [css, '@keyframes tile-in { from {', '@keyframes tile-in { 0% { opacity: 0; } from {'],
    'permanent opacity 0 on the tile': [css, '.tile { display: grid;', '.tile { opacity: 0; display: grid;'],
    'tile hidden by a column rule': [css, '.c1 { animation-delay: 0.07s; }', '.c1 { animation-delay: 0.07s; opacity: 0; }'],
    'specimen grid hidden': [css, '.specimen-grid {', '.specimen-grid { visibility: hidden;'],
    'tile display none': [css, '.tile-reads {', '.tile-reads { display: none;'],
    'opacity 0 !important': [css, '.tile { display: grid;', '.tile { opacity: 0 !important; display: grid;'],
    'opacity 0 percent': [css, '.tile { display: grid;', '.tile { opacity: 0%; display: grid;'],
    'opacity 50 percent': [css, '.tile { display: grid;', '.tile { opacity: 50%; display: grid;'],
    'opacity from a variable': [css, '.tile { display: grid;', '.tile { opacity: var(--x); display: grid;'],
    'opacity from calc': [css, '.tile { display: grid;', '.tile { opacity: calc(1 - 1); display: grid;'],
    'scale 0 on the tile': [css, '.tile { display: grid;', '.tile { transform: scale(0); display: grid;'],
    'scale 0 0 on the tile': [css, '.tile { display: grid;', '.tile { transform: translateY(2px) scale(0, 0); display: grid;'],
    'scale property 0': [css, '.tile { display: grid;', '.tile { scale: 0; display: grid;'],
    'scale 0 in the keyframes': [css, 'from { transform: translateY(6px) scale(0.9); }', 'from { transform: translateY(6px) scale(0); }'],
    'clip-path on the tile': [css, '.tile { display: grid;', '.tile { clip-path: inset(50%); display: grid;'],
    'height 0 on the tile': [css, 'height: 2.1rem;', 'height: 0;'],
    'height 0px after the real height': [css, 'height: 2.1rem;', 'height: 2.1rem; height: 0px;'],
    'max-height 0 on the grid': [css, '.specimen-grid {', '.specimen-grid { max-height: 0;'],
    'width 0 on the specimen': [css, '.specimen {', '.specimen { width: 0;'],
    'parent container hidden': [css, '.hero {', '.hero { opacity: 0;'],
    'keyframes without spaces, hiding step': [css.replace('@keyframes tile-in { from {', '@keyframes tile-in{from {'), '@keyframes tile-in{from {', '@keyframes tile-in{from { opacity: 0;']
  };
  for (const [name, [text, from, to]] of Object.entries(mutations)) {
    const mutated = text.replace(from, to);
    assert.notEqual(mutated, text, `${name}: the mutation matched nothing`);
    assert.ok(specimenHidingProblems(mutated, html).length > 0, `${name}: must fail the check`);
  }
  // Spelling changes that hide nothing must not fail: keyframes written without spaces, and a harmless value.
  const minified = css.replace('@keyframes tile-in { from { transform: translateY(6px) scale(0.9); } }', '@keyframes tile-in{from{transform:translateY(6px) scale(0.9)}}');
  assert.notEqual(minified, css);
  assert.deepEqual(specimenHidingProblems(minified, html), [], 'keyframes without spaces are read');
  assert.deepEqual(specimenHidingProblems(css.replace('.tile { display: grid;', '.tile { opacity: 1 !important; display: grid;'), html), [], 'opacity 1 !important hides nothing');
  assert.deepEqual(specimenHidingProblems(css.replace('.tile { display: grid;', '.tile { opacity: 100%; display: grid;'), html), [], 'opacity 100% hides nothing');
  assert.ok(specimenHidingProblems(minified.replace('{from{transform', '{from{opacity:0;transform'), html).length > 0, 'a hiding step in minified keyframes must fail');
  assert.ok(specimenHidingProblems(css, html.replace(/ c3">/, ' c2">')).length > 0, 'a tile moved to another column must fail');
  assert.ok(specimenHidingProblems(css, html.replace(/<span class="tile [^>]*>.*?<\/span>/, '')).length > 0, 'a missing tile must fail');
});
