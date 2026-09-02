// Panel 11, spine: the region under the plane with a draggable λ, the spring running
// against the exact solution, transport, and readouts. Proof of the shared modules; the
// prose is a placeholder.

import { el, fmt } from 'shared/dom.js';
import { createStage } from 'shared/gfx/stage.js';
import { createComplexPlane } from 'shared/gfx/cplane.js';
import { drawTrajectory } from 'shared/gfx/trajectory.js';
import { createPlayer } from 'shared/player.js';
import { transport } from 'shared/ui/transport.js';
import { slider, methodPicker, presets, readout, controls, row } from 'shared/ui/controls.js';

const SPAN = 6;   // seconds of run visible in the trajectory strip

export function mount(root, ctx) {
  const { store, signal, loop } = ctx;

  // the plane, with the region blitted underneath and the λ handle
  const planeStage = createStage(root, { layers: ['region', 'plane'], aspect: 'half', signal, grab: true });
  const plane = createComplexPlane({ stage: planeStage, store, signal, halfRange: 15, region: true, drag: true });

  // the run
  const runStage = createStage(root, { layers: ['plot'], aspect: 'strip', signal });
  const player = createPlayer({ store, loop, signal });
  const out = readout({ label: 'verdict' });
  runStage.onDraw(size => {
    const s = player.series;
    const tMax = Math.max(SPAN, player.t);
    drawTrajectory(runStage.ctx('plot'), size, s, { tMin: tMax - SPAN, tMax, y: [-3, 3], yLabel: 'x' });
    const r = plane.report, g = player.growth(), cur = player.current;
    if (!r) return;
    const verdict = el('span', { class: r.stable ? 'stable' : 'unstable' }, r.stable ? 'stable' : 'unstable');
    out.set([
      verdict, `  |R(hλ)| = ${fmt(r.factors[0], 4)}   ρ = ${fmt(r.rho, 4)}\n`,
      `predicted doubling ${r.doublingTime === Infinity ? '∞' : fmt(r.doublingTime, 2) + ' s'}`,
      g ? `   measured ratio ${fmt(g.ratio, 4)}, doubling ${g.doublingTime === Infinity ? '∞' : fmt(g.doublingTime, 2) + ' s'}` : '   measuring…',
      `\nt = ${fmt(cur.t, 2)} s   x = ${fmt(cur.x, 3)}   exact ${fmt(cur.exact, 3)}   ${fmt(player.cost.perFrame, 3)} ms/frame`,
    ]);
  });
  player.onChange(runStage.invalidate);

  root.append(
    controls(
      row(
        slider(store, 'h', { label: 'h (step)', min: 0.005, max: 0.25, format: v => v.toFixed(3), signal }),
        methodPicker(store, { signal }),
      ),
      row(presets(store, { demo: 'Demo (m=1, c=0.1, k=100)', essay: 'Essay (m=10, c=0.1, k=10)' }), transport(player, { signal })),
      out.el,
    ),
  );

  return { destroy() {} };
}
