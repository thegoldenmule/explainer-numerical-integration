// Panel 3, left: one instant of the spine's trajectory (t concrete). x and v as two stacked
// plots of the exact solution, with the tangent at a scrubbed t: the slope of x is v, the
// slope of v is a. The scrub is local to this pane; the store's t belongs to the players.

import { fmt, clamp } from 'shared/dom.js';
import { createStage } from 'shared/gfx/stage.js';
import { drawTrajectory } from 'shared/gfx/trajectory.js';
import { cssVar, drawPoint, drawPolyline, drawText, makeView } from 'shared/gfx/plot2d.js';
import { exactSolution, acceleration } from 'shared/math/system.js';
import { bindScrub } from 'shared/ui/scrub.js';
import { bindMath } from 'shared/ui/livemath.js';

const SPAN = 4;        // seconds shown
const SAMPLES = 800;   // of the exact curve
const TANGENT = 0.2;   // half-length of the tangent segment, in seconds
const BAR_H = 34;      // the a-bar: a band along the bottom of the v(t) stage, in CSS px

export function mount(root, ctx) {
  const { store, signal } = ctx;
  let tScrub = 0.6;

  // x(t) over v(t), two fill stages sharing the column's height; the a-bar is a layer of the
  // v stage, a band under its plot, so a (the slope of v) reads right under the curve it is
  // the slope of
  const xStage = createStage(root, { layers: ['plot'], signal });
  const vStage = createStage(root, { layers: ['plot', 'bar'], signal });

  let curve = null, curveKey = '';
  function curves(state) {
    const key = `${state.m}/${state.c}/${state.k}/${state.x0}/${state.v0}`;
    if (key === curveKey) return curve;
    const sol = exactSolution(state);
    const acc = acceleration(state.m, state.c, state.k);
    const t = new Float64Array(SAMPLES + 1), x = new Float64Array(SAMPLES + 1), v = new Float64Array(SAMPLES + 1);
    let capA = 1e-6;
    for (let i = 0; i <= SAMPLES; i++) {
      t[i] = SPAN * i / SAMPLES; x[i] = sol.x(t[i]); v[i] = sol.v(t[i]);
      capA = Math.max(capA, Math.abs(acc(x[i], v[i])));
    }
    curveKey = key;
    curve = { t, x, v, sol, acc, capA: capA * 1.1 };
    return curve;
  }

  // A plot's title: bigger and darker than drawTrajectory's own small --tick y-label (which
  // is suppressed here, yLabel: null, so the two never overlap), offset clear of the y-tick
  // numbers stacked at the plot's left edge. The value at the scrubbed instant is called out
  // in the opposite corner, in place of the old readout box.
  function plot(stage, size, ys, title, label, value, slope) {
    const g = stage.ctx('plot');
    g.clearRect(0, 0, size.w, stage.size.h);
    const blue = cssVar('--exact');
    const view = drawTrajectory(g, size, { t: curve.t, x: ys }, { tMin: 0, tMax: SPAN, approx: blue, yLabel: null, width: 1.5 });
    drawPolyline(g, view, [tScrub, tScrub], [view.yMin, view.yMax], { color: cssVar('--axis'), width: 1, dash: [3, 3], alpha: 0.5 });
    drawPolyline(g, view, [tScrub - TANGENT, tScrub + TANGENT], [value - TANGENT * slope, value + TANGENT * slope], { color: cssVar('--approx'), width: 2.5 });
    drawPoint(g, view, tScrub, value, { r: 5, fill: cssVar('--approx') });
    drawText(g, view, title, view.xMin, view.yMax, { color: cssVar('--fg'), size: 15, align: 'left', dx: 34, dy: 19 });
    drawText(g, view, `${label} = ${fmt(value, 3)}`, view.xMax, view.yMax, { color: cssVar('--approx'), size: 13, align: 'right', dx: -8, dy: 19 });
  }

  // The a-bar, in the band of `BAR_H` CSS px along the bottom of the v stage: a signed bar from
  // zero, its value at the right, `a` at the left.
  function drawBar(size, a, capA) {
    const { w, h, dpr } = size;
    const g = vStage.ctx('bar');
    g.clearRect(0, 0, w, h);
    const top = h - BAR_H * dpr;
    const pad = 8 * dpr;
    const view = makeView({ w: w - 2 * pad, h: BAR_H * dpr, dpr, xMin: -capA, xMax: capA, yMin: 0, yMax: 1 });
    const av = clamp(a, -capA, capA);
    const x0 = pad + view.X(0), x1 = pad + view.X(av);
    const trackTop = top + 16 * dpr, trackH = (BAR_H - 16 - 4) * dpr;
    g.strokeStyle = cssVar('--border');
    g.lineWidth = dpr;
    g.beginPath(); g.moveTo(0, top + 0.5 * dpr); g.lineTo(w, top + 0.5 * dpr); g.stroke();
    g.fillStyle = cssVar('--approx');
    g.fillRect(Math.min(x0, x1), trackTop, Math.max(1.5 * dpr, Math.abs(x1 - x0)), trackH);
    g.strokeStyle = cssVar('--axis');
    g.beginPath(); g.moveTo(x0, trackTop - 2 * dpr); g.lineTo(x0, trackTop + trackH + 2 * dpr); g.stroke();
    g.font = `600 ${12 * dpr}px ${cssVar('--font') || 'system-ui'}`;
    g.fillStyle = cssVar('--fg');
    g.textAlign = 'left'; g.fillText('a', pad, top + 12 * dpr);
    g.textAlign = 'right'; g.fillText(fmt(a, 2), w - pad, top + 12 * dpr);
    g.font = `${10 * dpr}px ${cssVar('--font') || 'system-ui'}`;
    g.fillStyle = cssVar('--tick');
    g.textAlign = 'center'; g.fillText('0', clamp(x0, pad + 10 * dpr, w - pad - 10 * dpr), trackTop - 5 * dpr);
  }

  xStage.onDraw(size => {
    const state = store.get();
    const c = curves(state);
    const x = c.sol.x(tScrub), v = c.sol.v(tScrub);
    plot(xStage, size, c.x, 'x(t)', 'x', x, v);
  });
  vStage.onDraw(size => {
    const state = store.get();
    const c = curves(state);
    const x = c.sol.x(tScrub), v = c.sol.v(tScrub);
    const a = c.acc(x, v);
    // the plot takes the stage above the a-bar's band
    plot(vStage, { ...size, h: Math.max(1, size.h - BAR_H * size.dpr) }, c.v, 'v(t)', 'v', v, a);
    drawBar(size, a, c.capA);
  });

  const invalidate = () => { xStage.invalidate(); vStage.invalidate(); };

  // The instant itself is the control: t is dragged where it is written, in the prose.
  // Local to the pane — the store's t belongs to the players.
  const tSubs = new Set();
  const tStore = {
    get: () => ({ t: tScrub }),
    set(patch) {
      if (!Number.isFinite(patch.t)) return { t: tScrub };
      const next = clamp(patch.t, 0, SPAN);
      if (next !== tScrub) { tScrub = next; for (const fn of tSubs) fn({ t: tScrub }, { t: tScrub }); invalidate(); }
      return { t: tScrub };
    },
    subscribe(fn, { immediate = true } = {}) {
      tSubs.add(fn);
      if (immediate) fn({ t: tScrub }, { t: tScrub });
      return () => tSubs.delete(fn);
    },
    limits: { t: [0, SPAN] },
  };
  const article = root.closest('article') ?? root;
  bindScrub(article, tStore, { signal });
  bindMath(article, tStore, () => ({}), { signal });

  const unsub = store.subscribe(invalidate, { immediate: false });
  return { destroy() { unsub(); } };
}
