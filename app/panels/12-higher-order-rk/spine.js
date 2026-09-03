// Panel 12, spine: method = *. Switch integrator and the region redraws; three small
// multiples of Euler, RK4, and implicit Euler pinned to the same λ; the live spring against
// the exact curve. The teaching contrast is implicit Euler: never explodes, visibly
// over-damped (0.26 vs 0.71 at t = 60 with the essay preset).
//
// No transport: createPlayer's own autoplay (its default) is the only playback, with nothing
// to pause it, and no preset buttons — m and k are draggable right in the prose's own
// equation instead, the same data-scrub-into-the-tuple pattern panel 8 uses for h.

import { el, fmt } from 'shared/dom.js';
import { createStage } from 'shared/gfx/stage.js';
import { createComplexPlane } from 'shared/gfx/cplane.js';
import { drawRegion } from 'shared/gfx/region-gl.js';
import { drawTrajectory } from 'shared/gfx/trajectory.js';
import { cssVar, makeView, drawGrid, drawPoint, drawText } from 'shared/gfx/plot2d.js';
import { createPlayer } from 'shared/player.js';
import { methodPicker } from 'shared/ui/controls.js';
import { bindScrub } from 'shared/ui/scrub.js';
import { eigenvalues } from 'shared/math/system.js';
import { METHODS } from 'shared/math/integrators.js';
import { stabilityReport } from 'shared/math/stability.js';

const SPAN = 6;                                   // seconds of run visible
const MULTIPLES = ['euler', 'rk4', 'implicit'];   // pinned small multiples, left to right
const halfRange = s => Math.max(3, 1.3 * Math.max(...eigenvalues(s.m, s.c, s.k).flat().map(Math.abs)));

export function mount(root, ctx) {
  const { store, signal, loop } = ctx;

  // ---- row 1: the plane for the store's method, beside the run ----
  const top = el('div', { class: 'viz-row' });
  root.append(top);
  const planeStage = createStage(top, { layers: ['region', 'plane'], aspect: 'half', signal });
  const plane = createComplexPlane({ stage: planeStage, store, signal, halfRange, region: true });

  const column = el('div', { class: 'controls' });
  top.append(column);
  const runStage = createStage(column, { layers: ['plot'], aspect: 'wide', signal });
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

  // ---- row 2: small multiples, one shared GL canvas blitted into three stages ----
  const strip = el('div', { class: 'controls-row' });
  root.append(strip);
  const multiples = MULTIPLES.map(method => {
    const stage = createStage(strip, { layers: ['region', 'plane'], aspect: 'square', signal });
    stage.onDraw(({ w, h, dpr }) => {
      const s = store.get();
      const view = makeView({ w, h, dpr, halfW: halfRange(s) });
      const gr = stage.ctx('region');
      gr.clearRect(0, 0, w, h);
      drawRegion(gr, { method, h: s.h, view });
      const g = stage.ctx('plane');
      g.clearRect(0, 0, w, h);
      drawGrid(g, view, { labels: false });
      const report = stabilityReport(method, s);
      report.lambdas.forEach((l, i) => {
        drawPoint(g, view, l[0], l[1], { r: 4.5, fill: cssVar(report.factors[i] <= 1 ? '--stable' : '--unstable') });
      });
      const current = s.method === method;
      drawText(g, view, `${METHODS[method].label}${current ? ' ◂' : ''}`, view.xMin, view.yMax,
        { color: current ? cssVar('--fg') : cssVar('--muted'), size: 11, dx: 6, dy: 14 });
      drawText(g, view, `|R| = ${fmt(report.factors[0], 3)}`, view.xMin, view.yMin,
        { color: cssVar(report.stable ? '--stable' : '--unstable'), size: 11, dx: 6, dy: -6 });
    });
    return stage;
  });

  // ---- row 3: just the picker; the run plays on its own and never stops ----
  root.append(el('div', { class: 'controls-row' }, methodPicker(store, { only: MULTIPLES, signal })));

  const article = root.closest('article') ?? root;
  const offScrub = bindScrub(article, store, { signal });
  const unsubscribe = store.subscribe(() => multiples.forEach(m => m.invalidate()), { immediate: false });
  return { destroy() { unsubscribe(); offScrub(); } };
}
