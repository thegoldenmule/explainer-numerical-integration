// Panel 11, spine: the region under the plane with a draggable λ, the spring running
// against the exact solution, and transport. The viz must fit beside the essay prose at
// 1280×800: a half plane beside the controls, a strip for the run, with the verdict and the
// predicted-vs-measured doubling time called out in the run's own corner.

import { el, fmt } from 'shared/dom.js';
import { createStage } from 'shared/gfx/stage.js';
import { createComplexPlane } from 'shared/gfx/cplane.js';
import { drawTrajectory } from 'shared/gfx/trajectory.js';
import { cssVar, drawText } from 'shared/gfx/plot2d.js';
import { createPlayer } from 'shared/player.js';
import { transport } from 'shared/ui/transport.js';
import { slider, methodPicker, presets, controls } from 'shared/ui/controls.js';

const SPAN = 6;   // seconds of run visible in the trajectory strip

export function mount(root, ctx) {
  const { store, signal, loop } = ctx;

  // the plane, with the region blitted underneath and the λ handle
  const top = el('div', { class: 'viz-row' });
  root.append(top);
  const planeStage = createStage(top, { layers: ['region', 'plane'], aspect: 'half', signal, grab: true });
  const plane = createComplexPlane({ stage: planeStage, store, signal, halfRange: 15, region: true, drag: true });

  // the run
  const runStage = createStage(root, { layers: ['plot'], aspect: 'strip', signal });
  const player = createPlayer({ store, loop, signal });
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

  top.append(controls(
    slider(store, 'h', { label: 'h (step)', min: 0.005, max: 0.25, format: v => v.toFixed(3), signal }),
    transport(player, { signal }),
  ));
  root.append(el('div', { class: 'controls-row' },
    methodPicker(store, { signal }),
    presets(store, { demo: 'Demo: m=1, k=100', essay: 'Essay: m=10, k=10' }),
  ));

  return { destroy() {} };
}
