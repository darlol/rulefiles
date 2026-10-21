import fs from 'node:fs';
import path from 'node:path';
import { loadData } from './lib/data.mjs';
import { validateConfig, validateMatrix, validateDigest, validateWatchSources, staleCells, matrixStats } from './lib/validate.mjs';
import { todayIso, readJson } from './lib/util.mjs';

const data = loadData();
const today = todayIso();
const errors = [...validateConfig(data.config), ...validateWatchSources(data.watchSources)];
const m = validateMatrix(data.matrix, data.hosts, today);
errors.push(...m.errors);
for (const d of data.digests) errors.push(...validateDigest(d.data, data.hosts, today, d.file, data.matrix));

// Drafts produced by the watch script must follow the same schema.
const draftDir = path.join(data.root, 'data', 'drafts');
if (fs.existsSync(draftDir)) {
  for (const f of fs.readdirSync(draftDir).filter((x) => x.endsWith('.draft.json'))) {
    const draft = readJson(path.join(draftDir, f));
    if (draft.status !== 'draft') errors.push(`drafts/${f}: status must be "draft"`);
    errors.push(...validateDigest(draft, data.hosts, today, f, data.matrix).map((e) => `drafts/${f}: ${e}`));
  }
}

const stale = staleCells(data.matrix, today, data.config.staleAfterDays);
const summary = {
  matrixCells: data.matrix.cells.length,
  unverified: matrixStats(data.matrix).unverified,
  migrationOnly: matrixStats(data.matrix).byStatus['migration-only'],
  digests: data.digests.length,
  items: data.digests.reduce((n, d) => n + d.data.items.length, 0),
  staleCells: stale.length
};
if (stale.length) console.warn(`WARNING: ${stale.length} matrix cell(s) older than ${data.config.staleAfterDays} days: ${stale.map((c) => c.tool + '/' + c.file).join(', ')}`);
if (errors.length) {
  console.error(errors.map((e) => 'ERROR: ' + e).join('\n'));
  console.error(`\nData validation failed with ${errors.length} error(s).`);
  process.exit(1);
}
console.log('Data validation passed.', JSON.stringify(summary));
