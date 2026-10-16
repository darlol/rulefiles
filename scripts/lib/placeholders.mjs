// Launch warnings. Some fields can only be filled in by the site owner. Their place in the copy is
// marked with [[TODO-OWNER: field]]. The build lists every marker and every older-style placeholder
// sentence ("will be named here"), and fails on them in strict mode, so none reaches a public site.

const MARKER = String.raw`\[\[TODO-OWNER:[^\]\n]*\]\]`;
const LEGACY = [
  String.raw`\b[Ww]ill be (?:listed|named|published|announced|defined|set)\b`,
  String.raw`\b[Nn]ot set yet\b`,
  String.raw`\b[Tt]o be (?:named|defined|decided|confirmed|announced)\b`,
  String.raw`\b(?:TODO|TBD|FIXME)\b`
];

/** One unit of text around a placeholder: from the previous sentence end to the next one. */
export const PLACEHOLDER_RE = new RegExp(String.raw`[^.!?\n]*(?:${[MARKER, ...LEGACY].join('|')})[^.!?\n]*[.!?]?`, 'g');
export const MARKER_RE = /\[\[TODO-OWNER:\s*([^\]\n]*?)\s*\]\]/g;
export const PLACEHOLDER_DOMAIN = 'https://agentdiffs.dev';

// Block elements end with a line break, so a heading and the sentence after it are not joined.
const textOf = (html) => html
  .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
  .replace(/<\/(h[1-6]|p|li|div|section)>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&#39;/g, "'")
  .replace(/&amp;/g, '&')
  .replace(/[ \t]+/g, ' ')
  .trim();

/** Every string value in a JSON-like object, with the path of the key it sits under. */
function* strings(value, at = '') {
  if (typeof value === 'string') yield [at, value];
  else if (Array.isArray(value)) for (const [i, v] of value.entries()) yield* strings(v, `${at}[${i}]`);
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) yield* strings(v, at ? `${at}.${k}` : k);
}

/** The field names inside the [[TODO-OWNER: ...]] markers of a text, in order. */
export const markerFields = (text) => [...String(text).matchAll(MARKER_RE)].map((m) => m[1]);

/**
 * @param {{path: string, html: string}[]} pages built pages, with their site path
 * @param {{baseUrl: string}} config the site configuration
 * @returns {string[]} one human-readable line per problem, without duplicates
 */
export function launchWarnings(pages, config) {
  const out = [];
  const add = (line) => { if (!out.includes(line)) out.push(line); };
  for (const p of pages) {
    const hits = [...textOf(p.html).matchAll(PLACEHOLDER_RE)].map((m) => m[0].trim());
    for (const hit of hits) add(`${p.path}: placeholder still present: "${hit}"`);
  }
  for (const [key, value] of strings(config)) {
    for (const hit of value.match(PLACEHOLDER_RE) || []) add(`site.config.json: ${key} still has a placeholder: "${hit.trim()}"`);
  }
  if (config.baseUrl === PLACEHOLDER_DOMAIN) add(`site.config.json: baseUrl is the placeholder ${PLACEHOLDER_DOMAIN}, set SITE_URL or baseUrl once a domain is chosen`);
  return out;
}
