import fs from 'node:fs';
import path from 'node:path';
import { readJson } from './util.mjs';

/** Published digest files, parsed. Used by the watcher to avoid re-listing items already cited. */
export function publishedDigestsFromDir(root) {
  const dir = path.join(root, 'data', 'digest');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => readJson(path.join(dir, f))).filter((d) => d.status === 'published');
}

/**
 * Keys that identify a source link, so the same item is recognised when the feed writes the link a little
 * differently from the published digest. Two keys at most:
 *  - the link with the host lower-cased and the trailing slash of the path removed (github.blog feeds drop it);
 *  - for a link with a fragment, tool + last path segment + fragment. The fragment is the entry id of a
 *    changelog page (codex-2026-10-14-gpt-55-retirement), and the page is served under more than one host.
 * A link without a fragment is only compared as a whole link, so two items on one page stay distinct.
 */
export function sourceKeys(tool, url) {
  let u;
  try { u = new URL(url); } catch { return [`url:${url}`]; }
  const path = u.pathname.replace(/\/+$/, '');
  const keys = [`url:${u.protocol}//${u.host.toLowerCase()}${path}${u.search}${u.hash}`];
  let fragment = u.hash.slice(1);
  try { fragment = decodeURIComponent(fragment); } catch { /* keep the raw fragment */ }
  if (fragment) keys.push(`fragment:${tool}:${path.split('/').pop()}#${fragment}`);
  return keys;
}
