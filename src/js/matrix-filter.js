// Pure filter logic for the matrix page. It has no DOM access so the tests can run it in Node,
// and the browser script (assets/matrix.js) imports the same file.
//
// An empty selection means "no filter". Selected tools narrow the columns, selected statuses narrow the cells,
// and a row stays visible only while at least one of its visible cells matches.

/**
 * @param {{ tools: string[], files: string[], cells: { tool: string, file: string, status: string }[] }} model
 * @param {{ tools?: Iterable<string>, statuses?: Iterable<string> }} selection
 */
export function applyFilters(model, selection = {}) {
  const wantTools = new Set(selection.tools || []);
  const wantStatuses = new Set(selection.statuses || []);
  const visibleTools = new Set(model.tools.filter((t) => wantTools.size === 0 || wantTools.has(t)));
  const matches = new Set();
  const visibleFiles = new Set();
  for (const c of model.cells) {
    if (!visibleTools.has(c.tool)) continue;
    if (wantStatuses.size && !wantStatuses.has(c.status)) continue;
    matches.add(`${c.tool}/${c.file}`);
    visibleFiles.add(c.file);
  }
  return { visibleTools, visibleFiles, matches, shown: matches.size, total: model.cells.length, active: wantTools.size + wantStatuses.size > 0 };
}

/** The sentence announced to screen readers and shown next to the filters. */
export function countMessage(result) {
  if (!result.active) return `Showing all ${result.total} cells.`;
  if (result.shown === 0) return 'No cell matches these filters. Reset the filters to see the whole matrix.';
  return `Showing ${result.shown} of ${result.total} cells.`;
}
