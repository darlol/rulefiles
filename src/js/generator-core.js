// Pure functions shared by the browser generator and the tests. No DOM, no network.

export const TARGETS = [
  { id: 'agents-md', path: 'AGENTS.md', label: 'AGENTS.md', checked: true, main: true },
  { id: 'claude-md', path: 'CLAUDE.md', label: 'CLAUDE.md', checked: false },
  { id: 'gemini-md', path: 'GEMINI.md', label: 'GEMINI.md', checked: false },
  { id: 'cursor-mdc', path: '.cursor/rules/project.mdc', label: '.cursor/rules/project.mdc', checked: false },
  { id: 'copilot-instructions', path: '.github/copilot-instructions.md', label: '.github/copilot-instructions.md', checked: false },
  { id: 'copilot-path', path: '.github/instructions/project.instructions.md', label: '.github/instructions/project.instructions.md', checked: false },
  { id: 'cursorrules', path: '.cursorrules', label: '.cursorrules (legacy)', checked: false }
];

const lines = (text) => String(text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
const bullets = (text) => lines(text).map((l) => '- ' + l.replace(/^[-*]\s+/, ''));

/** Markdown body shared by every target. Empty sections are left out. */
export function buildBody(input) {
  const out = [];
  const name = (input.projectName || '').trim() || 'Project';
  out.push(`# ${name}`);
  if ((input.description || '').trim()) out.push('', input.description.trim());
  if ((input.stack || '').trim()) out.push('', '## Stack', '', ...bullets(input.stack));
  const cmds = [
    ['Install', input.installCmd],
    ['Run in development', input.devCmd],
    ['Build', input.buildCmd],
    ['Test', input.testCmd],
    ['Lint', input.lintCmd]
  ].filter(([, v]) => (v || '').trim());
  if (cmds.length) out.push('', '## Commands', '', ...cmds.map(([k, v]) => `- ${k}: \`${v.trim()}\``));
  if ((input.style || '').trim()) out.push('', '## Code style', '', ...bullets(input.style));
  if ((input.architecture || '').trim()) out.push('', '## Project layout', '', ...bullets(input.architecture));
  if ((input.always || '').trim()) out.push('', '## Always', '', ...bullets(input.always));
  if ((input.askFirst || '').trim()) out.push('', '## Ask first', '', ...bullets(input.askFirst));
  if ((input.never || '').trim()) out.push('', '## Never', '', ...bullets(input.never));
  if ((input.pr || '').trim()) out.push('', '## Commits and pull requests', '', ...bullets(input.pr));
  return out.join('\n') + '\n';
}

/**
 * Double-quoted YAML scalar on one line. JSON string syntax is valid YAML, and this adds
 * a \uXXXX escape for the characters YAML does not allow as printable text (DEL, the C1
 * controls, U+FFFE and U+FFFF) or reads as a line break (U+0085). The C0 controls are
 * escaped by JSON.stringify. Whitespace runs, including U+2028 and U+2029, become one space.
 * A lone surrogate becomes U+FFFD, because YAML has no escape for it.
 */
export function yamlQuote(value) {
  const oneLine = String(value == null ? '' : value).replace(/\s+/g, ' ').trim()
    .replace(/[\ud800-\udbff][\udc00-\udfff]|[\ud800-\udfff]/g, (m) => (m.length === 2 ? m : '\ufffd'));
  return JSON.stringify(oneLine).replace(/[\u007f-\u009f\ufffe\uffff]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0'));
}

// Plain scalars are only used for values that every YAML parser reads back as the same string.
const PLAIN_SAFE = /^[A-Za-z0-9_./][A-Za-z0-9_./*, -]*$/;
const PLAIN_RESERVED = /^(true|false|null|yes|no|on|off|y|n|~|[-+]?(\d[\d_]*)?\.?\d+([eE][-+]?\d+)?|0[xo][0-9a-fA-F]+|\.inf|\.nan|\d{4}-\d\d?-\d\d?.*)$/i;

/** Plain when that is safe and readable, double-quoted otherwise. */
export function yamlScalar(value) {
  const oneLine = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  if (oneLine && PLAIN_SAFE.test(oneLine) && !PLAIN_RESERVED.test(oneLine) && !/^-( |$)/.test(oneLine)) return oneLine;
  return yamlQuote(oneLine);
}

function frontmatter(entries) {
  return ['---', ...entries.map(([k, v]) => `${k}: ${v}`), '---', ''].join('\n');
}

/**
 * @param {object} input form values
 * @param {string[]} targets ids from TARGETS
 * @param {{claudeMode?: 'full'|'import', cursorGlobs?: string, cursorAlwaysApply?: boolean, copilotApplyTo?: string}} options
 *   claudeMode defaults to 'import', which writes a CLAUDE.md that imports AGENTS.md
 * @returns {{path: string, content: string, note: string}[]}
 */
export function generateFiles(input, targets, options = {}) {
  const body = buildBody(input);
  const desc = ((input.description || '').trim() || 'Project instructions').replace(/\r?\n/g, ' ');
  const results = [];
  for (const t of TARGETS) {
    if (!targets.includes(t.id)) continue;
    switch (t.id) {
      case 'agents-md':
        results.push({ path: t.path, content: body, note: 'Plain Markdown, no frontmatter.' });
        break;
      case 'claude-md':
        if (options.claudeMode !== 'full') {
          results.push({
            path: t.path,
            content: '@AGENTS.md\n',
            note: 'Imports AGENTS.md with the @path syntax, so both files stay in sync. Keep AGENTS.md in the repository. Claude Code reads AGENTS.md on its own only from v2.1.277 and when there is no CLAUDE.md; the import also covers older versions and sessions that cannot read AGENTS.md.'
          });
        } else {
          results.push({ path: t.path, content: body, note: 'Plain Markdown, no frontmatter. The Cursor help page checked for this site says Cursor reads CLAUDE.md the same way it reads AGENTS.md, so Cursor may load this copy as well as AGENTS.md. The import option keeps one copy of the instructions.' });
        }
        break;
      case 'gemini-md':
        results.push({ path: t.path, content: body, note: 'Plain Markdown, no frontmatter.' });
        break;
      case 'cursor-mdc': {
        const always = options.cursorAlwaysApply !== false;
        const globs = (options.cursorGlobs || '').trim();
        const fm = [['description', yamlQuote(desc)]];
        if (globs) fm.push(['globs', yamlScalar(globs)]);
        fm.push(['alwaysApply', String(always)]);
        results.push({ path: t.path, content: frontmatter(fm) + body, note: 'Cursor project rule. The frontmatter keys are description, globs and alwaysApply.' });
        break;
      }
      case 'copilot-instructions':
        results.push({ path: t.path, content: body, note: 'Repository-wide Copilot instructions in Markdown.' });
        break;
      case 'copilot-path': {
        const applyTo = (options.copilotApplyTo || '').trim() || '**';
        results.push({ path: t.path, content: frontmatter([['applyTo', yamlQuote(applyTo)]]) + body, note: 'Path-specific Copilot instructions. applyTo takes a glob.' });
        break;
      }
      case 'cursorrules':
        results.push({
          path: t.path,
          content: body,
          note: 'Legacy single-file format. The Cursor help page checked for this site calls it "legacy and will be deprecated". It does not say whether Cursor still loads it. Prefer AGENTS.md or .cursor/rules.'
        });
        break;
      default:
        break;
    }
  }
  return results;
}
