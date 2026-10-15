import { isoWeekId, isoWeekRange } from './util.mjs';

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '\u2026', rsquo: '\u2019', lsquo: '\u2018', ldquo: '\u201c', rdquo: '\u201d', ndash: '\u2013', mdash: '\u2014' };

export function decodeEntities(s) {
  return String(s)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

function tag(block, name) {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  if (!m) return '';
  let v = m[1].trim();
  const cdata = v.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  v = cdata ? cdata[1] : decodeEntities(v);
  return v.trim();
}

const stripTags = (s) => decodeEntities(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

/** The first complete sentence of a feed description, or '' when the feed text is cut off. */
export function firstSentence(description) {
  let t = stripTags(description).replace(/\s*The post .* appeared first on .*$/i, '').trim();
  const cut = /[\u2026]$|\.\.\.$/.test(t);
  if (cut) { const i = t.search(/[.!?](\s|$)/); if (i < 0) return ''; t = t.slice(0, i + 1); }
  const m = t.match(/^(.+?[.!?])(\s|$)/);
  return (m ? m[1] : t).trim();
}

const PR_REFS = /\s*\((?:\s*#\d+\s*,?)+\)(\.?)\s*$/;
const cleanLine = (t) => stripTags(t).replace(PR_REFS, (_, dot) => dot).trim();

/** First lines of the HTML in content:encoded, taken from list items, or from paragraphs when there are none. */
export function contentLines(contentHtml) {
  const html = contentHtml || '';
  let parts = [...html.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => m[1]);
  if (!parts.length) parts = [...html.matchAll(/<p>([\s\S]*?)<\/p>/g)].map((m) => m[1]);
  return parts.map(cleanLine).filter(Boolean).slice(0, 3);
}

export function parseRss(xml, source) {
  const out = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const block = m[1];
    const title = stripTags(tag(block, 'title'));
    const link = tag(block, 'link');
    const pub = tag(block, 'pubDate');
    const d = new Date(pub);
    if (!title || !link || Number.isNaN(d.getTime())) continue;
    const date = d.toISOString().slice(0, 10);
    let lines;
    if (source.lineFrom === 'content') lines = contentLines(tag(block, 'content:encoded'));
    else { const l = firstSentence(tag(block, 'description')); lines = l ? [l] : []; }
    const ver = title.match(/^Codex CLI Release:\s*(\S+)$/);
    out.push({ id: `${source.id}:${link}`, tool: source.tool, sourceId: source.id, sourceLabel: source.label, title: ver ? `Codex ${ver[1]}` : title, ...(ver ? { version: ver[1] } : {}), date, url: link, firstLine: lines[0] || '', lines });
  }
  return out;
}

export function parseGithubReleases(json, source) {
  const list = typeof json === 'string' ? JSON.parse(json) : json;
  const out = [];
  for (const r of list) {
    if (r.draft || r.prerelease || !r.published_at || !r.html_url) continue;
    const tagName = String(r.tag_name || '');
    let version = tagName;
    if (source.tagPrefix && version.startsWith(source.tagPrefix)) version = version.slice(source.tagPrefix.length);
    else version = version.replace(/^v/, '');
    const lines = String(r.body || '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => /^[-*]\s+\S/.test(l))
      .map((l) => l.replace(/^[-*]\s+/, '').replace(/\s*\((?:#\d+(?:,\s*#\d+)*)\)\.?$/, (m) => (m.endsWith('.') ? '.' : '')))
      .slice(0, 3);
    const title = (source.titleFormat || '{tag}').replace('{version}', version).replace('{tag}', tagName);
    out.push({ id: `${source.id}:${tagName}`, tool: source.tool, sourceId: source.id, sourceLabel: source.label, title, version, date: r.published_at.slice(0, 10), url: r.html_url, firstLine: lines[0] || '', lines });
  }
  return out;
}

export function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'item';
}

export function entryToItem(e) {
  let text = e.firstLine || e.title;
  let quote = Boolean(e.firstLine);
  if (text.length > 400) { text = text.slice(0, 397) + '...'; quote = false; }
  const item = {
    id: `${e.tool}-${e.date}-${slugify(e.version ? e.version : e.title)}`,
    date: e.date,
    tool: e.tool,
    title: e.title,
    text,
    quote,
    ...(e.version ? { version: e.version } : {}),
    sourceUrl: e.url,
    sourceLabel: e.sourceLabel.replace(/ \(Copilot label\)$/, ''),
    candidateLines: e.lines.slice(0, 3)
  };
  return item;
}

export function groupDrafts(entries, today) {
  const byWeek = new Map();
  for (const e of entries) {
    const w = isoWeekId(e.date);
    if (!byWeek.has(w)) byWeek.set(w, []);
    byWeek.get(w).push(e);
  }
  const drafts = [];
  for (const [week, list] of [...byWeek.entries()].sort()) {
    const { start, end } = isoWeekRange(week);
    const items = list.map(entryToItem).sort((a, b) => (a.date === b.date ? (a.id < b.id ? -1 : 1) : a.date < b.date ? -1 : 1));
    // Disambiguate ids that collide.
    const seen = new Map();
    for (const it of items) { const n = (seen.get(it.id) || 0) + 1; seen.set(it.id, n); if (n > 1) it.id += `-${n}`; }
    drafts.push({
      schemaVersion: 1, week, start, end, status: 'draft', verifiedOn: today,
      title: `Draft for ${start} to ${end}`,
      summary: 'Listed automatically from official feeds. Not reviewed. Each item quotes its source; check it before it moves into a published digest.',
      items
    });
  }
  return drafts;
}
