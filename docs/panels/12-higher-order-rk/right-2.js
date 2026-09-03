// Panel 12, right 2: implicit Euler. Its region |1 − hλ| ≥ 1 on the plane, and an exploded
// h: a small bundle of implicit runs against the exact curve, one per step size in the
// range, with the store's h highlighted. h is dragged right in the prose's own equation
// (bindScrub, clamped to the bundle's own range); nearestIndex picks whichever bundled run
// that continuous h is closest to. Never explodes, always lies: the over-damping grows with
// the step.

import { fmt } from 'shared/dom.js';
import { createStage } from 'shared/gfx/stage.js';
import { createComplexPlane } from 'shared/gfx/cplane.js';
import { drawBundle } from 'shared/gfx/bundle.js';
import { cssVar, makeView, drawGrid, drawPolyline, drawText } from 'shared/gfx/plot2d.js';
import { bindMath } from 'shared/ui/livemath.js';
import { bindScrub } from 'shared/ui/scrub.js';
import { eigenvalues, exactSolution, naturalFrequency } from 'shared/math/system.js';
import { simulate } from 'shared/math/integrators.js';
import { ampFactor } from 'shared/math/stability.js';
import { cscale } from 'shared/math/complex.js';
import { sweepRange, sweep, sweepKey, nearestIndex } from 'shared/math/sweep.js';

const HS = sweepRange(1 / 60, 1 / 2, 6, { log: true });   // 1/60 s up to half a second
const FINE = 600;
/** short enough for the corner callout: 3 decimals, or 2 significant digits when tiny */
const short = v => (Math.abs(v) < 1e-3 && v !== 0 ? v.toPrecision(2) : v.toFixed(3)).replace(/-/g, '−');

/** 60 / ω_n seconds, clamped: 6 s for the demo spring, 60 s for the essay's. */
const spanFor = s => Math.min(120, Math.max(2, 60 / Math.max(naturalFrequency(s.m, s.k), 1e-3)));

export function mount(root, ctx) {
  const { store, signal } = ctx;
  const article = root.closest('article') ?? root;
  const current = s => nearestIndex(HS, s.h);

  const planeStage = createStage(root, { layers: ['region', 'plane'], aspect: 'square', signal });
  createComplexPlane({
    stage: planeStage, store, signal, labels: false,
    // implicit Euler's region and verdict, whatever the store's method is
    region: s => ({ method: 'implicit', h: s.h }),
    verdict: 'implicit',
    halfRange: s => Math.max(3, 1.3 * Math.max(2 / s.h, ...eigenvalues(s.m, s.c, s.k).flat().map(Math.abs))),
  });

  // the bundle: one implicit run per h in the range, memoized on the system and the window
  const runs = s => {
    const tEnd = spanFor(s);
    const key = sweepKey({ m: s.m, c: s.c, k: s.k, x0: s.x0, v0: s.v0, tEnd });
    return { tEnd, series: sweep(HS, h => simulate({ method: 'implicit', h, m: s.m, c: s.c, k: s.k, x0: s.x0, v0: s.v0 }, tEnd), { key }) };
  };
  const fine = { t: new Float64Array(FINE), x: new Float64Array(FINE) };
  const runStage = createStage(root, { layers: ['plot'], aspect: 'strip', signal });
  runStage.onDraw(({ w, h, dpr }) => {
    const s = store.get();
    const { tEnd, series } = runs(s);
    const i = current(s);
    const sol = exactSolution(s);
    let amp = Math.max(Math.abs(s.x0), 1e-3);
    for (let j = 0; j < FINE; j++) {
      fine.t[j] = tEnd * j / (FINE - 1); fine.x[j] = sol.x(fine.t[j]);
      amp = Math.max(amp, Math.abs(fine.x[j]));
    }
    const g = runStage.ctx('plot');
    const view = makeView({ w, h, dpr, xMin: 0, xMax: tEnd, yMin: -1.15 * amp, yMax: 1.15 * amp });
    g.clearRect(0, 0, w, h);
    drawGrid(g, view, { xLabel: 't', yLabel: 'x' });
    drawPolyline(g, view, fine.t, fine.x, { color: cssVar('--exact'), width: 1.75, dash: [6, 4] });
    drawBundle(g, view, series.map(r => ({ xs: r.result.t, ys: r.result.x })), { highlight: i, width: 2, dimWidth: 1.25 });

    // the highlighted run's own endpoint against the exact one, top-right: the rest of the
    // bundle's spread is the over-damping, visible without a row per h
    const exactEnd = sol.x(tEnd);
    const last = series[i].result.x[series[i].result.n - 1];
    const corner = { align: 'right', dx: -8 };
    drawText(g, view, `h = ${fmt(HS[i], 3)} s: x(${fmt(tEnd, 0)}) = ${short(last)}`, view.xMax, view.yMax, { ...corner, color: cssVar('--approx'), size: 12, dy: 16 });
    drawText(g, view, `exact x(${fmt(tEnd, 0)}) = ${short(exactEnd)}`, view.xMax, view.yMax, { ...corner, color: cssVar('--exact'), size: 12, dy: 32 });
  });
  const unsubscribe = store.subscribe(runStage.invalidate, { immediate: false });

  bindMath(article, store, s => {
    const ls = eigenvalues(s.m, s.c, s.k);
    const z = cscale(ls.reduce((a, b) => (b[1] > a[1] ? b : a)), s.h);
    return { 'abs-implicit': ampFactor('implicit', z), 'abs-exact': Math.exp(z[0]) };
  }, { signal, digits: 4 });
  // h drags continuously; the bundle just highlights whichever of its own steps is nearest
  const offScrub = bindScrub(article, store, { signal, limits: { h: [HS[0], HS[HS.length - 1]] } });

  return { destroy() { unsubscribe(); offScrub(); } };
}
