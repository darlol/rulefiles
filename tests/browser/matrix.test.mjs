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

for (const width of [320, 390, 768, 1280, 1440]) {
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

test('the first screen shows at least 16 statuses on a phone and 40 on a desktop', async () => {
  for (const [w, h, min] of [[390, 844, 16], [1440, 900, 40]]) {
    const { page, context } = await open(w, h);
    const n = await firstScreen(page);
    assert.ok(n >= min, `${n} statuses fully visible at ${w}×${h}, want ≥ ${min}`);
    await context.close();
  }
});

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
  await page.click('[data-filter-status="unverified"]');
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
    await page.click('[data-filter-status="reads"]');
    for (const p of await read()) pairs.set(p.k, p);
    for (const p of pairs.values()) {
      const r = ratio(p.fg, p.bg);
      assert.ok(r >= 4.5, `${scheme} ${p.k}: ${r.toFixed(2)}:1`);
    }
    await context.close();
  });
}
