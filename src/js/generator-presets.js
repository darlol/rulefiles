// Example values for the generator form. Pure data, shared by the page (scripts/lib/render.mjs builds the
// buttons) and the browser script (assets/generator.js fills the form). A preset only fills fields; it never
// selects extra files.

export const GENERATOR_PRESETS = [
  {
    id: 'node',
    label: 'Node.js and TypeScript',
    values: {
      projectName: 'my-app',
      description: 'Web app built with Node.js and TypeScript.',
      stack: 'Node.js 22\nTypeScript\nVitest',
      installCmd: 'npm ci',
      devCmd: 'npm run dev',
      buildCmd: 'npm run build',
      testCmd: 'npm test',
      lintCmd: 'npm run lint',
      style: 'Use TypeScript strict mode\nPrefer named exports',
      architecture: 'src/: application code\ntests/: unit tests',
      always: 'Run npm test before you finish a task',
      askFirst: 'Adding a dependency',
      never: 'Commit secrets or .env files',
      pr: 'Use Conventional Commits: feat:, fix:, docs:'
    }
  },
  {
    id: 'python',
    label: 'Python',
    values: {
      projectName: 'my-service',
      description: 'HTTP service written in Python.',
      stack: 'Python 3.12\nFastAPI\npytest',
      installCmd: 'pip install -r requirements.txt',
      devCmd: 'uvicorn app.main:app --reload',
      buildCmd: '',
      testCmd: 'pytest',
      lintCmd: 'ruff check .',
      style: 'Follow PEP 8\nAdd type hints to public functions',
      architecture: 'app/: application code\ntests/: pytest tests',
      always: 'Run pytest before you finish a task',
      askFirst: 'Changing the database schema',
      never: 'Commit secrets or .env files',
      pr: 'One topic per pull request'
    }
  }
];

/** The form fields a preset fills. "Clear the form" empties the same list. */
export const PRESET_FIELDS = ['projectName', 'description', 'stack', 'installCmd', 'devCmd', 'buildCmd', 'testCmd', 'lintCmd', 'style', 'architecture', 'always', 'askFirst', 'never', 'pr'];

/** Values for a preset id, or empty strings for "clear". Unknown ids give null. */
export function presetValues(id) {
  if (id === 'clear') return Object.fromEntries(PRESET_FIELDS.map((f) => [f, '']));
  const p = GENERATOR_PRESETS.find((x) => x.id === id);
  return p ? Object.fromEntries(PRESET_FIELDS.map((f) => [f, p.values[f] || ''])) : null;
}
