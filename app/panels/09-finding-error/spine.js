// Panel 9, spine: the error between the simulation and the exact solution plotted over time
// next to the run, on a log axis, with the *measured* step-to-step ratio and the doubling
// time derived from it. No formula for the ratio here; panel 10 derives R(hλ).

import { el, fmt } from 'shared/dom.js';
import { createStage } from 'shared/gfx/stage.js';
import { drawTrajectory } from 'shared/gfx/trajectory.js';
import { createPlayer } from 'shared/player.js';
import { transport } from 'shared/ui/transport.js';
import { slider, readout, controls } from 'shared/ui/controls.js';

const SPAN = 6;   // seconds of run visible

export function mount(root, ctx) {
  const { store, loop, signal } = ctx;

  const runStage = createStage(root, { layers: ['plot'], aspect: 'strip', signal });
  const errStage = createStage(root, { layers: ['plot'], aspect: 'strip', signal });
  const player = createPlayer({ store, loop, signal });
  const out = readout({ label: 'measured, not derived' });

  const window_ = () => { const tMax = Math.max(SPAN, player.t); return { tMin: tMax - SPAN, tMax }; };
  runStage.onDraw(size => {
    drawTrajectory(runStage.ctx('plot'), size, player.series, { ...window_(), y: [-3, 3], yLabel: 'x' });
  });
  errStage.onDraw(size => {
    const s = player.series;
    drawTrajectory(errStage.ctx('plot'), size, { t: s.t, x: s.err, n: s.n }, { ...window_(), yLog: true, yLabel: '|x − exact|  (log)' });
    const g = player.growth(), cur = player.current, h = player.h;
    if (!g) { out.set(`t = ${fmt(cur.t, 2)} s   error = ${fmt(cur.err, 4)}\nmeasuring the ratio over the next ${fmt(2 * Math.max(2, Math.round(1 / h)) * h, 1)} s…`); return; }
    const growing = g.ratio > 1;
    const time = growing
      ? `doubles every ${fmt(g.doublingTime, 2)} s  (= h·ln2 / ln z = ${fmt(h, 3)} · 0.693 / ${fmt(Math.log(g.ratio), 4)})`
      : g.ratio < 1 ? `halves every ${fmt(h * Math.LN2 / -Math.log(g.ratio), 2)} s` : 'holds steady';
    out.set([
      `t = ${fmt(cur.t, 2)} s   error = ${fmt(cur.err, 4)}\n`,
      'z = error(i+1) / error(i) ≈ ', el('span', { class: growing ? 'unstable' : 'stable' }, fmt(g.ratio, 4)),
      ` per step, over the last ${g.steps} steps\n`,
      `${growing ? 'error ' : ''}${time}`,
    ]);
  });
  player.onChange(() => { runStage.invalidate(); errStage.invalidate(); });

  root.append(controls(
    slider(store, 'h', { label: 'h (step)', min: 0.002, max: 0.25, format: v => `${v.toFixed(3)} s`, signal }),
    transport(player, { signal }),
  ));
  root.append(out.el);

  const unsub = store.subscribe(() => { runStage.invalidate(); errStage.invalidate(); }, { immediate: false });
  return { destroy() { unsub(); } };
}
