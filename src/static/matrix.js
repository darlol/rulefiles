import { applyFilters, countMessage } from './matrix-filter.js';

// Progressive enhancement: without this script the whole table is visible and nothing is hidden.
// The filters keep no state anywhere (no storage, no URL, no network).
const bar = document.getElementById('matrix-filters');
const table = document.querySelector('table.matrix');
if (bar && table) {
  const cells = [...table.querySelectorAll('td[data-tool]')];
  const model = {
    tools: [...new Set(cells.map((c) => c.dataset.tool))],
    files: [...new Set(cells.map((c) => c.dataset.file))],
    cells: cells.map((c) => ({ tool: c.dataset.tool, file: c.dataset.file, status: c.dataset.status }))
  };
  const toolButtons = [...bar.querySelectorAll('[data-filter-tool]')];
  const statusButtons = [...bar.querySelectorAll('[data-filter-status]')];
  const pressed = (list, attr) => list.filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.dataset[attr]);
  const message = document.getElementById('matrix-count');
  const rows = [...table.querySelectorAll('tbody tr')];

  const update = () => {
    const result = applyFilters(model, { tools: pressed(toolButtons, 'filterTool'), statuses: pressed(statusButtons, 'filterStatus') });
    for (const el of table.querySelectorAll('[data-tool]')) el.hidden = !result.visibleTools.has(el.dataset.tool);
    for (const tr of rows) tr.hidden = !result.visibleFiles.has(tr.dataset.file);
    for (const td of cells) td.classList.toggle('is-off', !result.matches.has(`${td.dataset.tool}/${td.dataset.file}`));
    message.textContent = countMessage(result);
    bar.querySelector('[data-filter-reset]').disabled = !result.active;
  };

  bar.addEventListener('click', (e) => {
    const button = e.target.closest('button');
    if (!button || !bar.contains(button)) return;
    if (button.hasAttribute('data-filter-reset')) {
      for (const b of [...toolButtons, ...statusButtons]) b.setAttribute('aria-pressed', 'false');
    } else if (button.hasAttribute('aria-pressed')) {
      button.setAttribute('aria-pressed', button.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
    }
    update();
  });

  bar.hidden = false;
  update();
}
