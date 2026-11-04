// The built HTML pages the tests expect. The digest issue pages follow the published digests of data/digest, so a
// new week adds its page here without a change to the tests. This file reads the data itself, with its own filter
// and its own sort, and imports nothing from scripts/: a build that lets a draft through, or drops a published
// week, then disagrees with it.
import fs from 'node:fs';
import path from 'node:path';

const DIGEST_DIR = new URL('../../data/digest/', import.meta.url).pathname;

/** The published digests of a data/digest directory, newest week first. Week ids such as 2026-W43 sort as text. */
export function publishedDigestsIn(digestDir = DIGEST_DIR) {
  return fs.readdirSync(digestDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(digestDir, f), 'utf8')))
    .filter((d) => d.status === 'published')
    .sort((a, b) => b.week.localeCompare(a.week));
}

const STATIC_PAGES = ['index.html', 'matrix/index.html', 'generator/index.html', 'digest/index.html', 'about/index.html', 'sponsors/index.html', 'newsletter/index.html', 'privacy/index.html', 'legal/index.html', '404.html'];

// The reference pages follow the files of data/matrix.json, read here directly: one page per file id, the index and /unverified/.
export const MATRIX = JSON.parse(fs.readFileSync(new URL('../../data/matrix.json', import.meta.url), 'utf8'));
export const FILE_PAGES = MATRIX.files.map((f) => `files/${f.id}/index.html`);
const REFERENCE_PAGES = ['files/index.html', ...FILE_PAGES, 'unverified/index.html'];
// Question pages: one per cell whose status is in questionPages.statuses of site.config.json and that has a quote, in
// the order of the tools, then the files. Comparison pages: the three slugs of the spec.
const CONFIG = JSON.parse(fs.readFileSync(new URL('../../site.config.json', import.meta.url), 'utf8'));
export const QUESTION_STATUSES = (CONFIG.questionPages && CONFIG.questionPages.statuses) || [];
export const QUESTION_CELLS = MATRIX.tools.flatMap((t) => MATRIX.files.map((f) => MATRIX.cells.find((c) => c.tool === t.id && c.file === f.id)))
  .filter((c) => c.status !== 'unverified' && c.quote && QUESTION_STATUSES.includes(c.status));
export const QUESTION_PAGES = QUESTION_CELLS.map((c) => `does/${c.tool}/read/${c.file}/index.html`);
export const COMPARE_SLUGS = ['claude-md-vs-agents-md', 'agents-md-vs-cursor-rules', 'cursorrules-still-read'];
const COMPARE_PAGES = COMPARE_SLUGS.map((s) => `compare/${s}/index.html`);

/** Newest first, as the site lists them. */
export const PUBLISHED_DIGESTS = publishedDigestsIn();
/** Oldest first. */
export const PUBLISHED_WEEKS = PUBLISHED_DIGESTS.map((d) => d.week).reverse();
export const PAGES = [...STATIC_PAGES.slice(0, 2), ...REFERENCE_PAGES, ...QUESTION_PAGES, ...COMPARE_PAGES, ...STATIC_PAGES.slice(2, 4), ...PUBLISHED_WEEKS.map((w) => `digest/${w}/index.html`), ...STATIC_PAGES.slice(4)];
