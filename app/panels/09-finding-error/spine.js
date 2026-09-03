// Panel 9, spine: the error between the simulation and the exact solution plotted over time
// next to the run, on a log axis, with the *measured* step-to-step ratio and the doubling
// time derived from it. No formula for the ratio here; panel 10 derives R(hλ).

import { fmt } from 'shared/dom.js';
import { createStage } from 'shared/gfx/stage.js';
import { drawTrajectory } from 'shared/gfx/trajectory.js';
import { cssVar, drawText } from 'shared/gfx/plot2d.js';
import { createPlayer } from 'shared/player.js';
import { transport } from 'shared/ui/transport.js';
import { slider, controls } from 'shared/ui/controls.js';

const SPAN = 6;   // seconds of run visible

export function mount(root, ctx) {
  const { store, loop, signal } = ctx;

  const runStage = createStage(root, { layers: ['plot'], aspect: 'strip', signal });
  const errStage = createStage(root, { layers: ['plot'], aspect: 'strip', signal });
  const player = createPlayer({ store, loop, signal });

  const window_ = () => { const tMax = Math.max(SPAN, player.t); return { tMin: tMax - SPAN, tMax }; };
  runStage.onDraw(size => {
    drawTrajectory(runStage.ctx('plot'), size, player.series, { ...window_(), y: [-3, 3], yLabel: 'x' });
  });
  errStage.onDraw(size => {
    const s = player.series;
    const view = drawTrajectory(errStage.ctx('plot'), size, { t: s.t, x: s.err, n: s.n }, { ...window_(), yLog: true, yLabel: '|x − exact|  (log)' });
    const g = errStage.ctx('plot');
    const growth = player.growth(), cur = player.current, h = player.h;
    const corner = { align: 'right', dx: -8 };
    drawText(g, view, `t = ${fmt(cur.t, 2)} s   error = ${fmt(cur.err, 4)}`, view.xMax, view.yMax, { ...corner, color: cssVar('--fg'), size: 12, dy: 16 });
    if (!growth) {
      drawText(g, view, `measuring the ratio over the next ${fmt(2 * Math.max(2, Math.round(1 / h)) * h, 1)} s…`, view.xMax, view.yMax, { ...corner, color: cssVar('--muted'), size: 12, dy: 32 });
      return;
    }
    // the beat: the ratio is measured, not derived, and the doubling/halving time it implies
    const growing = growth.ratio > 1;
    const time = growing ? `doubles every ${fmt(growth.doublingTime, 2)} s`
      : growth.ratio < 1 ? `halves every ${fmt(h * Math.LN2 / -Math.log(growth.ratio), 2)} s` : 'holds steady';
    drawText(g, view, `z = error(i+1) / error(i) ≈ ${fmt(growth.ratio, 4)}  (last ${growth.steps} steps)`, view.xMax, view.yMax,
      { ...corner, color: cssVar(growing ? '--unstable' : '--stable'), size: 12, dy: 32 });
    drawText(g, view, growing ? `error ${time}` : time, view.xMax, view.yMax, { ...corner, color: cssVar(growing ? '--unstable' : '--stable'), size: 12, dy: 48 });
  });
  player.onChange(() => { runStage.invalidate(); errStage.invalidate(); });

  root.append(controls(
    slider(store, 'h', { label: 'h (step)', min: 0.002, max: 0.25, format: v => `${v.toFixed(3)} s`, signal }),
    transport(player, { signal }),
  ));

  const unsub = store.subscribe(() => { runStage.invalidate(); errStage.invalidate(); }, { immediate: false });
  return { destroy() { unsub(); } };
}
