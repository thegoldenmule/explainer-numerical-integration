// Panel 13, spine: h becomes a function of t. The target-error slider (aux.tol, so it
// survives a remount and 13-right centers its sweep on it) drives runAdaptive with the
// store's method and parameters; h(t) is plotted as its own trajectory under the run. A
// "constant force only" switch passes k = c = 0 to the run (never to the store): with no
// higher derivatives left, both estimators read zero and h runs straight to the 16 s cap.
// The switch is a what-if, not a knob, so it stays local to the pane.

import { fmt } from 'shared/dom.js';
import { createStage } from 'shared/gfx/stage.js';
import { drawTrajectory } from 'shared/gfx/trajectory.js';
import { cssVar, drawText } from 'shared/gfx/plot2d.js';
import { runAdaptive } from 'shared/math/adaptive.js';
import { sweepKey } from 'shared/math/sweep.js';
import { aux } from 'shared/aux.js';
import { toggleFn, methodPicker, presets, controls, row } from 'shared/ui/controls.js';
import { bindScrub } from 'shared/ui/scrub.js';

const T_END = 120;     // seconds simulated (the essay's RK4 peak of 2.1 s needs the spring to have quieted)
const H_MAX = 16;      // the college paper's cap
const TOL_RANGE = [1e-3, 10 ** -0.5];   // the slider's span, inside AUX_LIMITS.tol

export function mount(root, ctx) {
  const { store, signal } = ctx;
  let free = false;

  // one wide stage, the run in the top half and h(t) in the bottom half
  const stage = createStage(root, { layers: ['plot'], aspect: 'wide', signal });

  let run = null, runKey = '';
  function adaptive(state) {
    const { tol } = aux.get();
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
    const { tol } = aux.get();
    const g = stage.ctx('plot');
    g.clearRect(0, 0, w, h);
    const gap = 6 * dpr, half = Math.floor((h - gap) / 2);
    let amp = 0, err = 0;
    for (let i = 0; i < r.n; i++) {
      amp = Math.max(amp, Math.abs(r.exact[i]));
      const e = Math.abs(r.x[i] - r.exact[i]);
      err = Number.isFinite(e) ? Math.max(err, e) : Infinity;
    }
    const fixedSteps = Math.round(T_END / state.h);
    const capped = r.hPeak >= H_MAX - 1e-9;
    drawTrajectory(g, { w, h: half, dpr }, r, { tMin: 0, tMax: T_END, cap: Math.max(1, 3 * amp), markers: true, maxMarkers: 400, yLabel: r.n <= 400 ? 'x (one dot per step)' : 'x' });
    g.save();
    g.translate(0, half + gap);
    const viewH = drawTrajectory(g, { w, h: h - half - gap, dpr }, { t: r.t, x: r.h, n: r.n }, {
      tMin: 0, tMax: T_END, yLog: true, y: [Math.min(1e-3, r.h[0]) / 2, H_MAX * 1.5], markers: r.n <= 400, approx: cssVar('--accent'), yLabel: 'h(t)  (log)',
    });
    // the controller's numbers, called out over the h(t) trace they describe
    const corner = { align: 'right', dx: -8 };
    drawText(g, viewH, `target ${fmt(tol, 4)}: ${r.n - 1} steps${r.rejected ? `, ${r.rejected} rejected` : ''}${r.forced ? `, ${r.forced} forced` : ''} (fixed h: ${fixedSteps})`,
      T_END, viewH.yMax, { ...corner, color: cssVar('--fg'), size: 11, dy: 14 });
    drawText(g, viewH, `h peaks at ${fmt(r.hPeak, 2)} s${capped ? ` (the ${H_MAX} s cap)` : ''}`, T_END, viewH.yMax,
      { ...corner, color: cssVar(capped ? '--unstable' : '--stable'), size: 11, dy: 28 });
    drawText(g, viewH, `max |x − exact| = ${fmt(err, 3)}${r.blewUp ? ' — blew up' : !r.complete ? ' (stopped early)' : ''}`, T_END, viewH.yMax,
      { ...corner, color: cssVar(r.blewUp ? '--unstable' : '--fg'), size: 11, dy: 42 });
    if (free) {
      drawText(g, viewH, 'no spring, no drag: every derivative past a is zero — nothing stops h but the cap', T_END, viewH.yMax,
        { ...corner, color: cssVar('--muted'), size: 10, dy: 56 });
    }
    g.restore();
    g.fillStyle = cssVar('--border');
    g.fillRect(0, half, w, gap);
  });

  const invalidate = stage.invalidate;
  const freeSwitch = toggleFn({ label: 'Constant force only', get: () => free, set: v => { free = v; invalidate(); }, signal });

  root.append(controls(
    row(methodPicker(store, { only: ['euler', 'rk4', 'implicit'], signal })),
    row(presets(store, { demo: 'Demo (m=1, c=0.1, k=100)', essay: 'Essay (m=10, c=0.1, k=10)' }), freeSwitch),
  ));

  const offScrub = bindScrub(root.closest('article') ?? root, aux, { signal, limits: { tol: TOL_RANGE } });
  const unsub = store.subscribe(invalidate, { immediate: false });
  const unsubAux = aux.subscribe((s, patch) => { if ('tol' in patch) invalidate(); }, { immediate: false });
  return { destroy() { unsub(); unsubAux(); offScrub(); } };
}
