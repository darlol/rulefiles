import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from '../scripts/build.mjs';
import { listFiles } from '../scripts/lib/util.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const css = fs.readFileSync(path.join(root, 'src', 'static', 'style.css'), 'utf8');
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'design-dist-'));
before(() => { build({ outDir: out, quiet: true }); });
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

// Reads the stylesheet as a flat list of rules: { selectors, props, reduce }, where reduce says the rule sits
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
      rules.push({ selectors: prelude.split(',').map((x) => x.trim().replace(/\s+/g, ' ')), props, reduce: inReduce });
    }
    i = close + 1;
  }
  return rules;
}

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
  // 3. Each hover or press state that moves an element is put back by its own selector.
  for (const r of normal) {
    if (!r.props.transform || r.props.transform === 'none') continue;
    for (const sel of r.selectors.filter((x) => /:(hover|active|focus)/.test(x))) if (!resets(sel, 'transform', 'none')) gaps.push(`transform on ${sel} is not reset`);
  }
  // 4. The checks above must have something to check.
  if (!normal.some((r) => 'animation' in r.props)) gaps.push('no animation found: the check is empty');
  if (!normal.some((r) => 'transition' in r.props)) gaps.push('no transition found: the check is empty');
  if (!normal.some((r) => r.props.transform && /:(hover|active)/.test(r.selectors.join()))) gaps.push('no moving state found: the check is empty');
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
    'archive card lift reset': ['.issue:hover { transform: none; }', ''],
    'button press reset': [', button:active, .btn:active { transform: none; }', ' { transform: none; }'],
    'arrow nudge reset': ['.cta .btn-primary:hover .ic { transform: none; }', '']
  };
  for (const [name, [from, to]] of Object.entries(mutations)) {
    const mutated = css.replace(from, to);
    assert.notEqual(mutated, css, `${name}: the mutation matched nothing`);
    assert.ok(reducedMotionGaps(mutated).length > 0, `${name}: removing it must fail the check`);
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

test('the current page is marked in the main navigation and tables have a caption and header scopes', () => {
  const html = fs.readFileSync(path.join(out, 'matrix', 'index.html'), 'utf8');
  const main = /<nav aria-label="Main">([\s\S]*?)<\/nav>/.exec(html)[1];
  assert.equal((main.match(/aria-current="page"/g) || []).length, 1);
  assert.match(main, /<a href="\/matrix\/" aria-current="page">Matrix<\/a>/);
  assert.match(html, /<caption class="sr">/);
  assert.match(html, /<div class="table-wrap" tabindex="0" role="region" aria-label="Instruction file matrix">/);
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
  const hides = (props) => props.opacity !== undefined && Number(props.opacity) < 1
    || /^(hidden|collapse)$/.test(props.visibility || '') || props.display === 'none';
  const rules = parseRules(cssText).filter((r) => !r.reduce);
  for (const r of rules) {
    const sel = r.selectors.filter((s) => /(^|[\s,>+~])\.(tile|specimen)|^\.c[0-9]\b/.test(s));
    if (sel.length && hides(r.props)) problems.push(`${sel.join(', ')} hides its content`);
  }
  // Every keyframe set that a tile or specimen rule starts must leave the tile visible at every step.
  const names = new Set();
  for (const r of rules) {
    if (!r.selectors.some((s) => /^\.(tile|c[0-9])\b|^\.specimen/.test(s))) continue;
    for (const [k, v] of Object.entries(r.props)) {
      if (!/^animation(-name)?$/.test(k)) continue;
      const name = v.split(/\s+/).find((w) => cssText.includes(`@keyframes ${w} `));
      if (name) names.add(name);
    }
  }
  if (!names.size) problems.push('no tile animation found: the check is empty');
  for (const name of names) {
    const m = cssText.match(new RegExp(`@keyframes ${name}\\s*\\{([^]*?\\})\\s*\\}`));
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
    'tile display none': [css, '.tile-reads {', '.tile-reads { display: none;']
  };
  for (const [name, [text, from, to]] of Object.entries(mutations)) {
    const mutated = text.replace(from, to);
    assert.notEqual(mutated, text, `${name}: the mutation matched nothing`);
    assert.ok(specimenHidingProblems(mutated, html).length > 0, `${name}: must fail the check`);
  }
  assert.ok(specimenHidingProblems(css, html.replace(/ c3">/, ' c2">')).length > 0, 'a tile moved to another column must fail');
  assert.ok(specimenHidingProblems(css, html.replace(/<span class="tile [^>]*>.*?<\/span>/, '')).length > 0, 'a missing tile must fail');
});
