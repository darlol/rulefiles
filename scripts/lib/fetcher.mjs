import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { parseRobots, isAllowed } from './robots.mjs';

export const PRODUCT_TOKEN = 'RulefilesWatch';
export const DEFAULT_USER_AGENT = `${PRODUCT_TOKEN}/0.1 (changelog watcher; honest bot; see repository README)`;
/** Largest response a source may use by default, and the ceiling no source can raise (the `maxBytes` of a source in data/watch-sources.json). */
export const DEFAULT_MAX_BYTES = 5_000_000;
export const HARD_MAX_BYTES = 25_000_000;
const MAX_REDIRECTS = 4;
const MAX_ROBOTS_REDIRECTS = 5; // RFC 9309 section 2.3.1.2: follow at least five consecutive redirects
const REDIRECT_STATUSES = [301, 302, 303, 307, 308];

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 24);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class RobotsError extends Error {}

/**
 * Polite fetcher: robots.txt check, honest User-Agent, per-request delay, on-disk cache with
 * conditional requests, and a minimum interval so repeated runs do not hit the network.
 */
export function createFetcher({
  cacheDir,
  userAgent = DEFAULT_USER_AGENT,
  delayMs = 1500,
  minIntervalMs = 6 * 3600 * 1000,
  robotsTtlMs = 24 * 3600 * 1000,
  fetchImpl = globalThis.fetch,
  now = () => Date.now(),
  sleepImpl = sleep
} = {}) {
  fs.mkdirSync(cacheDir, { recursive: true });
  let lastNetworkAt = null;
  const stats = { network: 0, cacheHits: 0, notModified: 0 };

  async function network(url, headers = {}) {
    const wait = lastNetworkAt + delayMs - now();
    if (lastNetworkAt !== null && wait > 0) await sleepImpl(wait);
    lastNetworkAt = now();
    stats.network += 1;
    const h = { 'user-agent': userAgent, accept: '*/*', ...headers };
    if (process.env.GITHUB_TOKEN && new URL(url).hostname === 'api.github.com') h.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    return fetchImpl(url, { headers: h, redirect: 'manual', signal: AbortSignal.timeout(20000) });
  }

  async function robotsFor(origin) {
    const file = path.join(cacheDir, `robots-${sha(origin)}.json`);
    if (fs.existsSync(file)) {
      const c = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (now() - c.fetchedAt < robotsTtlMs) return parseRobots(c.body);
    }
    // RFC 9309: 2xx is parsed, 3xx is followed (up to five hops), other 4xx means no restrictions.
    // 429 and 5xx mean the file is temporarily unavailable, so nothing is fetched from that host.
    let current = origin + '/robots.txt';
    let res;
    for (let hop = 0; ; hop++) {
      if (new URL(current).protocol !== 'https:') throw new RobotsError(`robots.txt of ${origin} redirected to a non-https URL; skipping`);
      res = await network(current);
      const location = REDIRECT_STATUSES.includes(res.status) ? res.headers.get('location') : null;
      if (!location) break;
      if (hop >= MAX_ROBOTS_REDIRECTS) throw new RobotsError(`robots.txt of ${origin} redirected more than ${MAX_ROBOTS_REDIRECTS} times; skipping`);
      current = new URL(location, current).href;
    }
    if (res.status === 429 || res.status >= 500) throw new RobotsError(`robots.txt of ${origin} returned ${res.status}; skipping`);
    if (REDIRECT_STATUSES.includes(res.status)) throw new RobotsError(`robots.txt of ${origin} returned a redirect without a location; skipping`);
    const body = res.status >= 200 && res.status < 300 ? (await res.text()).slice(0, 500_000) : '';
    fs.writeFileSync(file, JSON.stringify({ origin, fetchedAt: now(), status: res.status, body }));
    return parseRobots(body);
  }

  async function get(url, { maxBytes } = {}) {
    const limit = Number.isInteger(maxBytes) && maxBytes > 0 ? Math.min(maxBytes, HARD_MAX_BYTES) : DEFAULT_MAX_BYTES;
    const file = path.join(cacheDir, `page-${sha(url)}.json`);
    let cached = null;
    if (fs.existsSync(file)) {
      cached = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (now() - cached.fetchedAt < minIntervalMs) { stats.cacheHits += 1; return { status: 200, body: cached.body, fromCache: true }; }
    }
    const cond = {};
    if (cached && cached.etag) cond['if-none-match'] = cached.etag;
    else if (cached && cached.lastModified) cond['if-modified-since'] = cached.lastModified;
    // Redirects are followed by hand so that robots.txt is checked for every host we visit.
    let current = url;
    let res;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const u = new URL(current);
      if (u.protocol !== 'https:') throw new Error(`${current} is not https`);
      const groups = await robotsFor(u.origin);
      if (!isAllowed(groups, PRODUCT_TOKEN, u.pathname + u.search)) throw new RobotsError(`robots.txt of ${u.origin} disallows ${u.pathname}`);
      res = await network(current, cond);
      if ([301, 302, 303, 307, 308].includes(res.status) && res.headers.get('location')) {
        current = new URL(res.headers.get('location'), current).href;
        if (hop === MAX_REDIRECTS) throw new Error(`${url} redirected more than ${MAX_REDIRECTS} times`);
        continue;
      }
      break;
    }
    if (res.status === 304 && cached) {
      stats.notModified += 1;
      fs.writeFileSync(file, JSON.stringify({ ...cached, fetchedAt: now() }));
      return { status: 200, body: cached.body, fromCache: true };
    }
    if (res.status !== 200) throw new Error(`${url} returned HTTP ${res.status}`);
    const len = Number(res.headers.get('content-length') || 0);
    const tooLarge = () => new Error(`${url} is larger than ${limit} bytes (set maxBytes on the source in data/watch-sources.json, at most ${HARD_MAX_BYTES})`);
    if (len > limit) throw tooLarge();
    const body = await res.text();
    if (Buffer.byteLength(body) > limit) throw tooLarge();
    fs.writeFileSync(file, JSON.stringify({ url, finalUrl: current, fetchedAt: now(), etag: res.headers.get('etag'), lastModified: res.headers.get('last-modified'), body }));
    return { status: 200, body, fromCache: false };
  }

  return { get, stats };
}
