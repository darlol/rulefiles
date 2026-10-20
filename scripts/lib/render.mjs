import fs from 'node:fs';
import path from 'node:path';
import { escapeHtml as h, escapeXml as x, daysBetween } from './util.mjs';
import { renderMarkdown, parseFrontmatter } from './markdown.mjs';
import { staleCells, matrixStats } from './validate.mjs';
import { DATA_LICENSE_URL, DATA_ATTRIBUTION } from './license.mjs';
import { RELEASE_URL } from './placeholders.mjs';
import { GENERATOR_PRESETS } from '../../src/js/generator-presets.js';

export const STATUS_LABEL = {
  reads: 'Reads',
  'reads-conditionally': 'Reads, with conditions',
  configurable: 'Only if configured',
  'migration-only': 'Migration only',
  'not-read': 'Not read',
  unverified: 'Unverified'
};
const STATUS_HELP = {
  reads: 'The official page says the tool reads this file.',
  'reads-conditionally': 'The tool reads the file only under the conditions stated in the cell.',
  configurable: 'The tool does not read the file by default but can be set up to.',
  'migration-only': 'The page mentions the file only as input to a migration command such as /init, which copies parts of it into the tool\'s own instruction file. It does not say the tool loads the file itself.',
  'not-read': 'The official page says the tool does not read this file.',
  unverified: 'We could not confirm this on the cited official page on the date shown.'
};
/** Status badge: colour, icon and text together, so the status never depends on colour alone. */
export function statusBadge(status) {
  return `<span class="badge badge-${status}">${icon(status)}${h(STATUS_LABEL[status])}</span>`;
}
export const TOOL_NAME = { cursor: 'Cursor', 'claude-code': 'Claude Code', codex: 'Codex', 'github-copilot': 'GitHub Copilot' };

/** Escapes text for HTML, then turns `code` spans into <code>. The escaping runs first, so no markup can get through. */
export function inlineHtml(text) {
  return h(text).replace(/`([^`\n]+)`/g, '<code>$1</code>');
}

export function url(config, p) { return config.baseUrl + p; }

function newsletterEnabled(config) { return Boolean(config.newsletter && config.newsletter.formAction); }

// Cloudflare Web Analytics (automatic setup of the zone) adds its beacon to the HTML at the edge, so it is never in dist/.
// The script path is versioned (/beacon.min.js/v...), hence the host alone in script-src. The beacon posts to /cdn-cgi/rum on the same origin, hence connect-src 'self'.
// See docs/OPERATIONS.md, section Web Analytics.
function csp(config) {
  const formAction = newsletterEnabled(config) ? `'self' ${new URL(config.newsletter.formAction).origin}` : "'self'";
  return [
    "default-src 'none'",
    "script-src 'self' https://static.cloudflareinsights.com",
    "style-src 'self'",
    "img-src 'self'",
    "font-src 'self'",
    "connect-src 'self'",
    "base-uri 'none'",
    `form-action ${formAction}`
  ].join('; ');
}
export const cspFor = csp;


const ICON_PATHS = {
  reads: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  'reads-conditionally': '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor"/>',
  configurable: '<path d="M4 8h9M17 8h3M4 16h3M11 16h9"/><circle cx="15" cy="8" r="2"/><circle cx="9" cy="16" r="2"/>',
  'migration-only': '<path d="M4 12h11M11 7l5 5-5 5M20 5v14"/>',
  'not-read': '<path d="M6 6l12 12M18 6L6 18"/>',
  unverified: '<circle cx="12" cy="12" r="8.5" stroke-dasharray="3 3"/><path d="M9.7 9.6a2.4 2.4 0 1 1 3.4 2.2c-.8.4-1.1.9-1.1 1.7M12 17h.01"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  warn: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17h.01"/>'
};

/**
 * Inline SVG icon that points at the sprite. layout() adds the sprite to any page whose body uses an icon.
 * width and height are attributes on purpose: an SVG without them fills its container, so an icon would
 * render huge whenever style.css is missing, blocked or an old cached copy. The stylesheet overrides them.
 */
export function icon(name) {
  return `<svg class="ic" width="20" height="20" aria-hidden="true" focusable="false"><use href="#ic-${name}"/></svg>`;
}

function iconSprite() {
  return `<svg class="sprite" width="0" height="0" aria-hidden="true" focusable="false">${Object.entries(ICON_PATHS).map(([k, v]) => `<symbol id="ic-${k}" viewBox="0 0 24 24">${v}</symbol>`).join('')}</svg>`;
}

/** The site mark: a page with one highlighted line. It carries no text, so it survives a rename. */
const MARK = '<svg class="mark" width="32" height="32" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><rect class="m-bg" width="32" height="32" rx="8"/><rect class="m-line" x="7" y="8.5" width="12" height="3.2" rx="1.6" opacity=".6"/><rect class="m-hi" x="7" y="14.4" width="18" height="3.2" rx="1.6"/><rect class="m-line" x="7" y="20.3" width="9" height="3.2" rx="1.6" opacity=".6"/></svg>';

export const THEME_COLOR = { light: '#fafafa', dark: '#0b0c10' };

export function layout(config, page) {
  const canonical = url(config, page.path);
  const title = page.path === '/' ? (config.homeTitle || config.name) : page.bareTitle ? page.title : `${page.title} | ${config.name}`;
  const image = url(config, '/og.png');
  const ld = (page.jsonLd || []).map((o) => `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', ...o }).replace(/</g, '\\u003c')}</script>`).join('\n');
  const nav = [['/matrix/', 'Matrix'], ['/generator/', 'Generator'], ['/digest/', 'Digest'], ['/newsletter/', 'Newsletter'], ['/about/', 'About']]
    .map(([href, label]) => `<a href="${href}"${page.path.startsWith(href) ? ' aria-current="page"' : ''}>${label}</a>`).join('');
  return `<!doctype html>
<html lang="${h(config.language)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${h(csp(config))}">
<title>${h(title)}</title>
<meta name="description" content="${h(page.description)}">
${page.noindex ? '<meta name="robots" content="noindex">\n' : `<link rel="canonical" href="${h(canonical)}">\n`}<meta property="og:type" content="${page.ogType || 'website'}">
<meta property="og:site_name" content="${h(config.name)}">
<meta property="og:title" content="${h(title)}">
<meta property="og:description" content="${h(page.description)}">
${page.noindex ? '' : `<meta property="og:url" content="${h(canonical)}">\n`}<meta property="og:image" content="${h(image)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${h(`${config.name}: ${HERO_TITLE}`)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${h(title)}">
<meta name="twitter:description" content="${h(page.description)}">
<meta name="theme-color" content="${THEME_COLOR.light}" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="${THEME_COLOR.dark}" media="(prefers-color-scheme: dark)">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preload" href="/assets/fonts/hanken-grotesk.woff2" as="font" type="font/woff2" crossorigin>
<link rel="alternate" type="application/atom+xml" title="${h(config.name)} digest" href="/digest/feed.xml">
<link rel="stylesheet" href="/assets/style.css">
${ld}
</head>
<body>
${page.body.includes('href="#ic-') ? iconSprite() + '\n' : ''}<a class="skip" href="#main">Skip to content</a>
<header class="site-header"><div class="wrap">
<a class="brand" href="/">${MARK}<span>${h(config.name)}</span></a>
<nav aria-label="Main">${nav}</nav>
</div></header>
<main id="main" class="wrap">
${page.body}
</main>
<footer class="site-footer"><div class="wrap footer-grid">
<div class="footer-brand">
<a class="brand" href="/">${MARK}<span>${h(config.name)}</span></a>
<p>${h(config.name)} is an independent project, not affiliated with the tools it covers. No cookies. Visits are counted with Cloudflare Web Analytics.</p>
<p class="footer-license">Code under the <a href="/about/">MIT license</a>. Data and text under <a href="${DATA_LICENSE_URL}" rel="license">CC BY 4.0</a>.</p>
</div>
<nav aria-label="Explore"><h2>Explore</h2><ul>
<li><a href="/matrix/">Matrix</a></li>
<li><a href="/generator/">Generator</a></li>
<li><a href="/digest/">Digest</a></li>
<li><a href="/newsletter/">Newsletter</a></li>
<li><a href="/about/">About</a></li>
</ul></nav>
<nav aria-label="Data and legal"><h2>Data and legal</h2><ul>
<li><a href="/digest/feed.xml">Atom feed</a></li>
<li><a href="/llms.txt">llms.txt</a></li>
<li><a href="/data/matrix.json">matrix.json</a></li>
<li><a href="/sponsors/">Sponsors</a></li>
<li><a href="/privacy/">Privacy</a></li>
<li><a href="/legal/">Legal notice</a></li>
</ul></nav>
</div></footer>
${page.script ? `<script type="module" src="${page.script}"></script>` : ''}
</body>
</html>
`;
}

function breadcrumb(config, trail) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: trail.map(([name, p], i) => ({ '@type': 'ListItem', position: i + 1, name, item: url(config, p) }))
  };
}

// The logo is the site mark (favicon.svg), the only logo-like file the project has. It is the same file the header and the share image draw.
const publisher = (config) => ({ '@type': 'Organization', name: config.name, url: config.baseUrl, logo: url(config, '/favicon.svg') });

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-10-07" becomes "7 Oct 2026". The machine-readable date stays in the datetime attribute. */
export function shortDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : iso;
}

/**
 * Accessible name of an item's source link. Several items share one source label, so the name adds the
 * item title to make each link unique out of context. It starts with the visible text, as WCAG 2.5.3 asks.
 */
export function sourceLinkName(it) {
  return `Source: ${it.sourceLabel} — ${String(it.title).replace(/`/g, '')}`;
}

export function itemHtml(it) {
  const version = it.version ? `<span class="tag tag-quiet">version ${h(it.version)}</span>` : '';
  const figure = it.figure ? `<span class="item-figure">${h(it.figure)}</span> ` : '';
  return `<li class="item" id="${h(it.id)}">
<p class="item-top"><time datetime="${h(it.date)}">${h(shortDate(it.date))}</time><span class="tag">${h(TOOL_NAME[it.tool] || it.tool)}</span>${version}</p>
<h3 class="item-title">${inlineHtml(it.title)}</h3>
<p class="item-text">${it.quote === false ? '' : '<span class="muted">Source wording:</span> '}${inlineHtml(it.text)}</p>
<p class="item-foot">${figure}<a class="src" href="${h(it.sourceUrl)}" rel="noopener" aria-label="${h(sourceLinkName(it))}">Source: ${h(it.sourceLabel)}${icon('external')}</a></p>
</li>`;
}

/** The promise on the home page. The share image reuses it. */
export const HERO_TITLE = 'What changed in AI coding tools, with sources.';

export function homePage(ctx) {
  const { config, matrix, digests } = ctx;
  const latest = digests[0];
  const stats = matrixStats(matrix);
  const digestBlock = latest
    ? `<section class="home-section" aria-labelledby="latest"><h2 id="latest">Latest digest</h2>
<p>${`<a href="/digest/${h(latest.week)}/">${h(latest.title)}</a>`}: ${latest.items.length} dated items from official sources.</p>
<ul class="items items-grid">${latest.items.slice(0, 4).map(itemHtml).join('\n')}</ul>
<p class="section-link"><a href="/digest/">All issues</a></p></section>` : '';
  const cellMap = new Map(matrix.cells.map((c) => [`${c.tool}/${c.file}`, c]));
  const tiles = matrix.files.map((f) => matrix.tools.map((t, col) => {
    const c = cellMap.get(`${t.id}/${f.id}`);
    return `<span class="tile tile-${c.status} c${col}">${icon(c.status)}</span>`;
  }).join('')).join('');
  const heads = matrix.tools.map((t) => `<span class="specimen-tool">${h(t.name)}</span>`).join('');
  const statusCounts = Object.keys(STATUS_LABEL).filter((k) => stats.byStatus[k]).map((k) => `<li>${statusBadge(k)} <span class="status-count">${stats.byStatus[k]}</span></li>`).join('');
  const specimenFoot = `${matrix.cells.length} cells, each with an official source and a check date.`;
  const body = `<section class="hero" aria-labelledby="hero-title">
<div class="hero-copy">
<h1 id="hero-title">${h(HERO_TITLE)}</h1>
<p class="lead">${h(config.description)}</p>
<p class="cta"><a class="btn btn-primary" href="/matrix/">Open the matrix${icon('arrow')}</a><a class="btn" href="/generator/">Try the generator</a><a class="btn" href="/digest/">Read the digest</a></p>
</div>
<a class="specimen" href="/matrix/">
<span class="sr">Open the full matrix. Preview of ${matrix.files.length} file types by ${matrix.tools.length} tools.</span>
<span class="specimen-heads" aria-hidden="true">${heads}</span>
<span class="specimen-grid" aria-hidden="true">${tiles}</span>
<span class="specimen-foot">${specimenFoot}</span>
</a>
</section>
${digestBlock}
<section class="home-section" aria-labelledby="matrix"><h2 id="matrix">Which agent reads which file</h2>
<ul class="status-counts" aria-label="Cells by status">${statusCounts}</ul>
<p>The <a href="/matrix/">instruction file matrix</a> covers ${matrix.tools.length} tools and ${matrix.files.length} file types. Each of its ${matrix.cells.length} cells links to an official page and shows the date it was checked. ${stats.unverified} of them are marked unverified because the cited official page does not mention the file, and ${stats.byStatus['migration-only']} are marked migration only. The data was last reviewed on ${h(matrix.lastReviewed)}.</p>
<p>The <a href="/generator/">generator</a> writes a first version of those files from a short form, in your browser.</p></section>
<section class="home-section callout" aria-labelledby="news"><h2 id="news">Newsletter</h2>
${newsletterEnabled(config)
  ? '<p>A weekly email with the digest is open for signup. <a href="/newsletter/">Subscribe</a>. The <a href="/digest/feed.xml">Atom feed</a> carries the same issues.</p>'
  : '<p>A weekly email with the digest is planned. <a href="/newsletter/">Signup status</a>. The <a href="/digest/feed.xml">Atom feed</a> works today.</p>'}</section>`;
  return layout(config, {
    path: '/', title: config.name, description: config.description, body,
    jsonLd: [{ '@type': 'WebSite', name: config.name, url: config.baseUrl, description: config.description, inLanguage: config.language, publisher: publisher(config) }]
  });
}

// Sentences shared by the matrix and the reference pages, so the explanation of the two special statuses is written once.
export const UNVERIFIED_MEANING = 'A cell reads "unverified" when the page we checked does not mention the file.';
export const NO_SOURCE_SENTENCE = 'We then have no source, which says nothing about whether the tool reads it.';
export const MIGRATION_MEANING = 'A cell reads "migration only" when the page mentions the file only as input to a migration command such as /init.';

/** The "How to cite" block of the matrix, reused on the reference pages. */
function citeBlock(config, matrix) {
  return `<h2 id="cite">How to cite</h2>
<p>The data and the text are under <a href="${DATA_LICENSE_URL}" rel="license">CC BY 4.0</a>. Credit the project, link the license, and say what you changed. A cell is a dated reading of an official page, so give the date of the cell, which is shown on it, or the date the matrix was last reviewed.</p>
<p>Suggested credit: "${h(config.name)} data by ${h(DATA_ATTRIBUTION)}, ${h(config.baseUrl)}/matrix/, last reviewed ${h(matrix.lastReviewed)}, licensed under CC BY 4.0 (${h(DATA_LICENSE_URL)})."</p>
<p class="muted">Quoted excerpts of the sources belong to their authors. Link the official page of the cell when you rely on it.</p>`;
}

/** The newest verifiedOn of a list of cells: the date the page built from them last changed. */
export function latestCheck(cells) {
  return cells.map((c) => c.verifiedOn).sort().at(-1);
}

export function matrixPage(ctx) {
  const { config, matrix, today } = ctx;
  const stale = new Set(staleCells(matrix, today, config.staleAfterDays).map((c) => `${c.tool}/${c.file}`));
  const cellMap = new Map(matrix.cells.map((c) => [`${c.tool}/${c.file}`, c]));
  const head = matrix.tools.map((t) => `<th scope="col" data-tool="${h(t.id)}"><a href="${h(t.docsUrl)}" rel="noopener">${h(t.name)}</a>${t.scope ? `<span class="muted block">${h(t.scope)}</span>` : ''}</th>`).join('');
  const rows = matrix.files.map((f) => {
    const cells = matrix.tools.map((t) => {
      const c = cellMap.get(`${t.id}/${f.id}`);
      const isStale = stale.has(`${t.id}/${f.id}`);
      return `<td class="st-${c.status}" data-tool="${h(t.id)}" data-file="${h(f.id)}" data-status="${c.status}"><div class="cell">
<p class="cell-status">${statusBadge(c.status)}${c.version ? ` <span class="muted">from v${h(c.version)}</span>` : ''}</p>
<p class="note">${inlineHtml(c.note)}</p>
<p class="cell-foot"><a class="src" href="${h(c.sourceUrl)}" rel="noopener" aria-label="Source — ${h(f.path)} × ${h(t.name)}">Source${icon('external')}</a><span class="muted">checked <time datetime="${h(c.verifiedOn)}">${h(c.verifiedOn)}</time></span>${isStale ? `<strong class="stale">${icon('warn')}check again</strong>` : ''}</p></div></td>`;
    }).join('');
    return `<tr data-file="${h(f.id)}"><th scope="row"><a href="/files/${h(f.id)}/"><code>${h(f.path)}</code></a><span class="muted block">${h(f.description)}</span></th>${cells}</tr>`;
  }).join('\n');
  const legend = Object.keys(STATUS_LABEL).map((k) => `<li>${statusBadge(k)}<span>${h(STATUS_HELP[k])}</span></li>`).join('');
  const counts = Object.keys(STATUS_LABEL).map((k) => `${STATUS_LABEL[k]}: ${matrix.cells.filter((c) => c.status === k).length}`).join(', ');
  const toolChips = matrix.tools.map((t) => `<button type="button" class="chip" aria-pressed="false" data-filter-tool="${h(t.id)}">${h(t.name)}</button>`).join('');
  const statusChips = Object.keys(STATUS_LABEL).map((k) => `<button type="button" class="chip chip-${k}" aria-pressed="false" data-filter-status="${k}">${icon(k)}${h(STATUS_LABEL[k])}<span class="chip-count">${matrix.cells.filter((c) => c.status === k).length}</span></button>`).join('');
  const filters = `<div class="filters" id="matrix-filters" hidden>
<fieldset class="filter-group"><legend>Tools</legend><div class="chips">${toolChips}</div></fieldset>
<fieldset class="filter-group"><legend>Status</legend><div class="chips">${statusChips}</div></fieldset>
<div class="filter-foot"><p id="matrix-count" class="muted" role="status" aria-live="polite"></p><button type="button" class="btn btn-quiet" data-filter-reset disabled>Reset filters</button></div>
</div>`;
  const body = `<h1>Which coding agent reads which instruction file</h1>
<p class="lead">${matrix.tools.length} tools, ${matrix.files.length} file types, ${matrix.cells.length} cells. Last reviewed ${h(matrix.lastReviewed)}.</p>
<p class="intro">Each cell cites an official page and the date we checked it. ${h(UNVERIFIED_MEANING)} ${h(NO_SOURCE_SENTENCE)} ${h(MIGRATION_MEANING)} Counts: ${h(counts)}.</p>
${filters}
<p class="scroll-hint muted">Scroll sideways to see every tool. The file column stays in place.</p>
<div class="table-wrap" tabindex="0" role="region" aria-label="Instruction file matrix"><table class="matrix">
<caption class="sr">Instruction files by tool, with source and check date per cell</caption>
<thead><tr><th scope="col"><a href="/files/">File</a></th>${head}</tr></thead>
<tbody>
${rows}
</tbody></table></div>
<h2>Legend</h2>
<ul class="legend">${legend}</ul>
<h2>Data</h2>
<p>The same data is published as <a href="/data/matrix.json">matrix.json</a>. Need a starting file? Use the <a href="/generator/">generator</a>.</p>
<p>Each file type also has <a href="/files/">its own page</a>, and the cells marked unverified are listed on <a href="/unverified/">one page</a>.</p>
${citeBlock(config, matrix)}
<p class="muted">GitHub Copilot cells describe repository custom instructions on GitHub.com. Editor-specific behavior can differ and is not covered here.</p>`;
  const sources = [...new Set(matrix.tools.map((t) => t.docsUrl))];
  return layout(config, {
    path: '/matrix/', title: 'Which coding agent reads which instruction file',
    description: `Matrix of ${matrix.tools.length} AI coding tools and ${matrix.files.length} instruction file types, with an official source and a check date for each cell.`,
    body, script: '/assets/matrix.js',
    jsonLd: [
      { '@type': 'Dataset', name: 'Instruction files read by AI coding agents', description: `Which of ${matrix.files.length} instruction file types each of ${matrix.tools.length} AI coding tools reads, with source URL and check date per cell.`, url: url(config, '/matrix/'), dateModified: matrix.lastReviewed, inLanguage: config.language, license: DATA_LICENSE_URL, isBasedOn: sources, distribution: [{ '@type': 'DataDownload', encodingFormat: 'application/json', contentUrl: url(config, '/data/matrix.json') }], creator: publisher(config) },
      breadcrumb(config, [['Home', '/'], ['Matrix', '/matrix/']])
    ]
  });
}

// ---------- Reference pages, built from data/matrix.json only ----------

/** <title> and h1 of the page of one instruction file. */
export function filePageTitle(file) { return `Which coding agents read ${file.path}?`; }

function cellsOfFile(matrix, file) {
  return matrix.tools.map((t) => ({ tool: t, cell: matrix.cells.find((c) => c.tool === t.id && c.file === file.id) }));
}

function statusCounts(cells) {
  return Object.keys(STATUS_LABEL).filter((k) => cells.some((c) => c.status === k))
    .map((k) => `<li>${statusBadge(k)} <span class="status-count">${cells.filter((c) => c.status === k).length}</span></li>`).join('');
}

export function filePage(ctx, file) {
  const { config, matrix } = ctx;
  const rows = cellsOfFile(matrix, file);
  const title = filePageTitle(file);
  const pagePath = `/files/${file.id}/`;
  const tr = rows.map(({ tool, cell }) => `<tr data-tool="${h(tool.id)}"><th scope="row">${h(tool.name)}${tool.scope ? `<span class="muted block">${h(tool.scope)}</span>` : ''}</th>
<td class="cell st-${cell.status}"><p class="cell-status">${statusBadge(cell.status)}${cell.version ? ` <span class="muted">from v${h(cell.version)}</span>` : ''}</p></td>
<td class="cell note-col"><p class="note">${inlineHtml(cell.note)}</p></td>
<td class="cell"><p class="cell-foot"><a class="src" href="${h(cell.sourceUrl)}" rel="noopener" aria-label="Source — ${h(file.path)} × ${h(tool.name)}">Source${icon('external')}</a></p></td>
<td class="cell"><time datetime="${h(cell.verifiedOn)}">${h(cell.verifiedOn)}</time></td></tr>`).join('\n');
  const others = matrix.files.filter((f) => f.id !== file.id).map((f) => `<li><a href="/files/${h(f.id)}/"><code>${h(f.path)}</code></a></li>`).join('');
  const toolNames = listNames(matrix.tools.map((t) => t.name));
  const body = `<h1>${h(title).replace(/\//g, '/<wbr>')}</h1>
<p class="lead">${h(file.description)}</p>
<p class="intro">${h(UNVERIFIED_MEANING)} ${h(NO_SOURCE_SENTENCE)} ${h(MIGRATION_MEANING)}</p>
<ul class="status-counts" aria-label="Tools by status">${statusCounts(rows.map((r) => r.cell))}</ul>
<div class="table-wrap" tabindex="0" role="region" aria-label="${h(file.path)} by tool"><table class="matrix ref">
<caption class="sr">${h(file.path)}: status, note, official source and check date for each tool</caption>
<thead><tr><th scope="col">Tool</th><th scope="col">Status</th><th scope="col">Note</th><th scope="col">Official source</th><th scope="col">Checked</th></tr></thead>
<tbody>
${tr}
</tbody></table></div>
<h2>Data</h2>
<p>These rows come from the <a href="/matrix/">instruction file matrix</a>, also published as <a href="/data/matrix.json">matrix.json</a>. Cells marked unverified are listed on <a href="/unverified/">one page</a>.</p>
<h2 id="other-files">Other instruction files</h2>
<ul>${others}</ul>
<p><a href="/files/">All instruction file pages</a></p>
${citeBlock(config, matrix)}
<h2 id="newsletter">Newsletter</h2>
${newsletterForm(config)}`;
  const modified = latestCheck(rows.map((r) => r.cell));
  return layout(config, {
    path: pagePath, title, bareTitle: true, ogType: 'article',
    description: `Which of ${toolNames} read ${file.path}, with an official source and a check date for each tool.`,
    body,
    jsonLd: [
      { '@type': 'TechArticle', headline: title, description: file.description, dateModified: modified, inLanguage: config.language, license: DATA_LICENSE_URL, author: publisher(config), publisher: publisher(config), mainEntityOfPage: url(config, pagePath), isBasedOn: url(config, '/data/matrix.json'), citation: [...new Set(rows.map((r) => r.cell.sourceUrl))] },
      breadcrumb(config, [['Home', '/'], ['Matrix', '/matrix/'], [file.path, pagePath]])
    ]
  });
}

export function filesIndexPage(ctx) {
  const { config, matrix } = ctx;
  const list = matrix.files.map((f) => {
    const cells = matrix.cells.filter((c) => c.file === f.id);
    return `<li class="issue">
<h2 class="issue-title"><a href="/files/${h(f.id)}/"><code>${h(f.path)}</code></a></h2>
<p class="muted">${h(f.description)}</p>
<ul class="status-counts" aria-label="${h(f.path)}: tools by status">${statusCounts(cells)}</ul>
</li>`;
  }).join('\n');
  const body = `<h1>Instruction files</h1>
<p class="lead">One page per file type, built from the <a href="/matrix/">matrix</a>: ${matrix.files.length} file types, ${matrix.tools.length} tools.</p>
<ul class="archive">${list}</ul>
<p>Cells marked unverified are listed on <a href="/unverified/">one page</a>.</p>`;
  return layout(config, {
    path: '/files/', title: 'Instruction files',
    description: `One page for each of the ${matrix.files.length} instruction file types in the matrix, with the status, official source and check date for each of ${matrix.tools.length} AI coding tools.`,
    body,
    jsonLd: [
      { '@type': 'CollectionPage', name: `${config.name} instruction files`, url: url(config, '/files/'), dateModified: latestCheck(matrix.cells), mainEntity: { '@type': 'ItemList', itemListElement: matrix.files.map((f, i) => ({ '@type': 'ListItem', position: i + 1, url: url(config, `/files/${f.id}/`), name: filePageTitle(f) })) } },
      breadcrumb(config, [['Home', '/'], ['Matrix', '/matrix/'], ['Instruction files', '/files/']])
    ]
  });
}

export function unverifiedPage(ctx) {
  const { config, matrix } = ctx;
  const toolOf = Object.fromEntries(matrix.tools.map((t) => [t.id, t]));
  const cells = matrix.files.flatMap((f) => matrix.tools.map((t) => matrix.cells.find((c) => c.tool === t.id && c.file === f.id)))
    .filter((c) => c && c.status === 'unverified');
  const fileOf = Object.fromEntries(matrix.files.map((f) => [f.id, f]));
  const rows = cells.map((c) => `<tr data-tool="${h(c.tool)}" data-file="${h(c.file)}"><th scope="row">${h(toolOf[c.tool].name)}</th>
<td class="cell file-col"><a href="/files/${h(c.file)}/"><code>${h(fileOf[c.file].path)}</code></a></td>
<td class="cell"><p class="cell-foot"><a class="src" href="${h(c.sourceUrl)}" rel="noopener">${h(c.sourceUrl.replace(/^https:\/\//, ''))}${icon('external')}</a></p></td>
<td class="cell"><time datetime="${h(c.verifiedOn)}">${h(c.verifiedOn)}</time></td></tr>`).join('\n');
  const title = 'What the cited official pages don\'t say';
  const body = `<h1>${h(title)}</h1>
<p class="lead">${h(UNVERIFIED_MEANING)} ${h(NO_SOURCE_SENTENCE)}</p>
<div class="table-wrap" tabindex="0" role="region" aria-label="Unverified cells"><table class="matrix ref">
<caption class="sr">${cells.length} unverified cells: tool, file, cited page and check date</caption>
<thead><tr><th scope="col">Tool</th><th scope="col">File</th><th scope="col">Cited page</th><th scope="col">Checked</th></tr></thead>
<tbody>
${rows}
</tbody></table></div>
<p>The full data is in the <a href="/matrix/">matrix</a> and in <a href="/data/matrix.json">matrix.json</a>.</p>`;
  return layout(config, {
    path: '/unverified/', title,
    description: `${cells.length} cells of the instruction file matrix that the cited official page does not confirm, with the page and the check date.`,
    body,
    jsonLd: [
      { '@type': 'WebPage', name: title, url: url(config, '/unverified/'), inLanguage: config.language, ...(cells.length ? { dateModified: latestCheck(cells) } : {}) },
      breadcrumb(config, [['Home', '/'], ['Matrix', '/matrix/'], ['Unverified', '/unverified/']])
    ]
  });
}

function listNames(names) {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** Sentence about who reads AGENTS.md, built only from matrix cells that cite a source. */
export function agentsMdSentence(matrix) {
  const nameOf = Object.fromEntries(matrix.tools.map((t) => [t.id, t.name]));
  const of = (status) => matrix.cells.filter((c) => c.file === 'agents-md' && c.status === status).map((c) => nameOf[c.tool]);
  const reads = of('reads');
  const cond = of('reads-conditionally');
  if (!reads.length && !cond.length) return '';
  const parts = [];
  if (reads.length) parts.push(`${listNames(reads)} read${reads.length === 1 ? 's' : ''} it`);
  if (cond.length) parts.push(`${listNames(cond)} read${cond.length === 1 ? 's' : ''} it under the conditions given in the matrix`);
  return `According to the <a href="/matrix/">matrix</a>, ${parts.join(', and ')}.`;
}

/**
 * New visible text of the generator: hints, presets and the usage steps. Kept in one place so the
 * content review can read it, and so tests/generator-page.test.mjs can check that each line is on the page.
 */
export const GENERATOR_COPY = {
  presetsLabel: 'Start from an example:',
  clear: 'Clear the form',
  hints: {
    projectName: 'Becomes the title of the file.',
    description: 'What the project does, in one sentence. It goes right under the title.',
    stack: 'Languages, frameworks and main tools, with versions when they matter.',
    commands: 'The exact commands the agent should run. Leave a field empty to skip it.',
    rules: 'Each list becomes its own section. Leave a list empty to skip it.',
    always: 'What the agent should do on every task.',
    askFirst: 'What the agent must ask you about before doing it.',
    never: 'Hard limits the agent must not cross.',
    pr: 'How to write commit messages and pull requests.',
    cursorGlobs: 'With globs, Cursor attaches the rule when a matching file is in context. Without globs, the rule always applies.'
  },
  steps: [
    'Save `AGENTS.md` at the root of your repository and commit it.',
    'Save each extra file at the path shown in its title, relative to the repository root.',
    'Start a new agent session. The matrix shows which tool reads which file.'
  ]
};
export function generatorPage(ctx) {
  const { config, matrix } = ctx;
  // Each field has a hint that says what it is for and a placeholder with a concrete example.
  const field = (id, label, hint, rows, example) => {
    const ph = example ? ` placeholder="${h(`e.g. ${example}`).replace(/\n/g, '&#10;')}"` : '';
    const describedBy = hint ? ` aria-describedby="${id}-hint"` : '';
    return `<div class="field"><label for="${id}">${label}</label>${hint ? `<span class="muted block" id="${id}-hint">${hint}</span>` : ''}${rows ? `<textarea id="${id}" name="${id}" rows="${rows}"${describedBy}${ph}></textarea>` : `<input id="${id}" name="${id}" type="text" autocomplete="off"${describedBy}${ph}>`}</div>`;
  };
  // The preset buttons are in the page from the start, disabled until the script runs, so showing them moves nothing.
  const presets = GENERATOR_PRESETS.map((p) => `<button type="button" class="chip" data-preset="${h(p.id)}" disabled>${h(p.label)}</button>`).join('');
  const body = `<h1>Instruction file generator</h1>
<p class="lead">Fill in the form and copy the files. Everything runs in your browser. Nothing is sent or stored.</p>
<noscript><p><strong>This page needs JavaScript to generate files.</strong> The <a href="/matrix/">matrix</a> works without it.</p></noscript>
<div class="gen">
<form id="gen-form" class="gen-form" autocomplete="off">
<div class="gen-presets" id="gen-presets" role="group" aria-labelledby="gen-presets-label"><span id="gen-presets-label">${h(GENERATOR_COPY.presetsLabel)}</span><div class="chips">${presets}<button type="button" class="btn-quiet chip" data-preset="clear" disabled>${h(GENERATOR_COPY.clear)}</button></div></div>
<fieldset><legend>Project</legend>
${field('projectName', 'Project name', GENERATOR_COPY.hints.projectName, 0, 'my-app')}
${field('description', 'One-line description', GENERATOR_COPY.hints.description, 0, 'Web app for booking meeting rooms, built with Next.js.')}
${field('stack', 'Stack', `${GENERATOR_COPY.hints.stack} One item per line.`, 3, 'TypeScript\nNext.js 15\nPostgreSQL')}
</fieldset>
<fieldset><legend>Commands</legend>
<p class="muted">${h(GENERATOR_COPY.hints.commands)}</p>
${field('installCmd', 'Install', '', 0, 'npm ci')}${field('devCmd', 'Run in development', '', 0, 'npm run dev')}${field('buildCmd', 'Build', '', 0, 'npm run build')}${field('testCmd', 'Test', '', 0, 'npm test')}${field('lintCmd', 'Lint', '', 0, 'npm run lint')}
</fieldset>
<fieldset><legend>Rules</legend>
<p class="muted">${h(GENERATOR_COPY.hints.rules)}</p>
${field('style', 'Code style', 'One rule per line.', 3, 'Use TypeScript strict mode\nPrefer named exports')}
${field('architecture', 'Project layout', 'One line per directory or module.', 3, 'src/app/: pages and routes\nsrc/lib/: shared code')}
${field('always', 'Always', h(GENERATOR_COPY.hints.always), 2, 'Run npm test before you finish a task')}
${field('askFirst', 'Ask first', h(GENERATOR_COPY.hints.askFirst), 2, 'Adding a dependency')}
${field('never', 'Never', h(GENERATOR_COPY.hints.never), 2, 'Commit secrets or .env files')}
${field('pr', 'Commits and pull requests', h(GENERATOR_COPY.hints.pr), 2, 'Use Conventional Commits: feat:, fix:, docs:')}
</fieldset>
<fieldset><legend>Files to generate</legend>
<p class="muted">AGENTS.md is the main file and is always generated. ${agentsMdSentence(matrix)} Add the files below only for tools that need their own.</p>
<p>Optional extra files:</p>
<div id="gen-targets"></div>
<div class="gen-opt" data-option-for="claude-md"><span id="claude-mode-label">CLAUDE.md content</span>
<label class="check"><input type="radio" name="claudeMode" value="import" checked> Import AGENTS.md with <code>@AGENTS.md</code></label>
<label class="check"><input type="radio" name="claudeMode" value="full"> Full copy of the instructions</label></div>
<div class="gen-opt field" data-option-for="cursor-mdc"><label for="cursorGlobs">Cursor rule globs</label><span class="muted block" id="cursorGlobs-hint">Leave empty for none. Example: <code>src/**/*.ts</code> ${h(GENERATOR_COPY.hints.cursorGlobs)}</span><input id="cursorGlobs" name="cursorGlobs" type="text" aria-describedby="cursorGlobs-hint"></div>
<div class="gen-opt field" data-option-for="copilot-path"><label for="copilotApplyTo">Copilot applyTo glob</label><span class="muted block" id="copilotApplyTo-hint">Used for the path-specific file. Default: <code>**</code></span><input id="copilotApplyTo" name="copilotApplyTo" type="text" aria-describedby="copilotApplyTo-hint"></div>
</fieldset>
</form>
<div class="gen-out" aria-live="polite"><h2>Output</h2>
<ol class="gen-steps">${GENERATOR_COPY.steps.map((t) => `<li>${inlineHtml(t).replace('The matrix', '<a href="/matrix/">The matrix</a>')}</li>`).join('')}</ol>
<div id="gen-output"></div></div>
</div>
<p class="muted">Which tool reads which file is in the <a href="/matrix/">matrix</a>. Check it before you rely on a file.</p>`;
  return layout(config, {
    path: '/generator/', title: 'Instruction file generator',
    description: 'Generate AGENTS.md, CLAUDE.md, Cursor rules and GitHub Copilot instructions from one short form. Runs in your browser; nothing is sent or stored.',
    body, script: '/assets/generator.js',
    jsonLd: [
      { '@type': 'WebApplication', name: `${config.name} instruction file generator`, url: url(config, '/generator/'), applicationCategory: 'DeveloperApplication', operatingSystem: 'Any', browserRequirements: 'Requires JavaScript', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } },
      breadcrumb(config, [['Home', '/'], ['Generator', '/generator/']])
    ]
  });
}

export function digestIndexPage(ctx) {
  const { config, digests } = ctx;
  const list = digests.map((d, i) => {
    const tools = [...new Set(d.items.map((it) => it.tool))].filter((t) => TOOL_NAME[t]).map((t) => `<span class="tag">${h(TOOL_NAME[t])}</span>`).join('');
    return `<li class="issue">
<p class="issue-week"><time datetime="${h(d.start)}">${h(shortDate(d.start))}</time> to <time datetime="${h(d.end)}">${h(shortDate(d.end))}</time>${i === 0 ? '<span class="tag tag-mark">Latest</span>' : ''}</p>
<h2 class="issue-title"><a class="stretch" href="/digest/${h(d.week)}/">${h(d.title)}</a></h2>
<p class="issue-meta muted">${d.items.length} dated items, checked ${h(shortDate(d.verifiedOn))}</p>
<p class="issue-tools">${tools}</p>
</li>`;
  }).join('\n');
  const body = `<h1>Digest archive</h1>
<p class="lead">One page per ISO week. Each item has a date and a link to the official page it came from.</p>
<ul class="archive">${list}</ul>
<p>Subscribe with the <a href="/digest/feed.xml">Atom feed</a>. Email signup is described on the <a href="/newsletter/">newsletter page</a>.</p>`;
  return layout(config, {
    path: '/digest/', title: 'Digest archive', description: 'Weekly digest of dated changes in Cursor, Claude Code, Codex and GitHub Copilot, each linked to its official source.', body,
    jsonLd: [
      ...(digests.length ? [{ '@type': 'Dataset', name: 'Weekly digest of changes in AI coding tools', description: `${digests.reduce((n, d) => n + d.items.length, 0)} dated changes in Cursor, Claude Code, Codex and GitHub Copilot over ${digests.length} weeks, each with a source URL, a date and a short quote of the source.`, url: url(config, '/digest/'), dateModified: digests[0].verifiedOn, temporalCoverage: `${digests[digests.length - 1].start}/${digests[0].end}`, inLanguage: config.language, license: DATA_LICENSE_URL, isBasedOn: [...new Set(digests.flatMap((d) => d.items.map((i) => i.sourceUrl)))], distribution: [{ '@type': 'DataDownload', encodingFormat: 'application/json', contentUrl: url(config, '/data/digests.json') }], creator: publisher(config) }] : []),
      { '@type': 'CollectionPage', name: `${config.name} digest archive`, url: url(config, '/digest/'), mainEntity: { '@type': 'ItemList', itemListElement: digests.map((d, i) => ({ '@type': 'ListItem', position: i + 1, url: url(config, `/digest/${d.week}/`), name: d.title })) } },
      breadcrumb(config, [['Home', '/'], ['Digest', '/digest/']])
    ]
  });
}

export function digestWeekPage(ctx, digest) {
  const { config } = ctx;
  const sorted = [...digest.items].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.id < b.id ? -1 : 1));
  const byTool = Object.keys(TOOL_NAME).map((t) => ({ t, items: sorted.filter((i) => i.tool === t) })).filter((g) => g.items.length);
  const sections = byTool.map((g) => `<section aria-labelledby="t-${g.t}"><h2 id="t-${g.t}">${h(TOOL_NAME[g.t])} <span class="count">${g.items.length}</span></h2><ul class="items items-rail">${g.items.map(itemHtml).join('\n')}</ul></section>`).join('\n');
  const body = `<h1>${h(digest.title)}</h1>
<p class="lead">${h(digest.week)}, <time class="nw" datetime="${h(digest.start)}">${h(shortDate(digest.start))}</time> to <time class="nw" datetime="${h(digest.end)}">${h(shortDate(digest.end))}</time>. Checked against the sources on <time class="nw" datetime="${h(digest.verifiedOn)}">${h(shortDate(digest.verifiedOn))}</time>.</p>
<p class="summary">${inlineHtml(digest.summary)}</p>
${sections}
<p class="back"><a href="/digest/">Back to the archive</a></p>`;
  const cites = [...new Set(digest.items.map((i) => i.sourceUrl))];
  return layout(config, {
    path: `/digest/${digest.week}/`, title: digest.title, description: `${digest.items.length} dated changes in ${byTool.map((g) => TOOL_NAME[g.t]).join(', ')} for ${digest.week}, each linked to its official source.`, ogType: 'article', body,
    jsonLd: [
      { '@type': 'Article', headline: digest.title, datePublished: digest.verifiedOn, dateModified: digest.verifiedOn, inLanguage: config.language, license: DATA_LICENSE_URL, author: publisher(config), publisher: publisher(config), mainEntityOfPage: url(config, `/digest/${digest.week}/`), citation: cites },
      breadcrumb(config, [['Home', '/'], ['Digest', '/digest/'], [digest.week, `/digest/${digest.week}/`]])
    ]
  });
}

export function contentPage(ctx, file, pagePath) {
  const { config, matrix } = ctx;
  const parsed = parseFrontmatter(fs.readFileSync(file, 'utf8'));
  const { meta } = parsed;
  // With no repoUrl, a line that would link the repository is left out rather than rendered with an empty link.
  const body = config.repoUrl ? parsed.body : parsed.body.split('\n').filter((l) => !l.includes('{{repoUrl}}')).join('\n');
  const nl = (present, future) => (newsletterEnabled(config) ? present : future);
  const vars = {
    unverified: matrixStats(matrix).unverified,
    migrationOnly: matrixStats(matrix).byStatus['migration-only'],
    cells: matrix.cells.length,
    lastReviewed: matrix.lastReviewed,
    siteUrl: config.baseUrl,
    licenseUrl: DATA_LICENSE_URL,
    attribution: DATA_ATTRIBUTION,
    contactEmail: config.contactEmail,
    privacyEmail: config.privacyEmail,
    dataStatus: newsletterEnabled(config) ? 'collected' : 'planned',
    // Statements of fact about the newsletter are in the future while the form is closed, since nothing is sent or recorded yet.
    nlRecords: nl('Our provider also records the IP address and referrer-level details of your signup.', 'Once the signup is open, our provider will also record the IP address and referrer-level details of each signup.'),
    nlCarries: nl('Every email carries an unsubscribe link.', 'Every email will carry an unsubscribe link.'),
    nlProviderRole: nl('sends the emails and stores the list on our behalf', 'will send the emails and store the list on our behalf'),
    nlHostedPages: nl('The signup and confirmation pages are hosted by Buttondown, and its own policies apply to them.', 'The signup and confirmation pages will be hosted by Buttondown, and its own policies will apply to them.'),
    nlNoTracking: nl('Our emails carry no tracking pixel, and the links to other pages are not rewritten.', 'Our emails will carry no tracking pixel, and the links to other pages will not be rewritten.'),
    newsletterIntro: newsletterEnabled(config)
      ? 'This section describes what applies when you subscribe.'
      : 'The signup form is switched off until the newsletter opens. This section describes what will apply once it is on.',
    sponsorContact: config.sponsorContact,
    hostName: config.host.name,
    hostAddress: config.host.address,
    hostPhone: config.host.phone,
    // The public repository is linked from the About page only. Its label is the address without the scheme.
    repoUrl: config.repoUrl || '',
    repoLabel: (config.repoUrl || '').replace(/^https:\/\//, '')
  };
  const type = pagePath === '/about/' ? 'AboutPage' : 'WebPage';
  // A page can carry `updated: YYYY-MM-DD` in its front matter. The date is shown at the foot of the page.
  if (meta.updated !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(meta.updated)) throw new Error(`${path.basename(file)}: "updated" must be a date written YYYY-MM-DD, got "${meta.updated}"`);
  const updated = meta.updated ? `<p class="muted page-updated">Last updated: <time datetime="${meta.updated}">${meta.updated}</time></p>` : '';
  // The description takes the same {{variables}} as the body.
  const description = meta.description === undefined ? undefined : String(meta.description).replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
  return layout(config, {
    path: pagePath, title: meta.title, description, body: `<div class="prose">${renderMarkdown(body, vars)}${updated}</div>`,
    jsonLd: [{ '@type': type, name: meta.title, url: url(config, pagePath), description, inLanguage: config.language, ...(meta.updated ? { dateModified: meta.updated } : {}) }, breadcrumb(config, [['Home', '/'], [meta.title, pagePath]])]
  });
}

/** The signup form of the newsletter page, open or switched off. The reference pages carry the same form. */
function newsletterForm(config) {
  const nl = config.newsletter;
  const enabled = newsletterEnabled(config);
  const hidden = Object.entries(nl.hiddenFields || {}).map(([k, v]) => `<input type="hidden" name="${h(k)}" value="${h(v)}">`).join('');
  const form = enabled
    ? `<form class="nl-form" method="${h(nl.method || 'post')}" action="${h(nl.formAction)}">
<label for="nl-email">Email address</label>
<input id="nl-email" name="${h(nl.emailFieldName || 'email')}" type="email" required autocomplete="email">
${hidden}
<p class="muted">Submitting sends your address to the newsletter provider. You will get a confirmation email first (double opt-in). See <a href="/privacy/">Privacy</a>.</p>
<button type="submit">Subscribe</button>
</form>`
    : `<form class="nl-form" aria-disabled="true">
<label for="nl-email">Email address</label>
<input id="nl-email" name="email" type="email" disabled aria-describedby="nl-status">
<button type="button" disabled>Subscribe</button>
<p id="nl-status" class="notice" role="status">${icon('warn')}<span>Signup is switched off until the publication. Nothing can be submitted or sent.</span></p>
</form>`;
  return form;
}

export function newsletterPage(ctx) {
  const { config } = ctx;
  const enabled = newsletterEnabled(config);
  const form = newsletterForm(config);
  const body = `<div class="prose">
<h1>Newsletter</h1>
<p class="lead">The weekly digest by email, sent through Buttondown.</p>
${form}
<p>${enabled ? 'The' : 'Until the publication, the'} <a href="/digest/feed.xml">Atom feed</a> carries every issue, and the <a href="/digest/">archive</a> has them all.</p>
<h2>How signup ${enabled ? 'works' : 'will work'}</h2>
<ul>
<li>One email per week with the digest. No other mailings.</li>
<li>Double opt-in and a one-click unsubscribe link in every email.</li>
<li>No tracking of opens or clicks.</li>
<li>The <a href="/privacy/">privacy page</a> names the provider, says who is responsible for your data and how to reach them.</li>
</ul>
</div>`;
  return layout(config, {
    path: '/newsletter/', title: 'Newsletter', description: enabled
      ? 'Weekly email digest of what changed in AI coding tools. Sign up by email, or follow the Atom feed.'
      : 'Weekly email digest of what changed in AI coding tools. Signup is switched off until the publication; the Atom feed works now.', body,
    jsonLd: [{ '@type': 'WebPage', name: 'Newsletter', url: url(config, '/newsletter/'), description: 'Weekly email digest signup page.', inLanguage: config.language }, breadcrumb(config, [['Home', '/'], ['Newsletter', '/newsletter/']])]
  });
}

export function notFoundPage(ctx) {
  const { config } = ctx;
  return layout(config, {
    path: '/404.html', title: 'Page not found', description: 'This page does not exist.', noindex: true,
    body: `<div class="prose"><h1>Page not found</h1><p>Try the <a href="/matrix/">matrix</a>, the <a href="/digest/">digest archive</a> or the <a href="/">home page</a>.</p></div>`
  });
}

export function renderFeed(ctx) {
  const { config, digests } = ctx;
  const updated = digests.length ? digests[0].verifiedOn : '1970-01-01';
  const entries = digests.map((d) => {
    const content = `<ul>${d.items.map((i) => `<li>${h(i.date)} ${h(TOOL_NAME[i.tool])}: ${inlineHtml(i.title)}. ${inlineHtml(i.text)} <a href="${h(i.sourceUrl)}">${h(i.sourceLabel)}</a></li>`).join('')}</ul>`;
    return `  <entry>
    <title>${x(d.title)}</title>
    <id>tag:${new URL(config.baseUrl).hostname},2026:digest/${x(d.week)}</id>
    <link rel="alternate" type="text/html" href="${x(url(config, `/digest/${d.week}/`))}"/>
    <published>${d.verifiedOn}T00:00:00Z</published>
    <updated>${d.verifiedOn}T00:00:00Z</updated>
    <author><name>${x(config.name)}</name></author>
    <summary>${x(d.summary)}</summary>
    <content type="html">${x(content)}</content>
  </entry>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="${x(config.language)}">
  <title>${x(config.name)} digest</title>
  <subtitle>${x(config.tagline)}</subtitle>
  <id>${x(url(config, '/digest/feed.xml'))}</id>
  <link rel="self" type="application/atom+xml" href="${x(url(config, '/digest/feed.xml'))}"/>
  <link rel="alternate" type="text/html" href="${x(url(config, '/digest/'))}"/>
  <updated>${updated}T00:00:00Z</updated>
  <author><name>${x(config.name)}</name></author>
${entries}
</feed>
`;
}

export function renderSitemap(config, pages) {
  const urls = pages.map((p) => `  <url><loc>${x(url(config, p.path))}</loc>${p.lastmod ? `<lastmod>${p.lastmod}</lastmod>` : ''}</url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

export function renderRobots(config) {
  return `User-agent: *
Allow: /

Sitemap: ${url(config, '/sitemap.xml')}
`;
}

export function renderLlmsTxt(ctx) {
  const { config, matrix, digests } = ctx;
  const lines = [
    `# ${config.name}`,
    '',
    `> ${config.description}`,
    '',
    'Every digest item and matrix cell links to an official source and carries a date. Cells marked "unverified" were not confirmed on the cited page, and cells marked "migration only" are mentioned there only as input to a migration command. Pages are plain HTML without cookies. Their only third-party script is Cloudflare Web Analytics, which measures visits and page load performance.',
    '',
    '## Data',
    '',
    `- [Instruction file matrix](${url(config, '/matrix/')}): which of ${matrix.tools.length} tools reads which of ${matrix.files.length} instruction files, last reviewed ${matrix.lastReviewed}`,
    `- [matrix.json](${url(config, '/data/matrix.json')}): the same matrix as JSON`,
    `- [digests.json](${url(config, '/data/digests.json')}): all digest issues as JSON`,
    `- [llms-full.txt](${url(config, '/llms-full.txt')}): matrix and digests as one Markdown file`,
    `- [License](${DATA_LICENSE_URL}): the data and the text are CC BY 4.0, credit "${DATA_ATTRIBUTION}" and link ${url(config, '/')}; quoted excerpts belong to their authors; the code is MIT`,
    '',
    '## Instruction files',
    '',
    `- [Instruction files](${url(config, '/files/')}): one page per file type, built from the matrix`,
    ...matrix.files.map((f) => `- [${filePageTitle(f)}](${url(config, `/files/${f.id}/`)}): ${f.description}`),
    `- [What the cited official pages don't say](${url(config, '/unverified/')}): the ${matrix.cells.filter((c) => c.status === 'unverified').length} cells marked unverified, with the cited page and the check date`,
    '',
    '## Digest',
    '',
    ...digests.map((d) => `- [${d.title}](${url(config, `/digest/${d.week}/`)}): ${d.items.length} dated items, checked ${d.verifiedOn}`),
    `- [Atom feed](${url(config, '/digest/feed.xml')}): every issue`,
    '',
    '## Tools',
    '',
    `- [Instruction file generator](${url(config, '/generator/')}): builds AGENTS.md, CLAUDE.md, Cursor rules and Copilot instructions in the browser`,
    '',
    '## Optional',
    '',
    `- [About](${url(config, '/about/')}): method and limits`,
    `- [Privacy](${url(config, '/privacy/')}): no cookies; visits counted with Cloudflare Web Analytics`,
    `- [Sponsors](${url(config, '/sponsors/')}): sponsorship policy`,
    `- [Legal notice](${url(config, '/legal/')}): publisher, host and contact`,
    ''
  ];
  return lines.join('\n');
}

export function renderLlmsFull(ctx) {
  const { config, matrix, digests } = ctx;
  const toolName = Object.fromEntries(matrix.tools.map((t) => [t.id, t.name]));
  const fileById = Object.fromEntries(matrix.files.map((f) => [f.id, f]));
  const out = [`# ${config.name}: full content`, '', `> ${config.description}`, '', `Matrix last reviewed ${matrix.lastReviewed}. Source: ${url(config, '/matrix/')}`, '', `File pages: ${url(config, '/files/')}. Unverified cells: ${url(config, '/unverified/')}`, '', '## Instruction file matrix', ''];
  for (const f of matrix.files) {
    out.push(`### ${f.path}`, '', f.description, '', `Page: ${url(config, `/files/${f.id}/`)}`, '');
    for (const t of matrix.tools) {
      const c = matrix.cells.find((x) => x.tool === t.id && x.file === f.id);
      out.push(`- ${toolName[t.id]}: ${STATUS_LABEL[c.status]}. ${c.note} Source: ${c.sourceUrl} (checked ${c.verifiedOn})`);
    }
    out.push('');
  }
  out.push('## Digest', '');
  for (const d of digests) {
    out.push(`### ${d.title} (${d.week})`, '', d.summary, '');
    for (const i of [...d.items].sort((a, b) => (a.date < b.date ? -1 : 1))) {
      out.push(`- ${i.date}, ${TOOL_NAME[i.tool]}, ${i.title}${i.version ? ` (version ${i.version})` : ''}: ${i.text} Source: ${i.sourceUrl}`);
    }
    out.push('');
  }
  void fileById;
  return out.join('\n');
}

/** HSTS lasts 180 days, with no includeSubDomains and no preload, and is sent only by the release host (see docs/OPERATIONS.md). */
export const HSTS = 'max-age=15552000';

export function renderHeaders(config) {
  // An absolute https rule matches that host only (Cloudflare Pages `_headers`), so www.rulefiles.dev and any preview host never get the header.
  const hsts = config.baseUrl === RELEASE_URL ? `${config.baseUrl}/*\n  Strict-Transport-Security: ${HSTS}\n` : '';
  return `/*
  Content-Security-Policy: ${csp(config)}
  X-Content-Type-Options: nosniff
  Referrer-Policy: same-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()
/assets/*
  Cache-Control: public, max-age=0, must-revalidate
${hsts}`;
}

export const FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><style>.b{fill:#4338ca}.l{fill:#fff}@media (prefers-color-scheme:dark){.b{fill:#a5b4fc}.l{fill:#0b0c10}}</style><rect class="b" width="32" height="32" rx="8"/><rect class="l" x="7" y="8.5" width="12" height="3.2" rx="1.6" opacity=".6"/><rect fill="#ffe066" x="7" y="14.4" width="18" height="3.2" rx="1.6"/><rect class="l" x="7" y="20.3" width="9" height="3.2" rx="1.6" opacity=".6"/></svg>
`;

export { path, daysBetween };
