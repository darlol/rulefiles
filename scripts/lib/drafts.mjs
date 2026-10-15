import fs from 'node:fs';
import path from 'node:path';
import { readJson } from './util.mjs';

/** Published digest files, parsed. Used by the watcher to avoid re-listing items already cited. */
export function publishedDigestsFromDir(root) {
  const dir = path.join(root, 'data', 'digest');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => readJson(path.join(dir, f))).filter((d) => d.status === 'published');
}
