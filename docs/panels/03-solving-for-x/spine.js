// Panel 3, spine: the blue exact curve and the red segmented approximation over a whole
// trajectory (t = *), with the gap between them plotted underneath on the same time axis,
// one point per integrator step, on a log scale so the growth is a slope and not a cliff.
// Scrub dt and the polyline hugs or leaves the curve; hover (or touch) either graph and the
// nearest step lights up on both, with its error called out on the strip.

import { fmt } from 'shared/dom.js';
import { createStage } from 'shared/gfx/stage.js';
import { drawTrajectory, nearestSample } from 'shared/gfx/trajectory.js';
import { cssVar, drawPoint, drawPolyline, drawText } from 'shared/gfx/plot2d.js';
import { simulate } from 'shared/math/integrators.js';
import { sweepKey } from 'shared/math/sweep.js';
import { bindMath } from 'shared/ui/livemath.js';
import { bindScrub } from 'shared/ui/scrub.js';

const SPAN = 4;          // seconds of trajectory shown
const HIT_PX = 24;       // css px within which a pointer picks a sample
const TITLE = 15;        // graph titles: bigger than drawGrid's own 11px axis labels
const CALLOUT = 13;      // the hovered step's numbers, top right of each graph
const DECADES = 9;       // most decades the error axis will ever open up to

/** An error value at four significant figures, with a unicode minus in the exponent. */
const sig = (v, p = 4) => (Number.isFinite(v) ? String(+v.toPrecision(p)).replace(/-/g, '−') : v > 0 ? '∞' : 'NaN');

/** The log window for the error strip: anchored on the peak, floored so a near-zero dip
 *  between two oscillations cannot stretch the axis over sixteen decades. */
function errRange(s) {
  if (!(s.peak > 0)) return [1e-6, 1];
  const floor = Number.isFinite(s.floor) ? s.floor : s.peak;
  return [Math.max(floor, s.peak * 10 ** -DECADES) * 0.5, s.peak * 3];
}

export function mount(root, ctx) {
  const { store, signal } = ctx;

  // two strips, not wide + strip: at 1920×1080 a 16/9 top plot plus a strip runs ~11rem past
  // the fold, and .pane-body clips rather than scrolls. Same pairing as panel 9's spine.
  const stage = createStage(root, { layers: ['plot'], aspect: 'strip', signal, grab: true });
  const errStage = createStage(root, { layers: ['plot'], aspect: 'strip', signal, grab: true });
  let run = null, runKey = null;          // the memoized whole trajectory, plus its error
  let view = null, errView = null;        // the two plots share tMin = 0, tMax = SPAN
  let picked = -1;                        // the hovered / touched sample

  function trajectory(state) {
    const key = sweepKey({ method: state.method, h: state.h, m: state.m, c: state.c, k: state.k, x0: state.x0, v0: state.v0 });
    if (key === runKey) return run;
    runKey = key;
    const s = simulate(state, SPAN);
    const err = new Float64Array(s.n);
    let peak = 0, floor = Infinity;
    for (let i = 0; i < s.n; i++) {
      const e = Math.abs(s.x[i] - s.exact[i]);
      err[i] = e;
      if (!Number.isFinite(e)) continue;
      if (e > peak) peak = e;
      if (e > 0 && e < floor) floor = e;
    }
    run = { ...s, err, peak, floor };
    picked = -1;
    return run;
  }

  // ---- top: the exact curve and the integrator's polyline ----
  stage.onDraw(size => {
    const state = store.get();
    const s = trajectory(state);
    let amp = 0;
    for (let i = 0; i < s.n; i++) amp = Math.max(amp, Math.abs(s.exact[i]));
    const cap = Math.max(3 * amp, 1);
    const g = stage.ctx('plot');
    view = drawTrajectory(g, size, s, { tMin: 0, tMax: SPAN, cap, markers: true, maxMarkers: 2000, h: state.h, yLabel: null });
    drawText(g, view, 'x(t): exact vs approximation', view.xMin, view.yMax, { color: cssVar('--fg'), size: TITLE, align: 'left', dx: 34, dy: 19 });

    if (picked >= 0 && picked < s.n) {
      const t = s.t[picked], x = s.x[picked], ex = s.exact[picked];
      drawPolyline(g, view, [t, t], [view.yMin, view.yMax], { color: cssVar('--axis'), width: 1, dash: [3, 3], alpha: 0.6 });
      drawPoint(g, view, t, ex, { r: 5, fill: cssVar('--exact') });
      if (Number.isFinite(x) && Math.abs(x) < 1e6) drawPoint(g, view, t, x, { r: 5, fill: cssVar('--approx') });
      drawText(g, view, `t = ${fmt(t, 3)} s`, view.xMax, view.yMax, { color: cssVar('--fg'), size: CALLOUT, align: 'right', dx: -8, dy: 19 });
    }
  });

  // ---- underneath: the same steps, the gap to the exact curve, log scale ----
  errStage.onDraw(size => {
    const s = trajectory(store.get());
    const g = errStage.ctx('plot');
    const [lo, hi] = errRange(s);
    errView = drawTrajectory(g, size, { t: s.t, x: s.err, n: s.n }, {
      tMin: 0, tMax: SPAN, y: [lo, hi], yLog: true, markers: true, maxMarkers: 2000, yLabel: null,
    });
    drawText(g, errView, '|error| per step  (log)', errView.xMin, errView.yMax, { color: cssVar('--fg'), size: TITLE, align: 'left', dx: 34, dy: 19 });

    if (picked >= 0 && picked < s.n) {
      const t = s.t[picked], e = s.err[picked];
      drawPolyline(g, errView, [t, t], [lo, hi], { color: cssVar('--axis'), width: 1, dash: [3, 3], alpha: 0.6 });
      if (Number.isFinite(e) && e > 0) drawPoint(g, errView, t, e, { r: 5, fill: cssVar('--approx') });
      drawText(g, errView, `step ${picked} of ${s.n - 1}:   |error| = ${sig(e)}`, errView.xMax, errView.yMax,
        { color: cssVar('--approx'), size: CALLOUT, align: 'right', dx: -8, dy: 19 });
    } else {
      drawText(g, errView, `max |error| = ${sig(s.peak)}`, errView.xMax, errView.yMax,
        { color: cssVar('--muted'), size: CALLOUT, align: 'right', dx: -8, dy: 19 });
    }
  });

  const redraw = () => { stage.invalidate(); errStage.invalidate(); };
  const setPicked = i => { if (i !== picked) { picked = i; redraw(); } };

  // ---- hover (or touch) either graph: the nearest step lights up on both ----
  function bindPick(st, getView, getSeries) {
    const canvas = st.canvas('plot');
    let dragging = null;
    const at = e => {
      const v = getView();
      if (!v || !run) return;
      const r = canvas.getBoundingClientRect();
      const px = (e.clientX - r.left) * v.dpr, py = (e.clientY - r.top) * v.dpr;
      const h = run.n > 1 ? run.t[1] - run.t[0] : store.get().h;
      const centre = Math.round(v.x(px) / h);
      // only samples within HIT_PX horizontally can be within HIT_PX at all, so at 8000
      // steps the hover scans a few hundred samples instead of all of them
      const reach = Math.ceil(HIT_PX * v.dpr / (v.sx * h)) + 1;
      const i0 = Math.max(0, centre - reach), i1 = Math.min(run.n, centre + reach + 1);
      // a pointer on a curve picks that sample; anywhere else picks the step nearest in time
      const hit = i1 > i0 && getSeries()
        .map(ys => nearestSample(v, run.t.subarray(i0, i1), ys.subarray(i0, i1), px, py))
        .filter(Boolean)
        .sort((a, b) => a.dist - b.dist)[0];
      setPicked(hit && hit.dist <= HIT_PX * v.dpr
        ? i0 + hit.i
        : Math.min(run.n - 1, Math.max(0, centre)));
    };
    canvas.addEventListener('pointerdown', e => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      dragging = e.pointerId;
      canvas.setPointerCapture(e.pointerId);
      st.grabbing(true);
      at(e);
      e.preventDefault();
    }, { signal });
    canvas.addEventListener('pointermove', e => { if (dragging === e.pointerId || e.pointerType === 'mouse') at(e); }, { signal });
    const end = e => { if (dragging === e.pointerId) { dragging = null; st.grabbing(false); } };
    canvas.addEventListener('pointerup', end, { signal });
    canvas.addEventListener('pointercancel', end, { signal });
    // a mouse leaving drops the highlight; a touch pointer also "leaves" on lift, and that
    // tap's selection should survive
    canvas.addEventListener('pointerleave', e => { if (dragging === null && e.pointerType === 'mouse') setPicked(-1); }, { signal });
  }
  bindPick(stage, () => view, () => [run.x, run.exact]);
  bindPick(errStage, () => errView, () => [run.err]);

  const article = root.closest('article');
  const unsub = store.subscribe(redraw, { immediate: false });
  bindMath(article, store, state => {
    const s = trajectory(state);
    return { steps: s.n - 1, maxerr: sig(s.peak) };
  }, { signal });
  const offScrub = bindScrub(article, store, { signal, limits: { h: [0.001, 0.033] } });
  return { destroy() { unsub(); offScrub(); } };
}
