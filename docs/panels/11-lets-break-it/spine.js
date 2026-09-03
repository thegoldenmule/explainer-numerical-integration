// Panel 11, spine: transport above the plane, the region under it with a draggable λ, the
// spring running against the exact solution below that, and the equation the reader can
// drag m and k in directly (c comes from dragging the root instead: c and k together fix a
// point in the plane, m does not move it, so it needs its own handle).

import { fmt, fragment } from 'shared/dom.js';
import { createStage } from 'shared/gfx/stage.js';
import { createComplexPlane } from 'shared/gfx/cplane.js';
import { drawTrajectory } from 'shared/gfx/trajectory.js';
import { cssVar, drawText } from 'shared/gfx/plot2d.js';
import { createPlayer } from 'shared/player.js';
import { transport } from 'shared/ui/transport.js';
import { methodPicker, controls } from 'shared/ui/controls.js';
import { bindMath } from 'shared/ui/livemath.js';
import { bindScrub } from 'shared/ui/scrub.js';

const SPAN = 6;   // seconds of run visible in the trajectory strip

const EQUATION = `<math display="block"><mrow>
  <mn data-scrub="m" data-digits="2">1.00</mn><msup><mi>x</mi><mo>″</mo></msup><mo>+</mo>
  <mn data-var="c" data-digits="2">0.10</mn><msup><mi>x</mi><mo>′</mo></msup><mo>+</mo>
  <mn data-scrub="k" data-digits="1">100.0</mn><mi>x</mi><mo>=</mo><mn>0</mn>
</mrow></math>`;

export function mount(root, ctx) {
  const { store, signal, loop } = ctx;
  const article = root.closest('article') ?? root;

  // transport first, so the plane below it gets the full width instead of sharing a row
  const player = createPlayer({ store, loop, signal });
  root.append(controls(transport(player, { signal })));

  // the plane, with the region blitted underneath and the λ handle
  const planeStage = createStage(root, { layers: ['region', 'plane'], aspect: 'square', signal, grab: true });
  const plane = createComplexPlane({ stage: planeStage, store, signal, halfRange: 15, region: true, drag: true });

  // the run
  const runStage = createStage(root, { layers: ['plot'], aspect: 'strip', signal });
  const secs = v => (v === Infinity ? '∞' : fmt(v, 2) + ' s');
  const short = v => (Math.abs(v) >= 100 ? v.toExponential(2).replace('-', '−') : fmt(v, 3));   // keeps the line short
  runStage.onDraw(size => {
    const s = player.series;
    const tMax = Math.max(SPAN, player.t);
    const view = drawTrajectory(runStage.ctx('plot'), size, s, { tMin: tMax - SPAN, tMax, y: [-3, 3], yLabel: 'x' });
    const r = plane.report, g = player.growth(), cur = player.current;
    if (!r) return;
    const factor = Number.isNaN(r.factors[0]) ? `ρ = ${fmt(r.rho, 4)}` : `|R| = ${fmt(r.factors[0], 4)}`;
    // the verdict and the predicted-vs-measured doubling time, in the run's own corner
    const corner = { align: 'right', dx: -8 };
    drawText(runStage.ctx('plot'), view, `${r.stable ? 'stable' : 'unstable'}  ${factor}`, view.xMax, view.yMax,
      { ...corner, color: cssVar(r.stable ? '--stable' : '--unstable'), size: 12, dy: 16 });
    drawText(runStage.ctx('plot'), view, `predicted doubling ${secs(r.doublingTime)} · measured ${g ? secs(g.doublingTime) : '…'}`, view.xMax, view.yMax,
      { ...corner, color: cssVar('--fg'), size: 12, dy: 32 });
    drawText(runStage.ctx('plot'), view, `t = ${fmt(cur.t, 2)} s   x ${short(cur.x)} · exact ${short(cur.exact)}`, view.xMax, view.yMax,
      { ...corner, color: cssVar('--muted'), size: 11, dy: 48 });
  });
  player.onChange(runStage.invalidate);

  root.append(controls(methodPicker(store, { signal }), fragment(EQUATION)));

  bindMath(article, store, undefined, { signal });
  const offScrub = bindScrub(article, store, { signal, limits: { h: [0.005, 0.25] } });
  return { destroy() { offScrub(); } };
}
