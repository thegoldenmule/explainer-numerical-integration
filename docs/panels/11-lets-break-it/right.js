// Panel 11, right: explode the plane. Nine λ inside, on, and outside the current method's
// boundary at the store's h, drawn on the plane over the region, each with a mini trajectory
// of the simulation against the exact curve in a 3×3 grid of small multiples. Hover a point
// (or a multiple) to highlight it and dim the rest; the index lives in aux.highlight so it
// survives a remount. The verdict is the spectral radius of the 2×2 update at
// (m, c, k) = (m, −2m·Re λ, m|λ|²), which equals |R(hλ)| for the scalar methods and is the
// only honest number for semi-implicit Euler and Verlet.

import { el, fmt } from 'shared/dom.js';
import { createStage } from 'shared/gfx/stage.js';
import { createComplexPlane } from 'shared/gfx/cplane.js';
import { cssVar, makeView, drawGrid, drawPolyline, drawPoint, drawText, layoutGrid } from 'shared/gfx/plot2d.js';
import { simulate, METHODS } from 'shared/math/integrators.js';
import { paramsFromEigenvalue, exactSolution } from 'shared/math/system.js';
import { updateMatrix, spectralRadius } from 'shared/math/stability.js';
import { sweep, sweepKey } from 'shared/math/sweep.js';
import { cfmt } from 'shared/math/complex.js';
import { aux } from 'shared/aux.js';
import { methodPicker } from 'shared/ui/controls.js';

const ROWS = 3, COLS = 3, COUNT = ROWS * COLS;
const PERIODS = 4;                 // of the exact solution per mini run
const MIN_STEPS = 24, MAX_STEPS = 400;
const EXACT_SAMPLES = 240;
const EPS = 1e-9;
const KINDS = ['inside', 'on the boundary', 'outside'];

// The plane's geometry per method, in units of 1/h: `scale` is the region's vertical
// extent (the rows sit at 0.45, 0.7, 0.9 of it), cx and half frame the view around it.
const GEOM = {
  euler:    { scale: 1,   cx: -0.7, half: 1.5 },
  implicit: { scale: 1,   cx: 0.7,  half: 1.5 },
  rk4:      { scale: 2.8, cx: -1,   half: 4.6 },
  semi:     { scale: 2,   cx: -0.6, half: 3 },
  verlet:   { scale: 2,   cx: -0.6, half: 3 },
};
const LEVELS = [0.9, 0.7, 0.45];   // top row first, as fractions of scale
const RAYS = [Math.PI / 2, Math.PI * 5 / 8, Math.PI * 3 / 4];   // top row first: the Im axis, then two rays into the left half plane
const RATIOS = [0.5, 1, 1.3];      // in, on, out along a ray, as fractions of the boundary radius

/** ρ of the method's update for the system whose eigenvalue is λ, at step h and mass m. */
export function rhoAt(method, h, m, lambda) {
  return spectralRadius(updateMatrix(method, { m, ...paramsFromEigenvalue(m, lambda), h }));
}

/** Bisect ρ = 1 between a stable point a and an unstable point b along f(s) → λ. */
function bisect(f, rho, a, b) {
  for (let i = 0; i < 40; i++) {
    const mid = (a + b) / 2;
    if (rho(f(mid)) <= 1 + EPS) a = mid; else b = mid;
  }
  return (a + b) / 2;
}

/**
 * The nine λ for a method at step h: [{ lambda, row, col, kind }], row-major, top row first,
 * columns inside → on → outside.
 *   Euler:    rows of constant Im; the disk's center, its edge, and the imaginary axis.
 *   Implicit: the mirror image: the imaginary axis, the edge of the unstable disk, its center.
 *   Others:   three rays from the origin (the imaginary axis and two into the left half
 *             plane) at 0.5, 1, and 1.3 times the radius where ρ first crosses 1.
 */
export function gridPoints(method, h, m) {
  const rho = l => rhoAt(method, h, m, l);
  const r = 1 / h;
  const pts = [];
  if (method === 'euler' || method === 'implicit') {
    const sign = method === 'euler' ? -1 : 1;   // the disk sits at −1/h (stable) or +1/h (unstable)
    LEVELS.forEach((y, row) => {
      const d = Math.sqrt(1 - y * y);
      const center = sign * r, edge = sign * (1 - d) * r, axis = 0;
      const res = method === 'euler' ? [center, edge, axis] : [axis, edge, center];
      res.forEach((re, col) => pts.push({ lambda: [re, y * r], row, col, kind: KINDS[col] }));
    });
    return pts;
  }
  const S = GEOM[method].scale * r;
  RAYS.forEach((theta, row) => {
    const f = s => [Math.abs(Math.cos(theta)) < 1e-12 ? 0 : s * Math.cos(theta), s * Math.sin(theta)];   // the Im axis ray is exactly Re = 0
    // walk out from the origin to the first radius where ρ exceeds 1, then refine
    const N = 400;
    let a = 0, b = S * 2;
    for (let i = 1; i <= N; i++) {
      const s = (i / N) * 2 * S;
      if (rho(f(s)) > 1 + EPS) { b = s; break; }
      a = s;
    }
    const boundary = b < 2 * S ? bisect(f, rho, a, b) : S;
    RATIOS.forEach((ratio, col) => pts.push({ lambda: f(ratio * boundary), row, col, kind: KINDS[col] }));
  });
  return pts;
}

/** One mini run: the simulation at λ plus the exact curve sampled finely. */
function miniRun(state, lambda) {
  const { method, h, m, x0, v0 } = state;
  const params = { method, h, m, ...paramsFromEigenvalue(m, lambda), x0, v0 };
  const im = Math.abs(lambda[1]);
  const period = im > 1e-9 ? 2 * Math.PI / im : Infinity;
  const steps = Math.min(MAX_STEPS, Math.max(MIN_STEPS, Math.ceil(PERIODS * period / h)));
  const tEnd = steps * h;
  const sim = simulate(params, tEnd);
  const sol = exactSolution(params);
  const t = new Float64Array(EXACT_SAMPLES), x = new Float64Array(EXACT_SAMPLES);
  // the frame is scaled to the exact curve's first period, so a growing exact solution (an
  // implicit-Euler point with Re λ > 0) leaves the frame instead of flattening the run
  let amp = 0;
  for (let i = 0; i < EXACT_SAMPLES; i++) {
    t[i] = tEnd * i / (EXACT_SAMPLES - 1);
    x[i] = sol.x(t[i]);
    if (Number.isFinite(x[i]) && t[i] <= Math.min(period, tEnd)) amp = Math.max(amp, Math.abs(x[i]));
  }
  return { sim, exact: { t, x }, tEnd, amp: Math.max(amp, 1e-6), rho: rhoAt(method, h, m, lambda) };
}

/** aux.highlight is shared by every sweep: clamp to this grid; −1 means nothing highlighted. */
const highlightIndex = () => Math.min(COUNT - 1, aux.get().highlight);

const verdictOf = rho => (rho > 1 + EPS ? 'unstable' : rho < 1 - EPS ? 'stable' : 'neutral');

/** A small label with a surface-colored halo, so it stays legible over a dense polyline. */
function label(g, dpr, text, x, y, { color, align = 'left' }) {
  g.save();
  g.font = `${10 * dpr}px ${cssVar('--font') || 'system-ui'}`;
  g.textAlign = align;
  g.lineJoin = 'round';
  g.strokeStyle = cssVar('--surface') || '#fff';
  g.lineWidth = 3 * dpr;
  g.strokeText(text, x, y);
  g.fillStyle = color;
  g.fillText(text, x, y);
  g.restore();
}

export function mount(root, ctx) {
  const { store, signal } = ctx;
  const geom = s => GEOM[s.method] ?? GEOM.euler;

  const points = state => sweep([0], () => gridPoints(state.method, state.h, state.m),
    { key: sweepKey({ panel: '11-right-points', method: state.method, h: state.h, m: state.m }) })[0].result;
  const runs = (state, pts) => sweep(pts.map((_, i) => i), i => miniRun(state, pts[i].lambda),
    { key: sweepKey({ panel: '11-right-runs', method: state.method, h: state.h, m: state.m, x0: state.x0, v0: state.v0 }) });

  // ---- row 1: the plane with the nine points, the method picker beside it (the .viz-row
  // wrapper's second column, otherwise empty: .stage.half loses the 48%-of-row-width cap
  // that keeps it beside the 'wide' grid stage below without pushing it past the fold). The
  // nine points, their kinds, and the region all redraw on any method change already. ----
  const top = el('div', { class: 'viz-row' });
  root.append(top);
  const planeStage = createStage(top, { layers: ['region', 'plane'], aspect: 'half', signal });
  top.append(methodPicker(store, { signal }));
  const plane = createComplexPlane({
    stage: planeStage, store, signal, region: true, labels: false,
    halfRange: s => geom(s).half / s.h,
    cx: s => geom(s).cx / s.h,
    onDraw(g, view, state) {
      const pts = points(state);
      const hi = highlightIndex();
      const { dpr } = view;
      pts.forEach((p, i) => {
        const rho = rhoAt(state.method, state.h, state.m, p.lambda);
        const color = cssVar(rho > 1 + EPS ? '--unstable' : '--stable');
        g.save();
        g.globalAlpha = hi < 0 || hi === i ? 1 : 0.35;
        if (hi === i) {
          g.strokeStyle = cssVar('--fg'); g.lineWidth = 1.5 * dpr;
          g.beginPath(); g.arc(view.X(p.lambda[0]), view.Y(p.lambda[1]), 10 * dpr, 0, Math.PI * 2); g.stroke();
        }
        drawPoint(g, view, p.lambda[0], p.lambda[1], { r: hi === i ? 6 : 4.5, fill: color });
        g.restore();
      });
      if (hi >= 0 && pts[hi]) {
        const p = pts[hi];
        const X = view.X(p.lambda[0]);
        const right = X < view.w - 80 * dpr;
        drawText(g, view, cfmt(p.lambda, 2), p.lambda[0], p.lambda[1], { color: cssVar('--fg'), size: 11, align: right ? 'left' : 'right', dx: right ? 13 : -13, dy: 4 });
      }
    },
  });

  // ---- row 2: the small multiples ----
  const gridStage = createStage(root, { layers: ['plot'], aspect: 'wide', signal });
  let cells = [];
  gridStage.onDraw(({ w, h, dpr }) => {
    const state = store.get();
    const pts = points(state);
    const results = runs(state, pts);
    const hi = highlightIndex();
    const g = gridStage.ctx('plot');
    g.clearRect(0, 0, w, h);
    cells = layoutGrid(w, h, ROWS, COLS, 6 * dpr);
    const exactColor = cssVar('--exact'), approxColor = cssVar('--approx');
    cells.forEach((cell, i) => {
      const { result: r } = results[i];
      const lit = hi < 0 || hi === i;
      g.save();
      g.translate(cell.x, cell.y);
      g.beginPath(); g.rect(0, 0, cell.w, cell.h); g.clip();
      if (hi === i) { g.fillStyle = cssVar('--accent-soft'); g.fillRect(0, 0, cell.w, cell.h); }
      g.globalAlpha = lit ? 1 : 0.3;
      const yMax = 2.2 * r.amp;
      const view = makeView({ w: cell.w, h: cell.h, dpr, xMin: 0, xMax: r.tEnd, yMin: -yMax, yMax });
      drawGrid(g, view, { labels: false });
      drawPolyline(g, view, r.exact.t, r.exact.x, { color: exactColor, width: 1.25, dash: [4, 3] });
      drawPolyline(g, view, r.sim.t, r.sim.x, { color: approxColor, width: 1.5 });
      const v = verdictOf(r.rho);
      const text = `${METHODS[state.method].hasRegion ? '|R|' : 'ρ'} = ${fmt(r.rho, 3)}`;
      label(g, dpr, text, 5 * dpr, 12 * dpr, { color: cssVar(v === 'unstable' ? '--unstable' : '--stable') });
      label(g, dpr, pts[i].kind, cell.w - 5 * dpr, 12 * dpr, { color: cssVar('--muted'), align: 'right' });
      g.restore();
    });
  });

  // ---- hover: nearest point on the plane, cell under the pointer on the grid ----
  const setHighlight = i => { if (i !== aux.get().highlight) aux.set({ highlight: i }); };
  const planeCanvas = planeStage.canvas('plane');
  planeCanvas.addEventListener('pointermove', e => {
    const view = plane.view;
    if (!view) return;
    const rect = planeCanvas.getBoundingClientRect();
    const px = (e.clientX - rect.left) * view.dpr, py = (e.clientY - rect.top) * view.dpr;
    let best = -1, dist = Infinity;
    points(store.get()).forEach((p, i) => {
      const d = Math.hypot(view.X(p.lambda[0]) - px, view.Y(p.lambda[1]) - py);
      if (d < dist) { dist = d; best = i; }
    });
    if (best >= 0) setHighlight(best);
  }, { signal });
  const gridCanvas = gridStage.canvas('plot');
  gridCanvas.addEventListener('pointermove', e => {
    const { dpr } = gridStage.size;
    const rect = gridCanvas.getBoundingClientRect();
    const px = (e.clientX - rect.left) * dpr, py = (e.clientY - rect.top) * dpr;
    const i = cells.findIndex(c => px >= c.x && px <= c.x + c.w && py >= c.y && py <= c.y + c.h);
    if (i >= 0) setHighlight(i);
  }, { signal });
  // No wheel handler: wheel is the page's swipe gesture and must never be cancelled.

  const unsub = store.subscribe(gridStage.invalidate, { immediate: false });
  const unsubAux = aux.subscribe((s, patch) => {
    if ('highlight' in patch) { plane.invalidate(); gridStage.invalidate(); }
  }, { immediate: false });
  return { destroy() { unsub(); unsubAux(); } };
}
