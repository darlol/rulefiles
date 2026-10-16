import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT, listFiles } from './lib/util.mjs';
import { loadConfig } from './lib/data.mjs';

const LINK = /\b(?:href|src)="([^"]+)"/g;

/** Internal link check on a built directory. Returns {errors, external}. */
export function checkInternal(distDir) {
  const errors = [];
  const external = new Set();
  const htmlFiles = listFiles(distDir).filter((f) => f.endsWith('.html'));
  const idsByFile = new Map();
  const idsOf = (file) => {
    if (!idsByFile.has(file)) idsByFile.set(file, new Set([...fs.readFileSync(file, 'utf8').matchAll(/\bid="([^"]+)"/g)].map((m) => m[1])));
    return idsByFile.get(file);
  };
  const resolve = (p) => {
    const clean = p.split('#')[0].split('?')[0];
    const candidates = [path.join(distDir, clean)];
    if (clean.endsWith('/')) candidates.unshift(path.join(distDir, clean, 'index.html'));
    return candidates.find((c) => fs.existsSync(c) && fs.statSync(c).isFile());
  };
  for (const file of htmlFiles) {
    const html = fs.readFileSync(file, 'utf8');
    const rel = path.relative(distDir, file);
    for (const m of html.matchAll(LINK)) {
      const link = m[1].replace(/&amp;/g, '&');
      if (/^https?:\/\//.test(link)) { external.add(link); continue; }
      if (/^(mailto:|tel:|data:|javascript:)/.test(link)) continue;
      if (link.startsWith('#')) {
        if (!idsOf(file).has(link.slice(1))) errors.push(`${rel}: missing anchor ${link}`);
        continue;
      }
      if (!link.startsWith('/')) { errors.push(`${rel}: relative link ${link} (use root-relative links)`); continue; }
      const target = resolve(link);
      if (!target) { errors.push(`${rel}: broken link ${link}`); continue; }
      const hash = link.split('#')[1];
      if (hash && target.endsWith('.html') && !idsOf(target).has(hash)) errors.push(`${rel}: missing anchor ${link}`);
    }
  }
  return { errors, external: [...external].sort() };
}

async function checkExternal(urls, { delayMs = 1000 } = {}) {
  const bad = [];
  for (const u of urls) {
    try {
      let res = await fetch(u, { method: 'HEAD', redirect: 'follow', headers: { 'user-agent': 'RulefilesLinkCheck/0.1' }, signal: AbortSignal.timeout(20000) });
      if (res.status === 405 || res.status === 403) res = await fetch(u, { method: 'GET', redirect: 'follow', headers: { 'user-agent': 'RulefilesLinkCheck/0.1' }, signal: AbortSignal.timeout(20000) });
      console.log(`${res.status} ${u}`);
      if (res.status >= 400) bad.push(`${res.status} ${u}`);
    } catch (e) {
      console.log(`ERR ${u} ${e.message}`);
      bad.push(`ERR ${u}`);
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return bad;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dist = path.join(ROOT, 'dist');
  if (!fs.existsSync(dist)) { console.error('dist/ not found. Run npm run build first.'); process.exit(1); }
  const { errors, external: all } = checkInternal(dist);
  // URLs on the site's own base URL are not external; they are covered by the internal check.
  const base = loadConfig().baseUrl;
  const external = all.filter((u) => !u.startsWith(base + '/') && u !== base);
  console.log(`Checked internal links in dist/. ${external.length} distinct external URLs.`);
  let failed = errors;
  if (process.argv.includes('--external')) {
    // Only the official source URLs from the data, one request each with a delay.
    const bad = await checkExternal(external);
    failed = failed.concat(bad);
  }
  if (failed.length) { console.error(failed.join('\n')); process.exit(1); }
  console.log('Link check passed.');
}
