// Panel 8, spine: the simulation running with a frame-budget bar above it. Raise h and the
// compute cost per frame falls while the error against the exact curve rises. The bar is on
// a log scale because a spring costs microseconds against a 16.7 ms frame; the cost numbers
// live on the bar and in the prose, and the error is called out on the run itself.
//
// The plot window is a few periods of *this* spring (cost.js's plotSpan) and the y range is
// the run's own amplitude, so the oscillation fills the frame instead of being a squiggle
// inside a pinned ±3 box, and a blown-up Euler simply leaves the frame.

import { fmt } from 'shared/dom.js';
import { createStage } from 'shared/gfx/stage.js';
import { cssVar, drawText } from 'shared/gfx/plot2d.js';
import { drawTrajectory } from 'shared/gfx/trajectory.js';
import { createPlayer, stepCost } from 'shared/player.js';
import { transport } from 'shared/ui/transport.js';
import { presets, controls } from 'shared/ui/controls.js';
import { bindMath } from 'shared/ui/livemath.js';
import { bindScrub } from 'shared/ui/scrub.js';
import { FRAME_MS, stepsPerFrame, fmtMs, fmtSteps, drawBudgetBar, plotSpan } from './cost.js';

const CYCLES = 4;   // periods of the spring visible at once

export function mount(root, ctx) {
  const { store, loop, signal } = ctx;

  const stage = createStage(root, { layers: ['plot'], aspect: 'wide', signal });
  const player = createPlayer({ store, loop, signal });
  let maxErr = 0, maxAmp = 0, scanned = 0;

  stage.onDraw(({ w, h, dpr }) => {
    const state = store.get();
    const g = stage.ctx('plot');
    g.clearRect(0, 0, w, h);

    // the budget bar across the top, carrying every cost number
    const barTop = 22 * dpr, barH = 18 * dpr, pad = 8 * dpr;
    const perStep = player.cost.perStep;
    const steps = stepsPerFrame(state.h);
    const cost = perStep * steps;
    drawBudgetBar(g, { x: pad, y: barTop, w: w - 2 * pad, h: barH, dpr },
      { cost, label: `physics per frame (${fmtSteps(steps)} × ${fmtMs(perStep)})` });

    // running maxima: the error to report, and the amplitude the y range is built from
    const s = player.series;
    for (; scanned < s.n; scanned++) {
      const e = s.err[scanned];
      if (e > maxErr || !Number.isFinite(e)) maxErr = e;
      const a = Math.abs(s.exact[scanned]);
      if (a > maxAmp) maxAmp = a;
    }

    // the run underneath, windowed to a few periods and ranged to its own amplitude
    const span = plotSpan(state, { cycles: CYCLES });
    const tMax = Math.max(span, player.t);
    const Y = Math.max(1.25 * maxAmp, 1e-3);
    const top = barTop + barH + 34 * dpr;
    g.save();
    g.translate(0, top);
    const view = drawTrajectory(g, { w, h: h - top, dpr }, s,
      { tMin: tMax - span, tMax, y: [-Y, Y], yLabel: 'x' });

    const cur = player.current;
    const off = !(cur.err <= Y);   // NaN and ∞ included: the run has left the frame
    // top-right, clear of the grid's y labels on the left
    drawText(g, view,
      `error |x − exact| = ${fmt(cur.err, 4)}    largest so far ${fmt(maxErr, 4)}${off ? '    (off the chart)' : ''}`,
      tMax, Y, { color: cssVar(off ? '--unstable' : '--fg'), size: 12, align: 'right', dx: -8, dy: 16 });
    g.restore();
  });
  player.onChange(() => {
    if (player.n <= 1) { maxErr = 0; maxAmp = 0; scanned = 0; }
    stage.invalidate();
  });

  root.append(controls(
    presets(store, { demo: 'Demo (m=1, c=0.1, k=100)', essay: 'Essay (m=10, c=0.1, k=10)' }),
    transport(player, { signal }),
  ));

  const article = root.closest('article');
  const unsub = store.subscribe(stage.invalidate, { immediate: false });
  bindMath(article, store, state => {
    const steps = stepsPerFrame(state.h);
    const perStep = stepCost(state).perStep;   // the same memoized benchmark the player reads
    return {
      steps, stepText: fmtSteps(steps),
      perStepText: fmtMs(perStep),
      frameCost: fmtMs(perStep * steps),
      frame: fmtMs(FRAME_MS),
    };
  }, { signal });
  const offScrub = bindScrub(article, store, { signal, limits: { h: [0.002, 0.25] } });
  return { destroy() { unsub(); offScrub(); } };
}
