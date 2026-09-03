// Panel 3, left: one instant of the spine's trajectory (t concrete). x and v as two stacked
// strips of the exact solution, with the tangent at a scrubbed t: the slope of x is v, the
// slope of v is a. The scrub is local to this pane; the store's t belongs to the players.

import { el, fmt, clamp } from 'shared/dom.js';
import { createStage } from 'shared/gfx/stage.js';
import { drawTrajectory } from 'shared/gfx/trajectory.js';
import { cssVar, drawPoint, drawPolyline, drawText, makeView } from 'shared/gfx/plot2d.js';
import { exactSolution, acceleration } from 'shared/math/system.js';
import { controls } from 'shared/ui/controls.js';

const SPAN = 4;        // seconds shown
const SAMPLES = 800;   // of the exact curve
const TANGENT = 0.2;   // half-length of the tangent segment, in seconds
const BAR_H = 34;      // the local, canvas-drawn a-bar: no shared "thin bar" stage exists, so
                        // this pane sizes and draws its own bare canvas (see mount())

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

  // A strip's title: bigger and darker than drawTrajectory's own small --tick y-label (which
  // is suppressed here, yLabel: null, so the two never overlap), offset clear of the y-tick
  // numbers stacked at the strip's left edge. The value at the scrubbed instant is called out
  // in the opposite corner, in place of the old readout box.
  function strip(stage, size, ys, title, label, value, slope) {
    const g = stage.ctx('plot');
    const blue = cssVar('--exact');
    const view = drawTrajectory(g, size, { t: curve.t, x: ys }, { tMin: 0, tMax: SPAN, approx: blue, yLabel: null, width: 1.5 });
    drawPolyline(g, view, [tScrub, tScrub], [view.yMin, view.yMax], { color: cssVar('--axis'), width: 1, dash: [3, 3], alpha: 0.5 });
    drawPolyline(g, view, [tScrub - TANGENT, tScrub + TANGENT], [value - TANGENT * slope, value + TANGENT * slope], { color: cssVar('--approx'), width: 2.5 });
    drawPoint(g, view, tScrub, value, { r: 5, fill: cssVar('--approx') });
    drawText(g, view, title, view.xMin, view.yMax, { color: cssVar('--fg'), size: 15, align: 'left', dx: 34, dy: 19 });
    drawText(g, view, `${label} = ${fmt(value, 3)}`, view.xMax, view.yMax, { color: cssVar('--approx'), size: 13, align: 'right', dx: -8, dy: 19 });
  }

  // The a-bar: a bare canvas (no shared "thin bar" stage exists — done locally per CLAUDE.md).
  // Sized to its own wrapper's content width so it spans the controls column.
  const barBox = el('div');
  const barCanvas = el('canvas', { width: 1, height: BAR_H });
  barBox.append(barCanvas);
  function drawBar(a, capA) {
    const w = barCanvas.width;
    const g = barCanvas.getContext('2d');
    g.clearRect(0, 0, w, BAR_H);
    const view = makeView({ w, h: BAR_H, dpr: 1, xMin: -capA, xMax: capA, yMin: 0, yMax: 1 });
    const av = clamp(a, -capA, capA);
    const x0 = view.X(0), x1 = view.X(av);
    const trackTop = 16, trackH = BAR_H - trackTop - 4;
    g.fillStyle = cssVar('--approx');
    g.fillRect(Math.min(x0, x1), trackTop, Math.max(1.5, Math.abs(x1 - x0)), trackH);
    g.strokeStyle = cssVar('--axis');
    g.lineWidth = 1;
    g.beginPath(); g.moveTo(x0, trackTop - 2); g.lineTo(x0, trackTop + trackH + 2); g.stroke();
    g.font = `600 12px ${cssVar('--font') || 'system-ui'}`;
    g.fillStyle = cssVar('--fg');
    g.textAlign = 'left'; g.fillText('a', 0, 11);
    g.textAlign = 'right'; g.fillText(fmt(a, 2), w, 11);
    g.font = `10px ${cssVar('--font') || 'system-ui'}`;
    g.fillStyle = cssVar('--tick');
    g.textAlign = 'center'; g.fillText('0', clamp(x0, 10, w - 10), trackTop - 5);
  }

  xStage.onDraw(size => {
    const state = store.get();
    const c = curves(state);
    const x = c.sol.x(tScrub), v = c.sol.v(tScrub);
    strip(xStage, size, c.x, 'x(t)', 'x', x, v);
  });
  vStage.onDraw(size => {
    const state = store.get();
    const c = curves(state);
    const x = c.sol.x(tScrub), v = c.sol.v(tScrub);
    const a = c.acc(x, v);
    strip(vStage, size, c.v, 'v(t)', 'v', v, a);
    const w = Math.max(60, Math.round(barBox.clientWidth));
    if (barCanvas.width !== w) barCanvas.width = w;
    drawBar(a, c.capA);
  });

  const invalidate = () => { xStage.invalidate(); vStage.invalidate(); };
  root.append(controls(localSlider({
    label: 't (this instant)', min: 0, max: SPAN, value: tScrub, format: v => `${v.toFixed(2)} s`, signal,
    onInput: v => { tScrub = v; invalidate(); },
  }), barBox));

  const unsub = store.subscribe(invalidate, { immediate: false });
  return { destroy() { unsub(); } };
}
