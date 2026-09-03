// Panel 7, right: sweep the discriminant through zero. Dragging c in the formula above walks
// the two roots along the real axis until they collide at −c/2m and split into the plane;
// beside them the closed-form solution switches between overdamped, critically damped, and
// underdamped. The regime, the discriminant and the roots are live numbers in the prose and on
// the canvas — there is no readout under the picture.
//
// c is this pane's own copy (./local.js): an overdamped view is a what-if and is never written
// to the tuple, and the sweep needs a range far past the tuple's LIMITS.c. It is dragged on a
// log scale, which keeps the resolution near 2√(mk) usable whatever m and k are. m and k do go
// to the tuple: they are the reader's real spring.

import { el, fmt } from 'shared/dom.js';
import { createStage } from 'shared/gfx/stage.js';
import { createComplexPlane } from 'shared/gfx/cplane.js';
import { drawTrajectory } from 'shared/gfx/trajectory.js';
import { cssVar, drawText } from 'shared/gfx/plot2d.js';
import { bindMath } from 'shared/ui/livemath.js';
import { bindScrub } from 'shared/ui/scrub.js';
import { controls, row } from 'shared/ui/controls.js';
import { discriminant, regime, eigenvalues, exactSolution, naturalFrequency } from 'shared/math/system.js';
import { cfmt } from 'shared/math/complex.js';
import { localDamping } from './local.js';

const SAMPLES = 800;
const REGIME_LABEL = { underdamped: 'underdamped', critical: 'critically damped', overdamped: 'overdamped' };
// This pane's own range for c: 2√(mk) tops out at 2√(50 · 2000) ≈ 632 over the tuple's limits,
// so critical is always reachable. The floor stays positive because the drag is multiplicative.
const C_RANGE = [0.05, 1000];

const criticalC = s => 2 * Math.sqrt(s.m * s.k);

export function mount(root, ctx) {
  const { store, signal } = ctx;
  const article = root.closest('article') ?? root;
  const local = localDamping(store, { range: C_RANGE, signal });

  // a square plane beside its one control, then a strip under both (--stage-max's budget)
  const top = el('div', { class: 'viz-row' });
  root.append(top);
  const planeStage = createStage(top, { layers: ['plane'], aspect: 'half', signal });
  const plane = createComplexPlane({
    stage: planeStage, store: local, signal, verdict: 'physical',
    halfRange: s => Math.max(3, 1.3 * Math.max(...eigenvalues(s.m, s.c, s.k).flat().map(Math.abs))),
    onDraw(g, view, s) {
      const muted = cssVar('--muted');
      // the collision point −c/2m, and where this c stands against the critical one
      const alpha = -s.c / (2 * s.m);
      drawText(g, view, `−c/2m = ${fmt(alpha, 2)}`, alpha, 0, { color: muted, size: 11, align: 'center', dy: 16 });
      // bottom-left: the only corner drawGrid leaves empty (Im λ sits top-center, Re λ bottom-right)
      drawText(g, view, `c = ${fmt(s.c, 2)} vs 2√(mk) = ${fmt(criticalC(s), 2)}: ${REGIME_LABEL[regime(s.m, s.c, s.k)]}`,
        view.xMin, view.yMin, { color: muted, size: 11, dx: 8, dy: -10 });
    },
  });

  // the one button: critical is a measure-zero value no drag will ever land on
  const snap = el('button', { class: 'btn', type: 'button' }, 'set c = 2√(mk)');
  snap.addEventListener('click', () => local.set({ c: criticalC(local.get()) }), { signal });
  const note = el('p', { class: 'muted' },
    'Critically damped: the one c where c² − 4mk = 0 and the two roots collide on the real '
    + 'axis — the boundary between overdamped (two real roots, no oscillation) and underdamped '
    + '(a conjugate pair, and the mass rings). No drag lands on it exactly, so this sets it.');
  top.append(controls(row(snap), note));

  // the closed form, sampled over a few natural periods
  const runStage = createStage(root, { layers: ['plot'], aspect: 'strip', signal });
  const series = { t: new Float64Array(SAMPLES), x: new Float64Array(SAMPLES), n: SAMPLES };
  runStage.onDraw(size => {
    const s = local.get();
    const sol = exactSolution(s);
    const wn = naturalFrequency(s.m, s.k);
    const tEnd = Math.min(60, Math.max(1, wn > 0 ? 6 * 2 * Math.PI / wn : 60));
    for (let i = 0; i < SAMPLES; i++) { series.t[i] = tEnd * i / (SAMPLES - 1); series.x[i] = sol.x(series.t[i]); }
    const amp = Math.max(Math.abs(s.x0), 0.25, Math.abs(s.v0) / Math.max(wn, 1e-3));
    drawTrajectory(runStage.ctx('plot'), size, series, {
      tMin: 0, tMax: tEnd, y: [-1.15 * amp, 1.15 * amp], approx: cssVar('--exact'), width: 2, yLabel: 'x (exact)',
    });
  });
  const unsubscribe = local.subscribe(() => {
    runStage.invalidate();
    snap.textContent = `set c = 2√(mk) = ${fmt(criticalC(local.get()), 2)}`;
  });

  bindScrub(article, local, { signal });
  bindMath(article, local, s => {
    const d = discriminant(s.m, s.c, s.k), r = regime(s.m, s.c, s.k);
    const [l1, l2] = eigenvalues(s.m, s.c, s.k);
    return {
      disc: d,
      sign: r === 'critical' ? 'zero' : d < 0 ? 'negative' : 'positive',
      regime: REGIME_LABEL[r],
      l1: cfmt(l1, 3), l2: cfmt(l2, 3),
      alpha: -s.c / (2 * s.m),
      crit: criticalC(s),
      localc: s.c,
      springc: local.springC,
    };
  }, { signal });

  return { destroy() { unsubscribe(); plane.destroy(); local.destroy(); } };
}
