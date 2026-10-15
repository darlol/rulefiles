import fs from 'node:fs';
import path from 'node:path';
import { ROOT, readJson } from './util.mjs';

export function loadConfig(root = ROOT) {
  const config = readJson(path.join(root, 'site.config.json'));
  if (process.env.SITE_URL) config.baseUrl = process.env.SITE_URL.replace(/\/+$/, '');
  if (process.env.NEWSLETTER_FORM_ACTION) config.newsletter = { ...config.newsletter, formAction: process.env.NEWSLETTER_FORM_ACTION };
  return config;
}

export function loadData(root = ROOT) {
  const config = loadConfig(root);
  const matrix = readJson(path.join(root, 'data', 'matrix.json'));
  const hosts = readJson(path.join(root, 'data', 'allowed-source-hosts.json')).hosts;
  const watchSources = readJson(path.join(root, 'data', 'watch-sources.json'));
  const digestDir = path.join(root, 'data', 'digest');
  const digestFiles = fs.existsSync(digestDir) ? fs.readdirSync(digestDir).filter((f) => f.endsWith('.json')).sort() : [];
  const digests = digestFiles.map((f) => ({ file: f, data: readJson(path.join(digestDir, f)) }));
  return { root, config, matrix, hosts, watchSources, digests };
}

/** Published digests, newest week first. */
export function publishedDigests(data) {
  return data.digests
    .map((d) => d.data)
    .filter((d) => d.status === 'published')
    .sort((a, b) => (a.week < b.week ? 1 : -1));
}
