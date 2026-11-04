import { applyFilters, countMessage } from './matrix-filter.js';

// Progressive enhancement. Without this script every tile is a link to its entry in the open "All notes" fold,
// and nothing is hidden. With it, the grid becomes an ARIA grid (one tab stop, arrow keys), a tile opens its
// note in the panel, and the address takes #d-{tool}--{file}. The filters keep no state (no storage, no network).
const grid = document.getElementById('matrix-grid');
const panel = document.getElementById('matrix-panel');
const notes = document.getElementById('matrix-notes');
if (grid && panel && notes) {
  const tiles = [...grid.querySelectorAll('a.mt')];
  const rows = [...grid.querySelectorAll('.mrow[data-file]')];
  const entry = (t) => document.getElementById(`cell-${t.dataset.tool}-${t.dataset.file}`);
  const scrim = document.getElementById('matrix-scrim');
  const view = panel.querySelector('.panel-cell');
  const empty = panel.querySelector('.panel-empty');
  const title = panel.querySelector('.panel-title');
  const content = panel.querySelector('.panel-body');
  // The address is read and written through document.URL and history, so nothing reloads or jumps.
  const hashOf = () => decodeURIComponent(document.URL.split('#')[1] || '');
  let current = tiles[0];
  let open = null;
  // Below 60rem the panel is a bottom sheet over the page, so while it is open it is a modal dialog: focus moves
  // into it and Tab stays inside. From 60rem it is a side column next to the grid and stays a plain region.
  const sheet = window.matchMedia('(max-width: 59.99rem)');
  const modal = () => Boolean(open) && sheet.matches;
  const setMode = () => {
    panel.setAttribute('role', modal() ? 'dialog' : 'region');
    if (modal()) panel.setAttribute('aria-modal', 'true'); else panel.removeAttribute('aria-modal');
  };
  if (sheet.addEventListener) sheet.addEventListener('change', setMode); else sheet.addListener(setMode);

  grid.setAttribute('role', 'grid');
  for (const el of grid.querySelectorAll('[role="cell"]')) el.setAttribute('role', 'gridcell');
  const roving = (t) => { for (const x of tiles) x.tabIndex = x === t ? 0 : -1; current = t; };
  roving(current);
  // The list stays complete and in the page; with the panel working it starts folded.
  notes.open = false;

  const show = (tile, focus) => {
    if (open) open.removeAttribute('aria-current');
    open = tile;
    tile.setAttribute('aria-current', 'true');
    roving(tile);
    const src = entry(tile).querySelector('.cell').cloneNode(true);
    src.removeAttribute('id');
    title.textContent = '';
    title.append(grid.querySelector(`.mrow[data-file="${tile.dataset.file}"] code`).cloneNode(true), ' × ', src.querySelector('.an-tool').textContent);
    src.querySelector('.an-tool').remove();
    content.textContent = '';
    content.append(src);
    empty.hidden = true;
    view.hidden = false;
    panel.classList.add('is-open');
    scrim.hidden = false;
    setMode();
    // On a desktop the panel sits at the top of the side column, so focusing its title must not scroll the page
    // away from the tile that was clicked. The phone sheet is fixed, so there is nothing to scroll there.
    if (focus || modal()) title.focus({ preventScroll: !modal() });
  };
  const close = () => {
    if (!open) return;
    const tile = open;
    open.removeAttribute('aria-current');
    open = null;
    view.hidden = true;
    empty.hidden = false;
    panel.classList.remove('is-open');
    scrim.hidden = true;
    setMode();
    history.replaceState(null, '', document.URL.split('#')[0]);
    tile.focus();
  };
  // #d-tool--file is the address of an open cell; the older #cell-tool-file of digests and answer pages opens it too.
  const fromHash = () => {
    const h = hashOf();
    const tile = tiles.find((t) => h === `d-${t.dataset.tool}--${t.dataset.file}` || h === `cell-${t.dataset.tool}-${t.dataset.file}`);
    if (!tile) return;
    show(tile, false);
    tile.scrollIntoView({ block: 'center' });
  };

  grid.addEventListener('click', (e) => {
    const tile = e.target.closest('a.mt');
    if (!tile) return;
    e.preventDefault();
    history.replaceState(null, '', tile.getAttribute('href'));
    show(tile, true);
  });
  panel.querySelector('.panel-close').addEventListener('click', close);
  scrim.addEventListener('click', close);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) close(); });
  window.addEventListener('hashchange', fromHash);
  // Focus trap of the sheet: Tab from the last control goes back to the first, Shift+Tab from the first (or the
  // title) to the last, and focus that lands outside, by a click or a screen reader, comes back to the title.
  const focusables = () => [...panel.querySelectorAll('a[href], button:not([disabled])')].filter((x) => x.offsetParent !== null);
  panel.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab' || !modal()) return;
    const list = focusables();
    if (!list.length) return;
    const first = list[0];
    const last = list[list.length - 1];
    const at = document.activeElement;
    if (e.shiftKey && (at === first || at === title)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && at === last) { e.preventDefault(); first.focus(); }
  });
  document.addEventListener('focusin', (e) => { if (modal() && !panel.contains(e.target)) title.focus(); });

  // Arrow keys move between the tiles that are shown and match the filters; Home and End go to the ends of a
  // row, with Ctrl to the first or last cell of the grid.
  const live = (t) => !t.classList.contains('is-off') && t.offsetParent !== null;
  grid.addEventListener('keydown', (e) => {
    const tile = e.target.closest('a.mt');
    if (!tile) return;
    const shownRows = rows.filter((r) => !r.hidden).map((r) => tiles.filter((t) => t.dataset.file === r.dataset.file && live(t)));
    const cols = tiles.filter((t) => t.dataset.file === tile.dataset.file && t.offsetParent !== null).indexOf(tile);
    const r = shownRows.findIndex((row) => row.includes(tile));
    if (r < 0) return;
    const row = shownRows[r];
    const at = row.indexOf(tile);
    const near = (list) => list.reduce((best, t) => {
      const c = tiles.filter((x) => x.dataset.file === t.dataset.file && x.offsetParent !== null).indexOf(t);
      return !best || Math.abs(c - cols) < Math.abs(best.c - cols) ? { t, c } : best;
    }, null);
    let next = null;
    if (e.key === 'ArrowRight') next = row[at + 1];
    else if (e.key === 'ArrowLeft') next = row[at - 1];
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const step = e.key === 'ArrowDown' ? 1 : -1;
      for (let i = r + step; i >= 0 && i < shownRows.length && !next; i += step) { const hit = near(shownRows[i]); next = hit && hit.t; }
    } else if (e.key === 'Home') next = e.ctrlKey ? shownRows.find((x) => x.length)[0] : row[0];
    else if (e.key === 'End') next = e.ctrlKey ? shownRows.filter((x) => x.length).pop().slice(-1)[0] : row[row.length - 1];
    else return;
    e.preventDefault();
    if (next) { roving(next); next.focus(); }
  });

  // Filters: tiles that do not match turn neutral and leave the tab order, a row without a match folds, a
  // tool that is not selected loses its column. The "All notes" list below is never filtered.
  const bar = document.getElementById('matrix-filters');
  if (bar) {
    const fileText = (file) => notes.querySelector(`#an-${file}`).textContent + ' ' + notes.querySelector(`#an-${file} + .an-desc`).textContent;
    const model = {
      tools: [...new Set(tiles.map((t) => t.dataset.tool))],
      files: rows.map((r) => r.dataset.file),
      cells: tiles.map((t) => ({ tool: t.dataset.tool, file: t.dataset.file, status: t.dataset.status, text: fileText(t.dataset.file) + ' ' + entry(t).textContent }))
    };
    const search = document.getElementById('matrix-q');
    const toolButtons = [...bar.querySelectorAll('[data-filter-tool]')];
    const statusButtons = [...bar.querySelectorAll('[data-filter-status]')];
    const pressed = (list, attr) => list.filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.dataset[attr]);
    const message = document.getElementById('matrix-count');
    // Tools and Status open under the line of the bar; each toggle shows or hides its own group of chips.
    const toggles = [...bar.querySelectorAll('.filter-toggle')];
    const update = () => {
      const result = applyFilters(model, { tools: pressed(toolButtons, 'filterTool'), statuses: pressed(statusButtons, 'filterStatus'), query: search ? search.value : '' });
      for (const el of grid.querySelectorAll('[data-tool]:not(a)')) el.hidden = !result.visibleTools.has(el.dataset.tool);
      for (const r of rows) r.hidden = !result.visibleFiles.has(r.dataset.file);
      for (const t of tiles) t.classList.toggle('is-off', !result.matches.has(`${t.dataset.tool}/${t.dataset.file}`));
      if (!live(current)) { const first = tiles.find(live); if (first) roving(first); }
      message.textContent = countMessage(result);
      bar.querySelector('[data-filter-reset]').disabled = !result.active;
      for (const t of toggles) t.classList.toggle('is-active', Boolean(document.getElementById(t.getAttribute('aria-controls')).querySelector('[aria-pressed="true"]')));
    };
    bar.addEventListener('click', (e) => {
      const button = e.target.closest('button');
      if (!button || !bar.contains(button)) return;
      if (button.classList.contains('filter-toggle')) {
        const open = button.getAttribute('aria-expanded') !== 'true';
        button.setAttribute('aria-expanded', String(open));
        document.getElementById(button.getAttribute('aria-controls')).hidden = !open;
        return;
      }
      if (button.hasAttribute('data-filter-reset')) {
        for (const b of [...toolButtons, ...statusButtons]) b.setAttribute('aria-pressed', 'false');
        if (search) search.value = '';
      } else if (button.hasAttribute('aria-pressed')) {
        button.setAttribute('aria-pressed', button.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
      }
      update();
    });
    if (search) search.addEventListener('input', update);
    update();
  }
  fromHash();
}
