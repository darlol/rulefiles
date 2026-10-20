import { TARGETS, generateFiles } from './generator-core.js';
import { presetValues } from './generator-presets.js';

const form = document.getElementById('gen-form');
const out = document.getElementById('gen-output');
const targetBox = document.getElementById('gen-targets');
const presetBar = document.getElementById('gen-presets');

// AGENTS.md is always generated, so it gets no checkbox. Each extra file gets one, and the options of a
// file sit right under its checkbox and show only while that file is selected.
const options = {};
for (const el of form.querySelectorAll('[data-option-for]')) options[el.dataset.optionFor] = el;
for (const t of TARGETS) {
  if (t.main) continue;
  const label = document.createElement('label');
  label.className = 'check';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.name = 'target';
  input.value = t.id;
  input.checked = t.checked;
  label.append(input, ' ' + t.label);
  targetBox.append(label);
  if (options[t.id]) targetBox.append(options[t.id]);
}

function syncOptions() {
  for (const input of targetBox.querySelectorAll('input[name="target"]')) {
    if (options[input.value]) options[input.value].hidden = !input.checked;
  }
}

function values() {
  const data = Object.fromEntries(new FormData(form).entries());
  const main = TARGETS.filter((t) => t.main).map((t) => t.id);
  const extra = [...form.querySelectorAll('input[name="target"]:checked')].map((i) => i.value);
  const globs = (data.cursorGlobs || '').trim();
  return {
    data,
    targets: main.concat(extra),
    options: {
      claudeMode: data.claudeMode,
      cursorGlobs: data.cursorGlobs,
      // A rule with globs applies to the matching files; a rule without globs always applies.
      cursorAlwaysApply: globs === '',
      copilotApplyTo: data.copilotApplyTo
    }
  };
}

if (presetBar) {
  presetBar.addEventListener('click', (e) => {
    const button = e.target.closest('button[data-preset]');
    if (!button) return;
    const v = presetValues(button.dataset.preset);
    if (!v) return;
    for (const name of Object.keys(v)) if (form.elements[name]) form.elements[name].value = v[name];
    render();
  });
  presetBar.hidden = false;
}

function render() {
  const { data, targets, options } = values();
  const files = generateFiles(data, targets, options);
  out.textContent = '';
  if (!files.length) {
    const p = document.createElement('p');
    p.className = 'muted';
    p.textContent = 'Select at least one file to generate.';
    out.append(p);
    return;
  }
  for (const f of files) {
    const section = document.createElement('section');
    section.className = 'gen-file';
    const h = document.createElement('h3');
    const code = document.createElement('code');
    code.textContent = f.path;
    h.append(code);
    const note = document.createElement('p');
    note.className = 'muted';
    note.textContent = f.note;
    const pre = document.createElement('pre');
    pre.tabIndex = 0;
    pre.textContent = f.content;
    const actions = document.createElement('p');
    actions.className = 'gen-actions';
    const copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'btn btn-primary';
    copy.textContent = 'Copy';
    copy.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(f.content); copy.textContent = 'Copied'; }
      catch { copy.textContent = 'Copy failed, select the text instead'; }
      setTimeout(() => { copy.textContent = 'Copy'; }, 1800);
    });
    const dl = document.createElement('button');
    dl.type = 'button';
    dl.textContent = 'Download';
    dl.addEventListener('click', () => {
      const blob = new Blob([f.content], { type: 'text/markdown;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = f.path.split('/').pop();
      document.body.append(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
    });
    actions.append(copy, dl);
    section.append(h, note, pre, actions);
    out.append(section);
  }
}

form.addEventListener('input', render);
form.addEventListener('change', () => { syncOptions(); render(); });
form.addEventListener('submit', (e) => e.preventDefault());
syncOptions();
render();
