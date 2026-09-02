// Panel 3, spine: the blue exact curve and the red segmented approximation over a whole
// trajectory (t = *). Scrub dt and the polyline hugs or leaves the curve; touch the curve
// to step back down to one instant, with that sample's (t, x) read out.

import { el, fmt } from 'shared/dom.js';
import { createStage } from 'shared/gfx/stage.js';
import { drawTrajectory, nearestSample } from 'shared/gfx/trajectory.js';
import { cssVar, drawPoint, drawPolyline } from 'shared/gfx/plot2d.js';
import { simulate } from 'shared/math/integrators.js';
import { sweepKey } from 'shared/math/sweep.js';
import { slider, readout, controls } from 'shared/ui/controls.js';
import { bindMath } from 'shared/ui/livemath.js';

const SPAN = 6;         // seconds of trajectory shown
const HIT_PX = 24;      // css px within which a touch picks a sample

export function mount(root, ctx) {
  const { store, signal } = ctx;

  const stage = createStage(root, { layers: ['plot'], aspect: 'wide', signal, grab: true });
  const out = readout({ label: 'one instant' });
  let run = null, runKey = null;   // the memoized whole trajectory
  let view = null, picked = -1;    // the touched sample

  function trajectory(state) {
    const key = sweepKey({ method: state.method, h: state.h, m: state.m, c: state.c, k: state.k, x0: state.x0, v0: state.v0 });
    if (key !== runKey) { runKey = key; run = simulate(state, SPAN); picked = -1; }
    return run;
  }

  stage.onDraw(size => {
    const state = store.get();
    const s = trajectory(state);
    let amp = 0;
    for (let i = 0; i < s.n; i++) amp = Math.max(amp, Math.abs(s.exact[i]));
    const cap = Math.max(3 * amp, 1);
    const g = stage.ctx('plot');
    view = drawTrajectory(g, size, s, { tMin: 0, tMax: SPAN, cap, markers: true, maxMarkers: 2000, h: state.h });

    if (picked >= 0 && picked < s.n) {
      const t = s.t[picked], x = s.x[picked], ex = s.exact[picked];
      drawPolyline(g, view, [t, t], [view.yMin, view.yMax], { color: cssVar('--axis'), width: 1, dash: [3, 3], alpha: 0.6 });
      drawPoint(g, view, t, ex, { r: 5, fill: cssVar('--exact') });
      if (Number.isFinite(x) && Math.abs(x) < 1e6) drawPoint(g, view, t, x, { r: 5, fill: cssVar('--approx') });
      out.set([
        `t = ${fmt(t, 3)} s   step ${picked} of ${s.n - 1}\n`,
        el('span', { class: 'swatch approx' }), `x ≈ ${fmt(x, 4)}   `,
        el('span', { class: 'swatch exact' }), `x = ${fmt(ex, 4)}`,
        `   |error| = ${fmt(Math.abs(x - ex), 4)}`,
      ]);
    } else {
      let err = 0;
      for (let i = 0; i < s.n; i++) { const e = Math.abs(s.x[i] - s.exact[i]); if (Number.isFinite(e)) err = Math.max(err, e); else err = Infinity; }
      out.set(`${s.n - 1} steps of dt = ${fmt(state.h, 3)} s over ${SPAN} s   max |error| = ${fmt(err, 4)}\ntouch the curve to pick one instant`);
    }
  });

  // ---- touch the curve: step down to one instant ----
  const canvas = stage.canvas('plot');
  let dragging = null;
  const pick = e => {
    if (!view || !run) return;
    const r = canvas.getBoundingClientRect();
    const px = (e.clientX - r.left) * view.dpr, py = (e.clientY - r.top) * view.dpr;
    // a touch on either curve picks that sample; anywhere else picks the step nearest in time
    const onApprox = nearestSample(view, run.t, run.x, px, py, run.n);
    const onExact = nearestSample(view, run.t, run.exact, px, py, run.n);
    const hit = [onApprox, onExact].filter(Boolean).sort((a, b) => a.dist - b.dist)[0];
    const i = hit && hit.dist <= HIT_PX * view.dpr
      ? hit.i
      : Math.min(run.n - 1, Math.max(0, Math.round(view.x(px) / store.get().h)));
    if (i !== picked) { picked = i; stage.invalidate(); }
  };
  canvas.addEventListener('pointerdown', e => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    dragging = e.pointerId;
    canvas.setPointerCapture(e.pointerId);
    stage.grabbing(true);
    pick(e);
    e.preventDefault();
  }, { signal });
  canvas.addEventListener('pointermove', e => { if (dragging === e.pointerId) pick(e); }, { signal });
  const end = e => { if (dragging === e.pointerId) { dragging = null; stage.grabbing(false); } };
  canvas.addEventListener('pointerup', end, { signal });
  canvas.addEventListener('pointercancel', end, { signal });

  root.append(controls(
    slider(store, 'h', { label: 'dt (step)', min: 0.005, max: 0.25, format: v => `${v.toFixed(3)} s`, signal }),
  ));
  root.append(out.el);

  const unsub = store.subscribe(stage.invalidate, { immediate: false });
  bindMath(root.closest('article'), store, () => ({}), { signal });
  return { destroy() { unsub(); } };
}
