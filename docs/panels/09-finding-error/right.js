// Panel 9, right: the modal equation. The 2D state (x, v) split onto the two eigenvectors,
// each mode a scalar x' = λx with its own R(hλ) on the complex plane, the modal magnitudes
// stepping by |R| beside the reconstructed x against the exact curve. For a damped spring
// the two λ are conjugates, so both modes share |R|; the prose says so.

import { fmt } from 'shared/dom.js';
import { createStage } from 'shared/gfx/stage.js';
import { createComplexPlane } from 'shared/gfx/cplane.js';
import { cssVar, makeView, drawGrid, drawPolyline, drawText } from 'shared/gfx/plot2d.js';
import { cfmt, cabs } from 'shared/math/complex.js';
import { exactSolution } from 'shared/math/system.js';
import { decompose, project, modalFactors, simulateModal } from 'shared/math/modes.js';
import { METHODS } from 'shared/math/integrators.js';
import { sweepKey } from 'shared/math/sweep.js';
import { methodPicker, controls } from 'shared/ui/controls.js';
import { bindScrub } from 'shared/ui/scrub.js';

const SPAN = 4;   // seconds of the modal run

export function mount(root, ctx) {
  const { store, signal } = ctx;

  // the picker, above the plane: both λ with their |R|, scaled to the current system
  root.append(controls(methodPicker(store, { only: ['euler', 'rk4', 'implicit'], signal })));
  const planeStage = createStage(root, { layers: ['plane'], aspect: 'square', signal });
  const plane = createComplexPlane({
    stage: planeStage, store, signal,
    halfRange: s => { const [l] = decompose(s.m, s.c, s.k).lambdas; return Math.max(1.5, 1.4 * Math.hypot(l[0], l[1])); },
  });

  // the modal run: |a₁|, |a₂| on a log axis beside the reconstructed x
  const runStage = createStage(root, { layers: ['plot'], aspect: 'strip', signal });
  let run = null, runKey = '';
  const modalRun = state => {
    const key = sweepKey({ method: state.method, h: state.h, m: state.m, c: state.c, k: state.k, x0: state.x0, v0: state.v0 });
    if (key === runKey) return run;
    runKey = key;
    const modes = decompose(state.m, state.c, state.k);
    const R = modalFactors(state.method, state.h, modes);
    run = { modes, R, ok: !modes.defective && R.every(r => r !== null), sim: null };
    if (run.ok) run.sim = simulateModal(state, SPAN);
    return run;
  };

  runStage.onDraw(({ w, h, dpr }) => {
    const state = store.get();
    const g = runStage.ctx('plot');
    g.clearRect(0, 0, w, h);
    const r = modalRun(state);
    const [a1, a2] = project(r.modes, state.x0, state.v0);
    if (!r.ok) {
      const why = r.modes.defective
        ? 'critically damped: one repeated λ, one eigenvector, no modal split'
        : `${METHODS[state.method].label} has no scalar R(hλ); pick Euler, RK4, or implicit Euler`;
      drawText(g, makeView({ w, h, dpr, halfW: 1 }), why, 0, 0, { color: cssVar('--muted'), align: 'center' });
      return;
    }
    const { sim, modes, R } = r;
    const half = Math.floor(w / 2), gap = 6 * dpr;

    // left: modal magnitudes, numerical (solid) against exact e^{Re λ t} (dashed)
    const mag1 = new Float64Array(sim.n), mag2 = new Float64Array(sim.n), ex1 = new Float64Array(sim.n);
    const m0 = cabs(sim.coefficients[0][0]) || 1e-9;
    for (let i = 0; i < sim.n; i++) {
      mag1[i] = cabs(sim.coefficients[i][0]); mag2[i] = cabs(sim.coefficients[i][1]);
      ex1[i] = m0 * Math.exp(modes.lambdas[0][0] * sim.t[i]);
    }
    let lo = Infinity, hi = -Infinity;
    for (const arr of [mag1, mag2, ex1]) for (const v of arr) if (Number.isFinite(v) && v > 0) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
    if (!Number.isFinite(lo)) { lo = 1e-3; hi = 1; }
    const span = Math.max(Math.log10(hi) - Math.log10(lo), 1);
    g.save();
    g.beginPath(); g.rect(0, 0, half - gap, h); g.clip();
    const vL = makeView({ w: half - gap, h, dpr, xMin: 0, xMax: SPAN, yMin: 10 ** (Math.log10(lo) - 0.1 * span), yMax: 10 ** (Math.log10(hi) + 0.1 * span), yLog: true });
    drawGrid(g, vL, { xLabel: 't', yLabel: '|a₁|, |a₂|  (log)' });
    drawPolyline(g, vL, sim.t, ex1, { color: cssVar('--exact'), width: 1.5, dash: [6, 4] });
    drawPolyline(g, vL, sim.t, mag1, { color: cssVar('--approx'), width: 2 });
    drawPolyline(g, vL, sim.t, mag2, { color: cssVar('--axis'), width: 1.25, dash: [2, 3] });
    // the two modes' λ and |R(hλ)|, colored by the same verdict the disk elsewhere uses
    const same = Math.abs(cabs(R[0]) - cabs(R[1])) < 1e-9;
    const cornerL = { align: 'right', dx: -6 };
    drawText(g, vL, `λ₁ = ${cfmt(modes.lambdas[0], 3)}  |R| = ${fmt(cabs(R[0]), 4)}`, SPAN, vL.yMax,
      { ...cornerL, color: cssVar(cabs(R[0]) <= 1 ? '--stable' : '--unstable'), size: 11, dy: 14 });
    drawText(g, vL, `λ₂ = ${cfmt(modes.lambdas[1], 3)}  |R| = ${fmt(cabs(R[1]), 4)}${same ? '  (conjugate: same ratio)' : ''}`, SPAN, vL.yMax,
      { ...cornerL, color: cssVar(cabs(R[1]) <= 1 ? '--stable' : '--unstable'), size: 11, dy: 28 });
    g.restore();

    // right: the reconstructed x against the exact curve
    const sol = exactSolution(state);
    const exact = new Float64Array(sim.n);
    let amp = 0;
    for (let i = 0; i < sim.n; i++) { exact[i] = sol.x(sim.t[i]); amp = Math.max(amp, Math.abs(exact[i])); }
    const yMax = Math.max(1, 2.5 * amp);
    g.save();
    g.translate(half + gap, 0);
    g.beginPath(); g.rect(0, 0, w - half - gap, h); g.clip();
    const vR = makeView({ w: w - half - gap, h, dpr, xMin: 0, xMax: SPAN, yMin: -yMax, yMax });
    drawGrid(g, vR, { xLabel: 't', yLabel: 'x = a₁ + a₂' });
    drawPolyline(g, vR, sim.t, exact, { color: cssVar('--exact'), width: 1.5, dash: [6, 4] });
    drawPolyline(g, vR, sim.t, sim.x, { color: cssVar('--approx'), width: 2 });
    drawText(g, vR, `(x₀, v₀) = (${fmt(state.x0, 2)}, ${fmt(state.v0, 2)}) = a₁·(1, λ₁) + a₂·(1, λ₂)`, SPAN, vR.yMax, { align: 'right', dx: -6, color: cssVar('--fg'), size: 11, dy: 14 });
    drawText(g, vR, `a₁ = ${cfmt(a1, 3)}   a₂ = ${cfmt(a2, 3)}`, SPAN, vR.yMax, { align: 'right', dx: -6, color: cssVar('--muted'), size: 11, dy: 28 });
    g.restore();
  });

  const offScrub = bindScrub(root.closest('article'), store, { signal, limits: { h: [0.002, 0.25] } });
  const unsub = store.subscribe(runStage.invalidate, { immediate: false });
  return { destroy() { unsub(); offScrub(); } };
}
