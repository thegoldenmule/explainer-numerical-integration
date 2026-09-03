// Panel 10, left: Euler as follow-the-tangent, walked automatically. A local explicit-Euler
// stepper walks the spring from the store's state; each step draws the tangent it followed
// and the point it landed on, over the exact curve. Then |1 + hλ| by hand in the prose.
//
// No buttons: the walk always shows AUTO_STEPS steps, and changing h (or m, c, k, x0, v0)
// clears it and retakes them automatically, so the picture is always "what ten Euler steps
// look like from here" for whatever the reader just dragged, not a manual crank.

import { fmt } from 'shared/dom.js';
import { createStage } from 'shared/gfx/stage.js';
import { drawTrajectory } from 'shared/gfx/trajectory.js';
import { cssVar, drawPolyline, drawText } from 'shared/gfx/plot2d.js';
import { bindMath } from 'shared/ui/livemath.js';
import { bindScrub } from 'shared/ui/scrub.js';
import { createStepper } from 'shared/math/integrators.js';
import { eigenvalues, exactSolution } from 'shared/math/system.js';
import { handleIndex } from 'shared/gfx/cplane.js';
import { ampFactor } from 'shared/math/stability.js';
import { cscale } from 'shared/math/complex.js';

const TUPLE = ['method', 'h', 'm', 'c', 'k', 'x0', 'v0'];
const AUTO_STEPS = 10;        // retaken automatically on every reset
const MIN_STEPS_SHOWN = 15;   // the window always has room for this many steps
const FINE = 600;             // samples of the exact curve across the window
const CAP = 10;               // a blow-up stops stretching the y range here

export function mount(root, ctx) {
  const { store, signal } = ctx;

  // ---- the walk: a local Euler stepper and its samples ----
  let stepper, exact;
  const series = { t: [], x: [], v: [], exact: [], n: 0 };
  function reset() {
    const s = store.get();
    stepper = createStepper({ ...s, method: 'euler' });
    exact = exactSolution(s);
    series.t.length = series.x.length = series.v.length = series.exact.length = 0;
    push();
    stage.invalidate();
  }
  function push() {
    series.t.push(stepper.t); series.x.push(stepper.x); series.v.push(stepper.v); series.exact.push(exact.x(stepper.t));
    series.n = series.t.length;
  }
  function step(n = 1) {
    for (let i = 0; i < n && series.n < 2000; i++) { stepper.step(); push(); }
    stage.invalidate();
  }
  function resetAndWalk() { reset(); step(AUTO_STEPS); }

  // ---- the plot: the fine exact curve on a layer beneath the walk. No readout beside it
  // any more, so a tangent walk gets the taller 'wide' stage instead of a 'strip'. ----
  const stage = createStage(root, { layers: ['exact', 'plot'], aspect: 'wide', signal });
  const fine = { t: new Float64Array(FINE), x: new Float64Array(FINE) };
  stage.onDraw(size => {
    const s = store.get();
    const tMax = Math.max(stepper.t, MIN_STEPS_SHOWN * s.h);
    let amp = 0;
    for (let i = 0; i < FINE; i++) {
      fine.t[i] = tMax * i / (FINE - 1); fine.x[i] = exact.x(fine.t[i]);
      amp = Math.max(amp, Math.abs(fine.x[i]));
    }
    for (let i = 0; i < series.n; i++) amp = Math.max(amp, Math.min(CAP, Math.abs(series.x[i])));
    amp = Math.max(amp, 1e-3);
    // the walk, without its coarse exact samples: the fine exact curve goes on the layer beneath
    const walk = { t: series.t, x: series.x, v: series.v, n: series.n };
    const view = drawTrajectory(stage.ctx('plot'), size, walk, {
      tMin: 0, tMax, y: [-1.15 * amp, 1.15 * amp], markers: true, tangents: true, h: s.h, width: 2,
    });
    const g = stage.ctx('exact');
    g.clearRect(0, 0, size.w, size.h);
    drawPolyline(g, view, fine.t, fine.x, { color: cssVar('--exact'), width: 1.5, dash: [6, 4], alpha: 0.9 });

    const i = series.n - 1;
    const err = Math.abs(series.x[i] - series.exact[i]);
    const prevErr = i > 0 ? Math.abs(series.x[i - 1] - series.exact[i - 1]) : NaN;
    // the last step's arithmetic, called out top-right, clear of the grid's own labels
    const corner = { align: 'right', dx: -8 };
    drawText(g, view, `step ${i}: t = ${fmt(stepper.t, 3)} s`, view.xMax, view.yMax, { ...corner, color: cssVar('--fg'), size: 12, dy: 16 });
    drawText(g, view, `x = ${fmt(series.x[i], 4)}   exact = ${fmt(series.exact[i], 4)}`, view.xMax, view.yMax, { ...corner, color: cssVar('--fg'), size: 12, dy: 32 });
    drawText(g, view, `error ${fmt(err, 4)}${prevErr > 0 ? `   ratio to last step ${fmt(err / prevErr, 3)}` : ''}`, view.xMax, view.yMax, { ...corner, color: cssVar('--approx'), size: 12, dy: 48 });
  });

  resetAndWalk();
  const unsubscribe = store.subscribe((s, patch) => { if (TUPLE.some(k => k in patch)) resetAndWalk(); }, { immediate: false });

  const article = root.closest('article') ?? root;
  bindMath(article, store, s => {
    const ls = eigenvalues(s.m, s.c, s.k);
    const l = ls[handleIndex(ls)];
    return { 'lambda-re': l[0], 'lambda-im': l[1], 'abs-r': ampFactor('euler', cscale(l, s.h)) };
  }, { signal });
  const offScrub = bindScrub(article, store, { signal, limits: { h: [0.005, 0.25] } });

  return { destroy() { unsubscribe(); offScrub(); } };
}
