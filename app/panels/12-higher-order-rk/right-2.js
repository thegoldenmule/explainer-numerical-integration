// Panel 12, right 2: implicit Euler. Its region |1 − hλ| ≥ 1 on the plane, and an exploded
// h: a small bundle of implicit runs against the exact curve, one per step size in the
// range, with the store's h highlighted. A discrete slider walks the range by setting h.
// Never explodes, always lies: the over-damping grows with the step.

import { el, fmt } from 'shared/dom.js';
import { createStage } from 'shared/gfx/stage.js';
import { createComplexPlane } from 'shared/gfx/cplane.js';
import { drawBundle } from 'shared/gfx/bundle.js';
import { cssVar, makeView, drawGrid, drawPolyline, drawPoint } from 'shared/gfx/plot2d.js';
import { bindMath } from 'shared/ui/livemath.js';
import { controls, readout } from 'shared/ui/controls.js';
import { eigenvalues, exactSolution, naturalFrequency } from 'shared/math/system.js';
import { simulate } from 'shared/math/integrators.js';
import { ampFactor } from 'shared/math/stability.js';
import { cscale } from 'shared/math/complex.js';
import { sweepRange, sweep, sweepKey, nearestIndex } from 'shared/math/sweep.js';

const HS = sweepRange(1 / 60, 1 / 2, 6, { log: true });   // 1/60 s up to half a second
const FINE = 600;
/** short enough for the narrow readout: 3 decimals, or 2 significant digits when tiny */
const short = v => (Math.abs(v) < 1e-3 && v !== 0 ? v.toPrecision(2) : v.toFixed(3)).replace(/-/g, '−');

/** 60 / ω_n seconds, clamped: 6 s for the demo spring, 60 s for the essay's. */
const spanFor = s => Math.min(120, Math.max(2, 60 / Math.max(naturalFrequency(s.m, s.k), 1e-3)));

export function mount(root, ctx) {
  const { store, signal } = ctx;
  const current = s => nearestIndex(HS, s.h);

  const top = el('div', { class: 'viz-row' });
  root.append(top);
  const planeStage = createStage(top, { layers: ['region', 'plane'], aspect: 'half', signal });
  createComplexPlane({
    stage: planeStage, store, signal, labels: false,
    region: s => ({ method: 'implicit', h: s.h }),
    halfRange: s => Math.max(3, 1.3 * Math.max(2 / s.h, ...eigenvalues(s.m, s.c, s.k).flat().map(Math.abs))),
    onDraw(g, view, s) {
      // implicit Euler's verdict on the roots, over cplane's dots (which follow the store's method)
      for (const l of eigenvalues(s.m, s.c, s.k)) {
        const f = ampFactor('implicit', cscale(l, s.h));
        drawPoint(g, view, l[0], l[1], { r: 6, fill: cssVar(f <= 1 ? '--stable' : '--unstable') });
      }
    },
  });

  const input = el('input', { type: 'range', min: 0, max: HS.length - 1, step: 1, value: current(store.get()) });
  const value = el('output');
  input.addEventListener('input', () => store.set({ h: HS[Number(input.value)] }), { signal });
  const out = readout({ label: 'implicit x at the window\u2019s end' });
  top.append(controls(
    el('label', { class: 'control' }, el('span', { class: 'control-label' }, el('span', {}, 'h along the range'), value), input),
    out.el,
  ));

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

    value.textContent = `${fmt(HS[i], 3)} s`;
    const exactEnd = sol.x(tEnd);
    out.set(series.flatMap((r, j) => {
      const last = r.result.x[r.result.n - 1];
      const line = `h = ${fmt(r.value, 3)}  x(${fmt(tEnd, 0)}) = ${short(last)}`;
      return [j === i ? el('strong', {}, line) : line, '\n'];
    }).concat(`exact      x(${fmt(tEnd, 0)}) = ${short(exactEnd)}`));
  });
  const unsubscribe = store.subscribe(runStage.invalidate, { immediate: false });

  bindMath(root.closest('article') ?? root, store, s => {
    const ls = eigenvalues(s.m, s.c, s.k);
    const z = cscale(ls.reduce((a, b) => (b[1] > a[1] ? b : a)), s.h);
    return { 'abs-implicit': ampFactor('implicit', z), 'abs-exact': Math.exp(z[0]) };
  }, { signal, digits: 4 });

  return { destroy() { unsubscribe(); } };
}
