// Panel 13, spine: h becomes a function of t. A target-error slider drives runAdaptive with
// the store's method and parameters; h(t) is plotted as its own trajectory under the run.
// A "constant force only" switch passes k = c = 0 to the run (never to the store): with no
// higher derivatives left, both estimators read zero and h runs straight to the 16 s cap.
//
// The target error is local to this pane for now; it belongs in the aux store's `tol` once
// that exists, so a remount keeps it.

import { el, fmt } from 'shared/dom.js';
import { createStage } from 'shared/gfx/stage.js';
import { drawTrajectory } from 'shared/gfx/trajectory.js';
import { cssVar } from 'shared/gfx/plot2d.js';
import { runAdaptive } from 'shared/math/adaptive.js';
import { sweepKey } from 'shared/math/sweep.js';
import { methodPicker, presets, readout, controls, row } from 'shared/ui/controls.js';

const T_END = 120;     // seconds simulated (the essay's RK4 peak of 2.1 s needs the spring to have quieted)
const H_MAX = 16;      // the college paper's cap
const TOL_LOG = [-3, -0.5];

export function mount(root, ctx) {
  const { store, signal } = ctx;
  let tol = 0.01, free = false;

  // one wide stage, the run in the top half and h(t) in the bottom half
  const stage = createStage(root, { layers: ['plot'], aspect: 'wide', signal });
  const out = readout({ label: 'the controller' });

  let run = null, runKey = '';
  function adaptive(state) {
    const key = sweepKey({ tol, free, method: state.method, h: state.h, m: state.m, c: state.c, k: state.k, x0: state.x0, v0: state.v0 });
    if (key === runKey) return run;
    runKey = key;
    run = runAdaptive({
      method: state.method, tol, m: state.m, c: free ? 0 : state.c, k: free ? 0 : state.k, x0: state.x0, v0: state.v0,
      hInit: state.h, hMax: H_MAX,
    }, T_END);
    return run;
  }

  stage.onDraw(({ w, h, dpr }) => {
    const state = store.get();
    const r = adaptive(state);
    const g = stage.ctx('plot');
    g.clearRect(0, 0, w, h);
    const gap = 6 * dpr, half = Math.floor((h - gap) / 2);
    let amp = 0;
    for (let i = 0; i < r.n; i++) amp = Math.max(amp, Math.abs(r.exact[i]));
    drawTrajectory(g, { w, h: half, dpr }, r, { tMin: 0, tMax: T_END, cap: Math.max(1, 3 * amp), markers: true, maxMarkers: 400, yLabel: r.n <= 400 ? 'x (one dot per step)' : 'x' });
    g.save();
    g.translate(0, half + gap);
    drawTrajectory(g, { w, h: h - half - gap, dpr }, { t: r.t, x: r.h, n: r.n }, {
      tMin: 0, tMax: T_END, yLog: true, y: [Math.min(1e-3, r.h[0]) / 2, H_MAX * 1.5], markers: r.n <= 400, approx: cssVar('--accent'), yLabel: 'h(t)  (log)',
    });
    g.restore();
    g.fillStyle = cssVar('--border');
    g.fillRect(0, half, w, gap);
    let err = 0;
    for (let i = 0; i < r.n; i++) { const e = Math.abs(r.x[i] - r.exact[i]); err = Number.isFinite(e) ? Math.max(err, e) : Infinity; }
    const fixedSteps = Math.round(T_END / state.h);
    out.set([
      `target ${fmt(tol, 4)}: ${r.n - 1} steps for ${T_END} s (fixed h = ${fmt(state.h, 3)} would take ${fixedSteps}), ${r.rejected} rejected`,
      r.forced ? `, ${r.forced} forced at the floor` : '', '\n',
      `h peaks at `, el('span', { class: r.hPeak >= H_MAX - 1e-9 ? 'unstable' : 'stable' }, `${fmt(r.hPeak, 2)} s`),
      r.hPeak >= H_MAX - 1e-9 ? ` (the ${H_MAX} s cap)` : '', `   max |x − exact| = ${fmt(err, 3)}`,
      r.blewUp ? el('span', { class: 'unstable' }, '   blew up') : !r.complete ? '   (stopped early)' : '',
      free ? '\nno spring, no drag: every derivative past a is zero, the next Taylor term is zero, nothing stops h but the cap' : '',
    ]);
  });

  // ---- the local target-error slider (log) and the constant-force switch ----
  const tolInput = el('input', { type: 'range', min: TOL_LOG[0], max: TOL_LOG[1], step: 0.01, value: Math.log10(tol) });
  const tolOut = el('output', {}, fmt(tol, 4));
  const invalidate = stage.invalidate;
  tolInput.addEventListener('input', () => { tol = 10 ** Number(tolInput.value); tolOut.textContent = fmt(tol, 4); invalidate(); }, { signal });
  const freeBtn = el('button', {
    class: 'btn', type: 'button', 'aria-pressed': 'false',
    onclick() { free = !free; freeBtn.setAttribute('aria-pressed', String(free)); invalidate(); },
  }, 'Constant force only');

  root.append(controls(
    row(el('label', { class: 'control' }, el('span', { class: 'control-label' }, el('span', {}, 'target local error'), tolOut), tolInput),
      methodPicker(store, { only: ['euler', 'rk4', 'implicit'], signal })),
    row(presets(store, { demo: 'Demo (m=1, c=0.1, k=100)', essay: 'Essay (m=10, c=0.1, k=10)' }), freeBtn),
  ));
  root.append(out.el);

  const unsub = store.subscribe(invalidate, { immediate: false });
  return { destroy() { unsub(); } };
}
