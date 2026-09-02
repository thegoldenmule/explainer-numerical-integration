// Panel 3, left: one instant of the spine's trajectory (t concrete). x and v as two stacked
// strips of the exact solution, with the tangent at a scrubbed t: the slope of x is v, the
// slope of v is a. The scrub is local to this pane; the store's t belongs to the players.

import { el, fmt } from 'shared/dom.js';
import { createStage } from 'shared/gfx/stage.js';
import { drawTrajectory } from 'shared/gfx/trajectory.js';
import { cssVar, drawPoint, drawPolyline } from 'shared/gfx/plot2d.js';
import { exactSolution, acceleration } from 'shared/math/system.js';
import { readout, controls } from 'shared/ui/controls.js';

const SPAN = 4;        // seconds shown
const SAMPLES = 800;   // of the exact curve
const TANGENT = 0.2;   // half-length of the tangent segment, in seconds

/** A local slider (the scrubbed t is not part of the tuple). */
function localSlider({ label, min, max, step = 'any', value, format = v => String(v), onInput, signal }) {
  const input = el('input', { type: 'range', min, max, step, value });
  const out = el('output', {}, format(value));
  input.addEventListener('input', () => { out.textContent = format(Number(input.value)); onInput(Number(input.value)); }, { signal });
  return el('label', { class: 'control' }, el('span', { class: 'control-label' }, el('span', {}, label), out), input);
}

export function mount(root, ctx) {
  const { store, signal } = ctx;
  let tScrub = 0.6;

  const xStage = createStage(root, { layers: ['plot'], aspect: 'strip', signal });
  const vStage = createStage(root, { layers: ['plot'], aspect: 'strip', signal });
  const out = readout({ label: 'at this instant' });

  let curve = null, curveKey = '';
  function curves(state) {
    const key = `${state.m}/${state.c}/${state.k}/${state.x0}/${state.v0}`;
    if (key === curveKey) return curve;
    const sol = exactSolution(state);
    const t = new Float64Array(SAMPLES + 1), x = new Float64Array(SAMPLES + 1), v = new Float64Array(SAMPLES + 1);
    for (let i = 0; i <= SAMPLES; i++) { t[i] = SPAN * i / SAMPLES; x[i] = sol.x(t[i]); v[i] = sol.v(t[i]); }
    curveKey = key;
    curve = { t, x, v, sol };
    return curve;
  }

  function strip(stage, size, ys, yLabel, value, slope) {
    const g = stage.ctx('plot');
    const blue = cssVar('--exact');
    const view = drawTrajectory(g, size, { t: curve.t, x: ys }, { tMin: 0, tMax: SPAN, approx: blue, yLabel, width: 1.5 });
    drawPolyline(g, view, [tScrub, tScrub], [view.yMin, view.yMax], { color: cssVar('--axis'), width: 1, dash: [3, 3], alpha: 0.5 });
    drawPolyline(g, view, [tScrub - TANGENT, tScrub + TANGENT], [value - TANGENT * slope, value + TANGENT * slope], { color: cssVar('--approx'), width: 2.5 });
    drawPoint(g, view, tScrub, value, { r: 5, fill: cssVar('--approx') });
  }

  xStage.onDraw(size => {
    const state = store.get();
    const c = curves(state);
    const x = c.sol.x(tScrub), v = c.sol.v(tScrub);
    strip(xStage, size, c.x, 'x', x, v);
  });
  vStage.onDraw(size => {
    const state = store.get();
    const c = curves(state);
    const x = c.sol.x(tScrub), v = c.sol.v(tScrub);
    const a = acceleration(state.m, state.c, state.k)(x, v);
    strip(vStage, size, c.v, 'v', v, a);
    out.set(`t = ${fmt(tScrub, 2)} s\nx = ${fmt(x, 3)}   v = x′ = ${fmt(v, 3)} (slope of x)   a = v′ = ${fmt(a, 3)} (slope of v)`);
  });

  const invalidate = () => { xStage.invalidate(); vStage.invalidate(); };
  root.append(controls(localSlider({
    label: 't (this instant)', min: 0, max: SPAN, value: tScrub, format: v => `${v.toFixed(2)} s`, signal,
    onInput: v => { tScrub = v; invalidate(); },
  })));
  root.append(out.el);

  const unsub = store.subscribe(invalidate, { immediate: false });
  return { destroy() { unsub(); } };
}
