// Panel 5, left: what linear means. One function f, two draggable inputs a and b, and the
// check f(a + b) = f(a) + f(b): a, b, and a + b sit on the x axis with their outputs dropped
// to the curve, and the readout does the arithmetic. f(x) = 2x passes; f(x) = x² fails by
// exactly 2ab.

import { el, fmt } from 'shared/dom.js';
import { createStage } from 'shared/gfx/stage.js';
import { createDragHandles } from 'shared/gfx/drag.js';
import { cssVar, makeView, drawGrid, drawPolyline, drawPoint, drawText } from 'shared/gfx/plot2d.js';
import { readout, controls } from 'shared/ui/controls.js';

const HALF_W = 3.2;
const FUNCTIONS = {
  linear: { label: 'f(x) = 2x', f: x => 2 * x, cross: () => 0 },
  square: { label: 'f(x) = x²', f: x => x * x, cross: (a, b) => 2 * a * b },
};

export function mount(root, ctx) {
  const { signal } = ctx;
  let kind = 'linear';
  let a = 0.8, b = 1.3;
  let view = null;

  const stage = createStage(root, { layers: ['plot'], aspect: 'wide', signal });
  const out = readout({ label: 'the check' });

  stage.onDraw(({ w, h, dpr }) => {
    const { f, cross } = FUNCTIONS[kind];
    const g = stage.ctx('plot');
    const yMax = kind === 'square' ? 8 : 6.5;
    view = makeView({ w, h, dpr, xMin: -HALF_W, xMax: HALF_W, yMin: -yMax * 0.45, yMax });
    g.clearRect(0, 0, w, h);
    drawGrid(g, view, { xLabel: 'x', yLabel: 'f(x)' });

    const xs = [], ys = [];
    for (let i = 0; i <= 200; i++) { const x = -HALF_W + 2 * HALF_W * i / 200; xs.push(x); ys.push(f(x)); }
    drawPolyline(g, view, xs, ys, { color: cssVar('--fg'), width: 1.5 });

    const fa = f(a), fb = f(b), fab = f(a + b), sum = fa + fb;
    const blue = cssVar('--exact'), green = cssVar('--stable'), red = cssVar('--approx');
    // drops from the three points to the axes
    for (const [x, y, color] of [[a, fa, blue], [b, fb, green], [a + b, fab, red]]) {
      drawPolyline(g, view, [x, x], [0, y], { color, width: 1, dash: [3, 3], alpha: 0.6 });
      drawPolyline(g, view, [x, 0], [y, y], { color, width: 1, dash: [3, 3], alpha: 0.6 });
      drawPoint(g, view, x, y, { r: 5, fill: color });
    }
    // handles on the axis
    drawPoint(g, view, a, 0, { r: 7, fill: blue });
    drawPoint(g, view, b, 0, { r: 7, fill: green });
    drawPoint(g, view, a + b, 0, { r: 5, fill: red, stroke: '#fff' });
    drawText(g, view, 'a', a, 0, { color: blue, size: 12, align: 'center', dy: 22 });
    drawText(g, view, 'b', b, 0, { color: green, size: 12, align: 'center', dy: 22 });
    drawText(g, view, 'a + b', a + b, 0, { color: red, size: 12, align: 'center', dy: -12 });

    const passes = Math.abs(sum - fab) < 1e-9;
    out.set([
      `f(a) + f(b) = ${fmt(fa, 2)} + ${fmt(fb, 2)} = ${fmt(sum, 2)}      f(a + b) = f(${fmt(a + b, 2)}) = ${fmt(fab, 2)}\n`,
      passes ? el('span', { class: 'stable' }, 'equal: linear') : el('span', { class: 'unstable' }, `off by ${fmt(fab - sum, 2)} = 2ab: not linear`),
      kind === 'square' ? `   (a + b)² = a² + 2ab + b², and the cross term 2ab = ${fmt(cross(a, b), 2)} is what a linear model must drop` : '   and f(s·a) = s·f(a) for the same reason: the graph is a line through the origin',
    ]);
  });

  createDragHandles(stage.canvas('plot'), {
    signal, hitRadius: 14,
    handles: () => [{ id: 'a', x: a, y: 0 }, { id: 'b', x: b, y: 0 }],
    view: () => view ?? makeView({ w: 1, h: 1, dpr: 1, xMin: -HALF_W, xMax: HALF_W, yMin: -1, yMax: 1 }),
    onMove: (id, p) => {
      const x = Math.max(-HALF_W + 0.1, Math.min(HALF_W - 0.1, p.x));
      if (id === 'a') a = x; else b = x;
      stage.invalidate();
    },
  });

  const buttons = Object.entries(FUNCTIONS).map(([k, v]) => el('button', { class: 'btn', type: 'button', 'aria-pressed': String(k === kind) }, v.label));
  buttons.forEach((btn, i) => btn.addEventListener('click', () => {
    kind = Object.keys(FUNCTIONS)[i];
    buttons.forEach((x, j) => x.setAttribute('aria-pressed', String(i === j)));
    stage.invalidate();
  }, { signal }));
  root.append(controls(el('div', { class: 'transport' }, el('div', { class: 'transport-group' }, ...buttons))));
  root.append(out.el);

  return { destroy() {} };
}
