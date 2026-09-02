// Panel 6, left: matrices as transformations, nothing more. A shape on the plane and the
// matrix that moves it; the four entries are scrubbable numbers in a local store with its
// own limits. Scale, skew, rotate, and a few presets. No eigenvectors here.

import { el, fmt, fragment } from 'shared/dom.js';
import { createStore } from 'shared/state.js';
import { createStage } from 'shared/gfx/stage.js';
import { cssVar, makeView, drawGrid, drawTransformedGrid, drawShape, drawArrow, drawText } from 'shared/gfx/plot2d.js';
import { mdet } from 'shared/math/matrix2.js';
import { bindScrub } from 'shared/ui/scrub.js';
import { readout, controls } from 'shared/ui/controls.js';

const HALF_W = 3.2;
const ENTRY = [-3, 3];
const SHAPE = [[0, 0], [1.4, 0], [1.4, 0.6], [0.9, 0.6], [0.9, 1.5], [0.4, 1.5], [0.4, 0.6], [0, 0.6]];   // an "F", so a flip shows
const TH = Math.PI / 6;
const PRESETS = {
  identity: { a: 1, b: 0, c: 0, d: 1 },
  scale:    { a: 2, b: 0, c: 0, d: 0.5 },
  skew:     { a: 1, b: 0.8, c: 0, d: 1 },
  rotate:   { a: Math.cos(TH), b: -Math.sin(TH), c: Math.sin(TH), d: Math.cos(TH) },
  flip:     { a: -1, b: 0, c: 0, d: 1 },
};

const matrixMath = () => fragment(`
  <math display="block">
    <mrow>
      <mi>M</mi><mo>=</mo>
      <mrow><mo>[</mo><mtable>
        <mtr><mtd><mn data-scrub="a" data-digits="2">1.00</mn></mtd><mtd><mn data-scrub="b" data-digits="2">0.00</mn></mtd></mtr>
        <mtr><mtd><mn data-scrub="c" data-digits="2">0.00</mn></mtd><mtd><mn data-scrub="d" data-digits="2">1.00</mn></mtd></mtr>
      </mtable><mo>]</mo></mrow>
      <mspace width="1.5em"/>
      <mtext>det</mtext><mo>=</mo><mi>a</mi><mi>d</mi><mo>−</mo><mi>b</mi><mi>c</mi><mo>=</mo><mn data-var="det" data-digits="2">1.00</mn>
    </mrow>
  </math>`);

export function mount(root, ctx) {
  const { signal } = ctx;
  const local = createStore(PRESETS.identity, {
    limits: { a: ENTRY, b: ENTRY, c: ENTRY, d: ENTRY },
    validate: key => { throw new Error(`unknown matrix entry: ${key}`); },
    presets: PRESETS,
  });
  const M = () => { const { a, b, c, d } = local.get(); return [[a, b], [c, d]]; };

  root.append(matrixMath());
  const stage = createStage(root, { layers: ['plane'], aspect: 'wide', signal });
  const out = readout({ label: 'what M did' });

  stage.onDraw(({ w, h, dpr }) => {
    const m = M();
    const g = stage.ctx('plane');
    const view = makeView({ w, h, dpr, halfW: HALF_W });
    g.clearRect(0, 0, w, h);
    drawGrid(g, view, { xLabel: 'x', yLabel: 'y' });
    drawTransformedGrid(g, view, m, { spacing: 0.5, extent: 12, color: cssVar('--accent'), alpha: 0.3, axes: false });
    drawShape(g, view, SHAPE, null, { fill: null, stroke: cssVar('--muted'), width: 1.5, alpha: 0.7 });
    drawShape(g, view, SHAPE, m, { fill: cssVar('--accent-soft'), stroke: cssVar('--accent'), width: 2 });
    // the columns: where the two unit arrows land
    drawArrow(g, view, 0, 0, m[0][0], m[1][0], { color: cssVar('--approx'), width: 2, head: 7 });
    drawArrow(g, view, 0, 0, m[0][1], m[1][1], { color: cssVar('--stable'), width: 2, head: 7 });
    drawText(g, view, '(a, c) = M(1, 0)', m[0][0], m[1][0], { color: cssVar('--approx'), size: 11, dx: 6, dy: 14 });
    drawText(g, view, '(b, d) = M(0, 1)', m[0][1], m[1][1], { color: cssVar('--stable'), size: 11, dx: 6, dy: -6 });
    drawText(g, view, 'before', SHAPE[4][0], SHAPE[4][1], { color: cssVar('--muted'), size: 11, dx: 6, dy: -4 });

    const det = mdet(m);
    const { a, b, c, d } = local.get();
    const kind = Math.abs(b) < 1e-9 && Math.abs(c) < 1e-9 ? (Math.abs(a - d) < 1e-9 ? 'a uniform scale' : 'a scale along the axes')
      : Math.abs(a - d) < 1e-9 && Math.abs(b + c) < 1e-9 ? 'a rotation (times a scale)'
      : (Math.abs(a - 1) < 1e-9 && Math.abs(d - 1) < 1e-9 && (Math.abs(b) < 1e-9 || Math.abs(c) < 1e-9)) ? 'a skew' : 'a mix of scale, skew, and turn';
    out.set([
      `${kind}   area × ${fmt(Math.abs(det), 3)}${det < 0 ? ', mirrored (det < 0)' : det === 0 ? ', flattened to a line (det = 0)' : ''}\n`,
      el('span', { class: 'label' }, 'grid lines stay straight and parallel, the origin stays put; no invariant directions are drawn here'),
    ]);
  });

  root.append(controls(el('div', { class: 'transport' }, el('div', { class: 'transport-group' },
    ...Object.keys(PRESETS).map(name => el('button', { class: 'btn', type: 'button', onclick: () => local.preset(name) }, name)),
  ))));
  root.append(out.el);

  bindScrub(root.closest('article') ?? root, local, { signal });
  // det is derived; the scrubs own the entries' text
  const detSlot = (root.closest('article') ?? root).querySelector('[data-var="det"]');
  const unsub = local.subscribe(s => {
    if (detSlot) detSlot.textContent = fmt(s.a * s.d - s.b * s.c, 2);
    stage.invalidate();
  });
  return { destroy() { unsub(); } };
}
