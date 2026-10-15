// Pure functions shared by the browser generator and the tests. No DOM, no network.

export const TARGETS = [
  { id: 'agents-md', path: 'AGENTS.md', label: 'AGENTS.md', checked: true },
  { id: 'claude-md', path: 'CLAUDE.md', label: 'CLAUDE.md', checked: true },
  { id: 'gemini-md', path: 'GEMINI.md', label: 'GEMINI.md', checked: false },
  { id: 'cursor-mdc', path: '.cursor/rules/project.mdc', label: '.cursor/rules/project.mdc', checked: true },
  { id: 'copilot-instructions', path: '.github/copilot-instructions.md', label: '.github/copilot-instructions.md', checked: true },
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

function frontmatter(obj) {
  return ['---', ...Object.entries(obj).map(([k, v]) => `${k}: ${v}`), '---', ''].join('\n');
}

/**
 * @param {object} input form values
 * @param {string[]} targets ids from TARGETS
 * @param {{claudeMode?: 'full'|'import', cursorGlobs?: string, cursorAlwaysApply?: boolean, copilotApplyTo?: string}} options
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
        if (options.claudeMode === 'import') {
          results.push({
            path: t.path,
            content: '@AGENTS.md\n',
            note: 'Imports AGENTS.md with the @path syntax, so both files stay in sync. Keep AGENTS.md in the repository.'
          });
        } else {
          results.push({ path: t.path, content: body, note: 'Plain Markdown, no frontmatter.' });
        }
        break;
      case 'gemini-md':
        results.push({ path: t.path, content: body, note: 'Plain Markdown, no frontmatter.' });
        break;
      case 'cursor-mdc': {
        const always = options.cursorAlwaysApply !== false;
        const fm = { description: desc, globs: (options.cursorGlobs || '').trim(), alwaysApply: String(always) };
        results.push({ path: t.path, content: frontmatter(fm) + body, note: 'Cursor project rule. The frontmatter keys are description, globs and alwaysApply.' });
        break;
      }
      case 'copilot-instructions':
        results.push({ path: t.path, content: body, note: 'Repository-wide Copilot instructions in Markdown.' });
        break;
      case 'copilot-path': {
        const applyTo = (options.copilotApplyTo || '').trim() || '**';
        results.push({ path: t.path, content: frontmatter({ applyTo: `"${applyTo.replace(/"/g, '\\"')}"` }) + body, note: 'Path-specific Copilot instructions. applyTo takes a glob.' });
        break;
      }
      case 'cursorrules':
        results.push({
          path: t.path,
          content: body,
          note: 'Legacy single-file format. The Cursor rules page checked for this site does not mention it. Prefer AGENTS.md or .cursor/rules.'
        });
        break;
      default:
        break;
    }
  }
  return results;
}
