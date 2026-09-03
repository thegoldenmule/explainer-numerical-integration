// Panel 6, spine: three things, in order. Â, a 2×2 matrix — every one of its four numbers a
// draggable number right in the equation; v, an arrow you drag around the plane (also
// draggable as numbers in that same equation); and R = Â v, drawn split into the part of v
// that lies along an invariant direction — scaled by that direction's eigenvalue — plus
// whatever is left over. Land v on a direction and the leftover is zero and R = λ v: an
// arrow that only changed length. That split is the whole panel; there is no readout under
// the picture, and no tuple write — this pane never reads m, c, k past the first frame.
//
// Â opens at the spring's own matrix in natural units, overdamped (ζ = PRESET_FACTOR, always
// −2·PRESET_FACTOR on the diagonal regardless of m and k — natural units is exactly what
// makes that entry a plain constant), so both invariant directions are real and visible from
// the first frame. From there every entry is the reader's own: drag one and Â stops being any
// spring's matrix at all, which is the point of the panel's opening line — "forget all the
// physics for a second," eigenvectors don't care where a matrix came from. A remount (this
// pane's whole state is a closure, not the shared store) opens fresh at the same overdamped
// default.

import { fmt, fragment, clamp } from 'shared/dom.js';
import { createStage } from 'shared/gfx/stage.js';
import { createDragHandles } from 'shared/gfx/drag.js';
import { cssVar, makeView, drawGrid, drawArrow, drawPolyline, drawText, drawPoint } from 'shared/gfx/plot2d.js';
import { eigen, apply } from 'shared/math/matrix2.js';
import { bindMath } from 'shared/ui/livemath.js';
import { bindScrub } from 'shared/ui/scrub.js';

const HALF_W = 2.6;
const NEAR_DEG = 4;        // within this angle of an eigenvector, it lights up
const PRESET_FACTOR = 1.5; // Â's default diagonal: ζ = PRESET_FACTOR, overdamped
const M_RANGE = [-10, 10]; // this pane's own drag range for every entry of Â
const V_RANGE = [-5, 5];   // and for v's own two components
const MATRIX_KEYS = ['a00', 'a01', 'a10', 'a11'];
const SUB = ['₁', '₂'];

const deg = rad => rad * 180 / Math.PI;
const angleBetweenLines = (u, v) => {
  const d = Math.abs(u[0] * v[0] + u[1] * v[1]) / (Math.hypot(u[0], u[1]) * Math.hypot(v[0], v[1]) || 1);
  return deg(Math.acos(Math.min(1, d)));
};

/**
 * v in the eigenbasis: v = c₁û₁ + c₂û₂, so Âv = λ̂₁c₁û₁ + λ̂₂c₂û₂ exactly (an oblique
 * split, not an orthogonal projection — that is what makes the two pieces add up).
 * null whenever there is no basis to split into: a complex pair, a defective repeated root
 * (the two directions have met), or a pair so nearly parallel that the coefficients blow up.
 */
function decompose(e, v) {
  if (!e.real || !e.vectors || e.defective) return null;
  const [u1, u2] = e.vectors;
  const det = u1[0] * u2[1] - u2[0] * u1[1];
  if (!Number.isFinite(det) || Math.abs(det) < 1e-6) return null;
  const c1 = (u2[1] * v[0] - u2[0] * v[1]) / det;
  const c2 = (u1[0] * v[1] - u1[1] * v[0]) / det;
  const lam = [e.values[0][0], e.values[1][0]];
  const p = [[c1 * u1[0], c1 * u1[1]], [c2 * u2[0], c2 * u2[1]]];
  const q = [[lam[0] * p[0][0], lam[0] * p[0][1]], [lam[1] * p[1][0], lam[1] * p[1][1]]];
  if (![c1, c2, ...p.flat(), ...q.flat()].every(n => Number.isFinite(n))) return null;
  return { c: [c1, c2], u: [u1, u2], p, q, lam };
}

const sup = (name, i) => `<msub><mover><mi>${name}</mi><mo>^</mo></mover><mn>${i}</mn></msub>`;
const col = (a, b) => `<mrow><mo>[</mo><mtable><mtr><mtd>${a}</mtd></mtr><mtr><mtd>${b}</mtd></mtr></mtable><mo>]</mo></mrow>`;
const slot = (name, digits, initial) => `<mn data-var="${name}" data-digits="${digits}">${initial}</mn>`;
const scrub = (name, digits, initial) => `<mn data-var="${name}" data-scrub="${name}" data-digits="${digits}">${initial}</mn>`;

/** Â, v and R as one equation — every entry of Â and both of v draggable, R read-only,
 *  since it is what they produce — then the split of R. No readout under either. */
const equations = () => fragment(`
  <div>
    <math display="block">
      <mrow>
        <mover><mi>A</mi><mo>^</mo></mover><mi>v</mi><mo>=</mo>
        <mrow><mo>[</mo><mtable>
          <mtr><mtd>${scrub('a00', 2, '0.00')}</mtd><mtd>${scrub('a01', 2, '1.00')}</mtd></mtr>
          <mtr><mtd>${scrub('a10', 2, '−1.00')}</mtd><mtd>${scrub('a11', 2, '−3.00')}</mtd></mtr>
        </mtable><mo>]</mo></mrow>
        ${col(scrub('vx', 2, '1.20'), scrub('vy', 2, '0.90'))}
        <mo>=</mo>
        ${col(slot('rx', 2, '0.90'), slot('ry', 2, '−3.90'))}
        <mo>=</mo><mi>R</mi>
      </mrow>
    </math>
    <math display="block">
      <mrow>
        <mi>R</mi><mo>=</mo>
        ${sup('λ', 1)}<msub><mi>c</mi><mn>1</mn></msub>${sup('u', 1)}
        <mo>+</mo>
        ${sup('λ', 2)}<msub><mi>c</mi><mn>2</mn></msub>${sup('u', 2)}
      </mrow>
    </math>
  </div>`);

export function mount(root, ctx) {
  const { signal } = ctx;
  const article = root.closest('article') ?? root;
  // Â, opened at the spring's own natural-units matrix, overdamped; v, the dragged vector.
  // Both are this pane's own from the first frame — nothing here reads the tuple at all.
  let matrix = { a00: 0, a01: 1, a10: -1, a11: -2 * PRESET_FACTOR };
  let vec = [1.2, 0.9];     // in (x, v/ω) units
  let view = null;

  // A store-shaped view over every draggable number (Â's four entries, v's two): unique
  // keys, so bindScrub and bindMath take the article once and every slot follows. R is not
  // here — it is what these produce, read-only in the equation (livemath's slot() below).
  const subs = new Set();
  const snapshot = () => ({ ...matrix, vx: vec[0], vy: vec[1] });
  const local = {
    get: snapshot,
    set(patch) {
      let changed = false;
      for (const k of MATRIX_KEYS) {
        if (!Number.isFinite(patch[k])) continue;
        const v = clamp(patch[k], M_RANGE[0], M_RANGE[1]);
        if (v !== matrix[k]) { matrix = { ...matrix, [k]: v }; changed = true; }
      }
      if (Number.isFinite(patch.vx)) { const v = clamp(patch.vx, V_RANGE[0], V_RANGE[1]); if (v !== vec[0]) { vec = [v, vec[1]]; changed = true; } }
      if (Number.isFinite(patch.vy)) { const v = clamp(patch.vy, V_RANGE[0], V_RANGE[1]); if (v !== vec[1]) { vec = [vec[0], v]; changed = true; } }
      if (changed) notify(patch);
      return snapshot();
    },
    subscribe(fn, { immediate = true } = {}) {
      subs.add(fn);
      if (immediate) { const s = snapshot(); fn(s, s); }
      return () => subs.delete(fn);
    },
    limits: { a00: M_RANGE, a01: M_RANGE, a10: M_RANGE, a11: M_RANGE, vx: V_RANGE, vy: V_RANGE },
  };

  /** Everything the picture reads, from one snapshot. */
  function model(s) {
    const Ahat = [[s.a00, s.a01], [s.a10, s.a11]];
    const e = eigen(Ahat);
    const v = [s.vx, s.vy];
    const dirs = e.vectors ? (e.defective ? [e.vectors[0]] : e.vectors) : [];
    let near = -1, off = Infinity;
    dirs.forEach((u, i) => { const a = angleBetweenLines(u, v); if (a < off) { off = a; near = i; } });
    return { Ahat, e, v, dirs, near, off, R: apply(Ahat, v), split: decompose(e, v) };
  }

  root.append(equations());
  const stage = createStage(root, { layers: ['plane'], aspect: 'half', signal });

  const notify = (patch) => { const s = snapshot(); for (const fn of subs) fn(s, patch ?? s); stage.invalidate(); };

  stage.onDraw(({ w, h, dpr }) => {
    const { e, v, R, dirs, near, off, split } = model(local.get());
    const g = stage.ctx('plane');
    view = makeView({ w, h, dpr, halfW: HALF_W });
    g.clearRect(0, 0, w, h);
    drawGrid(g, view, { xLabel: 'x', yLabel: 'v / ω', ticks: 6 });

    const DIR = [cssVar('--stable'), cssVar('--exact')];
    const landed = near >= 0 && off <= NEAR_DEG;

    // the invariant directions, lit when the dragged vector lands on one
    const L = 3 * HALF_W;
    dirs.forEach((u, i) => {
      const lit = landed && i === near;
      drawPolyline(g, view, [-L * u[0], L * u[0]], [-L * u[1], L * u[1]], {
        color: DIR[i], width: lit ? 3 : 1.25, alpha: lit ? 1 : 0.5, dash: lit ? null : [6, 5],
      });
      drawText(g, view, `û${SUB[i]}, λ̂ = ${fmt(e.values[i][0], 2)}`, u[0] * 0.62 * HALF_W, u[1] * 0.62 * HALF_W,
        { color: DIR[i], size: 11, dx: 6, dy: -6 });
    });

    // R, split head to tail: the piece along the direction v is nearest to, then the rest
    if (split) {
      const [ia, ib] = near === 1 ? [1, 0] : [0, 1];
      const pa = split.p[ia], qa = split.q[ia];
      drawPolyline(g, view, [0, pa[0]], [0, pa[1]], { color: DIR[ia], width: 1.5, alpha: 0.7, dash: [5, 4] });
      drawPolyline(g, view, [pa[0], v[0]], [pa[1], v[1]], { color: DIR[ib], width: 1.5, alpha: 0.7, dash: [5, 4] });
      drawArrow(g, view, 0, 0, qa[0], qa[1], { color: DIR[ia], width: 2, head: 7 });
      drawArrow(g, view, qa[0], qa[1], R[0], R[1], { color: DIR[ib], width: 2, head: 7 });
      drawText(g, view, `λ̂${SUB[ia]} c${SUB[ia]} û${SUB[ia]}`, qa[0] / 2, qa[1] / 2, { color: DIR[ia], size: 11, dx: 6, dy: 14 });
      drawText(g, view, landed ? 'the rest: zero' : `λ̂${SUB[ib]} c${SUB[ib]} û${SUB[ib]}`, (qa[0] + R[0]) / 2, (qa[1] + R[1]) / 2,
        { color: DIR[ib], size: 11, dx: 6, dy: -6 });
    }

    // v and its image
    drawArrow(g, view, 0, 0, v[0], v[1], { color: cssVar('--fg'), width: 2.5, head: 9 });
    drawPoint(g, view, v[0], v[1], { r: 5, fill: cssVar('--fg') });
    drawText(g, view, 'v (drag)', v[0], v[1], { color: cssVar('--fg'), size: 11, dx: 8, dy: -6 });
    drawArrow(g, view, 0, 0, R[0], R[1], { color: cssVar('--approx'), width: 2.5, head: 9 });
    drawText(g, view, 'R = Â v', R[0], R[1], { color: cssVar('--approx'), size: 11, dx: 8, dy: 14 });

    // the one sentence that used to live in the readout
    const huge = split && Math.max(...split.q.flat().map(Math.abs)) > 2.5 * HALF_W;
    const note = !e.real ? ['λ̂ has gone complex: no real invariant direction', 'every v turns, so R never lines up with v']
      : e.defective ? ['critically damped: the two directions have met', 'there is one direction left, and nothing to split into']
      : landed ? [`v is on û${SUB[near]}: the rest is zero`, `R = ${fmt(e.values[near][0], 3)} v — it only changed length`]
      : huge ? ['the two directions are nearly parallel', 'both pieces run off the frame and all but cancel']
      : [`v is ${fmt(off, 1)}° off û${SUB[near]}`, 'the second piece is what turns R away from v'];
    note.forEach((line, i) => drawText(g, view, line, view.xMin, view.yMax,
      { color: cssVar(landed ? '--stable' : e.real ? '--muted' : '--unstable'), size: 12, dx: 10, dy: 18 + i * 15 }));
  });

  createDragHandles(stage.canvas('plane'), {
    signal, hitRadius: 14,
    handles: () => [{ id: 'v', x: vec[0], y: vec[1] }],
    view: () => view ?? makeView({ w: 1, h: 1, dpr: 1, halfW: HALF_W }),
    onMove: (id, p) => {
      if (Math.hypot(p.x, p.y) < 0.05) return;
      vec = [p.x, p.y];
      notify();
    },
  });

  // The picture is the argument; the slots carry only Â's own numbers, v, and R = Â v (read-
  // only). The verdict sentence and the eigen-directions live on the canvas (drawText), not here.
  bindScrub(article, local, { signal });
  bindMath(article, local, s => {
    const { R } = model(s);
    return { ...s, rx: R[0], ry: R[1] };
  }, { signal });

  return { destroy() { subs.clear(); } };
}
