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

/** Newest first, as the site lists them. */
export const PUBLISHED_DIGESTS = publishedDigestsIn();
/** Oldest first. */
export const PUBLISHED_WEEKS = PUBLISHED_DIGESTS.map((d) => d.week).reverse();
export const PAGES = [...STATIC_PAGES.slice(0, 4), ...PUBLISHED_WEEKS.map((w) => `digest/${w}/index.html`), ...STATIC_PAGES.slice(4)];
