// Panel 6, spine: three things, in order. A, the spring's own 2×2 system matrix; v, an arrow
// you drag around the plane; and R = A v, drawn split into the part of v that lies along an
// invariant direction — scaled by that direction's eigenvalue — plus whatever is left over.
// Land v on a direction and the leftover is zero and R = λ v: an arrow that only changed
// length. That split is the whole panel; there is no readout under the picture.
//
// At the demo defaults A = [[0, 1], [−k/m, −c/m]] = [[0, 1], [−100, −c]]: a unit vector's
// image is a hundred units long and no single view holds both. So the grid is drawn in the
// spring's natural units, (x, v/ω) per 1/ω seconds, where the same matrix reads
// Â = [[0, 1], [−1, −2ζ]] with ζ = c / 2√(mk). Â is similar to A (a diagonal change of
// units), so its eigenvectors are A's in those units and its eigenvalues are λ/ω; the prose
// prints both.
//
// Per idea.md the panel wants an overdamped case to show real invariant directions, but the
// tuple's own c is the demo's lightly-damped 0.1 and this panel must never write the tuple
// (that write used to leak into every later panel — see the c slider on panels 7-13 landing
// on an overdamped spring after a reader passed through here). So damping here is entirely
// local to this pane: a `c` that defaults to an overdamped multiple of critical, recomputed
// only when the tuple's m or k change, and otherwise left alone — including while the reader
// drags it down through critical to watch the two directions converge and vanish.

import { fmt, fragment } from 'shared/dom.js';
import { createStage } from 'shared/gfx/stage.js';
import { createDragHandles } from 'shared/gfx/drag.js';
import { cssVar, makeView, drawGrid, drawArrow, drawPolyline, drawText, drawPoint } from 'shared/gfx/plot2d.js';
import { systemMatrix, regime, naturalFrequency, dampingRatio } from 'shared/math/system.js';
import { eigen, apply } from 'shared/math/matrix2.js';
import { bindMath } from 'shared/ui/livemath.js';
import { bindScrub } from 'shared/ui/scrub.js';

/** This pane's own range for c. Fixed, not derived from m and k: bindScrub reads a key's
 *  limits once at bind time, and 2√(mk) over the tuple's own m and k stays inside this. */
const C_RANGE = [0, 200];

const HALF_W = 2.6;
const NEAR_DEG = 4;        // within this angle of an eigenvector, it lights up
const PRESET_FACTOR = 1.5; // this pane's own default: c = PRESET_FACTOR · 2√(mk), overdamped
const SUB = ['₁', '₂'];
const DASH = '—';

const deg = rad => rad * 180 / Math.PI;
const angleBetweenLines = (u, v) => {
  const d = Math.abs(u[0] * v[0] + u[1] * v[1]) / (Math.hypot(u[0], u[1]) * Math.hypot(v[0], v[1]) || 1);
  return deg(Math.acos(Math.min(1, d)));
};
const fmtLam = ([re, im]) => (Math.abs(im) < 1e-12 ? fmt(re, 3) : `${fmt(re, 3)} ${im >= 0 ? '+' : '−'} ${fmt(Math.abs(im), 3)}i`);

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

/** Â, v and R as one equation, then the split of R, then the live numbers under both. */
const equations = () => fragment(`
  <div>
    <math display="block">
      <mrow>
        <mover><mi>A</mi><mo>^</mo></mover><mi>v</mi><mo>=</mo>
        <mrow><mo>[</mo><mtable>
          <mtr><mtd><mn>0</mn></mtd><mtd><mn>1</mn></mtd></mtr>
          <mtr><mtd><mn>−1</mn></mtd><mtd>${slot('ahat11', 2, '−3.00')}</mtd></mtr>
        </mtable><mo>]</mo></mrow>
        ${col(slot('vx', 2, '1.20'), slot('vy', 2, '0.90'))}
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
    <small class="muted">
      <math><mrow>${sup('λ', 1)}<mo>=</mo><mn data-var="lam1">−0.382</mn></mrow></math>,
      <math><mrow><msub><mi>c</mi><mn>1</mn></msub><mo>=</mo><mn data-var="c1" data-digits="2">0.00</mn></mrow></math>;
      <math><mrow>${sup('λ', 2)}<mo>=</mo><mn data-var="lam2">−2.618</mn></mrow></math>,
      <math><mrow><msub><mi>c</mi><mn>2</mn></msub><mo>=</mo><mn data-var="c2" data-digits="2">0.00</mn></mrow></math>.
      Natural units <math><mrow><mo>(</mo><mi>x</mi><mo>,</mo><mi>v</mi><mo>/</mo><mi>ω</mi><mo>)</mo></mrow></math>
      per <math><mrow><mn>1</mn><mo>/</mo><mi>ω</mi></mrow></math> s: the raw
      <math><mrow><mi>A</mi><mo>=</mo><mo>[</mo><mo>[</mo><mn>0</mn><mo>,</mo><mn>1</mn><mo>]</mo><mo>,</mo><mo>[</mo>${slot('a10', 2, '−100.00')}<mo>,</mo>${slot('a11', 2, '−30.00')}<mo>]</mo><mo>]</mo></mrow></math>,
      <math><mrow><mi>ω</mi><mo>=</mo>${slot('omega', 2, '10.00')}</mrow></math> /s. This pane’s own
      <math><mrow><mi>c</mi><mo>=</mo><mn data-var="localC" data-scrub="localC" data-digits="2">30.00</mn></mrow></math> against
      <math><mrow><mn>2</mn><msqrt><mrow><mi>m</mi><mi>k</mi></mrow></msqrt><mo>=</mo>${slot('critical', 2, '20.00')}</mrow></math>
      (<math><mi data-var="regime">overdamped</mi></math>) — the spring’s
      <math><mrow><mi>c</mi><mo>=</mo>${slot('c', 2, '0.10')}</mrow></math> is never written from
      here. Drag it below critical and the two directions meet and vanish.
    </small>
  </div>`);

export function mount(root, ctx) {
  const { store, signal } = ctx;
  const article = root.closest('article') ?? root;
  let vec = [1.2, 0.9];     // the dragged vector, in (x, v/ω) units
  let view = null;

  // This pane's own damping (never written to the tuple). Seeded from the tuple's current
  // m, k; recomputed only when either changes, otherwise preserved while the pane stays
  // mounted (dragging the slider below critical must not get overwritten on the next frame).
  const s0 = store.get();
  let mkKey = `${s0.m}/${s0.k}`;
  let localC = PRESET_FACTOR * 2 * Math.sqrt(s0.m * s0.k);

  function ensureLocalC(s) {
    const key = `${s.m}/${s.k}`;
    if (key === mkKey) return;
    mkKey = key;
    const critical = 2 * Math.sqrt(s.m * s.k);
    localC = PRESET_FACTOR * critical;
  }

  // The pane's own read-only view of the world: the tuple, plus the local damping and the
  // dragged vector. Shaped like a store so bindMath can bind to it; nothing here writes back.
  const subs = new Set();
  const snapshot = () => {
    const s = store.get();
    ensureLocalC(s);
    return { ...s, localC, vx: vec[0], vy: vec[1] };
  };
  const local = {
    get: snapshot,
    /** Only localC is writable, and only into this pane: the tuple's c is never touched. */
    set(patch) {
      if (!('localC' in patch) || !Number.isFinite(patch.localC)) return snapshot();
      const next = Math.min(C_RANGE[1], Math.max(C_RANGE[0], patch.localC));
      if (next !== localC) { localC = next; notify({ localC: next }); }
      return snapshot();
    },
    subscribe(fn, { immediate = true } = {}) {
      subs.add(fn);
      if (immediate) { const s = snapshot(); fn(s, s); }
      return () => subs.delete(fn);
    },
    limits: { localC: C_RANGE },
  };

  /** Everything both the picture and the prose read, from one snapshot. */
  function model(s) {
    const zeta = dampingRatio(s.m, s.localC, s.k);
    const Ahat = [[0, 1], [-1, -2 * zeta]];
    const e = eigen(Ahat);
    const v = [s.vx, s.vy];
    const dirs = e.vectors ? (e.defective ? [e.vectors[0]] : e.vectors) : [];
    let near = -1, off = Infinity;
    dirs.forEach((u, i) => { const a = angleBetweenLines(u, v); if (a < off) { off = a; near = i; } });
    return {
      zeta, Ahat, e, v, dirs, near, off,
      omega: naturalFrequency(s.m, s.k),
      A: systemMatrix(s.m, s.localC, s.k),
      R: apply(Ahat, v),
      split: decompose(e, v),
      r: regime(s.m, s.localC, s.k),
    };
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

  // The picture is the argument; the slots carry only what a picture cannot print. The
  // verdict sentence and the eigen-directions live on the canvas (drawText), not here.
  bindScrub(article, local, { signal });
  bindMath(article, local, s => {
    const d = model(s);
    return {
      a10: d.A[1][0], a11: d.A[1][1], ahat11: d.Ahat[1][1],
      omega: d.omega, localC: s.localC, critical: 2 * Math.sqrt(s.m * s.k),
      regime: d.r === 'critical' ? 'critically damped' : d.r,
      vx: d.v[0], vy: d.v[1], rx: d.R[0], ry: d.R[1],
      lam1: fmtLam(d.e.values[0]), lam2: fmtLam(d.e.values[1]),
      c1: d.split ? d.split.c[0] : DASH, c2: d.split ? d.split.c[1] : DASH,
    };
  }, { signal });

  const unsub = store.subscribe(notify, { immediate: false });
  return { destroy() { unsub(); subs.clear(); } };
}
