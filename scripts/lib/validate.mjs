import { isIsoDate, isoWeekRange, daysBetween } from './util.mjs';
import { licenseProblems } from './license.mjs';

export const MATRIX_STATUSES = ['reads', 'reads-conditionally', 'configurable', 'migration-only', 'not-read', 'unverified'];

// Counts per status, always computed from the data so no page needs a hard-coded total.
export function matrixStats(matrix) {
  const byStatus = Object.fromEntries(MATRIX_STATUSES.map((s) => [s, 0]));
  for (const c of matrix.cells || []) byStatus[c.status] = (byStatus[c.status] || 0) + 1;
  const total = (matrix.cells || []).length;
  return { total, byStatus, unverified: byStatus.unverified, verified: total - byStatus.unverified };
}
export const ITEM_TOOLS = ['cursor', 'claude-code', 'codex', 'github-copilot'];
export const DIGEST_STATUSES = ['published', 'draft'];

function hostAllowed(url, hosts) {
  let u;
  try { u = new URL(url); } catch { return 'is not a valid URL'; }
  if (u.protocol !== 'https:') return 'must use https';
  const host = u.hostname.toLowerCase();
  if (!hosts.some((h) => host === h || host.endsWith('.' + h))) return `host ${host} is not in data/allowed-source-hosts.json`;
  return null;
}

const EMAIL_RE = /^[a-z0-9._-]+@[a-z0-9-]+(\.[a-z0-9-]+)+$/;

export function validateConfig(config) {
  const errors = [];
  for (const key of ['name', 'tagline', 'description', 'baseUrl', 'language']) {
    if (typeof config[key] !== 'string' || !config[key]) errors.push(`site.config.json: "${key}" must be a non-empty string`);
  }
  if (typeof config.baseUrl === 'string' && !/^https:\/\/[^/]+$/.test(config.baseUrl)) {
    errors.push('site.config.json: baseUrl must look like https://example.com without a trailing slash');
  }
  if (config.homeTitle !== undefined && (typeof config.homeTitle !== 'string' || !config.homeTitle || config.homeTitle.length > 60)) errors.push('site.config.json: homeTitle must be a non-empty string of at most 60 characters');
  if (config.description && config.description.length > 200) errors.push('site.config.json: description should stay under 200 characters');
  for (const key of ['contactEmail', 'privacyEmail', 'sponsorContact']) {
    if (typeof config[key] !== 'string' || !EMAIL_RE.test(config[key])) errors.push(`site.config.json: "${key}" must be an email address`);
  }
  const host = config.host;
  if (!host || typeof host !== 'object') errors.push('site.config.json: host object is missing (name, address, phone, sourceUrl, readOn)');
  else {
    for (const key of ['name', 'address', 'phone']) if (typeof host[key] !== 'string' || !host[key].trim()) errors.push(`site.config.json: host.${key} must be a non-empty string`);
    if (typeof host.sourceUrl !== 'string' || !/^https:\/\//.test(host.sourceUrl)) errors.push('site.config.json: host.sourceUrl must be the https page the host details were read on');
    if (!isIsoDate(host.readOn)) errors.push('site.config.json: host.readOn must be YYYY-MM-DD');
  }
  if (config.indexNowKey !== undefined && !/^[A-Za-z0-9-]{8,128}$/.test(config.indexNowKey)) errors.push('site.config.json: indexNowKey must be 8 to 128 characters: letters, digits and dashes');
  const nl = config.newsletter;
  if (!nl || typeof nl !== 'object') errors.push('site.config.json: newsletter object is missing');
  else if (nl.formAction && !/^https:\/\//.test(nl.formAction)) errors.push('site.config.json: newsletter.formAction must be an https URL or empty');
  return errors;
}

export function validateMatrix(matrix, hosts, today) {
  const errors = [];
  const warnings = [];
  if (matrix.schemaVersion !== 1) errors.push('matrix.json: schemaVersion must be 1');
  errors.push(...licenseProblems(matrix, 'matrix.json'));
  if (!isIsoDate(matrix.lastReviewed)) errors.push('matrix.json: lastReviewed must be YYYY-MM-DD');
  const toolIds = new Set();
  for (const t of matrix.tools || []) {
    if (!t.id || !t.name) errors.push('matrix.json: every tool needs id and name');
    if (toolIds.has(t.id)) errors.push(`matrix.json: duplicate tool id ${t.id}`);
    toolIds.add(t.id);
    const why = hostAllowed(t.docsUrl, hosts);
    if (why) errors.push(`matrix.json: tool ${t.id} docsUrl ${why}`);
  }
  const fileIds = new Set();
  for (const f of matrix.files || []) {
    if (!f.id || !f.path || !f.description) errors.push('matrix.json: every file needs id, path and description');
    if (fileIds.has(f.id)) errors.push(`matrix.json: duplicate file id ${f.id}`);
    fileIds.add(f.id);
  }
  const seen = new Set();
  for (const c of matrix.cells || []) {
    const key = `${c.tool}/${c.file}`;
    if (!toolIds.has(c.tool)) errors.push(`matrix.json: cell ${key} uses an unknown tool`);
    if (!fileIds.has(c.file)) errors.push(`matrix.json: cell ${key} uses an unknown file`);
    if (seen.has(key)) errors.push(`matrix.json: duplicate cell ${key}`);
    seen.add(key);
    if (!MATRIX_STATUSES.includes(c.status)) errors.push(`matrix.json: cell ${key} has invalid status "${c.status}"`);
    if (typeof c.note !== 'string' || !c.note.trim()) errors.push(`matrix.json: cell ${key} needs a note`);
    else if (c.note.length > 400) errors.push(`matrix.json: cell ${key} note is longer than 400 characters`);
    const why = hostAllowed(c.sourceUrl, hosts);
    if (why) errors.push(`matrix.json: cell ${key} sourceUrl ${why}`);
    if (!isIsoDate(c.verifiedOn)) errors.push(`matrix.json: cell ${key} verifiedOn must be YYYY-MM-DD`);
    else if (today && c.verifiedOn > today) errors.push(`matrix.json: cell ${key} verifiedOn is in the future`);
    if (c.version !== undefined && typeof c.version !== 'string') errors.push(`matrix.json: cell ${key} version must be a string`);
  }
  for (const t of toolIds) for (const f of fileIds) {
    if (!seen.has(`${t}/${f}`)) errors.push(`matrix.json: missing cell ${t}/${f}`);
  }
  if (isIsoDate(matrix.lastReviewed) && (matrix.cells || []).some((c) => isIsoDate(c.verifiedOn) && c.verifiedOn > matrix.lastReviewed)) {
    errors.push('matrix.json: a cell has verifiedOn later than lastReviewed');
  }
  return { errors, warnings };
}

export function staleCells(matrix, today, staleAfterDays) {
  return (matrix.cells || []).filter((c) => isIsoDate(c.verifiedOn) && daysBetween(c.verifiedOn, today) > staleAfterDays);
}

export function validateDigest(digest, hosts, today, fileName = '') {
  const errors = [];
  const label = `digest ${digest.week || fileName}`;
  if (digest.schemaVersion !== 1) errors.push(`${label}: schemaVersion must be 1`);
  errors.push(...licenseProblems(digest, label));
  if (!/^\d{4}-W\d{2}$/.test(digest.week || '')) errors.push(`${label}: week must look like 2026-W41`);
  else {
    const range = isoWeekRange(digest.week);
    if (digest.start !== range.start || digest.end !== range.end) errors.push(`${label}: start/end must be ${range.start} and ${range.end}`);
    if (fileName && fileName !== `${digest.week}.json` && fileName !== `${digest.week}.draft.json`) errors.push(`${label}: file name must be ${digest.week}.json`);
  }
  if (!DIGEST_STATUSES.includes(digest.status)) errors.push(`${label}: status must be one of ${DIGEST_STATUSES.join(', ')}`);
  if (!isIsoDate(digest.verifiedOn)) errors.push(`${label}: verifiedOn must be YYYY-MM-DD`);
  else if (today && digest.verifiedOn > today) errors.push(`${label}: verifiedOn is in the future`);
  for (const key of ['title', 'summary']) if (typeof digest[key] !== 'string' || !digest[key].trim()) errors.push(`${label}: ${key} is required`);
  if (!Array.isArray(digest.items) || digest.items.length === 0) errors.push(`${label}: items must be a non-empty array`);
  const ids = new Set();
  for (const item of digest.items || []) {
    const id = item.id || '(no id)';
    const l = `${label} item ${id}`;
    if (!item.id || !/^[a-z0-9][a-z0-9.\-]*$/.test(item.id)) errors.push(`${l}: id must be lowercase letters, digits, dots and dashes`);
    if (ids.has(item.id)) errors.push(`${l}: duplicate id`);
    ids.add(item.id);
    if (!isIsoDate(item.date)) errors.push(`${l}: date must be YYYY-MM-DD`);
    else {
      if (digest.start && (item.date < digest.start || item.date > digest.end)) errors.push(`${l}: date ${item.date} is outside ${digest.start}..${digest.end}`);
      if (today && item.date > today) errors.push(`${l}: date is in the future`);
    }
    if (!ITEM_TOOLS.includes(item.tool)) errors.push(`${l}: tool must be one of ${ITEM_TOOLS.join(', ')}`);
    if (typeof item.title !== 'string' || !item.title.trim()) errors.push(`${l}: title is required`);
    if (typeof item.text !== 'string' || !item.text.trim()) errors.push(`${l}: text is required`);
    else if (item.text.length > 400) errors.push(`${l}: text is longer than 400 characters`);
    if (item.quote !== undefined && typeof item.quote !== 'boolean') errors.push(`${l}: quote must be true or false`);
    for (const key of ['version', 'figure']) if (item[key] !== undefined && (typeof item[key] !== 'string' || !item[key])) errors.push(`${l}: ${key} must be a non-empty string when present`);
    const why = hostAllowed(item.sourceUrl, hosts);
    if (why) errors.push(`${l}: sourceUrl ${why}`);
    if (typeof item.sourceLabel !== 'string' || !item.sourceLabel) errors.push(`${l}: sourceLabel is required`);
  }
  return errors;
}

export function validateWatchSources(ws) {
  const errors = [];
  const ids = new Set();
  for (const s of ws.sources || []) {
    if (!s.id || ids.has(s.id)) errors.push(`watch-sources.json: missing or duplicate id ${s.id}`);
    ids.add(s.id);
    if (!ITEM_TOOLS.includes(s.tool)) errors.push(`watch-sources.json: source ${s.id} has unknown tool`);
    if (!['rss', 'github-releases'].includes(s.type)) errors.push(`watch-sources.json: source ${s.id} has unknown type`);
    if (!/^https:\/\//.test(s.url || '')) errors.push(`watch-sources.json: source ${s.id} url must be https`);
    if (/\.atom($|\?)/.test(s.url || '') && /github\.com/.test(s.url)) errors.push(`watch-sources.json: source ${s.id} uses a github.com .atom feed, which robots.txt disallows`);
  }
  return errors;
}
