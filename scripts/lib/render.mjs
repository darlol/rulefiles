import fs from 'node:fs';
import path from 'node:path';
import { escapeHtml as h, escapeXml as x, daysBetween } from './util.mjs';
import { renderMarkdown, parseFrontmatter } from './markdown.mjs';
import { staleCells, matrixStats } from './validate.mjs';

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
export const TOOL_NAME = { cursor: 'Cursor', 'claude-code': 'Claude Code', codex: 'Codex', 'github-copilot': 'GitHub Copilot' };

/** Escapes text for HTML, then turns `code` spans into <code>. The escaping runs first, so no markup can get through. */
export function inlineHtml(text) {
  return h(text).replace(/`([^`\n]+)`/g, '<code>$1</code>');
}

export function url(config, p) { return config.baseUrl + p; }

function newsletterEnabled(config) { return Boolean(config.newsletter && config.newsletter.formAction); }

function csp(config) {
  const formAction = newsletterEnabled(config) ? `'self' ${new URL(config.newsletter.formAction).origin}` : "'self'";
  return [
    "default-src 'none'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self'",
    "connect-src 'none'",
    "base-uri 'none'",
    `form-action ${formAction}`
  ].join('; ');
}
export const cspFor = csp;

export function layout(config, page) {
  const canonical = url(config, page.path);
  const title = page.path === '/' ? (config.homeTitle || config.name) : `${page.title} | ${config.name}`;
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
<meta property="og:image:alt" content="${h(config.name)} logo">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="alternate" type="application/atom+xml" title="${h(config.name)} digest" href="/digest/feed.xml">
<link rel="stylesheet" href="/assets/style.css">
${ld}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="site-header"><div class="wrap">
<a class="brand" href="/">${h(config.name)}</a>
<nav aria-label="Main">${nav}</nav>
</div></header>
<main id="main" class="wrap">
${page.body}
</main>
<footer class="site-footer"><div class="wrap">
<p>${h(config.name)} is an independent project, not affiliated with the tools it covers. No cookies, no trackers.</p>
<p><a href="/digest/feed.xml">Atom feed</a> · <a href="/llms.txt">llms.txt</a> · <a href="/data/matrix.json">matrix.json</a> · <a href="/sponsors/">Sponsors</a> · <a href="/privacy/">Privacy</a></p>
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

const publisher = (config) => ({ '@type': 'Organization', name: config.name, url: config.baseUrl });

export function itemHtml(it) {
  const meta = [it.version ? `version ${h(it.version)}` : '', it.figure ? h(it.figure) : ''].filter(Boolean).join(' · ');
  return `<li class="item" id="${h(it.id)}">
<p class="item-head"><time datetime="${h(it.date)}">${h(it.date)}</time> <span class="tag">${h(TOOL_NAME[it.tool] || it.tool)}</span> <strong>${inlineHtml(it.title)}</strong></p>
<p class="item-text">${it.quote === false ? '' : '<span class="muted">Source wording:</span> '}${inlineHtml(it.text)}</p>
<p class="item-meta">${meta ? `${meta} · ` : ''}Source: <a href="${h(it.sourceUrl)}" rel="noopener">${h(it.sourceLabel)}</a></p>
</li>`;
}

export function homePage(ctx) {
  const { config, matrix, digests } = ctx;
  const latest = digests[0];
  const stats = matrixStats(matrix);
  const digestBlock = latest
    ? `<section aria-labelledby="latest"><h2 id="latest">Latest digest</h2>
<p><a href="/digest/${h(latest.week)}/">${h(latest.title)}</a>: ${latest.items.length} dated items from official sources.</p>
<ul class="items">${latest.items.slice(0, 4).map(itemHtml).join('\n')}</ul>
<p><a href="/digest/">All issues</a></p></section>` : '';
  const body = `<h1>${h(config.name)}</h1>
<p class="lead">${h(config.tagline)}</p>
<p>${h(config.description)}</p>
${digestBlock}
<section aria-labelledby="matrix"><h2 id="matrix">Which agent reads which file</h2>
<p>The <a href="/matrix/">instruction file matrix</a> covers ${matrix.tools.length} tools and ${matrix.files.length} file types. Each of its ${matrix.cells.length} cells links to an official page and shows the date it was checked. ${stats.unverified} of them are marked unverified because the cited official page does not mention the file, and ${stats.byStatus['migration-only']} are marked migration only. The data was last reviewed on ${h(matrix.lastReviewed)}.</p>
<p>The <a href="/generator/">generator</a> writes a first version of those files from a short form, in your browser.</p></section>
<section aria-labelledby="news"><h2 id="news">Newsletter</h2>
<p>A weekly email with the digest is planned. <a href="/newsletter/">Signup status</a>. The <a href="/digest/feed.xml">Atom feed</a> works today.</p></section>`;
  return layout(config, {
    path: '/', title: config.name, description: config.description, body,
    jsonLd: [{ '@type': 'WebSite', name: config.name, url: config.baseUrl, description: config.description, inLanguage: config.language, publisher: publisher(config) }]
  });
}

export function matrixPage(ctx) {
  const { config, matrix, today } = ctx;
  const stale = new Set(staleCells(matrix, today, config.staleAfterDays).map((c) => `${c.tool}/${c.file}`));
  const cellMap = new Map(matrix.cells.map((c) => [`${c.tool}/${c.file}`, c]));
  const head = matrix.tools.map((t) => `<th scope="col"><a href="${h(t.docsUrl)}" rel="noopener">${h(t.name)}</a>${t.scope ? `<span class="muted block">${h(t.scope)}</span>` : ''}</th>`).join('');
  const rows = matrix.files.map((f) => {
    const cells = matrix.tools.map((t) => {
      const c = cellMap.get(`${t.id}/${f.id}`);
      const isStale = stale.has(`${t.id}/${f.id}`);
      return `<td class="st-${c.status}"><span class="badge badge-${c.status}">${h(STATUS_LABEL[c.status])}</span>${c.version ? ` <span class="muted">from v${h(c.version)}</span>` : ''}
<p class="note">${inlineHtml(c.note)}</p>
<p class="muted"><a href="${h(c.sourceUrl)}" rel="noopener">Source</a> · checked <time datetime="${h(c.verifiedOn)}">${h(c.verifiedOn)}</time>${isStale ? ' · <strong>check again</strong>' : ''}</p></td>`;
    }).join('');
    return `<tr><th scope="row"><code>${h(f.path)}</code><span class="muted block">${h(f.description)}</span></th>${cells}</tr>`;
  }).join('\n');
  const legend = Object.keys(STATUS_LABEL).map((k) => `<li><span class="badge badge-${k}">${h(STATUS_LABEL[k])}</span> ${h(STATUS_HELP[k])}</li>`).join('');
  const counts = Object.keys(STATUS_LABEL).map((k) => `${STATUS_LABEL[k]}: ${matrix.cells.filter((c) => c.status === k).length}`).join(', ');
  const body = `<h1>Which coding agent reads which instruction file</h1>
<p class="lead">${matrix.tools.length} tools, ${matrix.files.length} file types, ${matrix.cells.length} cells. Last reviewed ${h(matrix.lastReviewed)}.</p>
<p>Each cell cites an official page and the date we checked it. A cell reads "unverified" when the page we checked does not mention the file. We then have no source, which says nothing about whether the tool reads it. A cell reads "migration only" when the page mentions the file only as input to a migration command such as /init. Counts: ${h(counts)}.</p>
<div class="table-wrap" tabindex="0" role="region" aria-label="Instruction file matrix"><table class="matrix">
<caption class="sr">Instruction files by tool, with source and check date per cell</caption>
<thead><tr><th scope="col">File</th>${head}</tr></thead>
<tbody>
${rows}
</tbody></table></div>
<h2>Legend</h2>
<ul class="legend">${legend}</ul>
<h2>Data</h2>
<p>The same data is published as <a href="/data/matrix.json">matrix.json</a>. Need a starting file? Use the <a href="/generator/">generator</a>.</p>
<p class="muted">GitHub Copilot cells describe repository custom instructions on GitHub.com. Editor-specific behavior can differ and is not covered here.</p>`;
  const sources = [...new Set(matrix.tools.map((t) => t.docsUrl))];
  return layout(config, {
    path: '/matrix/', title: 'Which coding agent reads which instruction file',
    description: `Matrix of ${matrix.tools.length} AI coding tools and ${matrix.files.length} instruction file types, with an official source and a check date for each cell.`,
    body,
    jsonLd: [
      { '@type': 'Dataset', name: 'Instruction files read by AI coding agents', description: `Which of ${matrix.files.length} instruction file types each of ${matrix.tools.length} AI coding tools reads, with source URL and check date per cell.`, url: url(config, '/matrix/'), dateModified: matrix.lastReviewed, inLanguage: config.language, isBasedOn: sources, distribution: [{ '@type': 'DataDownload', encodingFormat: 'application/json', contentUrl: url(config, '/data/matrix.json') }], creator: publisher(config) },
      breadcrumb(config, [['Home', '/'], ['Matrix', '/matrix/']])
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

export function generatorPage(ctx) {
  const { config, matrix } = ctx;
  const field = (id, label, hint, rows) => `<div class="field"><label for="${id}">${label}</label>${hint ? `<span class="muted block">${hint}</span>` : ''}${rows ? `<textarea id="${id}" name="${id}" rows="${rows}"></textarea>` : `<input id="${id}" name="${id}" type="text" autocomplete="off">`}</div>`;
  const body = `<h1>Instruction file generator</h1>
<p class="lead">Fill in the form and copy the files. Everything runs in your browser. Nothing is sent or stored.</p>
<noscript><p><strong>This page needs JavaScript to generate files.</strong> The <a href="/matrix/">matrix</a> works without it.</p></noscript>
<div class="gen">
<form id="gen-form" class="gen-form" autocomplete="off">
<fieldset><legend>Project</legend>
${field('projectName', 'Project name', '', 0)}
${field('description', 'One-line description', '', 0)}
${field('stack', 'Stack', 'One item per line.', 3)}
</fieldset>
<fieldset><legend>Commands</legend>
${field('installCmd', 'Install', '', 0)}${field('devCmd', 'Run in development', '', 0)}${field('buildCmd', 'Build', '', 0)}${field('testCmd', 'Test', '', 0)}${field('lintCmd', 'Lint', '', 0)}
</fieldset>
<fieldset><legend>Rules</legend>
${field('style', 'Code style', 'One rule per line.', 3)}
${field('architecture', 'Project layout', 'One line per directory or module.', 3)}
${field('always', 'Always', '', 2)}
${field('askFirst', 'Ask first', '', 2)}
${field('never', 'Never', '', 2)}
${field('pr', 'Commits and pull requests', '', 2)}
</fieldset>
<fieldset><legend>Files to generate</legend>
<div id="gen-main"></div>
<p class="muted">AGENTS.md is the main file and is always generated. ${agentsMdSentence(matrix)} Add the files below only for tools that need their own.</p>
<p>Optional extra files:</p>
<div id="gen-targets"></div>
</fieldset>
<fieldset><legend>Options</legend>
<div class="field"><span id="claude-mode-label">CLAUDE.md content</span>
<label class="check"><input type="radio" name="claudeMode" value="import" checked> Import AGENTS.md with <code>@AGENTS.md</code></label>
<label class="check"><input type="radio" name="claudeMode" value="full"> Full copy of the instructions</label></div>
<div class="field"><label for="cursorGlobs">Cursor rule globs</label><span class="muted block">Leave empty for none. Example: <code>src/**/*.ts</code></span><input id="cursorGlobs" name="cursorGlobs" type="text"></div>
<label class="check"><input type="checkbox" name="cursorAlwaysApply" checked> Cursor rule: always apply</label>
<div class="field"><label for="copilotApplyTo">Copilot applyTo glob</label><span class="muted block">Used for the path-specific file. Default: <code>**</code></span><input id="copilotApplyTo" name="copilotApplyTo" type="text"></div>
</fieldset>
</form>
<div class="gen-out" aria-live="polite"><h2>Output</h2><div id="gen-output"></div></div>
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
  const list = digests.map((d) => `<li><a href="/digest/${h(d.week)}/">${h(d.title)}</a> <span class="muted">${d.items.length} items, checked ${h(d.verifiedOn)}</span></li>`).join('\n');
  const body = `<h1>Digest archive</h1>
<p class="lead">One page per ISO week. Each item has a date and a link to the official page it came from.</p>
<ul class="archive">${list}</ul>
<p>Subscribe with the <a href="/digest/feed.xml">Atom feed</a>. Email signup is described on the <a href="/newsletter/">newsletter page</a>.</p>`;
  return layout(config, {
    path: '/digest/', title: 'Digest archive', description: 'Weekly digest of dated changes in Cursor, Claude Code, Codex and GitHub Copilot, each linked to its official source.', body,
    jsonLd: [
      { '@type': 'CollectionPage', name: `${config.name} digest archive`, url: url(config, '/digest/'), mainEntity: { '@type': 'ItemList', itemListElement: digests.map((d, i) => ({ '@type': 'ListItem', position: i + 1, url: url(config, `/digest/${d.week}/`), name: d.title })) } },
      breadcrumb(config, [['Home', '/'], ['Digest', '/digest/']])
    ]
  });
}

export function digestWeekPage(ctx, digest) {
  const { config } = ctx;
  const sorted = [...digest.items].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.id < b.id ? -1 : 1));
  const byTool = Object.keys(TOOL_NAME).map((t) => ({ t, items: sorted.filter((i) => i.tool === t) })).filter((g) => g.items.length);
  const sections = byTool.map((g) => `<section aria-labelledby="t-${g.t}"><h2 id="t-${g.t}">${h(TOOL_NAME[g.t])}</h2><ul class="items">${g.items.map(itemHtml).join('\n')}</ul></section>`).join('\n');
  const body = `<h1>${h(digest.title)}</h1>
<p class="lead">${h(digest.week)}, ${h(digest.start)} to ${h(digest.end)}. Checked against the sources on ${h(digest.verifiedOn)}.</p>
<p>${inlineHtml(digest.summary)}</p>
${sections}
<p><a href="/digest/">Back to the archive</a></p>`;
  const cites = [...new Set(digest.items.map((i) => i.sourceUrl))];
  return layout(config, {
    path: `/digest/${digest.week}/`, title: digest.title, description: `${digest.items.length} dated changes in ${byTool.map((g) => TOOL_NAME[g.t]).join(', ')} for ${digest.week}, each linked to its official source.`, ogType: 'article', body,
    jsonLd: [
      { '@type': 'Article', headline: digest.title, datePublished: digest.verifiedOn, dateModified: digest.verifiedOn, inLanguage: config.language, author: publisher(config), publisher: publisher(config), mainEntityOfPage: url(config, `/digest/${digest.week}/`), citation: cites },
      breadcrumb(config, [['Home', '/'], ['Digest', '/digest/'], [digest.week, `/digest/${digest.week}/`]])
    ]
  });
}

export function contentPage(ctx, file, pagePath) {
  const { config, matrix } = ctx;
  const { meta, body } = parseFrontmatter(fs.readFileSync(file, 'utf8'));
  const vars = {
    unverified: matrixStats(matrix).unverified,
    migrationOnly: matrixStats(matrix).byStatus['migration-only'],
    cells: matrix.cells.length,
    lastReviewed: matrix.lastReviewed,
    sponsorContact: config.sponsorContact ? `Contact: ${config.sponsorContact}` : 'A contact address for sponsorship questions will be listed here when sponsorship opens.'
  };
  const type = pagePath === '/about/' ? 'AboutPage' : 'WebPage';
  return layout(config, {
    path: pagePath, title: meta.title, description: meta.description, body: renderMarkdown(body, vars),
    jsonLd: [{ '@type': type, name: meta.title, url: url(config, pagePath), description: meta.description, inLanguage: config.language }, breadcrumb(config, [['Home', '/'], [meta.title, pagePath]])]
  });
}

export function newsletterPage(ctx) {
  const { config } = ctx;
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
<p id="nl-status" class="notice" role="status">Signup is switched off. No newsletter provider has been configured, so nothing can be submitted or sent.</p>
</form>`;
  const body = `<h1>Newsletter</h1>
<p class="lead">The weekly digest by email, once a provider is chosen and the list is set up.</p>
${form}
<p>Until then, the <a href="/digest/feed.xml">Atom feed</a> carries every issue, and the <a href="/digest/">archive</a> has them all.</p>
<h2>How signup will work</h2>
<ul>
<li>One email per week with the digest. No other mailings.</li>
<li>Double opt-in and a one-click unsubscribe link in every email.</li>
<li>The provider and the responsible person will be named on the <a href="/privacy/">privacy page</a> before the form is enabled.</li>
</ul>`;
  return layout(config, {
    path: '/newsletter/', title: 'Newsletter', description: 'Weekly email digest of what changed in AI coding tools. Signup is not open yet; the Atom feed works now.', body,
    jsonLd: [{ '@type': 'WebPage', name: 'Newsletter', url: url(config, '/newsletter/'), description: 'Weekly email digest signup page.', inLanguage: config.language }, breadcrumb(config, [['Home', '/'], ['Newsletter', '/newsletter/']])]
  });
}

export function notFoundPage(ctx) {
  const { config } = ctx;
  return layout(config, {
    path: '/404.html', title: 'Page not found', description: 'This page does not exist.', noindex: true,
    body: `<h1>Page not found</h1><p>Try the <a href="/matrix/">matrix</a>, the <a href="/digest/">digest archive</a> or the <a href="/">home page</a>.</p>`
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
    'Every digest item and matrix cell links to an official source and carries a date. Cells marked "unverified" were not confirmed on the cited page, and cells marked "migration only" are mentioned there only as input to a migration command. Pages are plain HTML without cookies or scripts that load data.',
    '',
    '## Data',
    '',
    `- [Instruction file matrix](${url(config, '/matrix/')}): which of ${matrix.tools.length} tools reads which of ${matrix.files.length} instruction files, last reviewed ${matrix.lastReviewed}`,
    `- [matrix.json](${url(config, '/data/matrix.json')}): the same matrix as JSON`,
    `- [digests.json](${url(config, '/data/digests.json')}): all digest issues as JSON`,
    `- [llms-full.txt](${url(config, '/llms-full.txt')}): matrix and digests as one Markdown file`,
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
    `- [Privacy](${url(config, '/privacy/')}): no cookies, no analytics`,
    `- [Sponsors](${url(config, '/sponsors/')}): sponsorship policy`,
    ''
  ];
  return lines.join('\n');
}

export function renderLlmsFull(ctx) {
  const { config, matrix, digests } = ctx;
  const toolName = Object.fromEntries(matrix.tools.map((t) => [t.id, t.name]));
  const fileById = Object.fromEntries(matrix.files.map((f) => [f.id, f]));
  const out = [`# ${config.name}: full content`, '', `> ${config.description}`, '', `Matrix last reviewed ${matrix.lastReviewed}. Source: ${url(config, '/matrix/')}`, '', '## Instruction file matrix', ''];
  for (const f of matrix.files) {
    out.push(`### ${f.path}`, '', f.description, '');
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

export function renderHeaders(config) {
  return `/*
  Content-Security-Policy: ${csp(config)}
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()
/assets/*
  Cache-Control: public, max-age=86400
`;
}

export const FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#1f2937"/><path d="M9 8v16M9 16h8M23 8l-5 8 5 8" fill="none" stroke="#f9fafb" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
`;

export { path, daysBetween };
