// fit.js: keep a pane's interactive column inside the viewport.
//
// `--stage-max` is a *ceiling* for one stage — `100dvh` minus a guess at how much chrome sits
// around it. It cannot know what else a given pane stacks in its column: a transport, a method
// picker, a second strip stage, an equation the reader can drag. Panes carrying more than the
// guess ran off the bottom of the page, where `.pane-body`'s `overflow: hidden` quietly clipped
// them (panel 11's spine was ~300px over at 1280×720).
//
// So the budget is measured instead of guessed. After a pane mounts, and again whenever the
// pane box changes size, `fitPane` compares the column's height with the room below it and
// writes one number, `--fit`, onto the `.viz`. Every stage width in controls.css is multiplied
// by it, so the stages — the only part of a pane that can lose pixels without losing meaning —
// shrink together, keeping their aspect ratios, until the column clears the bottom edge.
// Controls and equations are never touched. `--fit` only ever shrinks (≤ 1): a pane that
// already fits is left exactly as it was.
//
// The prose column has the same problem and gets the same treatment, one column over: a long
// pane on a short viewport ran past the bottom and lost its last paragraph to the same
// `overflow: hidden`. There is nothing to shrink there but the type, so `--prose-fit` scales
// the font size and the measure together — the line stays the same number of characters wide
// and the column simply gets shorter. It stops at `MIN_PROSE`, below which the text is too
// small to be worth reading; a pane that needs more than that clips as it did before.
//
// The pass loop is a fixed point, not a search. Each pass measures the column as it currently
// stands, divides the stages' share back out by the fit in force to recover what they want at
// full size, and solves for the fit that lands the column on the bottom edge. One pass is
// exact when nothing else reflows; the extra passes are for the `.viz-row` panes, where a
// narrower stage column widens the controls beside it and can change their height.

const MIN_FIT = 0.3;      // past this a stage is too small to read; the pane clips instead
const MIN_PROSE = 0.8;    // 12.8px body text; past this the prose clips rather than shrink on
const PROSE_STEP = 0.05;  // quantized, so neighbouring panels do not all land on their own size
const EPSILON = 0.005;    // a smaller correction than this is not worth a reflow
const MARGIN = 1;         // px of slack the solve aims for, so it cannot sit on the boundary
const PASSES = 4;

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

const hasStage = el => el.classList.contains('stage') || el.querySelector('.stage');

/**
 * The height of `child` that shrinking the stages would actually take away. All of it for a
 * stage; nothing for a row of controls; for a row that puts a stage beside something else (a
 * `.viz-row`) only the height the stage has over its neighbour, because below that the
 * neighbour is what holds the row open and shrinking the stage buys nothing.
 */
function scalableHeight(child) {
  if (child.classList.contains('stage')) return child.getBoundingClientRect().height;
  if (!child.querySelector('.stage')) return 0;
  const top = child.getBoundingClientRect().top;
  let stagePart = 0, otherPart = 0;
  for (const part of child.children) {
    const extent = part.getBoundingClientRect().bottom - top;
    if (hasStage(part)) stagePart = Math.max(stagePart, extent);
    else otherPart = Math.max(otherPart, extent);
  }
  return Math.max(0, stagePart - otherPart);
}

/** Height of the column, the room it has, and how much of it is stage. */
function measure(article, viz) {
  const vizTop = viz.getBoundingClientRect().top;
  const avail = article.getBoundingClientRect().bottom - vizTop;
  let required = 0;
  let stages = 0;
  for (const child of viz.children) {
    const box = child.getBoundingClientRect();
    if (!box.height && !box.width) continue;   // display: none, or not laid out yet
    required = Math.max(required, box.bottom - vizTop);
    stages += scalableHeight(child);
  }
  return { avail, required, stages };
}

/** Solve for `--fit` and write it. Idempotent: a pane already fitted converges on pass one. */
export function fitViz(article, viz) {
  if (!viz.querySelector('.stage')) return;   // nothing here scales
  let fit = Number(viz.style.getPropertyValue('--fit')) || 1;
  let last = null;                            // the pass before: { fit, required }
  for (let pass = 0; pass < PASSES; pass++) {
    const { avail, required, stages } = measure(article, viz);
    if (avail <= 0 || stages <= 0) return;               // off-screen or laid out to nothing
    const over = required - avail;
    if (fit === 1 && over <= 0) return;                  // fits at full size: leave it alone
    const wanted = stages / fit;                         // stage height at --fit: 1
    let next = clamp((avail - MARGIN - (required - stages)) / wanted, MIN_FIT, 1);
    if (over > 0) {
      // The solve says this fits and it does not, so something under it reflowed as the stages
      // narrowed. Shrink by the shortfall instead — unless the pass before was itself a shrink
      // that bought no height, which means what is over the budget is not the stages' to give.
      if (last && last.fit > fit && last.required - required < 0.5) return;
      next = Math.min(next, clamp(fit * (avail - MARGIN) / required, MIN_FIT, 1));
    }
    if (Math.abs(next - fit) < (over > 0 ? 0.0005 : EPSILON)) return;
    last = { fit, required };
    fit = next;
    if (fit === 1) viz.style.removeProperty('--fit');
    else viz.style.setProperty('--fit', fit.toFixed(4));
  }
}

/**
 * Solve for `--prose-fit` and write it. Type and measure scale together, so the column's height
 * is very nearly linear in the scale and one pass lands it; the loop is for the rounding.
 */
export function fitProse(article, prose) {
  let fit = Number(prose.style.getPropertyValue('--prose-fit')) || 1;
  for (let pass = 0; pass < PASSES; pass++) {
    const top = prose.getBoundingClientRect().top;
    const avail = article.getBoundingClientRect().bottom - top;
    const required = [...prose.children].reduce((m, c) => Math.max(m, c.getBoundingClientRect().bottom), top) - top;
    if (avail <= 0 || required <= 0) return;
    if (fit === 1 && required <= avail) return;
    const wanted = required / fit;                                   // height at --prose-fit: 1
    const next = clamp(Math.floor(avail / wanted / PROSE_STEP) * PROSE_STEP, MIN_PROSE, 1);
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
  const viz = article?.querySelector('.viz');
  if (!viz) return;
  const prose = article.querySelector('.prose');
  let busy = false;
  const run = () => {
    if (busy) return;
    busy = true;
    try {
      fitViz(article, viz);
      if (prose) fitProse(article, prose);
    } finally { busy = false; }
  };
  run();
  // The pane box changes with the viewport; the column changes when a pane finishes settling
  // after mount or when something in it grows. Both are watched, `.viz` included: a solve is
  // idempotent, so the observer's own notification re-measures, finds nothing to change, and
  // writes nothing — the loop stops itself rather than needing to be kept out.
  const ro = new ResizeObserver(run);
  ro.observe(container);
  ro.observe(viz);
  signal?.addEventListener('abort', () => ro.disconnect(), { once: true });
}
