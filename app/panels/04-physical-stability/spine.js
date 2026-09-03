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
import { bindMath } from 'shared/ui/livemath.js';
import { bindScrub } from 'shared/ui/scrub.js';

const SPAN = 6;         // seconds shown
const SAMPLES = 600;
const NEIGHBORS = 6;    // started at equal angles around the ε-circle
const C_RANGE = [-2, 50];   // this pane's own damping: below zero is the unstable what-if
const C_SCRUB = [-2, 10];   // the useful stretch of it, for the drag
const SLACK = 1.001;    // c = 0 rides the tube's edge by construction; don't call that an exit
const CAP = 3;          // y-range cap, in multiples of the readable early amplitude

/** This pane's own damping, in its own store so bindScrub() and subscribe() work unchanged. */
function localDamping(c0) {
  return createStore({ c: c0 }, {
    limits: { c: C_RANGE },
    validate: key => { throw new Error(`panel 4 spine: unknown local key: ${key}`); },
    presets: {},
  });
}

export function mount(root, ctx) {
  const { store, signal } = ctx;
  const article = root.closest('article') ?? root;

  // seeded from the reader's actual case; re-seeded only when the tuple's own c changes
  const local = localDamping(store.get().c);

  // one store-shaped view over this pane's two what-if numbers — local c and aux's epsilon —
  // so bindScrub can bind both from the article in a single pass, the way panels 2 and 5 bind
  // a facade over the scene. c never reaches C_RANGE's full stretch by drag; C_SCRUB narrows it
  // to the readable range the old slider used.
  const scrub = {
    get: () => ({ c: local.get().c, epsilon: aux.get().epsilon }),
    set(patch) {
      if (Number.isFinite(patch.c)) local.set({ c: patch.c });
      if (Number.isFinite(patch.epsilon)) aux.set({ epsilon: patch.epsilon });
      return scrub.get();
    },
    subscribe(fn, opts) {
      const relay = () => { const s = scrub.get(); fn(s, s); };
      const offLocal = local.subscribe(relay, opts);
      const offAux = aux.subscribe(relay, { immediate: false });
      return () => { offLocal(); offAux(); };
    },
    limits: { c: C_SCRUB, epsilon: aux.limits.epsilon },
  };

  const stage = createStage(root, { layers: ['plot'], aspect: 'wide', signal });

  const ts = new Float64Array(SAMPLES + 1);
  for (let i = 0; i <= SAMPLES; i++) ts[i] = SPAN * i / SAMPLES;
  const sample = sol => { const xs = new Float64Array(SAMPLES + 1); for (let i = 0; i <= SAMPLES; i++) xs[i] = sol.x(ts[i]); return xs; };

  // The neighbor sweep (exact[], the six perturbed curves, and the tube-escape stats) is the
  // same work the draw and the prose both need; memoized so bindMath's synchronous derive and
  // the next animation-frame draw agree, and a redraw or a re-render never repeats it twice.
  let measured = null, measureKey = '';
  function measure(sys, eps) {
    const key = `${sys.m}/${sys.c}/${sys.k}/${sys.x0}/${sys.v0}/${eps}`;
    if (key === measureKey) return measured;
    measureKey = key;
    const omega = naturalFrequency(sys.m, sys.k);
    const exact = sample(exactSolution(sys));

    // neighbors: (x₀ + ε cos φ, v₀ + ε ω sin φ); with k = 0 there is no ω, so perturb v by ε
    const series = [];
    let maxDist = 0, endDist = 0, far = 0, escapeAt = -1, escaped = 0;
    for (let j = 0; j < NEIGHBORS; j++) {
      const phi = 2 * Math.PI * j / NEIGHBORS;
      const dx = eps * Math.cos(phi), dv = eps * (omega > 0 ? omega : 1) * Math.sin(phi);
      const xs = sample(exactSolution({ ...sys, x0: sys.x0 + dx, v0: sys.v0 + dv }));
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
    measured = { exact, series, maxDist, endDist, far, escapeAt, escaped };
    return measured;
  }

  /** The system currently drawn: the tuple's m, k, x₀, v₀ with this pane's own c. */
  const sysNow = () => ({ ...store.get(), c: local.get().c });

  stage.onDraw(({ w, h, dpr }) => {
    const s = store.get();
    const c = local.get().c;                 // this pane's own damping, never the tuple's
    const sys = { ...s, c };                 // the system actually drawn
    const eps = aux.get().epsilon;
    const { exact, series, far, escapeAt } = measure(sys, eps);
    const lo = new Float64Array(SAMPLES + 1), hi = new Float64Array(SAMPLES + 1);
    for (let i = 0; i <= SAMPLES; i++) { lo[i] = exact[i] - eps; hi[i] = exact[i] + eps; }

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
  });

  const offScrub = bindScrub(article, scrub, { signal });

  // the verdict sentence in the prose: the sign of Re λ = −c / 2m, and nothing else. Bound
  // to all three stores (the tuple for m, this pane's own c, and aux's ε) so it stays live
  // whichever one moves; `measure` above is memoized, so this repeats no work the draw
  // hasn't already done for the same (m, c, k, x₀, v₀, ε).
  function verdictSlots() {
    const sys = sysNow(), eps = aux.get().epsilon;
    const { maxDist, endDist, escaped } = measure(sys, eps);
    const alpha = -sys.c / (2 * sys.m);
    const verdict = sys.c > 0 ? 'asymptotically stable'
      : sys.c < 0 ? 'unstable'
        : escaped === 0 ? 'stable' : 'unstable';
    const cls = verdict === 'unstable' ? 'unstable' : 'stable';
    return {
      alpha, maxDist, endDist,
      localc: sys.c,
      verdict: el('span', { class: cls }, verdict),
      tubeState: endDist > eps * SLACK ? 'outside' : 'inside',
    };
  }
  bindMath(article, store, verdictSlots, { signal });
  bindMath(article, local, verdictSlots, { signal });
  bindMath(article, aux, verdictSlots, { signal });

  // the tuple only re-seeds the local damping (m, k, x₀, v₀ still come from it directly)
  const unsub = store.subscribe((s, patch) => {
    if ('c' in patch) local.set({ c: s.c });
    stage.invalidate();
  }, { immediate: false });
  const unsubLocal = local.subscribe(stage.invalidate, { immediate: false });
  const unsubAux = aux.subscribe((s, patch) => { if ('epsilon' in patch) stage.invalidate(); }, { immediate: false });
  return { destroy() { unsub(); unsubLocal(); unsubAux(); offScrub(); } };
}
