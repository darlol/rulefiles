// Progressive enhancement for the home digest tool chips. Without this script every item stays visible.
// No storage, no URL writes, no network.

const bar = document.getElementById('home-digest-filters');
const list = document.getElementById('home-digest-items');
if (bar && list) {
  const items = [...list.querySelectorAll(':scope > .item[data-tool]')];
  const toolButtons = [...bar.querySelectorAll('[data-filter-tool]')];
  const reset = bar.querySelector('[data-filter-reset]');

  const apply = () => {
    const selected = new Set(
      toolButtons.filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.dataset.filterTool)
    );
    for (const li of items) {
      li.hidden = selected.size > 0 && !selected.has(li.dataset.tool);
    }
    if (reset) reset.disabled = selected.size === 0;
  };

  bar.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button || !bar.contains(button)) return;
    if (button.hasAttribute('data-filter-reset')) {
      for (const b of toolButtons) b.setAttribute('aria-pressed', 'false');
    } else if (button.hasAttribute('data-filter-tool')) {
      button.setAttribute('aria-pressed', button.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
    } else {
      return;
    }
    apply();
  });

  apply();
}
