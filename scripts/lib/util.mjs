import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function writeFile(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function escapeXml(value) {
  return escapeHtml(value).replace(/&#39;/g, '&apos;');
}

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value) {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return false;
  const d = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function daysBetween(a, b) {
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
}

/** ISO 8601 week id such as 2026-W41 for a YYYY-MM-DD date. */
export function isoWeekId(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Monday and Sunday (YYYY-MM-DD) of an ISO week id. */
export function isoWeekRange(weekId) {
  const [y, w] = weekId.split('-W').map(Number);
  const jan4 = new Date(Date.UTC(y, 0, 4));
  const day = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - day + 1 + (w - 1) * 7);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return { start: monday.toISOString().slice(0, 10), end: sunday.toISOString().slice(0, 10) };
}

export function todayIso() {
  return process.env.BUILD_DATE || new Date().toISOString().slice(0, 10);
}

export function listFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full));
    else out.push(full);
  }
  return out;
}

// Version strings as the sources write them: 2.1.303, 0.163.0, v1.4.0, 1.0.0-beta.2. Leading "v" ignored, any number of
// numeric parts (missing parts count as 0), then an optional prerelease compared as SemVer 2.0.0 section 11 does.
const VERSION_RE = /^v?(\d+(?:\.\d+)*)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

// What validateDigest accepts in an item's `version`: SemVer 2.0.0 (MAJOR.MINOR.PATCH, optional prerelease and build
// metadata, no leading zeros), with an optional lowercase "v" as release pages write it. Anything else would sort
// below every version in compareVersions without a word, so the build refuses it instead.
const SEMVER_RE = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

/** True when the string is a SemVer 2.0.0 version, with or without a leading "v". */
export function isSemver(value) {
  return typeof value === 'string' && SEMVER_RE.test(value);
}

/** Compares two version strings: negative if a < b, positive if a > b, 0 if equal. A string that is not a version sorts below every version. */
export function compareVersions(a, b) {
  const pa = VERSION_RE.exec(String(a));
  const pb = VERSION_RE.exec(String(b));
  if (!pa || !pb) return pa ? 1 : pb ? -1 : 0;
  const na = pa[1].split('.').map(Number);
  const nb = pb[1].split('.').map(Number);
  for (let i = 0; i < Math.max(na.length, nb.length); i++) {
    const d = (na[i] || 0) - (nb[i] || 0);
    if (d) return Math.sign(d);
  }
  if (!pa[2] || !pb[2]) return pa[2] ? -1 : pb[2] ? 1 : 0; // a release is above its prereleases
  const xa = pa[2].split('.');
  const xb = pb[2].split('.');
  for (let i = 0; i < Math.max(xa.length, xb.length); i++) {
    if (xa[i] === undefined) return -1;
    if (xb[i] === undefined) return 1;
    const da = /^\d+$/.test(xa[i]);
    const db = /^\d+$/.test(xb[i]);
    if (da && db) { const d = Number(xa[i]) - Number(xb[i]); if (d) return Math.sign(d); }
    else if (da !== db) return da ? -1 : 1; // numeric identifiers sort below alphanumeric ones
    else if (xa[i] !== xb[i]) return xa[i] < xb[i] ? -1 : 1;
  }
  return 0;
}
