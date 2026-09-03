// Panel 4, spine: the exact solution with an ε-tube around it and a handful of neighbors
// started nearby, all closed-form (no integrator exists yet). The neighbors start on a
// circle of radius ε in (x₀, v₀/ω), so each is exactly ε away at t = 0 and the tube is a
// fair test. The perturbation size is aux.epsilon, so it survives a remount.
//
// The panel's whole point is that a system can fail this test, and physical stability here
// is decided by Re λ = −c / 2m. The tuple clamps c ≥ 0 (LIMITS.c = [0, 50]) because a real
// spring's damping is never negative, so every case the reader could select used to be
// stable and the picture could never show its own opposite. Damping is therefore local to
// this pane — the same trick panel 6's spine plays with its overdamped c — in a small store
// whose limits run negative. It is seeded from the tuple's c and re-seeded whenever the
// tuple's c changes elsewhere, and it is never written back: a "what if" case is computed
// locally, so visiting this panel leaves the tuple exactly as it was found.

import { el, fmt } from 'shared/dom.js';
import { createStage } from 'shared/gfx/stage.js';
import { drawBundle } from 'shared/gfx/bundle.js';
import { cssVar, makeView, drawGrid, drawPolyline, drawBand, drawText } from 'shared/gfx/plot2d.js';
import { exactSolution, naturalFrequency } from 'shared/math/system.js';
import { createStore } from 'shared/state.js';
import { aux } from 'shared/aux.js';
import { slider, readout, controls, row } from 'shared/ui/controls.js';

const SPAN = 6;         // seconds shown
const SAMPLES = 600;
const NEIGHBORS = 6;    // started at equal angles around the ε-circle
const C_RANGE = [-2, 50];   // this pane's own damping: below zero is the unstable what-if
const C_SLIDER = [-2, 10];  // the useful stretch of it, on a linear slider
const C_STEP = 0.05;    // puts c = 0 on the grid: the borderline verdict must be landable
const SLACK = 1.001;    // c = 0 rides the tube's edge by construction; don't call that an exit
const CAP = 3;          // y-range cap, in multiples of the readable early amplitude

/** This pane's own damping, in its own store so slider() and subscribe() work unchanged. */
function localDamping(c0) {
  return createStore({ c: c0 }, {
    limits: { c: C_RANGE },
    validate: key => { throw new Error(`panel 4 spine: unknown local key: ${key}`); },
    presets: {},
  });
}

export function mount(root, ctx) {
  const { store, signal } = ctx;

  // seeded from the reader's actual case; re-seeded only when the tuple's own c changes
  const local = localDamping(store.get().c);

  const stage = createStage(root, { layers: ['plot'], aspect: 'wide', signal });
  const out = readout({ label: 'verdict' });

  const ts = new Float64Array(SAMPLES + 1);
  for (let i = 0; i <= SAMPLES; i++) ts[i] = SPAN * i / SAMPLES;
  const sample = sol => { const xs = new Float64Array(SAMPLES + 1); for (let i = 0; i <= SAMPLES; i++) xs[i] = sol.x(ts[i]); return xs; };

  stage.onDraw(({ w, h, dpr }) => {
    const s = store.get();
    const c = local.get().c;                 // this pane's own damping, never the tuple's
    const sys = { ...s, c };                 // the system actually drawn
    const eps = aux.get().epsilon;
    const omega = naturalFrequency(s.m, s.k);
    const exact = sample(exactSolution(sys));
    const lo = new Float64Array(SAMPLES + 1), hi = new Float64Array(SAMPLES + 1);
    for (let i = 0; i <= SAMPLES; i++) { lo[i] = exact[i] - eps; hi[i] = exact[i] + eps; }

    // neighbors: (x₀ + ε cos φ, v₀ + ε ω sin φ); with k = 0 there is no ω, so perturb v by ε
    const series = [];
    let maxDist = 0, endDist = 0, far = 0, escapeAt = -1, escaped = 0;
    for (let j = 0; j < NEIGHBORS; j++) {
      const phi = 2 * Math.PI * j / NEIGHBORS;
      const dx = eps * Math.cos(phi), dv = eps * (omega > 0 ? omega : 1) * Math.sin(phi);
      const xs = sample(exactSolution({ ...sys, x0: s.x0 + dx, v0: s.v0 + dv }));
      let left = false;
      for (let i = 0; i <= SAMPLES; i++) {
        const d = Math.abs(xs[i] - exact[i]);
        if (d > maxDist) maxDist = d;
        if (i === SAMPLES && d > endDist) endDist = d;
        if (Math.abs(xs[i]) > far) far = Math.abs(xs[i]);
        if (d > eps * SLACK) {
          left = true;
          if (escapeAt < 0 || ts[i] < escapeAt) escapeAt = ts[i];
        }
      }
      if (left) escaped++;
      series.push({ xs: ts, ys: xs });
    }

    const g = stage.ctx('plot');
    // ampQ, the amplitude over the first quarter of the window, is the scale the reader can
    // actually read; amp is the whole window, which an unstable case blows up by e^{|c|T/2m}.
    // The view fits what it can and caps at CAP · ampQ, so a runaway leaves the top of the
    // frame instead of squashing the ε-tube to nothing — which is what leaving looks like.
    let amp = 0, ampQ = 0;
    for (let i = 0; i <= SAMPLES; i++) {
      const a = Math.abs(exact[i]);
      if (a > amp) amp = a;
      if (i <= SAMPLES / 4 && a > ampQ) ampQ = a;
    }
    const base = Math.max(ampQ + eps, 0.5);
    const yMax = 1.2 * Math.min(Math.max(amp + eps, far), CAP * base);
    const view = makeView({ w, h, dpr, xMin: 0, xMax: SPAN, yMin: -yMax, yMax });
    g.clearRect(0, 0, w, h);
    drawGrid(g, view, { xLabel: 't', yLabel: 'x' });
    drawBand(g, view, ts, lo, hi, { fill: cssVar('--exact'), alpha: 0.16 });
    drawBundle(g, view, series, {
      highlight: -1,
      color: c < 0 ? cssVar('--unstable') : cssVar('--approx'),
      dimAlpha: 0.7, dimWidth: 1.25,
    });
    drawPolyline(g, view, ts, exact, { color: cssVar('--exact'), width: 2 });
    if (escapeAt >= 0) {
      const late = escapeAt > 0.62 * SPAN;
      drawPolyline(g, view, [escapeAt, escapeAt], [-yMax, yMax], { color: cssVar('--unstable'), width: 1.25, dash: [5, 4], alpha: 0.9 });
      drawText(g, view, `leaves the tube at t = ${fmt(escapeAt, 2)} s`, escapeAt, yMax, {
        color: cssVar('--unstable'), size: 11, align: late ? 'right' : 'left', dx: late ? -6 : 6, dy: 16,
      });
    }
    // anchored at t = 0: a runaway takes the tube off the top of the frame long before t = SPAN
    drawText(g, view, 'ε-tube around the exact solution', 0, exact[0] - eps, { color: cssVar('--exact'), size: 11, dx: 8, dy: 16 });

    // the verdict is the sign of Re λ = −c / 2m, and nothing else
    const alpha = -c / (2 * s.m);
    const verdict = c > 0
      ? [el('span', { class: 'stable' }, 'asymptotically stable'), ': every neighbor falls into the tube and keeps converging']
      : c < 0
        ? [el('span', { class: 'unstable' }, 'unstable'), escaped > 0
            ? `: ${escaped} of ${NEIGHBORS} neighbors have left the tube, however close they started`
            : `: Re λ > 0, so every neighbor leaves eventually — none has yet in the ${SPAN} s shown; push c further down`]
        : escaped === 0
          ? [el('span', { class: 'stable' }, 'stable'), ', but not asymptotically: with c = 0 nothing decays, so the neighbors ride the tube’s edge forever']
          : [el('span', { class: 'unstable' }, 'unstable'), `: Re λ = 0, but with k = ${fmt(s.k, 2)} there is no restoring force either, so a nudge in v drifts away forever`];
    out.set([
      ...verdict, '\n',
      `Re λ = −c / 2m = ${fmt(alpha, 3)}   ε = ${fmt(eps, 3)}   farthest any neighbor strays: ${fmt(maxDist, 4)}   at t = ${SPAN} s: ${fmt(endDist, 4)} (${endDist > eps * SLACK ? 'outside' : 'inside'} the tube, ${fmt(endDist / eps, 2)}× ε)\n`,
      el('span', { class: 'label' }, `the damping above is this pane’s own: a real spring’s c is never negative, so the tuple stops at 0 and the unstable case would be unreachable. The spring’s actual c = ${fmt(s.c, 2)} is untouched.`),
    ]);
  });

  root.append(controls(row(
    slider(aux, 'epsilon', { label: 'ε (perturbation size)', log: true, format: v => fmt(v, 3), signal }),
    slider(local, 'c', { label: 'this pane’s own c (damping): drag it below 0', min: C_SLIDER[0], max: C_SLIDER[1], step: C_STEP, format: v => fmt(v, 2), signal }),
  )));
  root.append(out.el);

  // the tuple only re-seeds the local damping (m, k, x₀, v₀ still come from it directly)
  const unsub = store.subscribe((s, patch) => {
    if ('c' in patch) local.set({ c: s.c });
    stage.invalidate();
  }, { immediate: false });
  const unsubLocal = local.subscribe(stage.invalidate, { immediate: false });
  const unsubAux = aux.subscribe((s, patch) => { if ('epsilon' in patch) stage.invalidate(); }, { immediate: false });
  return { destroy() { unsub(); unsubLocal(); unsubAux(); } };
}
