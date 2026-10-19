import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT, readJson, writeFile, todayIso, isIsoDate } from './lib/util.mjs';
import { createFetcher, DEFAULT_USER_AGENT } from './lib/fetcher.mjs';
import { parseRss, parseGithubReleases, groupDrafts } from './lib/parsers.mjs';
import { publishedDigestsFromDir, sourceKeys } from './lib/drafts.mjs';

function parseArgs(argv) {
  const a = { noState: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--no-state') a.noState = true;
    else if (['--offline', '--out', '--since', '--today', '--state', '--cache', '--user-agent', '--sources'].includes(k)) a[k.slice(2)] = argv[++i];
    else throw new Error(`Unknown argument ${k}`);
  }
  return a;
}

const addDays = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);

/**
 * Run the watcher. Returns {entries, drafts, written, skipped, state} and writes draft files unless dryRun.
 * deps lets tests inject a fetcher and a clock.
 */
export async function run(argv, deps = {}) {
  const args = parseArgs(argv);
  const root = deps.root || ROOT;
  const today = args.today || todayIso();
  const since = args.since || addDays(today, -10);
  if (!isIsoDate(since) || !isIsoDate(today)) throw new Error('--since and --today must be YYYY-MM-DD');
  const sources = readJson(args.sources || path.join(root, 'data', 'watch-sources.json'));
  const outDir = args.out || path.join(root, 'data', 'drafts');
  const statePath = args.state || path.join(root, 'data', 'watch-state.json');
  const state = !args.noState && fs.existsSync(statePath) ? readJson(statePath) : { seen: {} };
  state.seen = state.seen || {};
  const log = deps.log || ((m) => console.log(m));

  const fetcher = args.offline ? null : deps.fetcher || createFetcher({ cacheDir: args.cache || path.join(root, '.cache', 'watch'), userAgent: args['user-agent'] || process.env.WATCH_USER_AGENT || DEFAULT_USER_AGENT });
  const skipped = [];
  let entries = [];

  for (const s of sources.sources) {
    try {
      let body;
      if (args.offline) {
        const file = path.join(args.offline, `${s.id}.${s.type === 'rss' ? 'xml' : 'json'}`);
        if (!fs.existsSync(file)) throw new Error(`fixture ${file} not found`);
        body = fs.readFileSync(file, 'utf8');
      } else {
        body = (await fetcher.get(s.url, { maxBytes: s.maxBytes })).body;
      }
      const list = s.type === 'rss' ? parseRss(body, s) : parseGithubReleases(body, s);
      log(`${s.id}: ${list.length} entries parsed`);
      entries.push(...list);
    } catch (e) {
      skipped.push({ id: s.id, reason: e.message });
      log(`${s.id}: SKIPPED (${e.message})`);
    }
  }

  // Keep entries in the window that are neither seen before nor already cited by a published digest.
  const cited = new Set(publishedDigestsFromDir(root).flatMap((d) => d.items.flatMap((i) => [...sourceKeys(i.tool, i.sourceUrl), ...(i.version ? [`${i.tool}:${i.version}`] : [])])));
  const total = entries.length;
  entries = entries.filter((e) => e.date >= since && e.date <= today && !state.seen[e.id] && !sourceKeys(e.tool, e.url).some((k) => cited.has(k)) && !(e.version && cited.has(`${e.tool}:${e.version}`)));
  entries.sort((a, b) => (a.date === b.date ? (a.id < b.id ? -1 : 1) : a.date < b.date ? -1 : 1));
  log(`\n${entries.length} new change(s) since ${since} (of ${total} parsed):`);
  for (const e of entries) log(`${e.date} | ${e.tool} | ${e.title} | ${e.url}`);

  const drafts = groupDrafts(entries, today);
  const written = [];
  for (const d of drafts) {
    const file = path.join(outDir, `${d.week}.draft.json`);
    if (fs.existsSync(file)) {
      // Merge into an existing draft without dropping reviewer edits.
      const old = readJson(file);
      const ids = new Set(old.items.map((i) => i.sourceUrl));
      for (const it of d.items) if (!ids.has(it.sourceUrl)) old.items.push(it);
      old.items.sort((a, b) => (a.date === b.date ? (a.id < b.id ? -1 : 1) : a.date < b.date ? -1 : 1));
      old.verifiedOn = today;
      writeFile(file, JSON.stringify(old, null, 2) + '\n');
    } else {
      writeFile(file, JSON.stringify(d, null, 2) + '\n');
    }
    written.push(file);
  }
  for (const e of entries) state.seen[e.id] = today;

  if (!args.noState && !args.offline) writeFile(statePath, JSON.stringify(state, null, 2) + '\n');
  if (written.length) log(`\nWrote ${written.length} draft file(s): ${written.join(', ')}`);
  if (fetcher) log(`Network requests: ${fetcher.stats.network}, cache hits: ${fetcher.stats.cacheHits}, not modified: ${fetcher.stats.notModified}`);
  return { entries, drafts, written, skipped, sourceCount: sources.sources.length, state };
}

/**
 * One line that names every skipped source and why. The run still succeeds when only some sources fail
 * (the other sources are still worth a draft), so this line is how a skip gets noticed: it ends the log,
 * goes to stderr, and in GitHub Actions becomes a warning annotation and a line in the job summary.
 */
export function skippedSummary(skipped, sourceCount) {
  if (!skipped.length) return '';
  return `WARNING: ${skipped.length} of ${sourceCount} source(s) skipped: ${skipped.map((s) => `${s.id} (${s.reason})`).join('; ')}`;
}

/**
 * The line for the top of the draft pull request body: a skip is otherwise only in the run log, which nobody
 * reads on a green run. The reasons are error messages, so any line break is flattened to keep it one line.
 */
export function skippedNotice(skipped) {
  if (!skipped.length) return '';
  return `⚠ Sources skipped: ${skipped.map((s) => `${s.id} (${String(s.reason).replace(/\s+/g, ' ').trim()})`).join('; ')}`;
}

/** scripts/open-watch-pr.sh reads this file. It is written on every run, and removed when nothing was skipped, so an old notice never stays. */
export function writeSkippedNotice(file, skipped) {
  const notice = skippedNotice(skipped);
  if (notice) writeFile(file, notice + '\n');
  else fs.rmSync(file, { force: true });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const res = await run(process.argv.slice(2));
    const summary = skippedSummary(res.skipped, res.sourceCount);
    writeSkippedNotice(process.env.WATCH_SKIPPED_FILE || path.join(ROOT, '.cache', 'watch', 'skipped-sources.txt'), res.skipped);
    if (summary) {
      console.error(summary);
      if (process.env.GITHUB_ACTIONS) console.log(`::warning title=Watch source skipped::${summary.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A')}`);
      if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Watch: sources skipped\n\n${summary}\n`);
    }
    if (res.skipped.length && res.entries.length === 0 && res.skipped.length >= 4) process.exit(3);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
