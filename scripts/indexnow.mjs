// Tells IndexNow search engines which URLs of the built site changed. Run by hand, after the new build is live.
//
//   node scripts/indexnow.mjs --since 2026-10-15        # dry run: lists the URLs, sends nothing
//   node scripts/indexnow.mjs --since 2026-10-15 --send # sends one POST to https://api.indexnow.org/indexnow
//
// Which URLs: --since DATE keeps the sitemap URLs whose lastmod is on or after DATE (a URL without lastmod is kept,
// since its date is unknown), --all keeps every sitemap URL, --url adds one URL (repeatable).
// The key is public by design (https://www.indexnow.org/documentation), so no secret is read or needed.
// Nothing is sent without --send. The site must already serve https://<host>/<key>.txt when the request is made.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_ENDPOINT = 'https://api.indexnow.org/indexnow';
export const MAX_URLS = 10000;
export const KEY_RE = /^[A-Za-z0-9-]{8,128}$/;
const USER_AGENT = 'RulefilesIndexNow/0.1';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Entries of a sitemap.xml: [{ loc, lastmod? }]. */
export function parseSitemap(xml) {
  const out = [];
  for (const m of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const loc = m[1].match(/<loc>([^<]+)<\/loc>/);
    if (!loc) continue;
    const lm = m[1].match(/<lastmod>([^<]+)<\/lastmod>/);
    out.push({ loc: loc[1].trim().replace(/&amp;/g, '&'), ...(lm ? { lastmod: lm[1].trim() } : {}) });
  }
  return out;
}

/** The JSON body of the IndexNow POST. Throws when the key, the host or an URL is not valid. */
export function buildPayload({ baseUrl, key, urls }) {
  if (!KEY_RE.test(key || '')) throw new Error('IndexNow key must be 8 to 128 characters: letters, digits and dashes');
  const base = new URL(baseUrl);
  if (base.protocol !== 'https:') throw new Error('baseUrl must be https');
  const list = [...new Set(urls)];
  if (!list.length) throw new Error('no URL to send');
  if (list.length > MAX_URLS) throw new Error(`IndexNow accepts at most ${MAX_URLS} URLs per request, got ${list.length}`);
  for (const u of list) {
    if (new URL(u).host !== base.host) throw new Error(`URL ${u} is not on ${base.host}`);
  }
  return { host: base.host, key, urlList: list };
}

export function parseArgs(argv) {
  const a = { urls: [], send: false, all: false, since: '', dist: path.join(ROOT, 'dist'), endpoint: DEFAULT_ENDPOINT };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--send') a.send = true;
    else if (k === '--all') a.all = true;
    else if (k === '--since') a.since = argv[++i] || '';
    else if (k === '--url') a.urls.push(argv[++i] || '');
    else if (k === '--dist') a.dist = path.resolve(argv[++i] || '');
    else if (k === '--endpoint') a.endpoint = argv[++i] || '';
    else throw new Error(`unknown argument ${k}`);
  }
  if (a.since && !/^\d{4}-\d{2}-\d{2}$/.test(a.since)) throw new Error('--since must be YYYY-MM-DD');
  if (!a.since && !a.all && !a.urls.length) throw new Error('choose the URLs: --since YYYY-MM-DD, --all or --url URL');
  if (!/^https:\/\//.test(a.endpoint)) throw new Error('--endpoint must be an https URL');
  return a;
}

/**
 * @param {string[]} argv
 * @param {{ fetchImpl?: typeof fetch, log?: (m: string) => void, root?: string }} [env]
 */
export async function run(argv, { fetchImpl = globalThis.fetch, log = console.log, root = ROOT } = {}) {
  const args = parseArgs(argv);
  const config = JSON.parse(fs.readFileSync(path.join(root, 'site.config.json'), 'utf8'));
  const key = config.indexNowKey;
  const keyFile = path.join(args.dist, `${key}.txt`);
  if (!fs.existsSync(keyFile) || fs.readFileSync(keyFile, 'utf8').trim() !== key) throw new Error(`${keyFile} is missing or does not hold the key: run npm run build first`);
  const sitemap = parseSitemap(fs.readFileSync(path.join(args.dist, 'sitemap.xml'), 'utf8'));
  const chosen = (args.all || args.since ? sitemap.filter((e) => args.all || !e.lastmod || e.lastmod >= args.since) : []).map((e) => e.loc);
  const payload = buildPayload({ baseUrl: config.baseUrl, key, urls: [...chosen, ...args.urls] });
  log(`${payload.urlList.length} URL(s) for ${payload.host}. The key file must answer at https://${payload.host}/${key}.txt`);
  for (const u of payload.urlList) log(`  ${u}`);
  if (!args.send) { log('Dry run: nothing sent. Add --send to post it.'); return { sent: false, payload }; }
  const res = await fetchImpl(args.endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8', 'user-agent': USER_AGENT },
    body: JSON.stringify(payload)
  });
  // 200: received. 202: received, key validation pending. Other codes are documented at https://www.indexnow.org/documentation.
  if (res.status !== 200 && res.status !== 202) throw new Error(`IndexNow answered HTTP ${res.status}`);
  log(`IndexNow answered HTTP ${res.status}.`);
  return { sent: true, status: res.status, payload };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run(process.argv.slice(2)).catch((e) => { console.error(e.message); process.exit(1); });
}
