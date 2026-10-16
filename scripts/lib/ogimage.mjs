import zlib from 'node:zlib';

// Draws the site mark (the same shape as favicon.svg) on a dark 1200x630 canvas and encodes it as a PNG
// with node:zlib only. The output is deterministic. It carries no text, so it needs no font.

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

const BG = [31, 41, 55];
const FG = [249, 250, 251];

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

function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export function renderOgImage() {
  // Favicon coordinates are on a 32 unit grid. Scale it so the mark is about 300 px tall.
  const scale = 300 / 16;
  const ox = OG_WIDTH / 2 - 16 * scale + 0.5 * scale;
  const oy = OG_HEIGHT / 2 - 16 * scale;
  const segs = [[9, 8, 9, 24], [9, 16, 17, 16], [23, 8, 18, 16], [18, 16, 23, 24]].map(([a, b, c, d]) => [ox + a * scale, oy + b * scale, ox + c * scale, oy + d * scale]);
  const half = 1.5 * scale;
  const raw = Buffer.alloc((OG_WIDTH * 3 + 1) * OG_HEIGHT);
  for (let y = 0; y < OG_HEIGHT; y++) {
    const row = y * (OG_WIDTH * 3 + 1);
    raw[row] = 0;
    for (let x = 0; x < OG_WIDTH; x++) {
      let d = Infinity;
      for (const s of segs) d = Math.min(d, distanceToSegment(x + 0.5, y + 0.5, ...s));
      const cover = Math.max(0, Math.min(1, half - d + 0.5));
      for (let c = 0; c < 3; c++) raw[row + 1 + x * 3 + c] = Math.round(BG[c] + (FG[c] - BG[c]) * cover);
    }
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
