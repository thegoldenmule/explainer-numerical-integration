// Panel 8, right: explode h. The same simulation across a small spread of step sizes
// around the spine's h, one trajectory per h against the exact curve, one highlighted by
// the sweep strip (aux.highlight, clamped to this sweep on read; −1 means the spine's h in
// the middle) with its cost (steps per simulated second) and max error called out.

import { el, fmt } from 'shared/dom.js';
import { createStage } from 'shared/gfx/stage.js';
import { drawBundle } from 'shared/gfx/bundle.js';
import { cssVar, makeView, drawGrid, drawPolyline } from 'shared/gfx/plot2d.js';
import { simulate } from 'shared/math/integrators.js';
import { sweep, sweepRange, sweepKey } from 'shared/math/sweep.js';
import { LIMITS } from 'shared/state.js';
import { aux } from 'shared/aux.js';
import { readout, controls } from 'shared/ui/controls.js';
import { sweepStrip } from 'shared/ui/sweep.js';
import { stepCost } from 'shared/player.js';
import { fmtMs } from './cost.js';

const SPAN = 6;     // seconds simulated
const COUNT = 9;    // step sizes in the bundle; the middle one is the spine's h
const SPREAD = 4;   // h/SPREAD … h·SPREAD
const CENTER = (COUNT - 1) / 2;

/** aux.highlight is shared by every sweep: clamp to this one, and −1 means the spine's h. */
const highlightIndex = () => { const i = aux.get().highlight; return i < 0 ? CENTER : Math.min(COUNT - 1, i); };

export function mount(root, ctx) {
  const { store, signal } = ctx;

  const stage = createStage(root, { layers: ['plot'], aspect: 'wide', signal });
  const out = readout({ label: 'highlighted run' });

  const values = state => {
    const [lo, hi] = LIMITS.h;
    return sweepRange(Math.max(lo, state.h / SPREAD), Math.min(hi, state.h * SPREAD), COUNT, { log: true });
  };
  const runs = state => sweep(values(state), h => simulate({ ...state, h }, SPAN),
    { key: sweepKey({ panel: '8-right', method: state.method, m: state.m, c: state.c, k: state.k, x0: state.x0, v0: state.v0, h: state.h }) });

  stage.onDraw(({ w, h, dpr }) => {
    const state = store.get();
    const results = runs(state);
    const highlight = highlightIndex();
    const g = stage.ctx('plot');
    g.clearRect(0, 0, w, h);

    // range from the exact curve, so a blow-up leaves the frame instead of flattening it
    const fine = results[0].result;
    let amp = 0;
    for (let i = 0; i < fine.n; i++) amp = Math.max(amp, Math.abs(fine.exact[i]));
    const yMax = Math.max(1, 2.5 * amp);
    const view = makeView({ w, h, dpr, xMin: 0, xMax: SPAN, yMin: -yMax, yMax });
    drawGrid(g, view, { xLabel: 't', yLabel: 'x' });
    drawPolyline(g, view, fine.t, fine.exact, { color: cssVar('--exact'), width: 1.75, dash: [6, 4] });
    drawBundle(g, view, results.map(r => ({ xs: r.result.t, ys: r.result.x })), { highlight, width: 2.25, dimWidth: 1.25, dimAlpha: 0.3 });

    const r = results[highlight];
    let err = 0;
    for (let i = 0; i < r.result.n; i++) { const e = Math.abs(r.result.x[i] - r.result.exact[i]); err = Number.isFinite(e) ? Math.max(err, e) : Infinity; }
    const perStep = stepCost(state).perStep;
    out.set([
      `cost: ${fmt(1 / r.value, 1)} steps per simulated second = ${fmtMs(perStep / r.value)} of compute per second\n`,
      `error: max |x − exact| over ${SPAN} s = ${fmt(err, 4)}`,
      err > 10 * yMax ? el('span', { class: 'unstable' }, '   (off the chart)') : '',
    ]);
  });

  // the strip's values are fixed at construction, and the spine's h slider can move while
  // this pane is mounted off-screen, so rebuild the strip when the center changes
  const box = el('div');
  let strip = null, stripH = NaN;
  function buildStrip(state) {
    if (state.h === stripH) return;
    stripH = state.h;
    const hs = values(state);
    const next = sweepStrip({
      values: hs, label: 'highlight one h along the range', signal, initial: highlightIndex(),
      format: v => `h = ${fmt(v, 4)} s${v === hs[CENTER] ? ' (the spine’s h)' : ''}`,
      onSelect: i => aux.set({ highlight: i }),
    });
    strip ? strip.el.replaceWith(next.el) : box.append(next.el);
    strip = next;
  }
  buildStrip(store.get());
  root.append(controls(box));
  root.append(out.el);

  const unsub = store.subscribe((state, patch) => { if ('h' in patch) buildStrip(state); stage.invalidate(); }, { immediate: false });
  const unsubAux = aux.subscribe((s, patch) => {
    if ('highlight' in patch) { strip.select(highlightIndex(), { notify: false }); stage.invalidate(); }
  }, { immediate: false });
  return { destroy() { unsub(); unsubAux(); } };
}
