// Launch warnings. The site copy contains sentences that promise information the owner still has
// to supply ("will be named here"). The build lists them so they cannot reach a public site unnoticed.
// Warnings never fail the build.

export const PLACEHOLDER_RE = /[^.!?\n]*\bwill be (?:listed|named) (?:here|on the)\b[^.!?\n]*[.!?]?/gi;
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

/**
 * @param {{path: string, html: string}[]} pages built pages, with their site path
 * @param {{baseUrl: string}} config
 * @returns {string[]} one human-readable line per problem
 */
export function launchWarnings(pages, config) {
  const out = [];
  for (const p of pages) {
    const text = textOf(p.html);
    const hits = [...text.matchAll(PLACEHOLDER_RE)].map((m) => m[0].trim());
    for (const hit of hits) out.push(`${p.path}: placeholder text still present: "${hit}"`);
  }
  if (config.baseUrl === PLACEHOLDER_DOMAIN) out.push(`site.config.json: baseUrl is the placeholder ${PLACEHOLDER_DOMAIN}, set SITE_URL or baseUrl once a domain is chosen`);
  return out;
}
