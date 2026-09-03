// Panel 12, right 3: Störmer–Verlet. No scalar R(hλ), so no region on the λ-plane; the
// honest picture is the spectral radius ρ of its 2×2 update drawn as a heatmap over
// (hω, ζ), where the hω < 2 wall is a straight line at ζ = 0 and bends left with damping
// (ρ = 1 where 1 + tr + det = 0, i.e. hω = 2(√(1 + ζ²) − ζ)). Hover a cell to run the
// unit-frequency system (m = k = 1, c = 2ζ, h = hω) for a few dozen periods against the
// exact curve; without a hover, the cell shown is the reader's own (h√(k/m), c / 2√(mk)).
// A switch overlays semi-implicit Euler for comparison; its update has the same trace and
// determinant as lagged-drag Verlet at every (hω, ζ), so the two maps coincide exactly.

import { el, fmt } from 'shared/dom.js';
import { createStage } from 'shared/gfx/stage.js';
import { drawTrajectory } from 'shared/gfx/trajectory.js';
import { cssVar, makeView, drawGrid, drawHeatmap, drawPolyline, drawPoint, drawText } from 'shared/gfx/plot2d.js';
import { rhoColormap } from 'shared/gfx/color.js';
import { simulate, METHODS } from 'shared/math/integrators.js';
import { spectralRadiusNormalized, updateMatrixNormalized } from 'shared/math/stability.js';
import { eigen } from 'shared/math/matrix2.js';
import { naturalFrequency, dampingRatio } from 'shared/math/system.js';
import { sweep, sweepKey } from 'shared/math/sweep.js';
import { toggleFn, controls } from 'shared/ui/controls.js';

const CELL = 0.025;                                   // in both hω and ζ; hω = 2 falls on a cell edge
const X_MIN = -0.05, X_MAX = 2.6, Y_MIN = -0.025, Y_MAX = 1.05;
const NX = Math.round((X_MAX - X_MIN) / CELL), NY = Math.round((Y_MAX - Y_MIN) / CELL);
const PERIODS = 20;                                   // of the natural period 2π per run
const T_END = PERIODS * 2 * Math.PI;
const HW_MIN = 0.01;                                  // floor for the reader's point when k → 0
const Y_RANGE = [-1.6, 1.6];                          // x₀ = 1, so the exact curve never leaves it
const EPS = 1e-9;

/** ρ = 1 for both methods: 1 + tr + det = 0 → hω = 2(√(1 + ζ²) − ζ). */
export const wallAt = zeta => 2 * (Math.sqrt(1 + zeta * zeta) - zeta);

/** Snap a plot position to the center of its heatmap cell; null off the lattice or in the margin. */
function cellAt(hw, zeta) {
  const i = Math.floor((hw - X_MIN) / CELL), j = Math.floor((zeta - Y_MIN) / CELL);
  if (i < 0 || i >= NX || j < 0 || j >= NY) return null;
  const c = { hw: X_MIN + (i + 0.5) * CELL, zeta: Y_MIN + (j + 0.5) * CELL };
  return c.hw < 0 || c.zeta < 0 ? null : c;
}

const verdictOf = rho => (rho > 1 + EPS ? 'unstable' : rho < 1 - EPS ? 'stable' : 'neutral');
const verdictText = { stable: 'stable', neutral: 'neutral', unstable: 'unstable' };

/** One run of the unit-frequency system, with what the run's corner callout says about it. */
function run(method, hw, zeta) {
  const h = Math.max(HW_MIN, hw);
  const sim = simulate({ method, h, m: 1, c: 2 * zeta, k: 1, x0: 1, v0: 0 }, T_END);
  const rho = spectralRadiusNormalized(method, h, zeta);
  const ev = eigen(updateMatrixNormalized(method, h, zeta));
  // phase per step of the numerical map against the exact damped frequency ω√(1 − ζ²)
  const exactPhase = h * Math.sqrt(Math.max(0, 1 - zeta * zeta));
  const numPhase = ev.real ? NaN : Math.atan2(ev.values[0][1], ev.values[0][0]);
  const freqRatio = exactPhase > 0 ? numPhase / exactPhase : NaN;
  // amplitude over the last period, red against blue
  let ampSim = 0, ampExact = 0;
  for (let i = 0; i < sim.n; i++) {
    if (sim.t[i] < T_END - 2 * Math.PI) continue;
    if (Number.isFinite(sim.x[i])) ampSim = Math.max(ampSim, Math.abs(sim.x[i])); else ampSim = Infinity;
    ampExact = Math.max(ampExact, Math.abs(sim.exact[i]));
  }
  return { sim, rho, real: ev.real, freqRatio, ampSim, ampExact, h };
}

export function mount(root, ctx) {
  const { store, signal } = ctx;
  let method = 'verlet';       // or 'semi', through the switch
  let hover = null;            // { hw, zeta } of the hovered cell, or null for the reader's point

  const readerPoint = s => {
    const w = naturalFrequency(s.m, s.k);
    return { hw: s.h * w, zeta: w > 0 ? dampingRatio(s.m, s.c, s.k) : Infinity };
  };
  const shown = s => hover ?? readerPoint(s);
  const runAt = (hw, zeta) => sweep([0], () => run(method, hw, zeta),
    { key: sweepKey({ panel: '12-right-3', method, hw, zeta }) })[0].result;

  // ---- the map ----
  const mapStage = createStage(root, { layers: ['heat', 'plane'], aspect: 'wide', signal });
  let view = null;
  mapStage.onDraw(({ w, h, dpr }) => {
    const s = store.get();
    view = makeView({ w, h, dpr, xMin: X_MIN, xMax: X_MAX, yMin: Y_MIN, yMax: Y_MAX });
    const gh = mapStage.ctx('heat');
    gh.clearRect(0, 0, w, h);
    drawHeatmap(gh, view, (hw, z) => (hw < 0 || z < 0 ? NaN : spectralRadiusNormalized(method, hw, z)),
      { nx: NX, ny: NY, colormap: rhoColormap({ spanLo: 1, spanHi: 0.5 }) });

    const g = mapStage.ctx('plane');
    g.clearRect(0, 0, w, h);
    drawGrid(g, view, { xLabel: 'hω = h·√(k/m)', yLabel: 'ζ = c / 2√(mk)' });
    // the wall: hω = 2 at ζ = 0, and the ρ = 1 curve it bends into with damping
    const zs = [], xs = [];
    for (let z = 0; z <= Y_MAX + 1e-9; z += 0.01) { zs.push(z); xs.push(wallAt(z)); }
    drawPolyline(g, view, xs, zs, { color: cssVar('--region-edge'), width: 1.25, dash: [5, 4] });
    drawPolyline(g, view, [2, 2], [0, Y_MAX], { color: cssVar('--fg'), width: 1, dash: [2, 3], alpha: 0.6 });
    drawText(g, view, 'hω = 2', 2, Y_MAX, { color: cssVar('--fg'), size: 11, dx: 4, dy: 14 });
    drawText(g, view, 'ρ = 1', wallAt(0.8), 0.8, { color: cssVar('--region-edge'), size: 11, align: 'right', dx: -6, dy: 4 });
    drawText(g, view, `${METHODS[method].label}: ρ of the 2×2 update`, X_MIN, Y_MAX, { color: cssVar('--fg'), size: 11, dx: 6, dy: 30 });

    // the hovered cell
    if (hover) {
      g.save();
      g.strokeStyle = cssVar('--fg'); g.lineWidth = 1.5 * dpr;
      const X = view.X(hover.hw - CELL / 2), Y = view.Y(hover.zeta + CELL / 2);
      g.strokeRect(X, Y, CELL * view.sx, CELL * view.sy);
      g.restore();
    }
    // the reader's system, clamped to the frame when it lies beyond it
    const p = readerPoint(s);
    if (!Number.isFinite(p.zeta)) return;   // k = 0: no point to mark
    const off = p.hw > X_MAX || p.zeta > Y_MAX;
    const px = Math.min(p.hw, X_MAX - 0.03), py = Math.min(p.zeta, Y_MAX - 0.02);
    const rho = spectralRadiusNormalized(method, Math.max(HW_MIN, p.hw), Math.min(p.zeta, 1e6));
    const color = cssVar(verdictOf(rho) === 'unstable' ? '--unstable' : '--stable');
    g.save();
    g.strokeStyle = color; g.lineWidth = 2 * dpr; g.globalAlpha = 0.5;
    g.beginPath(); g.arc(view.X(px), view.Y(py), 10 * dpr, 0, Math.PI * 2); g.stroke();
    g.restore();
    drawPoint(g, view, px, py, { r: 5, fill: color });
    const left = px > X_MAX * 0.7;
    drawText(g, view, `the spine's system${off ? ' (off the map)' : ''}`, px, py,
      { color: cssVar('--fg'), size: 11, align: left ? 'right' : 'left', dx: left ? -14 : 14, dy: 4 });
  });

  // ---- the run beside it ----
  const runStage = createStage(root, { layers: ['plot'], aspect: 'strip', signal });
  runStage.onDraw(size => {
    const s = store.get();
    const p = shown(s);
    const g = runStage.ctx('plot');
    if (!Number.isFinite(p.zeta)) {   // k = 0: no spring, ω = 0, nothing to normalize by
      const { w, h, dpr } = size;
      g.clearRect(0, 0, w, h);
      drawText(g, makeView({ w, h, dpr, halfW: 1 }), 'k = 0: no spring, ω = 0, so hω and ζ are undefined', 0, 0, { color: cssVar('--muted'), align: 'center' });
      return;
    }
    const hw = Math.min(p.hw, X_MAX * 2), zeta = Math.min(p.zeta, 1e6);
    const r = runAt(hw, zeta);
    const v = drawTrajectory(g, size, r.sim, { tMin: 0, tMax: T_END, y: Y_RANGE, xLabel: 't', yLabel: 'x' });
    drawText(g, v, `${METHODS[method].label} at hω = ${fmt(r.h, 3)}, ζ = ${fmt(zeta, 3)}, ${PERIODS} periods of m = k = 1, x₀ = 1`, T_END, Y_RANGE[1],
      { color: cssVar('--muted'), size: 11, align: 'right', dx: -6, dy: 14 });

    // the loop's own numbers, called out beneath the title: verdict/ρ, phase drift, amplitude
    const verdict = verdictOf(r.rho);
    const phase = Number.isFinite(r.freqRatio)
      ? `frequency ${fmt(r.freqRatio, 4)} × exact: phase drifts ${fmt((r.freqRatio - 1) * 360, 1)}° per period`
      : r.real ? 'no oscillation left: the update’s eigenvalues are real' : 'no oscillation to compare';
    const corner = { color: cssVar('--muted'), size: 11, align: 'right', dx: -6 };
    drawText(g, v, `${hover ? 'cell' : 'spine'}: hω = ${fmt(hw, 3)}, ζ = ${fmt(zeta, 3)} → ρ = ${fmt(r.rho, 4)}: ${verdictText[verdict]}`, T_END, Y_RANGE[1],
      { ...corner, color: cssVar(verdict === 'unstable' ? '--unstable' : '--stable'), dy: 30 });
    drawText(g, v, phase, T_END, Y_RANGE[1], { ...corner, dy: 46 });
    drawText(g, v, `last-period amplitude: red ${fmt(r.ampSim, 3)} vs exact ${fmt(r.ampExact, 3)}`, T_END, Y_RANGE[1], { ...corner, dy: 62 });
  });

  // ---- hover: the cell under the pointer ----
  const planeCanvas = mapStage.canvas('plane');
  planeCanvas.addEventListener('pointermove', e => {
    if (!view) return;
    const q = view.fromEvent(e, planeCanvas);
    const cell = cellAt(q.x, q.y);
    if (!cell || (hover && hover.hw === cell.hw && hover.zeta === cell.zeta)) return;
    hover = cell;
    mapStage.invalidate(); runStage.invalidate();
  }, { signal });
  // No wheel handler: wheel is the page's swipe gesture and must never be cancelled.

  // ---- the switch ----
  const compare = toggleFn({
    label: 'compare: semi-implicit Euler',
    get: () => method === 'semi',
    set: v => { method = v ? 'semi' : 'verlet'; mapStage.invalidate(); runStage.invalidate(); },
    signal,
  });
  const back = el('button', { class: 'btn', type: 'button', onclick: () => { hover = null; mapStage.invalidate(); runStage.invalidate(); } }, 'back to the spine’s point');
  root.append(controls(el('div', { class: 'controls-row' }, compare, back)));

  const unsub = store.subscribe(() => { mapStage.invalidate(); runStage.invalidate(); }, { immediate: false });
  return { destroy() { unsub(); } };
}
