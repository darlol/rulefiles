// Reviewed copy of the question, comparison and cite-or-embed blocks, pasted as is from growth/COPY-wave1.v2.md
// (CR PASS, md5 c8976db55743507da44b3353d636814f). Section numbers refer to that file. Change a string here only
// through a new copy review. Appendix A (the `configurable` status) is not shipped, so it has no entry.

/** §1 Question pages. */
export const QUESTION_COPY = {
  title: (tool, path) => `Does ${tool} read ${path}?`, // §1.1
  // §1.2 Short answer, first words after the badge.
  answer: {
    reads: () => 'Yes.',
    'reads-conditionally': () => 'Yes, with conditions.',
    'migration-only': (tool) => `Only for migration. The official docs mention it only as input when ${tool} migrates to its own file, and don't say it loads it otherwise.`,
    'not-read': (tool) => `No. The official docs say ${tool} does not read or import it.`
  },
  // §1.2 Opening words (also the meta description and llms.txt answer, §1.7 and §1.8).
  opening: { reads: 'Yes.', 'reads-conditionally': 'Yes, with conditions.', 'migration-only': 'Only for migration.', 'not-read': 'No.' },
  sourceLine: (host, date) => `From the ${host} docs. Checked on ${date}.`, // §1.3
  method: "This answer comes from one official page, quoted above, as it read on the check date. We didn't run the tool to test it. If the vendor changes the page, the answer can change. The check date tells you how old it is. We only make a page like this when an official page says something about this file for this tool. When it doesn't, the cell stays unverified in the matrix.", // §1.4
  related: { // §1.6
    heading: 'Related',
    filePage: (path) => `All tools for ${path}`,
    matrixCell: 'This cell in the matrix',
    sameFile: (path) => `Other tools and ${path}`,
    sameTool: (tool) => `${tool} and other instruction files`,
    compare: 'Compare'
  },
  description: (opening, tool, path, date) => `${opening} ${tool} and ${path}, from the official docs, checked ${date}.`, // §1.7
  llmsLine: (title, link, opening, date) => `- [${title}](${link}): ${opening} Checked ${date}.` // §1.8
};

/** §2 Comparison pages. */
export const COMPARE_COPY = {
  answer: { // §2.1
    reads: (n, total, path, names) => `${n} of ${total} tools read ${path} by default (${names}).`,
    'reads-conditionally': (m, names) => `${m} read it with conditions (${names}).`,
    configurable: (k, names) => `${k} read it only if configured (${names}).`,
    'migration-only': (j, names) => `${j} mention it only for migration (${names}).`,
    'not-read': (i, names) => `${i} do not read it (${names}).`,
    unverified: (u) => `For ${u}, the official docs say nothing either way.`
  },
  context: { // §2.2
    'claude-md-vs-agents-md': "CLAUDE.md started as Claude Code's own file. AGENTS.md is a shared format that several tools now read. The table shows what each tool's official docs say about each file, and when we checked.",
    'agents-md-vs-cursor-rules': ".cursor/rules holds Cursor's project rules as .mdc files with front matter for globs and descriptions. Cursor reads both. The table shows which other tools do, based on each vendor's docs.",
    'cursorrules-still-read': ".cursorrules was the original single-file rules format in Cursor. Cursor's own docs now call it legacy. Claude Code's docs still mention it, for migration, and Cline lists it among its supported rule types. Here is where each tool stands, according to its official docs."
  }
};

/** §3 Cite or embed. */
export const CITE_COPY = {
  heading: 'Cite or embed',
  intro: 'The data and the text are under CC BY 4.0. You can quote this answer, put it on your site or feed it to a tool, as long as you credit Rulefiles and link the page.',
  creditLabel: 'Suggested credit:',
  credit: (tool, path, pageUrl, date) => `Rulefiles, "Does ${tool} read ${path}?", ${pageUrl}, checked ${date}, CC BY 4.0.`,
  embedLabel: 'Embed this answer (plain HTML, no script, no tracking):',
  dataLabel: 'As data:',
  data: (toolId, fileId) => `This cell is in /data/matrix.json, which any site can fetch (CORS is open). Look for tool "${toolId}" and file "${fileId}".`,
  footnote: 'Quoted excerpts of the sources belong to their authors. Link the official page of the cell when you rely on it.'
};

// Strings the pages need that COPY-wave1.v2.md does not give. They are taken word for word from SPEC-question-pages.md
// (§5 and §7.1) and listed in the PR, so copy review can replace them. Nothing here is new prose.
export const SPEC_LABELS = {
  answerPage: 'Answer page', // SPEC §7.1, link in a /matrix/ cell
  whatDocsSay: 'What the docs say', // SPEC §5 item 4
  compareQuestion: (path) => `Which coding agents read ${path}?` // SPEC §5 JSON-LD, same as the file page title
};
