import fs from 'node:fs';
import zlib from 'node:zlib';

// Draws the share image (1200x630) with node:zlib and a small scanline rasteriser, no dependency and no
// system font. The text comes from the site config, so a rename needs no change here. The glyph outlines in
// og-font.json are Hanken Grotesk Bold (SIL OFL 1.1, see scripts/lib/og-font.README.txt) at weight 720, converted
// to quadratic paths. The output is deterministic.

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

const FONT = JSON.parse(fs.readFileSync(new URL('./og-font.json', import.meta.url), 'utf8'));
const SUB = 4; // vertical sub-scanlines per pixel; horizontal coverage is exact

// The dark palette of the site (src/static/style.css).
const C = {
  // Signal Press dark theme (src/static/style.css). Mark ground = paper, hi bar = signal.
  bg: [26, 22, 18], panel: [34, 30, 25], line: [58, 52, 44], ink: [246, 241, 231], muted: [196, 184, 168],
  accent: [246, 241, 231], onAccent: [26, 22, 18], mark: [196, 92, 38]
};
const STATUS = {
  reads: [[18, 48, 31], [127, 224, 164]],
  'reads-conditionally': [[15, 47, 51], [111, 220, 230]],
  configurable: [[58, 42, 14], [246, 195, 106]],
  'migration-only': [[42, 34, 80], [187, 168, 255]],
  'not-read': [[61, 21, 25], [255, 154, 162]],
  unverified: [[28, 33, 50], [165, 172, 194]]
};

function crc32(buf) {
  let c;
  let crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}


// Polygons are arrays of [x, y]. Fill uses the nonzero rule, like a font does.
function fillPolys(raw, polys, color, alpha = 1) {
  let minY = Infinity;
  let maxY = -Infinity;
  const edges = [];
  for (const poly of polys) {
    for (let k = 0; k < poly.length; k++) {
      const [x0, y0] = poly[k];
      const [x1, y1] = poly[(k + 1) % poly.length];
      if (y0 === y1) continue;
      edges.push(y0 < y1 ? [x0, y0, x1, y1, 1] : [x1, y1, x0, y0, -1]);
      minY = Math.min(minY, y0, y1);
      maxY = Math.max(maxY, y0, y1);
    }
  }
  if (!edges.length) return;
  const y0 = Math.max(0, Math.floor(minY));
  const y1 = Math.min(OG_HEIGHT - 1, Math.ceil(maxY));
  const cov = new Float32Array(OG_WIDTH);
  for (let py = y0; py <= y1; py++) {
    cov.fill(0);
    let touched = false;
    let lo = OG_WIDTH;
    let hi = 0;
    for (let s = 0; s < SUB; s++) {
      const y = py + (s + 0.5) / SUB;
      const xs = [];
      for (const e of edges) if (e[1] <= y && y < e[3]) xs.push([e[0] + ((y - e[1]) * (e[2] - e[0])) / (e[3] - e[1]), e[4]]);
      if (!xs.length) continue;
      xs.sort((a, b) => a[0] - b[0]);
      let wind = 0;
      for (let k = 0; k < xs.length - 1; k++) {
        wind += xs[k][1];
        if (wind === 0) continue;
        const a = Math.max(0, xs[k][0]);
        const b = Math.min(OG_WIDTH, xs[k + 1][0]);
        if (b <= a) continue;
        touched = true;
        const ia = Math.floor(a);
        const ib = Math.floor(b);
        lo = Math.min(lo, ia);
        hi = Math.max(hi, Math.min(ib, OG_WIDTH - 1));
        if (ia === ib) cov[ia] += (b - a) / SUB;
        else {
          cov[ia] += (ia + 1 - a) / SUB;
          for (let x = ia + 1; x < ib; x++) cov[x] += 1 / SUB;
          if (ib < OG_WIDTH) cov[ib] += (b - ib) / SUB;
        }
      }
    }
    if (!touched) continue;
    const row = py * (OG_WIDTH * 3 + 1) + 1;
    for (let x = lo; x <= hi; x++) {
      const a = Math.min(1, cov[x]) * alpha;
      if (a <= 0) continue;
      for (let c = 0; c < 3; c++) raw[row + x * 3 + c] = Math.round(raw[row + x * 3 + c] * (1 - a) + color[c] * a);
    }
  }
}

function roundedRect(x, y, w, h, r) {
  const pts = [];
  const corner = (cx, cy, from) => { for (let i = 0; i <= 8; i++) { const t = from + (i / 8) * (Math.PI / 2); pts.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]); } };
  corner(x + w - r, y + r, -Math.PI / 2);
  corner(x + w - r, y + h - r, 0);
  corner(x + r, y + h - r, Math.PI / 2);
  corner(x + r, y + r, Math.PI);
  return pts;
}

function circle(cx, cy, r) {
  return Array.from({ length: 24 }, (_, i) => [cx + r * Math.cos((i / 24) * Math.PI * 2), cy + r * Math.sin((i / 24) * Math.PI * 2)]);
}

// Parses the compact "M x y L x y Q cx cy x y Z" path into flattened contours in font units.
const glyphCache = new Map();
function glyphContours(ch) {
  const g = FONT.glyphs[ch] || FONT.glyphs['?'];
  if (glyphCache.has(g)) return glyphCache.get(g);
  const contours = [];
  let cur = null;
  let pen = [0, 0];
  for (const m of g.d.matchAll(/([MLQZ])([^MLQZ]*)/g)) {
    const n = m[2].trim().split(/\s+/).filter(Boolean).map(Number);
    if (m[1] === 'M') { cur = [[n[0], n[1]]]; contours.push(cur); pen = [n[0], n[1]]; }
    else if (m[1] === 'L') { cur.push([n[0], n[1]]); pen = [n[0], n[1]]; }
    else if (m[1] === 'Q') {
      for (let i = 1; i <= 6; i++) {
        const t = i / 6;
        cur.push([(1 - t) * (1 - t) * pen[0] + 2 * (1 - t) * t * n[0] + t * t * n[2], (1 - t) * (1 - t) * pen[1] + 2 * (1 - t) * t * n[1] + t * t * n[3]]);
      }
      pen = [n[2], n[3]];
    }
  }
  glyphCache.set(g, contours);
  return contours;
}

const advance = (ch) => (FONT.glyphs[ch] || FONT.glyphs['?']).w;

/** Width in px of a string at a font size, with letter spacing in em. */
export function textWidth(text, size, tracking = 0) {
  let w = 0;
  for (const ch of text) w += (advance(ch) / FONT.unitsPerEm) * size + tracking * size;
  return w - tracking * size;
}

function drawText(raw, text, x, baseline, size, color, tracking = 0) {
  const scale = size / FONT.unitsPerEm;
  const polys = [];
  let pen = x;
  for (const ch of text) {
    for (const c of glyphContours(ch)) polys.push(c.map(([gx, gy]) => [pen + gx * scale, baseline - gy * scale]));
    pen += advance(ch) * scale + tracking * size;
  }
  fillPolys(raw, polys, color);
}

/** Greedy word wrap on measured width. */
export function wrapText(text, size, maxWidth, tracking = 0) {
  const lines = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && textWidth(next, size, tracking) > maxWidth) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function drawMark(raw, x, y, size) {
  const k = size / 32;
  fillPolys(raw, [roundedRect(x, y, size, size, 8 * k)], C.accent);
  fillPolys(raw, [roundedRect(x + 7 * k, y + 8.5 * k, 12 * k, 3.2 * k, 1.6 * k)], C.onAccent, 0.6);
  fillPolys(raw, [roundedRect(x + 7 * k, y + 14.4 * k, 18 * k, 3.2 * k, 1.6 * k)], C.mark);
  fillPolys(raw, [roundedRect(x + 7 * k, y + 20.3 * k, 9 * k, 3.2 * k, 1.6 * k)], C.onAccent, 0.6);
}

/**
 * @param {{ name?: string, title?: string, caption?: string, matrix?: { tools: {id:string}[], files: {id:string}[], cells: {tool:string,file:string,status:string}[] } }} [opts]
 * name: site name, title: the headline, caption: small line under it, matrix: data for the preview grid.
 */
export function renderOgImage({ name = '', title = '', caption = '', matrix = null } = {}) {
  const raw = Buffer.alloc((OG_WIDTH * 3 + 1) * OG_HEIGHT);
  for (let y = 0; y < OG_HEIGHT; y++) {
    const row = y * (OG_WIDTH * 3 + 1);
    raw[row] = 0;
    for (let x = 0; x < OG_WIDTH; x++) for (let c = 0; c < 3; c++) raw[row + 1 + x * 3 + c] = C.bg[c];
  }
  const left = 72;
  const hasPanel = Boolean(matrix && matrix.cells.length);
  const textWidthMax = hasPanel ? 600 : OG_WIDTH - 2 * left;
  drawMark(raw, left, 72, 64);
  if (name) drawText(raw, name, left + 64 + 20, 72 + 44, 38, C.ink, -0.02);
  if (title) {
    const size = 74;
    const lines = wrapText(title, size, textWidthMax, -0.03);
    lines.forEach((l, i) => drawText(raw, l, left, 250 + i * 82, size, C.ink, -0.03));
  }
  if (caption) drawText(raw, caption, left, 560, 26, C.muted);
  if (hasPanel) {
    const px = 760; const py = 72; const pw = 368; const ph = 486; const pad = 24; const gap = 10;
    fillPolys(raw, [roundedRect(px, py, pw, ph, 20)], C.line);
    fillPolys(raw, [roundedRect(px + 1.5, py + 1.5, pw - 3, ph - 3, 18.5)], C.panel);
    const cols = matrix.tools.length;
    const rows = matrix.files.length;
    const cw = (pw - 2 * pad - (cols - 1) * gap) / cols;
    const ch = (ph - 2 * pad - (rows - 1) * gap) / rows;
    const byKey = new Map(matrix.cells.map((c) => [`${c.tool}/${c.file}`, c.status]));
    matrix.files.forEach((f, r) => matrix.tools.forEach((t, c) => {
      const [bg, fg] = STATUS[byKey.get(`${t.id}/${f.id}`)] || STATUS.unverified;
      const x = px + pad + c * (cw + gap);
      const y = py + pad + r * (ch + gap);
      fillPolys(raw, [roundedRect(x, y, cw, ch, 10)], bg);
      fillPolys(raw, [circle(x + cw / 2, y + ch / 2, 6)], fg);
    }));
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(OG_WIDTH, 0);
  ihdr.writeUInt32BE(OG_HEIGHT, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}
