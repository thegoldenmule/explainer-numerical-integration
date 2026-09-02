// Panel 8, spine: the simulation running with a frame-budget bar beside it. Raise h and the
// compute cost per frame falls while the error against the exact curve rises. The bar is on
// a log scale because a spring costs microseconds against a 16.7 ms frame.

import { el, fmt } from 'shared/dom.js';
import { createStage } from 'shared/gfx/stage.js';
import { drawTrajectory } from 'shared/gfx/trajectory.js';
import { createPlayer } from 'shared/player.js';
import { transport } from 'shared/ui/transport.js';
import { slider, readout, controls } from 'shared/ui/controls.js';
import { bindMath } from 'shared/ui/livemath.js';
import { FRAME_MS, benchmarkStep, stepsPerFrame, fmtMs, drawBudgetBar } from './cost.js';

const SPAN = 6;   // seconds of run visible

export function mount(root, ctx) {
  const { store, loop, signal } = ctx;

  const stage = createStage(root, { layers: ['plot'], aspect: 'wide', signal });
  const player = createPlayer({ store, loop, signal });
  const out = readout({ label: 'cost and error' });
  let maxErr = 0, scanned = 0;

  stage.onDraw(({ w, h, dpr }) => {
    const state = store.get();
    const g = stage.ctx('plot');
    g.clearRect(0, 0, w, h);

    // the budget bar across the top
    const barTop = 22 * dpr, barH = 18 * dpr, pad = 8 * dpr;
    const perStep = benchmarkStep(state);
    const steps = stepsPerFrame(state.h);
    const cost = perStep * steps;
    drawBudgetBar(g, { x: pad, y: barTop, w: w - 2 * pad, h: barH, dpr }, { cost });

    // the run underneath
    const top = barTop + barH + 30 * dpr;
    g.save();
    g.translate(0, top);
    const s = player.series;
    const tMax = Math.max(SPAN, player.t);
    drawTrajectory(g, { w, h: h - top, dpr }, s, { tMin: tMax - SPAN, tMax, y: [-3, 3], yLabel: 'x' });
    g.restore();

    // error: the current gap and the largest so far
    for (; scanned < s.n; scanned++) { const e = s.err[scanned]; if (e > maxErr || !Number.isFinite(e)) maxErr = e; }
    const cur = player.current;
    const measured = player.cost;
    out.set([
      `cost: ${steps >= 1 ? fmt(steps, 1) + ' steps' : 'one step per ' + fmt(1 / steps, 1) + ' frames'} × ${fmtMs(perStep)} = ${fmtMs(cost)} of ${fmtMs(FRAME_MS)}`,
      el('span', { class: 'label' }, `  (player timer: ${fmtMs(measured.perFrame)}, 0.1 ms resolution)\n`),
      `error: |x − exact| = ${fmt(cur.err, 4)} at t = ${fmt(cur.t, 2)} s, largest so far ${fmt(maxErr, 4)}`,
    ]);
  });
  player.onChange(() => { if (player.n <= 1) { maxErr = 0; scanned = 0; } stage.invalidate(); });

  root.append(controls(
    slider(store, 'h', { label: 'h (step)', min: 0.002, max: 0.25, format: v => `${v.toFixed(3)} s`, signal }),
    transport(player, { signal }),
  ));
  root.append(out.el);

  const unsub = store.subscribe(stage.invalidate, { immediate: false });
  bindMath(root.closest('article'), store, state => ({ steps: stepsPerFrame(state.h) }), { signal });
  return { destroy() { unsub(); } };
}
