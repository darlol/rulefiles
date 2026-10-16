import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT, writeFile, todayIso } from './lib/util.mjs';
import { loadData, publishedDigests } from './lib/data.mjs';
import { validateConfig, validateMatrix, validateDigest } from './lib/validate.mjs';
import * as r from './lib/render.mjs';
import { launchWarnings } from './lib/placeholders.mjs';
import { renderOgImage } from './lib/ogimage.mjs';

/**
 * @param {{root?: string, outDir?: string, quiet?: boolean, strict?: boolean}} options
 *   strict makes the build throw, and removes outDir, while any launch placeholder remains.
 */
export function build({ root = ROOT, outDir = path.join(root, 'dist'), quiet = false, strict = false } = {}) {
  const data = loadData(root);
  const today = todayIso();
  const errors = [
    ...validateConfig(data.config),
    ...validateMatrix(data.matrix, data.hosts, today).errors,
    ...data.digests.flatMap((d) => validateDigest(d.data, data.hosts, today, d.file))
  ];
  if (errors.length) throw new Error('Data is invalid, refusing to build:\n' + errors.join('\n'));

  const ctx = { config: data.config, matrix: data.matrix, digests: publishedDigests(data), today };
  fs.rmSync(outDir, { recursive: true, force: true });
  const put = (rel, content) => writeFile(path.join(outDir, rel), content);
  const pages = [];
  const built = [];
  const page = (p, html, lastmod) => {
    built.push({ path: p, html });
    put(p === '/' ? 'index.html' : path.join(p, 'index.html'), html);
    pages.push({ path: p, lastmod });
  };

  const latest = ctx.digests[0];
  page('/', r.homePage(ctx), latest ? latest.verifiedOn : undefined);
  page('/matrix/', r.matrixPage(ctx), ctx.matrix.lastReviewed);
  page('/generator/', r.generatorPage(ctx));
  page('/digest/', r.digestIndexPage(ctx), latest ? latest.verifiedOn : undefined);
  for (const d of ctx.digests) page(`/digest/${d.week}/`, r.digestWeekPage(ctx, d), d.verifiedOn);
  page('/newsletter/', r.newsletterPage(ctx));
  page('/about/', r.contentPage(ctx, path.join(root, 'content', 'about.md'), '/about/'));
  page('/sponsors/', r.contentPage(ctx, path.join(root, 'content', 'sponsors.md'), '/sponsors/'));
  page('/privacy/', r.contentPage(ctx, path.join(root, 'content', 'privacy.md'), '/privacy/'));
  page('/legal/', r.contentPage(ctx, path.join(root, 'content', 'legal.md'), '/legal/'));
  put('404.html', r.notFoundPage(ctx));

  put('digest/feed.xml', r.renderFeed(ctx));
  put('sitemap.xml', r.renderSitemap(ctx.config, pages));
  put('robots.txt', r.renderRobots(ctx.config));
  put('llms.txt', r.renderLlmsTxt(ctx));
  put('llms-full.txt', r.renderLlmsFull(ctx));
  put('_headers', r.renderHeaders(ctx.config));
  put('favicon.svg', r.FAVICON);
  put('og.png', renderOgImage());
  put('data/matrix.json', JSON.stringify(ctx.matrix, null, 2) + '\n');
  put('data/digests.json', JSON.stringify(ctx.digests, null, 2) + '\n');

  // Static assets. generator-core.js is shared with the tests and is copied unchanged.
  fs.mkdirSync(path.join(outDir, 'assets'), { recursive: true });
  for (const f of fs.readdirSync(path.join(root, 'src', 'static'))) {
    fs.copyFileSync(path.join(root, 'src', 'static', f), path.join(outDir, 'assets', f));
  }
  fs.copyFileSync(path.join(root, 'src', 'js', 'generator-core.js'), path.join(outDir, 'assets', 'generator-core.js'));

  const warnings = launchWarnings(built, ctx.config);
  if (strict && warnings.length) {
    fs.rmSync(outDir, { recursive: true, force: true });
    throw new Error(`Strict build failed: ${warnings.length} launch placeholder(s) remain. See docs/LAUNCH-BLOCKERS.md.\n` + warnings.map((w) => `- ${w}`).join('\n'));
  }
  if (!quiet) {
    for (const w of warnings) console.warn(`LAUNCH WARNING: ${w}`);
    if (warnings.length) console.warn(`${warnings.length} launch warning(s). See docs/LAUNCH-BLOCKERS.md. This build is not blocked. The release build uses --strict.`);
  }
  if (!quiet) console.log(`Built ${pages.length} pages into ${outDir} (baseUrl ${ctx.config.baseUrl}, date ${today}).`);
  return { outDir, pages, config: ctx.config, warnings };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // Strict mode: --strict or RULEFILES_STRICT=1 (also true or yes).
  const strict = process.argv.includes('--strict') || /^(1|true|yes)$/i.test(process.env.RULEFILES_STRICT || '');
  try { build({ strict }); } catch (e) { console.error(e.message); process.exit(1); }
}
