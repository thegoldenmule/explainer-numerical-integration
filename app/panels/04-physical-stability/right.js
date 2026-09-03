// Panel 4, right: the whole initial-condition plane as a phase portrait, three times side by
// side: c = 0 (stable, orbits circle), c > 0 (asymptotically stable, spirals in), and c < 0
// (unstable, spirals out). The flow field is the system matrix applied at each lattice point;
// the trajectories are the closed form, which needs no integrator. The tuple clamps c ≥ 0,
// so the unstable portrait negates c in a local matrix and never writes it back.

import { fmt } from 'shared/dom.js';
import { createStage } from 'shared/gfx/stage.js';
import { cssVar, makeView, drawGrid, drawPolyline, drawPoint, drawText, drawVectorField, layoutGrid } from 'shared/gfx/plot2d.js';
import { systemMatrix, exactSolution, naturalFrequency } from 'shared/math/system.js';
import { apply } from 'shared/math/matrix2.js';
import { slider, controls, row } from 'shared/ui/controls.js';

const SAMPLES = 400;
const HALF = 1.6;   // x half-range; v is scaled by ω so an undamped orbit is a circle
const STARTS = [[1, 0], [-0.5, 0.6], [0.2, -1]];   // (x₀, v₀/ω)

export function mount(root, ctx) {
  const { store, signal } = ctx;

  const stage = createStage(root, { layers: ['plot'], aspect: 'wide', signal });

  stage.onDraw(({ w, h, dpr }) => {
    const s = store.get();
    const g = stage.ctx('plot');
    g.clearRect(0, 0, w, h);
    const omega = naturalFrequency(s.m, s.k);
    const wv = omega > 0 ? omega : 1;            // v-scale; k = 0 has no ω
    const period = omega > 0 ? 2 * Math.PI / omega : Infinity;
    const T = Math.min(6, 3 * period);
    // Re λ = −c / 2m per portrait, called out beside each one's own c
    const alpha = c => -c / (2 * s.m);
    const cases = [
      { c: 0, name: 'stable', note: `c = 0, Re λ = 0`, color: cssVar('--accent') },
      { c: s.c, name: 'asymptotically stable', note: `c = ${fmt(s.c, 2)}, Re λ = ${fmt(alpha(s.c), 3)}`, color: cssVar('--stable') },
      { c: -s.c, name: 'unstable', note: `c = ${fmt(-s.c, 2)}, Re λ = ${fmt(alpha(-s.c), 3)}`, color: cssVar('--unstable') },
    ];
    const cells = layoutGrid(w, h, 1, 3, 8 * dpr);
    cells.forEach((cell, i) => {
      const { c } = cases[i];
      const A = systemMatrix(s.m, c, s.k);
      g.save();
      g.translate(cell.x, cell.y);
      g.beginPath(); g.rect(0, 0, cell.w, cell.h); g.clip();
      const view = makeView({ w: cell.w, h: cell.h, dpr, halfW: HALF, halfH: HALF * wv * cell.h / cell.w });
      drawGrid(g, view, { xLabel: 'x', yLabel: 'v', ticks: 3 });
      drawVectorField(g, view, (x, v) => apply(A, [x, v]), { spacing: 20, normalize: true, maxLength: 12, alpha: 0.55 });
      for (const [x0, u0] of STARTS) {
        const sol = exactSolution({ m: s.m, c, k: s.k, x0, v0: u0 * wv });
        const xs = new Float64Array(SAMPLES), vs = new Float64Array(SAMPLES);
        for (let j = 0; j < SAMPLES; j++) { const t = T * j / (SAMPLES - 1); xs[j] = sol.x(t); vs[j] = sol.v(t); }
        drawPolyline(g, view, xs, vs, { color: cases[i].color, width: 1.75 });
        drawPoint(g, view, x0, u0 * wv, { r: 3.5, fill: cases[i].color });
      }
      drawText(g, view, cases[i].name, -HALF, view.yMax, { color: cases[i].color, size: 12, dx: 8, dy: 30 });
      drawText(g, view, cases[i].note, -HALF, view.yMax, { color: cssVar('--muted'), size: 11, dx: 8, dy: 44 });
      g.restore();
    });
  });

  root.append(controls(row(
    slider(store, 'c', { label: 'c (damping; the right portrait uses −c)', min: 0, max: 10, format: v => fmt(v, 2), signal }),
  )));

  const unsub = store.subscribe(stage.invalidate, { immediate: false });
  return { destroy() { unsub(); } };
}
