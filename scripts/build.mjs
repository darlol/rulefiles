import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT, writeFile, todayIso } from './lib/util.mjs';
import { loadData, publishedDigests } from './lib/data.mjs';
import { validateConfig, validateMatrix, validateDigest } from './lib/validate.mjs';
import * as r from './lib/render.mjs';
import { launchWarnings, releaseProblems } from './lib/placeholders.mjs';
import { renderOgImage } from './lib/ogimage.mjs';
import { parseFrontmatter } from './lib/markdown.mjs';

/**
 * @param {{root?: string, outDir?: string, quiet?: boolean, strict?: boolean}} options
 *   strict makes the build throw, and removes outDir, while any launch placeholder remains or the base URL is not the release address.
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
  // lastmod is the date the content changed, never the build date: the digest check date, the matrix review date, the `updated` date
  // in the front matter of a content page, or the date set in `pageUpdated` of site.config.json for the pages made by code.
  const pageUpdated = ctx.config.pageUpdated || {};
  const contentDate = (file, p) => parseFrontmatter(fs.readFileSync(path.join(root, 'content', file), 'utf8')).meta.updated || pageUpdated[p];
  page('/', r.homePage(ctx), latest ? latest.verifiedOn : undefined);
  page('/matrix/', r.matrixPage(ctx), ctx.matrix.lastReviewed);
  // The reference pages change only when a cell is checked again, so their lastmod is the newest verifiedOn of the cells they show.
  page('/files/', r.filesIndexPage(ctx), r.latestCheck(ctx.matrix.cells));
  for (const f of ctx.matrix.files) page(`/files/${f.id}/`, r.filePage(ctx, f), r.latestCheck(ctx.matrix.cells.filter((c) => c.file === f.id)));
  const unverified = ctx.matrix.cells.filter((c) => c.status === 'unverified');
  page('/unverified/', r.unverifiedPage(ctx), unverified.length ? r.latestCheck(unverified) : ctx.matrix.lastReviewed);
  page('/generator/', r.generatorPage(ctx), pageUpdated['/generator/']);
  page('/digest/', r.digestIndexPage(ctx), latest ? latest.verifiedOn : undefined);
  for (const d of ctx.digests) page(`/digest/${d.week}/`, r.digestWeekPage(ctx, d), d.verifiedOn);
  page('/newsletter/', r.newsletterPage(ctx), pageUpdated['/newsletter/']);
  page('/about/', r.contentPage(ctx, path.join(root, 'content', 'about.md'), '/about/'), contentDate('about.md', '/about/'));
  page('/sponsors/', r.contentPage(ctx, path.join(root, 'content', 'sponsors.md'), '/sponsors/'), contentDate('sponsors.md', '/sponsors/'));
  page('/privacy/', r.contentPage(ctx, path.join(root, 'content', 'privacy.md'), '/privacy/'), contentDate('privacy.md', '/privacy/'));
  page('/legal/', r.contentPage(ctx, path.join(root, 'content', 'legal.md'), '/legal/'), contentDate('legal.md', '/legal/'));
  put('404.html', r.notFoundPage(ctx));

  put('digest/feed.xml', r.renderFeed(ctx));
  // The data files and the feed are listed too, with the date of the data they hold.
  const latestDate = latest ? latest.verifiedOn : undefined;
  const sitemapEntries = [...pages, { path: '/data/matrix.json', lastmod: ctx.matrix.lastReviewed }, { path: '/data/digests.json', lastmod: latestDate }, { path: '/digest/feed.xml', lastmod: latestDate }];
  put('sitemap.xml', r.renderSitemap(ctx.config, sitemapEntries));
  put('robots.txt', r.renderRobots(ctx.config));
  put('llms.txt', r.renderLlmsTxt(ctx));
  put('llms-full.txt', r.renderLlmsFull(ctx));
  put('_headers', r.renderHeaders(ctx.config));
  // IndexNow ownership file: https://<host>/<key>.txt holds the key. The key is public by design.
  if (ctx.config.indexNowKey) put(`${ctx.config.indexNowKey}.txt`, ctx.config.indexNowKey);
  put('favicon.svg', r.FAVICON);
  put('og.png', renderOgImage({ name: ctx.config.name, title: r.HERO_TITLE, caption: `${ctx.matrix.cells.length} cells, each with an official source and a check date.`, matrix: ctx.matrix }));
  put('data/matrix.json', JSON.stringify(ctx.matrix, null, 2) + '\n');
  put('data/digests.json', JSON.stringify(ctx.digests, null, 2) + '\n');

  // Static assets. generator-core.js, generator-presets.js and matrix-filter.js are shared with the tests and are copied unchanged.
  fs.mkdirSync(path.join(outDir, 'assets'), { recursive: true });
  fs.cpSync(path.join(root, 'src', 'static'), path.join(outDir, 'assets'), { recursive: true });
  for (const f of ['generator-core.js', 'generator-presets.js', 'matrix-filter.js']) fs.copyFileSync(path.join(root, 'src', 'js', f), path.join(outDir, 'assets', f));

  const warnings = launchWarnings(built, ctx.config);
  const problems = strict ? [...warnings, ...releaseProblems(ctx.config)] : [];
  if (problems.length) {
    fs.rmSync(outDir, { recursive: true, force: true });
    throw new Error(`Strict build failed: ${problems.length} launch problem(s) remain. See docs/LAUNCH-BLOCKERS.md.\n` + problems.map((w) => `- ${w}`).join('\n'));
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
