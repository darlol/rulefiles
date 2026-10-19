// The build date the tests run with, derived from the data instead of written by hand, so a new digest does not
// break the suite. It is the latest date found in data/ (digest verifiedOn and item dates, matrix lastReviewed and
// cell verifiedOn) plus TEST_DATE_MARGIN_DAYS. The validator refuses data dated after the build date, so TEST_DATE
// is never before the data. It stays strictly after the latest verifiedOn, so a feed <updated> that took the build
// date instead of a digest date shows up in the tests.
import fs from 'node:fs';
import path from 'node:path';

export const TEST_DATE_MARGIN_DAYS = 2;
const DATA = new URL('../../data/', import.meta.url).pathname;
const ISO = /^\d{4}-\d\d-\d\d$/;
const DATE_KEYS = new Set(['verifiedOn', 'lastReviewed', 'date']);

function collect(value, out) {
  if (Array.isArray(value)) for (const v of value) collect(v, out);
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (DATE_KEYS.has(k) && typeof v === 'string' && ISO.test(v)) out.push(v);
      else collect(v, out);
    }
  }
  return out;
}

/** The latest data date: matrix.json and every JSON file of data/digest (published and draft). */
export function latestDataDate(dataDir = DATA) {
  const files = [path.join(dataDir, 'matrix.json')];
  const digestDir = path.join(dataDir, 'digest');
  for (const f of fs.readdirSync(digestDir).sort()) if (f.endsWith('.json')) files.push(path.join(digestDir, f));
  const dates = files.flatMap((f) => collect(JSON.parse(fs.readFileSync(f, 'utf8')), []));
  if (dates.length === 0) throw new Error(`tests/helpers/test-date.mjs: no date found in ${dataDir}, so TEST_DATE cannot be derived`);
  return dates.sort().at(-1);
}

export function addDays(iso, days) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const LATEST_DATA_DATE = latestDataDate();
export const TEST_DATE = addDays(LATEST_DATA_DATE, TEST_DATE_MARGIN_DAYS);
