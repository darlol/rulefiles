// Loaded right after the "How to read the matrix" fold, synchronously, so it runs before the first paint.
// On a phone it closes the fold, so the grid starts on the first screen. Without scripts the fold stays open.
var fold = document.getElementById('matrix-intro');
if (fold && window.matchMedia && window.matchMedia('(max-width: 47.99rem)').matches) fold.open = false;
