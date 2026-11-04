// Pure filter logic for the matrix page. It has no DOM access so the tests can run it in Node,
// and the browser script (assets/matrix.js) imports the same file.
//
// An empty selection means "no filter". Selected tools narrow the columns, selected statuses narrow the cells,
// a search query narrows the cells to those whose text holds every word of it, and a row stays visible only
// while at least one of its visible cells matches.

/** The words of a search query, lower case. Empty for a blank query. */
export function queryWords(query) {
  return String(query == null ? '' : query).toLowerCase().split(/\s+/).filter(Boolean);
}

/**
 * @param {{ tools: string[], files: string[], cells: { tool: string, file: string, status: string, text?: string }[] }} model
 *   text is what the search reads for a cell: the file path, its description, the tool name and the note.
 * @param {{ tools?: Iterable<string>, statuses?: Iterable<string>, query?: string }} selection
 */
export function applyFilters(model, selection = {}) {
  const wantTools = new Set(selection.tools || []);
  const wantStatuses = new Set(selection.statuses || []);
  const words = queryWords(selection.query);
  const visibleTools = new Set(model.tools.filter((t) => wantTools.size === 0 || wantTools.has(t)));
  const matches = new Set();
  const visibleFiles = new Set();
  for (const c of model.cells) {
    if (!visibleTools.has(c.tool)) continue;
    if (wantStatuses.size && !wantStatuses.has(c.status)) continue;
    if (words.length) {
      const text = String(c.text || '').toLowerCase();
      if (!words.every((w) => text.includes(w))) continue;
    }
    matches.add(`${c.tool}/${c.file}`);
    visibleFiles.add(c.file);
  }
  return { visibleTools, visibleFiles, matches, shown: matches.size, total: model.cells.length, active: wantTools.size + wantStatuses.size + words.length > 0 };
}

/** The sentence announced to screen readers and shown next to the filters. */
export function countMessage(result) {
  if (!result.active) return `Showing all ${result.total} cells.`;
  if (result.shown === 0) return 'No cell matches these filters. Reset the filters to see the whole matrix.';
  return `Showing ${result.shown} of ${result.total} cells.`;
}
