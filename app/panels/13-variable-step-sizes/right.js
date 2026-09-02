// Panel 13, right: the adaptive control loop in detail, then the target error exploded. A
// sweep of target errors centered on the reader's aux.tol produces a small bundle of h(t)
// profiles; the sweep strip highlights one (aux.highlight, clamped to this sweep on read;
// −1 means the reader's own target in the middle), with its accept/reject counts, the
// estimate-vs-target strip, and the controller's last decision read out.

import { el, fmt } from 'shared/dom.js';
import { createStage } from 'shared/gfx/stage.js';
import { drawBundle } from 'shared/gfx/bundle.js';
import { drawTrajectory } from 'shared/gfx/trajectory.js';
import { cssVar, makeView, drawGrid, drawPolyline, drawText } from 'shared/gfx/plot2d.js';
import { runAdaptive, CONTROLLER_DEFAULTS } from 'shared/math/adaptive.js';
import { METHODS } from 'shared/math/integrators.js';
import { sweep, sweepRange, sweepKey } from 'shared/math/sweep.js';
import { aux, AUX_LIMITS } from 'shared/aux.js';
import { readout, controls } from 'shared/ui/controls.js';
import { sweepStrip } from 'shared/ui/sweep.js';

const T_END = 120;
const H_MAX = 16;
const COUNT = 7;      // targets in the bundle; the middle one is the reader's aux.tol
const SPREAD = 10;    // tol/SPREAD … tol·SPREAD
const CENTER = (COUNT - 1) / 2;

/**
 * The sweep's targets: a log range around the reader's tol, the spread shrunk symmetrically
 * where the aux limits would clip it so the middle value is always tol itself.
 */
function targets(tol) {
  const [lo, hi] = AUX_LIMITS.tol;
  const s = Math.max(1, Math.min(SPREAD, hi / tol, tol / lo));
  return sweepRange(tol / s, tol * s, COUNT, { log: true });
}
/** aux.highlight is shared by every sweep: clamp to this one, and −1 means the reader's own target. */
const highlightIndex = () => { const i = aux.get().highlight; return i < 0 ? CENTER : Math.min(COUNT - 1, i); };

export function mount(root, ctx) {
  const { store, signal } = ctx;

  // one wide stage: the highlighted run's estimates against its target on top, the h(t) bundle below
  const stage = createStage(root, { layers: ['plot'], aspect: 'wide', signal });
  const out = readout({ label: 'the loop, for the highlighted target' });

  const runs = (state, tols) => sweep(tols, tol => runAdaptive({
    method: state.method, tol, m: state.m, c: state.c, k: state.k, x0: state.x0, v0: state.v0, hInit: state.h, hMax: H_MAX,
  }, T_END), { key: sweepKey({ panel: '13-right', method: state.method, h: state.h, m: state.m, c: state.c, k: state.k, x0: state.x0, v0: state.v0, tol: aux.get().tol }) });

  stage.onDraw(({ w, h, dpr }) => {
    const state = store.get();
    const results = runs(state, targets(aux.get().tol));
    const highlight = highlightIndex();
    const { value: tol, result: r } = results[highlight];
    const g = stage.ctx('plot');
    g.clearRect(0, 0, w, h);
    const gap = 6 * dpr, half = Math.floor((h - gap) / 2);
    // top: the accepted steps' error estimates against the target
    const view = drawTrajectory(g, { w, h: half, dpr }, { t: r.t, x: r.error, n: r.n }, {
      tMin: 0, tMax: T_END, yLog: true, y: [Math.max(1e-12, tol * 1e-4), Math.max(tol * 10, 1)], markers: r.n <= 400, yLabel: 'local error estimate per step  (log)',
    });
    drawPolyline(g, view, [0, T_END], [tol, tol], { color: cssVar('--stable'), width: 1.5, dash: [6, 4] });
    drawText(g, view, `target ${fmt(tol, 4)}`, T_END, tol, { color: cssVar('--stable'), size: 11, align: 'right', dx: -6, dy: -5 });

    // bottom: the bundle of h(t) profiles, one per target
    let lo = Infinity, hi = -Infinity;
    for (const { result: q } of results) for (let i = 0; i < q.n; i++) { lo = Math.min(lo, q.h[i]); hi = Math.max(hi, q.h[i]); }
    if (!Number.isFinite(lo)) { lo = 1e-3; hi = 1; }
    g.fillStyle = cssVar('--border');
    g.fillRect(0, half, w, gap);
    g.save();
    g.translate(0, half + gap);
    const hb = h - half - gap;
    const vb = makeView({ w, h: hb, dpr, xMin: 0, xMax: T_END, yMin: lo / 2, yMax: Math.min(H_MAX * 1.5, hi * 3), yLog: true });
    drawGrid(g, vb, { xLabel: 't', yLabel: 'h(t) per target error  (log)' });
    drawBundle(g, vb, results.map(({ result: q }) => ({ xs: q.t, ys: q.h })), { highlight, color: cssVar('--accent'), width: 2.25, dimWidth: 1.25, dimAlpha: 0.3 });
    g.restore();

    let err = 0;
    for (let i = 0; i < r.n; i++) { const e = Math.abs(r.x[i] - r.exact[i]); err = Number.isFinite(e) ? Math.max(err, e) : Infinity; }
    const order = METHODS[state.method].order;
    const i = r.n - 2;   // the last accepted step: h[i] produced error[i]; h[n−1] is the controller's proposal
    const lastErr = i >= 0 ? r.error[i] : NaN, lastH = i >= 0 ? r.h[i] : NaN, nextH = r.h[r.n - 1];
    const ratio = lastErr > 0 ? CONTROLLER_DEFAULTS.safety * (tol / lastErr) ** (1 / (order + 1)) : Infinity;
    out.set([
      `${r.n - 1} accepted, ${r.rejected} rejected${r.forced ? `, ${r.forced} forced at the floor` : ''}; h peaks at ${fmt(r.hPeak, 3)} s; max |x − exact| = ${fmt(err, 3)}`,
      r.blewUp ? el('span', { class: 'unstable' }, '; blew up') : !r.complete ? '; stopped early' : '', '\n',
      ...(i < 0 ? ['no step taken'] : [
        `last step: h = ${fmt(lastH, 3)} s gave an estimate of ${fmt(lastErr, 5)} ≤ ${fmt(tol, 4)} → `, el('span', { class: 'stable' }, 'accept'),
        `; next h = ${fmt(CONTROLLER_DEFAULTS.safety, 1)} · h · (target / error)^(1/${order + 1}) = ${fmt(ratio, 2)} × h`,
        ratio > CONTROLLER_DEFAULTS.growMax ? `, capped at ${CONTROLLER_DEFAULTS.growMax}×` : '', ` → ${fmt(nextH, 3)} s`,
        nextH >= H_MAX - 1e-9 ? ` (at the ${H_MAX} s cap)` : '',
      ]),
    ]);
  });

  const invalidate = stage.invalidate;

  // the strip's values are fixed at construction, and the spine's tol slider can move while
  // this pane is mounted off-screen, so rebuild the strip when the center changes
  const box = el('div');
  let strip = null;
  function buildStrip() {
    const values = targets(aux.get().tol);
    const next = sweepStrip({
      values, label: 'highlight one target error along the range', signal, initial: highlightIndex(),
      format: v => `target ${fmt(v, 4)}${v === values[CENTER] ? ' (the spine’s target)' : ''}`,
      onSelect: i => aux.set({ highlight: i }),
    });
    strip ? strip.el.replaceWith(next.el) : box.append(next.el);
    strip = next;
  }
  buildStrip();
  root.append(controls(box));
  root.append(out.el);

  const unsub = store.subscribe(invalidate, { immediate: false });
  const unsubAux = aux.subscribe((s, patch) => {
    if ('tol' in patch) buildStrip();
    if ('highlight' in patch) strip.select(highlightIndex(), { notify: false });
    if ('tol' in patch || 'highlight' in patch) invalidate();
  }, { immediate: false });
  return { destroy() { unsub(); unsubAux(); } };
}
