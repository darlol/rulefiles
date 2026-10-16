import { isoWeekId, isoWeekRange } from './util.mjs';
import { licenseFields } from './license.mjs';

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

const MD_LIST_ITEM = /^\s*(?:[-*+]|\d+[.)])\s+(\S.*)$/;

/** Plain text of one Markdown line or paragraph: links keep their text, emphasis and code marks go, PR references go. */
function cleanMarkdown(t) {
  return t
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\s+/g, ' ')
    .replace(PR_REFS, (_, dot) => dot)
    .trim();
}

/** First lines of Markdown text: list items, or paragraphs when there are none. Headings, rules and code fences are skipped. */
function markdownLines(md) {
  const items = [];
  const paragraphs = [];
  let fenced = false;
  let current = null; // { list: boolean, text: string }
  const flush = () => { if (current) (current.list ? items : paragraphs).push(current.text); current = null; };
  for (const raw of md.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(raw)) { flush(); fenced = !fenced; continue; }
    if (fenced) continue;
    if (!raw.trim()) { flush(); continue; }
    if (/^\s*#{1,6}\s/.test(raw) || /^\s*([-*_])(\s*\1){2,}\s*$/.test(raw)) { flush(); continue; }
    const li = raw.match(MD_LIST_ITEM);
    if (li) { flush(); current = { list: true, text: li[1] }; continue; }
    if (current) current.text += ` ${raw.trim()}`;
    else current = { list: false, text: raw.trim() };
  }
  flush();
  return (items.length ? items : paragraphs).map(cleanMarkdown).filter(Boolean).slice(0, 3);
}

/**
 * First lines of the text in content:encoded. The feed text is HTML (list items, or paragraphs when there
 * are none) or, for feeds that moved to Markdown such as the Codex changelog, Markdown. It counts as HTML
 * when it holds an <li> or <p> element.
 */
export function contentLines(content) {
  const text = content || '';
  if (!/<(li|p)>/.test(text)) return markdownLines(text);
  let parts = [...text.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => m[1]);
  if (!parts.length) parts = [...text.matchAll(/<p>([\s\S]*?)<\/p>/g)].map((m) => m[1]);
  return parts.map(cleanLine).filter(Boolean).slice(0, 3);
}

const DAY_MS = 86400000;

/**
 * The calendar date of an RSS entry. The feed date is read in UTC. A publisher that dates its pages in another
 * zone puts that date in the link (github.blog/changelog/2026-10-15-...), so when the link holds a date within
 * one day of the UTC date, the link's date wins: it is the date the page shows. Otherwise the UTC date stays.
 */
export function entryDate(pubDate, link) {
  const utc = pubDate.toISOString().slice(0, 10);
  const m = String(link).match(/\/(\d{4}-\d{2}-\d{2})-[^/]*\/?$/);
  if (!m) return utc;
  const linked = new Date(`${m[1]}T00:00:00Z`);
  if (Number.isNaN(linked.getTime()) || linked.toISOString().slice(0, 10) !== m[1]) return utc;
  const diff = Math.abs(linked.getTime() - new Date(`${utc}T00:00:00Z`).getTime());
  return diff <= DAY_MS ? m[1] : utc;
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
    const date = entryDate(d, link);
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
      schemaVersion: 1, ...licenseFields(), week, start, end, status: 'draft', verifiedOn: today,
      title: `Draft for ${start} to ${end}`,
      summary: 'Listed automatically from official feeds. Not reviewed. Each item quotes its source; check it before it moves into a published digest.',
      items
    });
  }
  return drafts;
}
