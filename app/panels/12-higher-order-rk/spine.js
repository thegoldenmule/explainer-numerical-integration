// Panel 12, spine: method = *. Two graphs, stacked full width: the plane for the store's
// method (region + eigenvalues), and the live spring running against the exact curve.
// Switching integrator redraws both. The teaching contrast is implicit Euler: never
// explodes, visibly over-damped (0.26 vs 0.71 at t = 60 with the essay preset) — the small
// multiples that used to pin Euler/RK4/implicit side by side moved out; the three right
// panes make that contrast one method at a time instead.
//
// No transport: createPlayer's own autoplay (its default) is the only playback, with nothing
// to pause it, and no preset buttons — m and k are draggable right in the prose's own
// equation instead, the same data-scrub-into-the-tuple pattern panel 8 uses for h.

import { el, fmt } from 'shared/dom.js';
import { createStage } from 'shared/gfx/stage.js';
import { createComplexPlane } from 'shared/gfx/cplane.js';
import { drawTrajectory } from 'shared/gfx/trajectory.js';
import { cssVar, drawText } from 'shared/gfx/plot2d.js';
import { createPlayer } from 'shared/player.js';
import { methodPicker } from 'shared/ui/controls.js';
import { bindScrub } from 'shared/ui/scrub.js';
import { eigenvalues } from 'shared/math/system.js';

const SPAN = 6;                                   // seconds of run visible
const MULTIPLES = ['euler', 'rk4', 'implicit'];   // the picker's choices

// Euler and implicit Euler's regions are circles, center ∓1/h radius 1/h (panel 10's disk,
// mirrored for implicit); RK4's is not a circle but stays within about 2.8/h of the origin
// along both axes (see panel 12-right's overlay). Center on the method's own circle when it
// has one, on the origin otherwise, sized with margin to show the whole shape, not a crop.
const CX = { euler: s => -1 / s.h, implicit: s => 1 / s.h };
const RADIUS = { euler: s => 1.15 / s.h, implicit: s => 1.15 / s.h, rk4: s => 3.2 / s.h };
const cx = s => (CX[s.method] ?? (() => 0))(s);
const halfRange = s => Math.max((RADIUS[s.method] ?? (() => 3))(s), 1.3 * Math.max(...eigenvalues(s.m, s.c, s.k).flat().map(Math.abs)));

export function mount(root, ctx) {
  const { store, signal, loop } = ctx;

  // the plane for the store's method
  const planeStage = createStage(root, { layers: ['region', 'plane'], aspect: 'square', signal });
  const plane = createComplexPlane({ stage: planeStage, store, signal, cx, halfRange, region: true });

  // the live spring run against the exact curve
  const runStage = createStage(root, { layers: ['plot'], aspect: 'wide', signal });
  const player = createPlayer({ store, loop, signal });
  runStage.onDraw(size => {
    const s = player.series;
    const tMax = Math.max(SPAN, player.t);
    const view = drawTrajectory(runStage.ctx('plot'), size, s, { tMin: tMax - SPAN, tMax, y: 'auto', cap: 3, yLabel: 'x' });
    const r = plane.report, cur = player.current;
    if (!r) return;
    const g = runStage.ctx('plot');
    const corner = { align: 'right', dx: -8 };
    drawText(g, view, `${r.method.label}: ${r.stable ? 'stable' : 'unstable'}`, view.xMax, view.yMax,
      { ...corner, color: cssVar(r.stable ? '--stable' : '--unstable'), size: 12, dy: 16 });
    drawText(g, view, `t = ${fmt(cur.t, 2)} s   x ${fmt(cur.x, 3)} · exact ${fmt(cur.exact, 3)}`, view.xMax, view.yMax,
      { ...corner, color: cssVar('--fg'), size: 12, dy: 32 });
  });
  player.onChange(runStage.invalidate);

  // just the picker; the run plays on its own and never stops
  root.append(el('div', { class: 'controls-row' }, methodPicker(store, { only: MULTIPLES, signal })));

  const article = root.closest('article') ?? root;
  const offScrub = bindScrub(article, store, { signal });
  return { destroy() { offScrub(); } };
}
