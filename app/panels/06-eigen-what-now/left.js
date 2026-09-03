// Panel 6, left: matrices as transformations, nothing more. One matrix, shown as a
// homogeneous 3×3 with the bottom row pinned to [0 0 1], and three controls that drive it:
// translate (x and y), rotate, scale. The matrix entries are the *output* — they update as a
// control moves, and the entries that control writes are highlighted while it is being
// dragged. Translation is why the matrix is 3×3: a 2×2 has nowhere to put it, and the
// translation column is the thing worth pointing at.
//
// The highlight is the shared .mn-hi class on the <mn> slots (controls.css): MathML's own
// mathbackground paints the bare glyph box, with no padding or radius, and reads as a blot.
//
// Ownership, per the composition M = T(tx, ty) · R(θ) · S(s):
//   translate → the third column          always exact
//   rotate    → all four of the top-left block   always exact
//   scale     → the two diagonal entries at θ = 0, all four once the shape has been turned,
//               because s multiplies sin θ as well as cos θ. Computed from θ, not from the
//               drag, so it never flickers.
// No eigenvectors here.

import { el, fragment } from 'shared/dom.js';
import { createStore } from 'shared/state.js';
import { createStage } from 'shared/gfx/stage.js';
import { cssVar, makeView, drawGrid, drawShape, drawArrow, drawText } from 'shared/gfx/plot2d.js';
import { bindMath } from 'shared/ui/livemath.js';
import { bindScrub } from 'shared/ui/scrub.js';
import { controls } from 'shared/ui/controls.js';
import { trs, applyPoint, areaFactor, drawAffineGrid } from './affine.js';

const HALF_W = 3.4;
const D2R = Math.PI / 180;
const SHAPE = [[0, 0], [1.4, 0], [1.4, 0.6], [0.9, 0.6], [0.9, 1.5], [0.4, 1.5], [0.4, 0.6], [0, 0.6]];   // an "F", so a turn shows
const START = { tx: 0, ty: 0, theta: 0, s: 1 };
const LIMITS = { tx: [-2, 2], ty: [-2, 2], theta: [-180, 180], s: [0.25, 1.75] };
const CELLS = ['m00', 'm01', 'm02', 'm10', 'm11', 'm12'];
const BLOCK = ['m00', 'm01', 'm10', 'm11'];

const slot = key => `<mn data-var="${key}" data-digits="2">0.00</mn>`;
const numberMatrix = () => fragment(`
  <math display="block">
    <mrow>
      <mi>M</mi><mo>=</mo>
      <mrow><mo>[</mo><mtable>
        <mtr><mtd>${slot('m00')}</mtd><mtd>${slot('m01')}</mtd><mtd>${slot('m02')}</mtd></mtr>
        <mtr><mtd>${slot('m10')}</mtd><mtd>${slot('m11')}</mtd><mtd>${slot('m12')}</mtd></mtr>
        <mtr><mtd><mn>0</mn></mtd><mtd><mn>0</mn></mtd><mtd><mn>1</mn></mtd></mtr>
      </mtable><mo>]</mo></mrow>
    </mrow>
  </math>
  <small class="muted">
    <math><mrow><mtext>det</mtext><mo>=</mo><msup><mi>s</mi><mn>2</mn></msup><mo>=</mo>
      <mn data-var="det" data-digits="2">1.00</mn></mrow></math>: every area is multiplied by that.
  </small>`);

export function mount(root, ctx) {
  const { signal } = ctx;
  const article = root.closest('article') ?? root;
  const local = createStore(START, {
    limits: LIMITS,
    validate: key => { throw new Error(`unknown transform control: ${key}`); },
    presets: {},
  });
  const M = () => { const { tx, ty, theta, s } = local.get(); return trs({ tx, ty, theta: theta * D2R, s }); };

  // ---- the picture: a shape under M, the images of the two unit arrows, the moved origin ----
  const box = el('div', { class: 'viz-row' });
  root.append(box);
  const stage = createStage(box, { layers: ['plane'], aspect: 'half', signal });
  const side = controls();
  box.append(side);

  stage.onDraw(({ w, h, dpr }) => {
    const m = M();
    const g = stage.ctx('plane');
    const view = makeView({ w, h, dpr, halfW: HALF_W });
    g.clearRect(0, 0, w, h);
    drawGrid(g, view, { xLabel: 'x', yLabel: 'y' });
    drawAffineGrid(g, view, m, { spacing: 0.5, extent: 12, color: cssVar('--accent'), alpha: 0.3 });
    drawShape(g, view, SHAPE, null, { fill: null, stroke: cssVar('--muted'), width: 1.5, alpha: 0.7 });
    drawShape(g, view, SHAPE.map(p => applyPoint(m, p)), null, { fill: cssVar('--accent-soft'), stroke: cssVar('--accent'), width: 2 });

    // where the origin went (the third column), and the two unit arrows from there
    const [ox, oy] = [m[0][2], m[1][2]];
    drawArrow(g, view, 0, 0, ox, oy, { color: cssVar('--fg'), width: 2, head: 7 });
    drawArrow(g, view, ox, oy, ox + m[0][0], oy + m[1][0], { color: cssVar('--approx'), width: 2, head: 7 });
    drawArrow(g, view, ox, oy, ox + m[0][1], oy + m[1][1], { color: cssVar('--stable'), width: 2, head: 7 });
    drawText(g, view, 'third column: the origin', ox, oy, { color: cssVar('--fg'), size: 11, dx: 8, dy: -6 });
    drawText(g, view, 'first column', ox + m[0][0], oy + m[1][0], { color: cssVar('--approx'), size: 11, dx: 6, dy: 14 });
    drawText(g, view, 'second column', ox + m[0][1], oy + m[1][1], { color: cssVar('--stable'), size: 11, dx: 6, dy: -6 });
    drawText(g, view, 'before', SHAPE[4][0], SHAPE[4][1], { color: cssVar('--muted'), size: 11, dx: 6, dy: -4 });
  });

  // ---- the matrix (output) and the prose's own T(tx,ty)·R(θ)·S(s) (input) ----
  side.append(numberMatrix());
  const cells = Object.fromEntries(CELLS.map(key => [key, article.querySelector(`[data-var="${key}"]`)]));

  // Which entries a scrub writes. Translate and rotate are fixed; scale spills into the
  // off-diagonal exactly when sin θ ≠ 0, so the rule is read off θ and never flickers. Each
  // group's own scrub nodes (not a slider container) arm the highlight now.
  const scrubNode = key => article.querySelector(`[data-scrub="${key}"]`);
  const GROUPS = [
    { keys: ['tx', 'ty'], cells: () => ['m02', 'm12'] },
    { keys: ['theta'], cells: () => BLOCK },
    { keys: ['s'], cells: () => (Math.abs(Math.sin(local.get().theta * D2R)) < 1e-9 ? ['m00', 'm11'] : BLOCK) },
  ];
  let active = null;
  function paint() {
    const on = new Set(active ? active.cells() : []);
    for (const [key, node] of Object.entries(cells)) node.classList.toggle('mn-hi', on.has(key));
  }
  const arm = g => () => { active = g; paint(); };
  const disarm = () => { if (!active) return; active = null; paint(); };
  for (const g of GROUPS) {
    for (const key of g.keys) {
      const node = scrubNode(key);
      node.addEventListener('pointerdown', arm(g), { signal });
      node.addEventListener('keydown', arm(g), { signal });
    }
  }
  for (const type of ['pointerup', 'pointercancel', 'keyup']) window.addEventListener(type, disarm, { signal });
  const offScrub = bindScrub(article, local, { signal });

  bindMath(article, local, () => {
    const m = M();
    return {
      m00: m[0][0], m01: m[0][1], m02: m[0][2],
      m10: m[1][0], m11: m[1][1], m12: m[1][2],
      det: areaFactor(m),
    };
  }, { signal });

  const unsub = local.subscribe(() => { paint(); stage.invalidate(); });
  return { destroy() { unsub(); offScrub(); } };
}
