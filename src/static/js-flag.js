// Loaded synchronously in the <head> of the pages that need it, before the first paint. It only marks that
// scripts run, so CSS can show controls that work only with JavaScript (the matrix filter bar) from the first
// render instead of revealing them later and moving the page. Same origin, no inline code: the CSP is unchanged.
document.documentElement.classList.add('js');
