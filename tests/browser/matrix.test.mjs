// Browser checks of /matrix/ in Chromium: layout at real widths, the keyboard, the panel and contrast.
// Run after a build with `npm run test:browser` (CI job "browser"). They are kept out of `npm test`,
// which stays browser-free.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { chromium } from 'playwright';
import { createServer } from '../../scripts/preview.mjs';
import { ROOT } from '../../scripts/lib/util.mjs';
import { loadData } from '../../scripts/lib/data.mjs';

const { matrix } = loadData();
let server, browser, base;
before(async () => {
  server = createServer(path.join(ROOT, 'dist'));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch();
});
after(async () => { if (browser) await browser.close(); if (server) server.close(); });

async function open(width, height, { scheme = 'light', hash = '', js = true } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, colorScheme: scheme, javaScriptEnabled: js });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}/matrix/${hash}`);
  return { page, context, errors };
}

for (const width of [320, 390, 768, 1024, 1280, 1440, 1920]) {
  test(`no horizontal scroll and no inner scroll box at ${width}px`, async () => {
    const { page, context, errors } = await open(width, 900);
    const r = await page.evaluate(() => {
      const doc = document.documentElement;
      const boxes = [...document.querySelectorAll('main *')].filter((el) => {
        const s = getComputedStyle(el);
        return /(auto|scroll)/.test(s.overflowX + s.overflowY) && (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1);
      }).map((el) => el.className || el.tagName);
      return { scroll: doc.scrollWidth, client: doc.clientWidth, boxes };
    });
    assert.ok(r.scroll <= r.client, `page is ${r.scroll}px wide in a ${r.client}px window`);
    assert.deepEqual(r.boxes, [], 'nothing scrolls inside its own box');
    assert.deepEqual(errors, []);
    await context.close();
  });
}

const firstScreen = (page) => page.evaluate(() => [...document.querySelectorAll('a.mt')].filter((t) => {
  const b = t.getBoundingClientRect();
  return b.height > 0 && b.top >= 0 && b.bottom <= innerHeight;
}).length);

// Measured with the filter bar above the grid: it costs one row of tiles at 1440 and 1920, two at 1024 and 1280.
test('the first screen shows at least 8 statuses on a phone and 32 at 1440 × 900', async () => {
  for (const [w, h, min] of [[390, 844, 8], [1024, 768, 8], [1280, 800, 16], [1440, 900, 32], [1920, 1080, 56]]) {
    const { page, context } = await open(w, h);
    const n = await firstScreen(page);
    assert.ok(n >= min, `${n} statuses fully visible at ${w}×${h}, want ≥ ${min}`);
    await context.close();
  }
});

test('on a desktop the search box, Tools and Status are on the first screen, above the grid', async () => {
  for (const [w, h] of [[1024, 768], [1280, 800], [1440, 900], [1920, 1080]]) {
    const { page, context } = await open(w, h);
    const r = await page.evaluate(() => {
      const top = (s) => { const el = document.querySelector(s); return el ? el.getBoundingClientRect() : { top: Infinity, bottom: Infinity }; };
      return { y: scrollY, vh: innerHeight, q: top('#matrix-q'), tools: top('[aria-controls="matrix-f-tools"]'), status: top('[aria-controls="matrix-f-status"]'), grid: top('#matrix-grid').top };
    });
    assert.equal(r.y, 0);
    for (const k of ['q', 'tools', 'status']) {
      assert.ok(r[k].top < r.vh && r[k].bottom <= r.vh, `${w}×${h}: ${k} at ${Math.round(r[k].top)}-${Math.round(r[k].bottom)}, window ${r.vh}`);
      assert.ok(r[k].bottom <= r.grid, `${w}×${h}: ${k} is above the grid`);
    }
    await context.close();
  }
});

// The chips of a group sit under its toggle; a test that needs one opens the group first.
async function chip(page, sel) {
  const group = await page.evaluate((s) => document.querySelector(s).closest('fieldset').id, sel);
  if (await page.isHidden(`#${group}`)) await page.click(`[aria-controls="${group}"]`);
  await page.click(sel);
}

test('phone tiles are at least 44px tall; unverified keeps its dashed border', async () => {
  const { page, context } = await open(390, 844);
  const r = await page.evaluate(() => {
    const tiles = [...document.querySelectorAll('a.mt')];
    return { min: Math.min(...tiles.map((t) => t.getBoundingClientRect().height)), dashed: tiles.filter((t) => t.dataset.status === 'unverified').every((t) => getComputedStyle(t).borderTopStyle === 'dashed') };
  });
  assert.ok(r.min >= 44, `smallest tile ${r.min}px`);
  assert.ok(r.dashed);
  await context.close();
});

test('the folds: open without scripts; with scripts the notes fold closes, and the intro closes on a phone only', async () => {
  for (const [w, js, intro, notes] of [[390, false, true, true], [1440, false, true, true], [390, true, false, false], [1440, true, true, false]]) {
    const { page, context } = await open(w, 844, { js });
    const s = await page.evaluate(() => ({ intro: document.getElementById('matrix-intro').open, notes: document.getElementById('matrix-notes').open }));
    assert.deepEqual(s, { intro, notes }, `${w}px, scripts ${js ? 'on' : 'off'}`);
    await context.close();
  }
});

test('keyboard: one tab stop, arrows move, Enter opens the panel, Escape closes it and returns focus', async () => {
  const { page, context, errors } = await open(1440, 900);
  const tool = (i) => matrix.tools[i].id;
  const file = (i) => matrix.files[i].id;
  assert.equal(await page.locator('#matrix-grid a.mt[tabindex="0"]').count(), 1);
  assert.equal(await page.getAttribute('#matrix-grid', 'role'), 'grid');
  await page.focus('#matrix-grid a.mt[tabindex="0"]');
  const focused = () => page.evaluate(() => { const a = document.activeElement; return a.dataset.tool ? `${a.dataset.tool}/${a.dataset.file}` : a.className; });
  assert.equal(await focused(), `${tool(0)}/${file(0)}`);
  await page.keyboard.press('ArrowRight');
  assert.equal(await focused(), `${tool(1)}/${file(0)}`);
  await page.keyboard.press('ArrowDown');
  assert.equal(await focused(), `${tool(1)}/${file(1)}`);
  await page.keyboard.press('End');
  assert.equal(await focused(), `${tool(matrix.tools.length - 1)}/${file(1)}`);
  await page.keyboard.press('Home');
  assert.equal(await focused(), `${tool(0)}/${file(1)}`);
  await page.keyboard.press('Control+End');
  assert.equal(await focused(), `${tool(matrix.tools.length - 1)}/${file(matrix.files.length - 1)}`);
  await page.keyboard.press('Control+Home');
  await page.keyboard.press('ArrowUp');
  assert.equal(await focused(), `${tool(0)}/${file(0)}`, 'ArrowUp stops at the first row');
  await page.keyboard.press('Enter');
  assert.equal(await focused(), 'panel-title');
  assert.ok(page.url().endsWith(`#d-${tool(0)}--${file(0)}`));
  assert.equal(await page.getAttribute(`a.mt[data-tool="${tool(0)}"][data-file="${file(0)}"]`, 'aria-current'), 'true');
  await page.keyboard.press('Escape');
  assert.equal(await focused(), `${tool(0)}/${file(0)}`);
  assert.equal(await page.isHidden('.panel-cell'), true);
  assert.deepEqual(errors, []);
  await context.close();
});

test('arrows skip tiles the filters leave out, and the notes list stays complete', async () => {
  const { page, context } = await open(1440, 900);
  await chip(page, '[data-filter-status="unverified"]');
  const off = await page.locator('a.mt.is-off').count();
  assert.equal(off, matrix.cells.filter((c) => c.status !== 'unverified').length);
  assert.equal(await page.locator('#matrix-notes li.an-cell').count(), matrix.cells.length);
  assert.equal(await page.locator('#matrix-notes li.an-cell[hidden], #matrix-notes li.an-cell.is-off').count(), 0, 'the filters never touch the notes list');
  await page.focus('#matrix-grid a.mt[tabindex="0"]');
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press(i % 2 ? 'ArrowDown' : 'ArrowRight');
    const status = await page.evaluate(() => document.activeElement.dataset.status);
    assert.equal(status, 'unverified');
  }
  await context.close();
});

test('every cell opens from its address with its note, quote, source and date; legacy #cell- links open it too', async () => {
  const { page, context, errors } = await open(1440, 900);
  for (const c of matrix.cells) {
    await page.evaluate((h) => { location.hash = h; }, `d-${c.tool}--${c.file}`);
    const body = page.locator('.panel-body');
    const listed = page.locator(`#d-${c.tool}--${c.file} .note`);
    assert.ok((await body.locator('.note').textContent()).length > 0);
    assert.equal(await body.locator('.note').textContent(), await listed.textContent());
    assert.equal(await body.locator('.cell-foot a[href]').first().getAttribute('href'), c.sourceUrl);
    assert.equal(await body.locator('time').getAttribute('datetime'), c.verifiedOn);
    assert.equal(await body.locator('.quote').count(), c.quote ? 1 : 0);
  }
  await page.goto(`${base}/matrix/#cell-${matrix.cells[5].tool}-${matrix.cells[5].file}`);
  assert.equal(await page.locator('.panel-body .note').textContent(), await page.locator(`#d-${matrix.cells[5].tool}--${matrix.cells[5].file} .note`).textContent());
  assert.deepEqual(errors, []);
  await context.close();
});

test('on a phone the panel is a sheet no taller than 60% of the screen, even for the longest note', async () => {
  const longest = matrix.cells.reduce((a, c) => ((c.note + (c.quote || '')).length > (a.note + (a.quote || '')).length ? c : a));
  const { page, context } = await open(390, 844, { hash: `#d-${longest.tool}--${longest.file}` });
  const r = await page.evaluate(() => { const b = document.getElementById('matrix-panel').getBoundingClientRect(); return { h: b.height, bottom: b.bottom, vh: innerHeight }; });
  assert.ok(r.h <= 0.6 * r.vh, `sheet ${r.h}px in ${r.vh}px`);
  assert.ok(Math.abs(r.bottom - r.vh) < 1, 'sheet sits on the bottom edge');
  await page.click('.panel-close');
  assert.equal(await page.isHidden('#matrix-scrim'), true);
  await context.close();
});

test('on a phone the open panel is a modal dialog: focus moves in, Tab stays in, the scrim and Escape close it and focus returns', async () => {
  const cell = matrix.cells.reduce((a, c) => ((c.note + (c.quote || '')).length > (a.note + (a.quote || '')).length ? c : a));
  const tile = `a.mt[data-tool="${cell.tool}"][data-file="${cell.file}"]`;
  const { page, context, errors } = await open(390, 844);
  assert.equal(await page.getAttribute('#matrix-panel', 'role'), 'region', 'closed, it is not a dialog');
  assert.equal(await page.getAttribute('#matrix-panel', 'aria-modal'), null);
  const where = () => page.evaluate(() => { const a = document.activeElement; return { inPanel: document.getElementById('matrix-panel').contains(a), tile: a.dataset.tool ? `${a.dataset.tool}/${a.dataset.file}` : '' }; });
  for (const how of ['scrim', 'Escape']) {
    await page.focus(tile);
    await page.keyboard.press('Enter');
    assert.equal(await page.getAttribute('#matrix-panel', 'role'), 'dialog');
    assert.equal(await page.getAttribute('#matrix-panel', 'aria-modal'), 'true');
    assert.equal(await page.getAttribute('#matrix-panel', 'aria-label'), 'Cell details');
    assert.equal((await where()).inPanel, true, 'focus moves into the panel');
    const stops = new Set();
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      const w = await where();
      assert.equal(w.inPanel, true, `Tab ${i + 1} stays in the panel`);
      stops.add(await page.evaluate(() => document.activeElement.outerHTML.slice(0, 60)));
    }
    assert.ok(stops.size >= 2, 'Tab cycles through the close button and the links');
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Shift+Tab');
      assert.equal((await where()).inPanel, true, `Shift+Tab ${i + 1} stays in the panel`);
    }
    if (how === 'scrim') await page.mouse.click(195, 60); else await page.keyboard.press('Escape');
    assert.equal(await page.isHidden('.panel-cell'), true, `${how} closes the panel`);
    assert.equal(await page.isHidden('#matrix-scrim'), true);
    assert.equal((await where()).tile, `${cell.tool}/${cell.file}`, `after ${how}, focus is back on the tile`);
    assert.equal(await page.getAttribute('#matrix-panel', 'aria-modal'), null);
  }
  assert.deepEqual(errors, []);
  await context.close();
});

test('on a desktop a click on a tile of the first screen opens the panel without scrolling the page', async () => {
  const { page, context, errors } = await open(1440, 900);
  const tile = 'a.mt[href="#d-claude-code--agents-md"]';
  // The panel is alone in the side column, so its title is already on screen here and Chromium would not scroll
  // anyway. The focus call is checked too, so a browser that scrolls a focused element into a different place
  // (or a later layout that pushes the panel down) cannot bring the jump back.
  await page.evaluate(() => {
    const focus = HTMLElement.prototype.focus;
    window.focusCalls = [];
    HTMLElement.prototype.focus = function (o) { window.focusCalls.push({ cls: this.className, preventScroll: Boolean(o && o.preventScroll) }); return focus.call(this, o); };
  });
  const box = (sel) => page.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { top: r.top, bottom: r.bottom, vh: innerHeight }; }, sel);
  assert.equal(await page.evaluate(() => scrollY), 0);
  await page.click(tile);
  assert.equal(await page.isVisible('.panel-cell'), true);
  assert.equal(await page.evaluate(() => scrollY), 0, 'the page does not scroll');
  assert.ok(page.url().endsWith('#d-claude-code--agents-md'));
  for (const sel of [tile, '.panel-cell']) {
    const r = await box(sel);
    assert.ok(r.top >= 0 && r.bottom <= r.vh, `${sel} is in the viewport (${Math.round(r.top)}-${Math.round(r.bottom)} of ${r.vh})`);
  }
  assert.equal(await page.evaluate(() => document.activeElement.className), 'panel-title', 'focus still moves to the panel');
  assert.deepEqual(await page.evaluate(() => window.focusCalls), [{ cls: 'panel-title', preventScroll: true }], 'the title is focused without scrolling');
  assert.deepEqual(errors, []);
  await context.close();
});

test('on a desktop and without scripts the panel stays a region, never modal', async () => {
  for (const [w, js] of [[1440, true], [390, false]]) {
    const { page, context } = await open(w, 900, { js, hash: `#d-${matrix.cells[0].tool}--${matrix.cells[0].file}` });
    assert.equal(await page.getAttribute('#matrix-panel', 'role'), 'region', `${w}px, scripts ${js ? 'on' : 'off'}`);
    assert.equal(await page.getAttribute('#matrix-panel', 'aria-modal'), null);
    if (js) {
      await page.focus('#matrix-q');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'matrix-q', 'focus is free next to the side panel');
    }
    await context.close();
  }
});

// WCAG relative luminance of an "rgb(r, g, b)" colour.
function lum(rgb) {
  const [r, g, b] = rgb.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

for (const scheme of ['light', 'dark']) {
  test(`tile text and icons keep 4.5:1 in the ${scheme} theme, filtered out or not`, async () => {
    const { page, context } = await open(1440, 900, { scheme });
    const read = () => page.evaluate(() => [...document.querySelectorAll('a.mt')].map((t) => { const s = getComputedStyle(t); return { k: t.dataset.status + (t.classList.contains('is-off') ? ' off' : ''), fg: s.color, bg: s.backgroundColor }; }));
    const pairs = new Map();
    for (const p of await read()) pairs.set(p.k, p);
    await chip(page, '[data-filter-status="reads"]');
    for (const p of await read()) pairs.set(p.k, p);
    for (const p of pairs.values()) {
      const r = ratio(p.fg, p.bg);
      assert.ok(r >= 4.5, `${scheme} ${p.k}: ${r.toFixed(2)}:1`);
    }
    await context.close();
  });

  test(`the quote in the panel is a tinted block with no side bar, text at 4.5:1 or more, in the ${scheme} theme`, async () => {
    const { page, context } = await open(1440, 900, { scheme, hash: '#d-cline--clinerules' });
    const q = await page.evaluate(() => { const b = document.querySelector('#matrix-panel blockquote'); const s = getComputedStyle(b); const strong = getComputedStyle(b.querySelector('strong')); return { cite: b.getAttribute('cite'), side: s.borderLeftWidth, fg: s.color, bg: s.backgroundColor, panel: getComputedStyle(document.getElementById('matrix-panel')).backgroundColor, strong: strong.color }; });
    assert.match(q.cite, /^https:\/\//);
    assert.equal(q.side, '0px');
    assert.notEqual(q.bg, q.panel, 'the tint differs from the panel');
    for (const fg of [q.fg, q.strong]) assert.ok(ratio(fg, q.bg) >= 4.5, `${scheme} quote: ${ratio(fg, q.bg).toFixed(2)}:1`);
    await context.close();
  });
}

// The search box, Tools and Status must take clicks at every width, in both themes, with the panel empty or open,
// at the top and after a scroll. A sticky panel covers whatever follows it in its column, which is how the box went
// out of reach once; the bar now sits above the grid, out of that column.
const shown = (page) => page.evaluate(() => [...document.querySelectorAll('#matrix-grid a.mt')].filter((t) => t.offsetParent && !t.classList.contains('is-off')).length);

// Scrolls the control to the top of the window as a jump or a focus would (scroll-margin keeps it under the
// header), checks that the middle of it is the control itself, and clicks there.
async function hit(page, sel) {
  const at = await page.evaluate((s) => {
    const c = document.querySelector(s);
    const b0 = c.getBoundingClientRect();
    const header = document.querySelector('.site-header').getBoundingClientRect().bottom;
    if (b0.top < header || b0.bottom > innerHeight) c.scrollIntoView({ block: 'start' });
    const b = c.getBoundingClientRect();
    const x = b.left + b.width / 2, y = b.top + b.height / 2;
    const el = document.elementFromPoint(x, y);
    const name = !el ? 'nothing' : el.id ? `#${el.id}` : `${el.tagName.toLowerCase()}${el.classList.length ? '.' + el.classList[0] : ''}`;
    return { x, y, scrollY: Math.round(scrollY), on: !!el && (el === c || c.contains(el)), name };
  }, sel);
  assert.ok(at.on, `${sel}: the middle is the control itself, not ${at.name} (y ${Math.round(at.y)}, scrollY ${at.scrollY})`);
  await page.mouse.click(at.x, at.y);
}

async function reachAll(page, { panelOpen, scrolled }, label) {
  if (panelOpen) {
    await page.locator('a.mt[href="#d-claude-code--agents-md"]').click();
    // On a phone the open panel is a modal sheet over the page, so the bar is used once it is closed again.
    if (await page.evaluate(() => document.getElementById('matrix-panel').getAttribute('aria-modal') === 'true')) await page.keyboard.press('Escape');
  }
  await page.evaluate((y) => window.scrollTo(0, y), scrolled ? 600 : 0);
  const all = await shown(page);

  await hit(page, '#matrix-q');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'matrix-q', `${label}: a click focuses the search box`);
  await page.keyboard.type('GEMINI');
  const typed = await shown(page);
  assert.ok(typed > 0 && typed < all, `${label}: typing filters the tiles (${all} → ${typed})`);
  await page.fill('#matrix-q', '');

  const tools = '[aria-controls="matrix-f-tools"]', tool = `[data-filter-tool="${matrix.cells[0].tool}"]`;
  await hit(page, tools);
  assert.equal(await page.getAttribute(tools, 'aria-expanded'), 'true', `${label}: Tools opens`);
  await hit(page, tool);
  assert.equal(await page.getAttribute(tool, 'aria-pressed'), 'true', `${label}: the tool chip turns on`);
  const byTool = await shown(page);
  assert.ok(byTool > 0 && byTool < all, `${label}: a tool chip filters the tiles (${all} → ${byTool})`);

  const status = '[aria-controls="matrix-f-status"]', st = '[data-filter-status="unverified"]';
  await hit(page, status);
  assert.equal(await page.getAttribute(status, 'aria-expanded'), 'true', `${label}: Status opens`);
  await hit(page, st);
  assert.equal(await page.getAttribute(st, 'aria-pressed'), 'true', `${label}: the status chip turns on`);
  const byStatus = await shown(page);
  assert.ok(byStatus < byTool, `${label}: a status chip filters the tiles (${byTool} → ${byStatus})`);
}

for (const width of [1920, 1440, 1280, 1024, 768, 390, 320]) {
  test(`at ${width} px the search box, Tools and Status take the click and filter, in both themes, panel empty or open, at the top or scrolled`, async () => {
    for (const scheme of ['light', 'dark']) for (const panelOpen of [false, true]) for (const scrolled of [false, true]) {
      const { page, context, errors } = await open(width, width <= 390 ? 844 : 900, { scheme });
      await reachAll(page, { panelOpen, scrolled }, `${scheme}, panel ${panelOpen ? 'open' : 'empty'}, ${scrolled ? 'scrolled' : 'top'}`);
      assert.deepEqual(errors, []);
      await context.close();
    }
  });
}

// N1: the header wraps to 138 px at 320 px wide; focusing the search box from far down the page leaves it below.
for (const width of [320, 390, 1440]) {
  test(`at ${width} px focusing the search box from far down the page stops it below the sticky header`, async () => {
    const { page, context } = await open(width, 800);
    await page.evaluate(() => window.scrollTo(0, 1500));
    await page.evaluate(() => document.getElementById('matrix-q').scrollIntoView());
    const r = await page.evaluate(() => ({ q: document.getElementById('matrix-q').getBoundingClientRect().top, header: document.querySelector('.site-header').getBoundingClientRect().bottom }));
    assert.ok(r.q >= r.header, `box top ${Math.round(r.q)} is under the header bottom ${Math.round(r.header)}`);
    await context.close();
  });
}
