// Panel 7, right: sweep the discriminant through zero. A slider on c walks the two roots
// along the real axis until they collide at −c/2m and split into the plane; beside them the
// closed-form solution switches between overdamped, critically damped, and underdamped.

import { el, fmt } from 'shared/dom.js';
import { createStage } from 'shared/gfx/stage.js';
import { createComplexPlane } from 'shared/gfx/cplane.js';
import { drawTrajectory } from 'shared/gfx/trajectory.js';
import { cssVar, drawText } from 'shared/gfx/plot2d.js';
import { slider, controls, readout } from 'shared/ui/controls.js';
import { discriminant, regime, eigenvalues, exactSolution, naturalFrequency } from 'shared/math/system.js';
import { cfmt } from 'shared/math/complex.js';

const SAMPLES = 800;
const REGIME_LABEL = { underdamped: 'underdamped', critical: 'critically damped', overdamped: 'overdamped' };

export function mount(root, ctx) {
  const { store, signal } = ctx;

  const top = el('div', { class: 'viz-row' });
  root.append(top);
  const planeStage = createStage(top, { layers: ['plane'], aspect: 'half', signal });
  createComplexPlane({
    stage: planeStage, store, signal, verdict: 'physical',
    halfRange: s => Math.max(3, 1.3 * Math.max(...eigenvalues(s.m, s.c, s.k).flat().map(Math.abs))),
    onDraw(g, view, s) {
      // the collision point −c/2m, and the critical c for this m, k
      const alpha = -s.c / (2 * s.m);
      drawText(g, view, `−c/2m = ${fmt(alpha, 2)}`, alpha, 0, { color: cssVar('--muted'), size: 11, align: 'center', dy: 16 });
    },
  });

  const out = readout({ label: 'regime' });
  const critical = el('button', { class: 'btn', type: 'button', title: 'Set c = 2√(mk) exactly' }, 'Snap to critical');
  critical.addEventListener('click', () => { const s = store.get(); store.set({ c: 2 * Math.sqrt(s.m * s.k) }); }, { signal });
  top.append(controls(
    slider(store, 'c', { label: 'c (drag)', min: 0, max: 50, signal }),
    slider(store, 'k', { label: 'k (spring)', min: 0, max: 400, signal }),
    el('div', { class: 'controls-row' }, critical),
    out.el,
  ));

  // the closed form, sampled over a few natural periods
  const runStage = createStage(root, { layers: ['plot'], aspect: 'strip', signal });
  const series = { t: new Float64Array(SAMPLES), x: new Float64Array(SAMPLES), n: SAMPLES };
  runStage.onDraw(size => {
    const s = store.get();
    const sol = exactSolution(s);
    const wn = naturalFrequency(s.m, s.k);
    const tEnd = Math.min(60, Math.max(1, wn > 0 ? 6 * 2 * Math.PI / wn : 60));
    for (let i = 0; i < SAMPLES; i++) { series.t[i] = tEnd * i / (SAMPLES - 1); series.x[i] = sol.x(series.t[i]); }
    const amp = Math.max(Math.abs(s.x0), 0.25, Math.abs(s.v0) / Math.max(wn, 1e-3));
    drawTrajectory(runStage.ctx('plot'), size, series, {
      tMin: 0, tMax: tEnd, y: [-1.15 * amp, 1.15 * amp], approx: cssVar('--exact'), width: 2, yLabel: 'x (exact)',
    });

    const d = discriminant(s.m, s.c, s.k), r = regime(s.m, s.c, s.k);
    const [l1, l2] = eigenvalues(s.m, s.c, s.k);
    out.set([
      el('strong', {}, REGIME_LABEL[r]), `  c² − 4mk = ${fmt(d, 1)}  (critical c = ${fmt(2 * Math.sqrt(s.m * s.k), 2)})\n`,
      `λ = ${cfmt(l1, 3)},  ${cfmt(l2, 3)}`,
    ]);
  });
  const unsubscribe = store.subscribe(runStage.invalidate, { immediate: false });

  return { destroy() { unsubscribe(); } };
}
