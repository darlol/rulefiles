import test from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { renderOgImage, textWidth, wrapText, OG_WIDTH, OG_HEIGHT } from '../scripts/lib/ogimage.mjs';

function pixels(png) {
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  const idat = [];
  for (let at = 8; at < png.length;) {
    const len = png.readUInt32BE(at);
    if (png.toString('ascii', at + 4, at + 8) === 'IDAT') idat.push(png.subarray(at + 8, at + 8 + len));
    at += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = OG_WIDTH * 3 + 1;
  return (x, y) => [raw[y * stride + 1 + x * 3], raw[y * stride + 1 + x * 3 + 1], raw[y * stride + 1 + x * 3 + 2]];
}

const matrix = {
  tools: [{ id: 'a' }, { id: 'b' }], files: [{ id: 'x' }, { id: 'y' }],
  cells: [{ tool: 'a', file: 'x', status: 'reads' }, { tool: 'b', file: 'x', status: 'not-read' }, { tool: 'a', file: 'y', status: 'unverified' }, { tool: 'b', file: 'y', status: 'configurable' }]
};

test('share image is a 1200x630 PNG that contains the text it was given', () => {
  const png = renderOgImage({ name: 'Example', title: 'A headline for the share image.', matrix });
  assert.equal(png.readUInt32BE(16), OG_WIDTH);
  assert.equal(png.readUInt32BE(20), OG_HEIGHT);
  const at = pixels(png);
  const ink = (c) => c[0] > 200 && c[1] > 200 && c[2] > 200;
  let inkPixels = 0;
  for (let y = 200; y < 440; y++) for (let x = 72; x < 700; x++) if (ink(at(x, y))) inkPixels++;
  assert.ok(inkPixels > 8000, `headline area has text pixels (${inkPixels})`);
  // Anti-aliasing: the edge of a glyph has intermediate greys, not only the two extremes.
  const seen = new Set();
  for (let y = 200; y < 440; y++) for (let x = 72; x < 400; x++) seen.add(at(x, y)[0]);
  assert.ok(seen.size > 20, 'glyph edges are anti-aliased');
});

test('the text comes from the arguments, so a rename or a new headline changes the image', () => {
  const a = renderOgImage({ name: 'First', title: 'Same headline', matrix });
  const b = renderOgImage({ name: 'Second', title: 'Same headline', matrix });
  const c = renderOgImage({ name: 'First', title: 'Other headline', matrix });
  assert.notEqual(a.toString('hex'), b.toString('hex'));
  assert.notEqual(a.toString('hex'), c.toString('hex'));
});

test('the share image is deterministic', () => {
  const o = { name: 'Example', title: 'Same input', caption: 'Same caption', matrix };
  assert.equal(renderOgImage(o).toString('hex'), renderOgImage(o).toString('hex'));
});

test('the preview grid draws one tile per matrix cell in the colour of its status', () => {
  const png = renderOgImage({ matrix });
  const at = pixels(png);
  // Panel starts at (760, 72), padding 24. First tile is cell a/x = reads (green dot in the middle).
  const cw = (368 - 48 - 10) / 2;
  const ch = (486 - 48 - 10) / 2;
  const centre = (c, r) => at(Math.round(760 + 24 + c * (cw + 10) + cw / 2), Math.round(72 + 24 + r * (ch + 10) + ch / 2));
  assert.deepEqual(centre(0, 0), [127, 224, 164]);
  assert.deepEqual(centre(1, 0), [255, 154, 162]);
  assert.deepEqual(centre(0, 1), [165, 172, 194]);
  assert.deepEqual(centre(1, 1), [246, 195, 106]);
});

test('text helpers measure and wrap on the font metrics', () => {
  assert.ok(textWidth('Wide text', 40) > textWidth('Wide', 40));
  assert.equal(textWidth('', 40), 0);
  const lines = wrapText('one two three four five six seven', 60, 300);
  assert.ok(lines.length > 1);
  for (const l of lines) assert.ok(textWidth(l, 60) <= 300 || !l.includes(' '), l);
  assert.equal(lines.join(' '), 'one two three four five six seven');
});
