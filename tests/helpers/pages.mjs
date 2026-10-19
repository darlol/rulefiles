// The built HTML pages the tests expect. The digest issue pages follow the published digests in data/digest, so a
// new week adds its page here without a change to the tests.
import { loadData, publishedDigests } from '../../scripts/lib/data.mjs';

const STATIC_PAGES = ['index.html', 'matrix/index.html', 'generator/index.html', 'digest/index.html', 'about/index.html', 'sponsors/index.html', 'newsletter/index.html', 'privacy/index.html', 'legal/index.html', '404.html'];

export const PUBLISHED_WEEKS = publishedDigests(loadData()).map((d) => d.week).sort();
export const PAGES = [...STATIC_PAGES.slice(0, 4), ...PUBLISHED_WEEKS.map((w) => `digest/${w}/index.html`), ...STATIC_PAGES.slice(4)];
