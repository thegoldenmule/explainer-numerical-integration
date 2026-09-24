// fit.js: keep a pane's prose column inside the viewport.
//
// A long pane on a short viewport ran past the bottom and lost its last paragraph to
// `.pane-body`'s `overflow: hidden`. There is nothing to shrink in the prose but the type, so
// `--prose-fit` scales the font size and the measure together — the line stays the same
// number of characters wide and the column simply gets shorter. It stops at `MIN_PROSE`,
// below which the text is too small to be worth reading; a pane that needs more than that
// clips, and the fix is to write less.
//
// The interactive column needs no measuring: `.viz` is a flex column that fills its row, and
// its stages flex into whatever height the controls and equations leave (layout.css,
// controls.css, and CLAUDE.md's "Pane layout standard").

const MIN_PROSE = 0.8;    // 12.8px body text; past this the prose clips rather than shrink on
const PROSE_STEP = 0.05;  // quantized, so neighbouring panels do not all land on their own size
const EPSILON = 0.005;    // a smaller correction than this is not worth a reflow
const PASSES = 4;

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/**
 * Solve for `--prose-fit` and write it. Type and measure scale together, so the column's height
 * is very nearly linear in the scale and one pass lands it; the loop is for the rounding.
 */
export function fitProse(article, prose) {
  let fit = Number(prose.style.getPropertyValue('--prose-fit')) || 1;
  let ceiling = Infinity;                     // the smallest size measured over the budget
  for (let pass = 0; pass < PASSES; pass++) {
    const top = prose.getBoundingClientRect().top;
    const avail = article.getBoundingClientRect().bottom - top;
    const required = [...prose.children].reduce((m, c) => Math.max(m, c.getBoundingClientRect().bottom), top) - top;
    if (avail <= 0 || required <= 0) return;
    if (fit === 1 && required <= avail) return;
    // a size that measured over is never worth trying again: text wraps in steps, so the
    // near-linear solve can propose one, and without this the passes bounce between two
    // buckets and can run out on the wrong one
    if (required > avail) ceiling = Math.min(ceiling, fit);
    const wanted = required / fit;                                   // height at --prose-fit: 1
    const next = clamp(Math.min(Math.floor(avail / wanted / PROSE_STEP) * PROSE_STEP,
                                ceiling - PROSE_STEP), MIN_PROSE, 1);
    if (Math.abs(next - fit) < EPSILON) return;
    fit = next;
    if (fit === 1) prose.style.removeProperty('--prose-fit');
    else prose.style.setProperty('--prose-fit', fit.toFixed(2));
  }
}

/**
 * Fit the pane in `container` (a `.pane-body`) now, and again on every resize of it, until
 * `signal` aborts. Called by the loader for every pane; panes do not opt in.
 */
export function fitPane(container, signal) {
  const article = container.querySelector('article');
  const prose = article?.querySelector('.prose');
  if (!prose) return;
  const viz = article.querySelector('.viz');
  let busy = false;
  const run = () => {
    if (busy) return;
    busy = true;
    try { fitProse(article, prose); } finally { busy = false; }
  };
  run();
  // The pane box changes with the viewport, and a pane can finish settling after mount. Both
  // the pane and its `.viz` are watched: a solve is idempotent, so the observer's own
  // notification re-measures, finds nothing to change, and writes nothing.
  const ro = new ResizeObserver(run);
  ro.observe(container);
  if (viz) ro.observe(viz);
  signal?.addEventListener('abort', () => ro.disconnect(), { once: true });
}
