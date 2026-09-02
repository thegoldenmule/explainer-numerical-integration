// Panel 11, left: the exact solution only, no integrator. A draggable λ on a plane with no
// region, and the closed form for the system whose eigenvalue it is, drawn in time: pure
// decay on the negative real axis, pure oscillation on the imaginary axis, a ringing decay
// in between. Reading the plane by example, before any method can get it wrong.

import { el, fmt } from 'shared/dom.js';
import { createStage } from 'shared/gfx/stage.js';
import { createComplexPlane, handleIndex } from 'shared/gfx/cplane.js';
import { drawTrajectory } from 'shared/gfx/trajectory.js';
import { cssVar, drawPoint } from 'shared/gfx/plot2d.js';
import { controls, row, readout } from 'shared/ui/controls.js';
import { eigenvalues, exactFromEigenvalue, paramsFromEigenvalue } from 'shared/math/system.js';
import { cfmt } from 'shared/math/complex.js';

const SAMPLES = 800;
const HALF = 12;
// three places on the plane, reached by the same inversion the drag uses
const PLACES = [
  { label: 'Pure decay: λ = −3', lambda: [-3, 0] },
  { label: 'Spiral: λ = −1 + 8i', lambda: [-1, 8] },
  { label: 'Pure oscillation: λ = 10i', lambda: [0, 10] },
];

const describe = ([a, b]) => {
  if (Math.abs(b) < 1e-9) return a < 0 ? 'on the negative real axis: pure decay, no ringing' : a > 0 ? 'on the positive real axis: pure growth' : 'at the origin: nothing moves';
  if (Math.abs(a) < 1e-9) return 'on the imaginary axis: pure oscillation, forever, at the same amplitude';
  return a < 0 ? 'left half plane: a spiral inward, a ringing decay in time' : 'right half plane: a spiral outward; the real system is unstable';
};

export function mount(root, ctx) {
  const { store, signal } = ctx;
  const upper = s => { const ls = eigenvalues(s.m, s.c, s.k); return ls[handleIndex(ls)]; };

  const top = el('div', { class: 'viz-row' });
  root.append(top);
  const planeStage = createStage(top, { layers: ['plane'], aspect: 'half', signal, grab: true });
  createComplexPlane({
    stage: planeStage, store, signal, drag: true, labels: false, halfRange: HALF,
    // no method here: the roots are colored by the physical verdict, over cplane's dots
    onDraw(g, view, s) {
      for (const l of eigenvalues(s.m, s.c, s.k)) {
        drawPoint(g, view, l[0], l[1], { r: 6, fill: cssVar(l[0] <= 0 ? '--stable' : '--unstable') });
      }
    },
  });

  const out = readout({ label: 'λ' });
  top.append(controls(
    row(...PLACES.map(p => el('button', {
      class: 'btn', type: 'button',
      onclick: () => store.set(paramsFromEigenvalue(store.get().m, p.lambda)),
    }, p.label))),
    out.el,
  ));

  const runStage = createStage(root, { layers: ['plot'], aspect: 'strip', signal });
  const series = { t: new Float64Array(SAMPLES), x: new Float64Array(SAMPLES), n: SAMPLES };
  runStage.onDraw(size => {
    const s = store.get();
    const lambda = upper(s);
    const sol = exactFromEigenvalue({ m: s.m, lambda, x0: s.x0, v0: s.v0 });
    // six periods when it rings, six time constants when it only decays
    const [a, b] = lambda;
    const span = Math.abs(b) > 0.1 * Math.abs(a) ? 6 * 2 * Math.PI / Math.max(Math.abs(b), 0.05) : 6 / Math.max(Math.abs(a), 0.05);
    const tEnd = Math.min(60, Math.max(1, span));
    let amp = Math.max(Math.abs(s.x0), 1e-3);
    for (let i = 0; i < SAMPLES; i++) {
      series.t[i] = tEnd * i / (SAMPLES - 1);
      series.x[i] = sol.x(series.t[i]);
      if (Number.isFinite(series.x[i])) amp = Math.max(amp, Math.min(Math.abs(series.x[i]), 8 * Math.abs(s.x0) + 1));
    }
    drawTrajectory(runStage.ctx('plot'), size, series, {
      tMin: 0, tMax: tEnd, y: [-1.15 * amp, 1.15 * amp], approx: cssVar('--exact'), width: 2, yLabel: 'x (exact)',
    });
    out.set(`${cfmt(lambda, 3)}\n${describe(lambda)}`);
  });
  const unsubscribe = store.subscribe(runStage.invalidate, { immediate: false });

  return { destroy() { unsubscribe(); } };
}
