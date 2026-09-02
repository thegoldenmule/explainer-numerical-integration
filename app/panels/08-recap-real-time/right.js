// Panel 8, right: explode h. The same simulation across a small spread of step sizes
// around the spine's h, one trajectory per h against the exact curve, one highlighted by a
// slider along the range with its cost (steps per simulated second) and max error called
// out. The highlight index is local to the pane (a stand-in for the aux store's sweep
// highlight and the shared sweep strip).

import { el, fmt } from 'shared/dom.js';
import { createStage } from 'shared/gfx/stage.js';
import { drawBundle } from 'shared/gfx/bundle.js';
import { cssVar, makeView, drawGrid, drawPolyline } from 'shared/gfx/plot2d.js';
import { simulate } from 'shared/math/integrators.js';
import { sweep, sweepRange, sweepKey } from 'shared/math/sweep.js';
import { LIMITS } from 'shared/state.js';
import { readout, controls } from 'shared/ui/controls.js';
import { stepCost } from 'shared/player.js';
import { fmtMs } from './cost.js';

const SPAN = 6;     // seconds simulated
const COUNT = 9;    // step sizes in the bundle; the middle one is the spine's h
const SPREAD = 4;   // h/SPREAD … h·SPREAD

export function mount(root, ctx) {
  const { store, signal } = ctx;
  let highlight = (COUNT - 1) / 2;

  const stage = createStage(root, { layers: ['plot'], aspect: 'wide', signal });
  const out = readout({ label: 'highlighted run' });
  const input = el('input', { type: 'range', min: 0, max: COUNT - 1, step: 1, value: highlight });
  const label = el('output');

  const values = state => {
    const [lo, hi] = LIMITS.h;
    return sweepRange(Math.max(lo, state.h / SPREAD), Math.min(hi, state.h * SPREAD), COUNT, { log: true });
  };
  const runs = state => sweep(values(state), h => simulate({ ...state, h }, SPAN),
    { key: sweepKey({ panel: '8-right', method: state.method, m: state.m, c: state.c, k: state.k, x0: state.x0, v0: state.v0, h: state.h }) });

  stage.onDraw(({ w, h, dpr }) => {
    const state = store.get();
    const results = runs(state);
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
    label.textContent = `h = ${fmt(r.value, 4)} s${highlight === (COUNT - 1) / 2 ? ' (the spine’s h)' : ''}`;
    out.set([
      `cost: ${fmt(1 / r.value, 1)} steps per simulated second = ${fmtMs(perStep / r.value)} of compute per second\n`,
      `error: max |x − exact| over ${SPAN} s = ${fmt(err, 4)}`,
      err > 10 * yMax ? el('span', { class: 'unstable' }, '   (off the chart)') : '',
    ]);
  });

  input.addEventListener('input', () => { highlight = Number(input.value); stage.invalidate(); }, { signal });
  root.append(controls(
    el('label', { class: 'control' }, el('span', { class: 'control-label' }, el('span', {}, 'highlight one h along the range'), label), input),
  ));
  root.append(out.el);

  const unsub = store.subscribe(stage.invalidate, { immediate: false });
  return { destroy() { unsub(); } };
}
