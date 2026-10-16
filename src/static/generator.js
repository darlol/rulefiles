import { TARGETS, generateFiles } from './generator-core.js';

const form = document.getElementById('gen-form');
const out = document.getElementById('gen-output');
const targetBox = document.getElementById('gen-targets');
const mainBox = document.getElementById('gen-main');

for (const t of TARGETS) {
  const label = document.createElement('label');
  label.className = 'check';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.name = 'target';
  input.value = t.id;
  input.checked = t.checked;
  if (t.main) {
    input.disabled = true;
    label.append(input, ' ' + t.label + ' (main file)');
    mainBox.append(label);
  } else {
    label.append(input, ' ' + t.label);
    targetBox.append(label);
  }
}

function values() {
  const data = Object.fromEntries(new FormData(form).entries());
  const targets = [...form.querySelectorAll('input[name="target"]:checked')].map((i) => i.value);
  return {
    data,
    targets,
    options: {
      claudeMode: data.claudeMode,
      cursorGlobs: data.cursorGlobs,
      cursorAlwaysApply: form.elements.cursorAlwaysApply.checked,
      copilotApplyTo: data.copilotApplyTo
    }
  };
}

function render() {
  const { data, targets, options } = values();
  const files = generateFiles(data, targets, options);
  out.replaceChildren();
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
form.addEventListener('change', render);
form.addEventListener('submit', (e) => e.preventDefault());
render();
