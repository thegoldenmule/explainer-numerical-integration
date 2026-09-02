// Panel 13, left: local truncation error on one step (the next Taylor term, from the exact
// state) versus the global error the fixed-step run has accumulated by then. One plot: the
// exact curve, the run's polyline, and a single step taken from the exact curve at a
// scrubbed step index; two readouts.

import { el, fmt } from 'shared/dom.js';
import { createStage } from 'shared/gfx/stage.js';
import { drawTrajectory } from 'shared/gfx/trajectory.js';
import { cssVar, drawPolyline, drawPoint } from 'shared/gfx/plot2d.js';
import { createStepper, simulate, METHODS } from 'shared/math/integrators.js';
import { exactSolution } from 'shared/math/system.js';
import { localTruncationError } from 'shared/math/taylor.js';
import { sweepKey } from 'shared/math/sweep.js';
import { slider, readout, controls } from 'shared/ui/controls.js';
import { bindMath } from 'shared/ui/livemath.js';

const STEPS = 60;   // steps shown; the span is 60 h so a single step stays visible

export function mount(root, ctx) {
  const { store, signal } = ctx;
  let at = 12;   // which step the local one is taken at (local to the pane)

  const stage = createStage(root, { layers: ['plot'], aspect: 'wide', signal });
  const out = readout({ label: 'one step vs. the whole run' });
  let sim = null, simKey = '';
  const fixedRun = state => {
    const key = sweepKey({ method: state.method, h: state.h, m: state.m, c: state.c, k: state.k, x0: state.x0, v0: state.v0 });
    if (key !== simKey) { simKey = key; sim = simulate(state, STEPS * state.h); }
    return sim;
  };

  stage.onDraw(size => {
    const state = store.get();
    const { method, h, m, c, k } = state;
    const s = fixedRun(state);
    const span = STEPS * h;
    let amp = 0;
    for (let i = 0; i < s.n; i++) amp = Math.max(amp, Math.abs(s.exact[i]));
    const g = stage.ctx('plot');
    const view = drawTrajectory(g, size, s, { tMin: 0, tMax: span, cap: Math.max(1, 3 * amp), markers: true, h });

    // one step from the exact state at t_i
    const sol = exactSolution(state);
    const i = Math.min(at, STEPS - 1);
    const t0 = i * h, x0 = sol.x(t0), v0 = sol.v(t0);
    const one = createStepper({ method, h, m, c, k, x0, v0 }).step();
    const xNext = sol.x(t0 + h);
    const order = METHODS[method].order;
    const est = localTruncationError({ m, c, k, x: x0, v: v0, h, order });
    const local = Math.abs(one.x - xNext);
    const global = Math.abs(s.x[i + 1] - s.exact[i + 1]);

    const accent = cssVar('--accent');
    drawPolyline(g, view, [t0, t0], [view.yMin, view.yMax], { color: cssVar('--axis'), width: 1, dash: [3, 3], alpha: 0.5 });
    drawPolyline(g, view, [t0, t0 + h], [x0, one.x], { color: accent, width: 3 });
    drawPoint(g, view, t0, x0, { r: 4.5, fill: cssVar('--exact') });
    drawPoint(g, view, t0 + h, one.x, { r: 4.5, fill: accent });
    if (Number.isFinite(s.x[i + 1]) && Math.abs(s.x[i + 1]) < 1e6) drawPoint(g, view, t0 + h, s.x[i + 1], { r: 4.5, fill: cssVar('--approx') });

    out.set([
      `step ${i} → ${i + 1}, t = ${fmt(t0, 3)} → ${fmt(t0 + h, 3)} s, ${METHODS[method].label} (order ${order})\n`,
      el('span', { style: `color:${accent}` }, 'local'), `: one step from the exact state lands ${fmt(local, 5)} off`,
      `  (next Taylor term h^${order + 1}/${order + 1}! · |x⁽${order + 1}⁾| = ${fmt(est.x, 5)})\n`,
      el('span', { style: `color:${cssVar('--approx')}` }, 'global'), `: the run is ${fmt(global, 5)} off after ${i + 1} steps`,
      local > 0 && Number.isFinite(global) ? `, ${fmt(global / local, 1)}× the local error` : '',
    ]);
  });

  const atInput = el('input', { type: 'range', min: 0, max: STEPS - 1, step: 1, value: at });
  const atOut = el('output', {}, `step ${at}`);
  atInput.addEventListener('input', () => { at = Number(atInput.value); atOut.textContent = `step ${at}`; stage.invalidate(); }, { signal });
  root.append(controls(
    el('label', { class: 'control' }, el('span', { class: 'control-label' }, el('span', {}, 'take one step from the exact curve at'), atOut), atInput),
    slider(store, 'h', { label: 'h (step)', min: 0.002, max: 0.25, format: v => `${v.toFixed(3)} s`, signal }),
  ));
  root.append(out.el);

  const unsub = store.subscribe(stage.invalidate, { immediate: false });
  bindMath(root.closest('article'), store, () => ({}), { signal });
  return { destroy() { unsub(); } };
}
