// Panel 2, left: vectors alone, the step down from the spine — the same picture with the
// force models taken away, so both arrows are free.
//
// `a` runs from the origin; `b` runs from a's tip, so the drawing *is* the decomposition and
// `a + b` is the arrow from the origin to b's tip. Drag either tip, or scrub any of the four
// components in the equation. The dashed copies (b from the origin, a from b's tip) close the
// parallelogram: head to tail either way lands on the same sum.
//
// The four components live in a pane-local store, not the scene: a force can only be scaled
// along the direction its model gives it (gravity has one parameter and always points at the
// attractor), and a vector refresher needs two arrows that turn freely. Nothing here writes
// the scene or the tuple.

import { fragment } from 'shared/dom.js';
import { createStore } from 'shared/state.js';
import { createStage } from 'shared/gfx/stage.js';
import { createDragHandles } from 'shared/gfx/drag.js';
import { cssVar, makeView, drawGrid, drawPolyline, drawText } from 'shared/gfx/plot2d.js';
import { bindScrub } from 'shared/ui/scrub.js';
import { bindMath } from 'shared/ui/livemath.js';
import { SUM_COLOR, IDENTITY_MAP, drawForceArrow, mag } from './arrows.js';

const A_COLOR = '--accent';
const B_COLOR = '--region-edge';
const HALF_W = 4;              // the view never gets smaller than this
const REACH = 3.6;             // a drag cannot put either tip outside this box
const A_COMP = [-REACH, REACH];        // a runs from the origin, so its components reach as far
const B_COMP = [-2 * REACH, 2 * REACH];  // b runs from a's tip: corner to corner is twice that

/** a and b, tail to tip: the defaults put both arrows and their sum well inside the view. */
const START = { ax: 2.5, ay: 1.5, bx: 1, by: -3 };

const num = key => `<mn data-var="${key}" data-scrub="${key}" data-digits="2">0</mn>`;
const pair = (x, y) => `<mo>(</mo>${num(x)}<mo>,</mo>${num(y)}<mo>)</mo>`;
const sum = `<mo>(</mo><mn data-var="sx" data-digits="2">0</mn><mo>,</mo><mn data-var="sy" data-digits="2">0</mn><mo>)</mo>`;

const EQUATIONS = `
<math display="block"><mrow>
  <mi>a</mi><mo>+</mo><mi>b</mi><mo>=</mo>${pair('ax', 'ay')}<mo>+</mo>${pair('bx', 'by')}<mo>=</mo>${sum}
</mrow></math>
<math display="block"><mrow>
  <mo>|</mo><mi>a</mi><mo>|</mo><mo>=</mo><mn data-var="la" data-digits="2">0</mn><mo>,</mo><mspace width="1em"/>
  <mo>|</mo><mi>b</mi><mo>|</mo><mo>=</mo><mn data-var="lb" data-digits="2">0</mn><mo>,</mo><mspace width="1em"/>
  <mo>|</mo><mi>a</mi><mo>+</mo><mi>b</mi><mo>|</mo><mo>=</mo><mn data-var="ls" data-digits="2">0</mn>
  <mo>≤</mo><mo>|</mo><mi>a</mi><mo>|</mo><mo>+</mo><mo>|</mo><mi>b</mi><mo>|</mo><mo>=</mo><mn data-var="lab" data-digits="2">0</mn>
</mrow></math>`;

/**
 * A vector's name beside the middle of its shaft, pushed off along the left normal. Tip
 * labels would collide here: b's tip and the sum's tip are the same point.
 */
function labelShaft(g, view, from, d, text, color) {
  const l = mag(d);
  if (l < 0.3) return;
  const nx = -d[1] / l, ny = d[0] / l;   // the plot-space left normal; Y is flipped in pixels
  drawText(g, view, text, from[0] + d[0] / 2, from[1] + d[1] / 2,
    { color: cssVar(color), size: 12, align: 'center', dx: nx * 14, dy: 4 - ny * 14 });
}

export function mount(root, ctx) {
  const { signal } = ctx;
  const article = root.closest('article') ?? root;
  let view = null, frozenHalf = null;

  const vecs = createStore({ ...START }, {
    limits: { ax: A_COMP, ay: A_COMP, bx: B_COMP, by: B_COMP },
    validate: () => undefined,
    presets: {},
  });
  const parts = () => {
    const { ax, ay, bx, by } = vecs.get();
    return { a: [ax, ay], b: [bx, by], s: [ax + bx, ay + by] };
  };
  /**
   * The view only ever grows past HALF_W, and only because a scrub can push a component past
   * REACH — a dragged tip is clamped inside it, so the plane never moves under the pointer.
   * It is frozen for the length of a drag anyway, in case a scrub already grew it.
   */
  const halfNow = ({ a, b, s }) => frozenHalf ?? Math.max(HALF_W, 1.12 * Math.max(...[a, b, s].flat().map(Math.abs)));

  const stage = createStage(root, { layers: ['plane'], aspect: 'square', signal });
  root.append(fragment(EQUATIONS));

  stage.onDraw(({ w, h, dpr }) => {
    const { a, b, s } = parts();
    const g = stage.ctx('plane');
    view = makeView({ w, h, dpr, halfW: halfNow({ a, b, s }) });
    g.clearRect(0, 0, w, h);
    drawGrid(g, view, { xLabel: 'x', yLabel: 'y' });

    // the parallelogram: each arrow copied to the other's tail, dashed — head to tail either
    // way lands on the same sum
    const dim = cssVar('--tick');
    drawPolyline(g, view, [0, b[0]], [0, b[1]], { color: dim, width: 1, dash: [4, 4] });
    drawPolyline(g, view, [b[0], s[0]], [b[1], s[1]], { color: dim, width: 1, dash: [4, 4] });
    // components of the sum, dropped to the axes
    drawPolyline(g, view, [s[0], s[0]], [0, s[1]], { color: cssVar(SUM_COLOR), width: 1, dash: [2, 3], alpha: 0.6 });
    drawPolyline(g, view, [0, s[0]], [s[1], s[1]], { color: cssVar(SUM_COLOR), width: 1, dash: [2, 3], alpha: 0.6 });

    // the decomposition itself: a from the origin, b from a's tip, the sum closing them.
    // b and a + b share a tip, so the names go beside each shaft, not at the point.
    drawForceArrow(g, view, [0, 0], a, IDENTITY_MAP, { color: A_COLOR, width: 2.5 });
    drawForceArrow(g, view, a, b, IDENTITY_MAP, { color: B_COLOR, width: 2.5 });
    drawForceArrow(g, view, [0, 0], s, IDENTITY_MAP, { color: SUM_COLOR, width: 3.5, head: 10 });
    labelShaft(g, view, [0, 0], a, 'a', A_COLOR);
    labelShaft(g, view, a, b, 'b', B_COLOR);
    labelShaft(g, view, [0, 0], s, 'a + b', SUM_COLOR);

    drawText(g, view, 'drag either tip', view.xMin, view.yMin, { color: cssVar('--muted'), size: 11, dx: 8, dy: -8 });
  });

  createDragHandles(stage.canvas('plane'), {
    signal, hitRadius: 14,
    handles: () => {
      const { a, s } = parts();
      return [{ id: 'a', x: a[0], y: a[1] }, { id: 'b', x: s[0], y: s[1] }];
    },
    view: () => view ?? makeView({ w: 1, h: 1, dpr: 1, halfW: HALF_W }),
    onStart: () => { frozenHalf = view?.xMax ?? HALF_W; },
    onMove: (id, p) => {
      const x = Math.max(-REACH, Math.min(REACH, p.x)), y = Math.max(-REACH, Math.min(REACH, p.y));
      if (id === 'a') { vecs.set({ ax: x, ay: y }); return; }
      const { ax, ay } = vecs.get();          // b's handle is its tip, a + b: b is the difference
      vecs.set({ bx: x - ax, by: y - ay });
    },
    onEnd: () => { frozenHalf = null; stage.invalidate(); },
  });

  bindScrub(article, vecs, { signal });
  bindMath(article, vecs, ({ ax, ay, bx, by }) => {
    const a = [ax, ay], b = [bx, by], s = [ax + bx, ay + by];
    return { sx: s[0], sy: s[1], la: mag(a), lb: mag(b), ls: mag(s), lab: mag(a) + mag(b) };
  }, { signal });

  const unsub = vecs.subscribe(stage.invalidate, { immediate: false });
  return { destroy() { unsub(); } };
}
