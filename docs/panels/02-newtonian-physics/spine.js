// Panel 2, spine: F = ma on the scene's point mass. Each force is its own equation — a
// constant wind vector, Newton's G m₁ m₂ / r², drag −c v, a spring −k x — with every
// parameter a draggable number and the vector it produces read out inside the equation
// itself. Below them, ΣF and a = ΣF / m as live MathML with m draggable too.
//
// The scrubs bind to one facade over the scene store (unique keys per parameter, each routed
// to scene.setForceParam / setMass), the same shape panel 5's spine uses, so bindScrub and
// bindMath take the article once and every slot follows any scene change. The facade, the
// per-force equations, and the row that shows one on/off live in arrows.js: the right pane
// offers the same four forces to drag and toggle while it runs, from the same code.
//
// Every active force is also an arrow from the body; the sum and a are drawn on top. Toggle
// each force, drag an arrow's head to scale it (through the scene store, so the left pane
// sees the same numbers), drag the body itself, run or step time by hand: explicit Euler
// steps of the tuple's h in 2D. The scene is 2D and createStepper is 1D, so the step is
// written here; time is a local clock and lives on the canvas, not in the tuple. A dotted
// line previews the next FORECAST_STEPS of that same step from wherever the body is now, so
// dragging or toggling a force shows where it is about to take the body before you run it.

import { el, fmt, fragment } from 'shared/dom.js';
import { createStage } from 'shared/gfx/stage.js';
import { createDragHandles } from 'shared/gfx/drag.js';
import { cssVar, makeView, drawGrid, drawPoint, drawPolyline, drawText } from 'shared/gfx/plot2d.js';
import { netForce } from 'shared/math/forces.js';
import { scene, defaultScene } from 'shared/scene.js';
import { controls } from 'shared/ui/controls.js';
import { bindScrub } from 'shared/ui/scrub.js';
import { bindMath } from 'shared/ui/livemath.js';
import {
  FORCE_COLOR, SUM_COLOR, ACCEL_COLOR, forceVectors, arrowMap, drawForceArrow, scalePatch, mag,
  forceParamFacade, forceRows, forceComponents,
} from './arrows.js';

const HALF_W = 4;
const HALF_H = 2.2;
const BODY_R = 9;
const FORECAST_STEPS = 25;

/**
 * The next `n` explicit-Euler steps of size `h` from the scene's current (x, v), without
 * touching the scene: a look-ahead, not a run. Every force model reads body.x/body.v, so
 * this restages netForce at each step exactly as step() below does, one step at a time.
 */
function forecast(s, h, n) {
  let x = s.body.x, v = s.body.v;
  const pts = [x];
  for (let i = 0; i < n; i++) {
    const a = netForce({ ...s, body: { m: s.body.m, x, v } }).map(F => F / s.body.m);
    x = [x[0] + h * v[0], x[1] + h * v[1]];
    v = [v[0] + h * a[0], v[1] + h * a[1]];
    pts.push(x);
  }
  return pts;
}

const TOTALS = `<math display="block"><mrow>
  <munder><mo>∑</mo><mi>i</mi></munder><msub><mi>F</mi><mi>i</mi></msub>
  <mo>=</mo><mo>(</mo><mn data-var="Sx" data-digits="2">0</mn><mo>,</mo><mn data-var="Sy" data-digits="2">0</mn><mo>)</mo>
  <mspace width="1.5em"/>
  <mi>a</mi><mo>=</mo>
  <mfrac><mrow><munder><mo>∑</mo><mi>i</mi></munder><msub><mi>F</mi><mi>i</mi></msub></mrow><mn data-scrub="m1" data-digits="2">1.00</mn></mfrac>
  <mo>=</mo><mo>(</mo><mn data-var="ax" data-digits="2">0</mn><mo>,</mo><mn data-var="ay" data-digits="2">0</mn><mo>)</mo>
</mrow></math>`;

export function mount(root, ctx) {
  const { store, loop, signal } = ctx;
  const article = root.closest('article') ?? root;
  const facade = forceParamFacade();
  let t = 0, steps = 0;           // this pane's clock: the tuple's t belongs to the players
  let running = false, carry = 0;
  let view = null, frozenMap = null;

  // ---- the force rows: switch, equation, and whether it counts toward the sum. Each row's
  // off-hint is always in the DOM at its full width (CSS hides it by :has(input:checked), not
  // a text swap) and the row itself has a reserved min-height, so toggling a force or
  // dragging a number wide never wraps the row and shoves the stage below it around. ----
  const rows = forceRows(signal);
  const runBtn = el('button', { class: 'btn', type: 'button', title: 'Run explicit Euler steps of the tuple’s h', 'aria-pressed': 'false' }, 'Run');
  const stepBtn = el('button', { class: 'btn', type: 'button', title: 'One explicit Euler step of the tuple’s h' }, 'Step');
  const resetBtn = el('button', { class: 'btn', type: 'button' }, 'Reset');
  root.append(controls(rows, el('div', { class: 'transport' }, el('div', { class: 'transport-group' }, runBtn, stepBtn, resetBtn))));

  const stage = createStage(root, { layers: ['plane'], aspect: 'wide', signal });
  root.append(el('div', { class: 'totals' }, fragment(TOTALS)));

  const mapNow = () => frozenMap ?? arrowMap(scene.get());

  stage.onDraw(({ w, h, dpr }) => {
    const s = scene.get();
    const { body } = s;
    const { list, sum } = forceVectors(s);
    const map = mapNow();
    const a = [sum[0] / body.m, sum[1] / body.m];
    const g = stage.ctx('plane');
    view = makeView({ w, h, dpr, halfW: HALF_W });
    g.clearRect(0, 0, w, h);
    drawGrid(g, view, { xLabel: 'x', yLabel: 'y' });

    // the spring's anchor is part of the picture: the spring pulls back toward the origin
    const spring = s.forces.find(f => f.type === 'spring');
    if (spring?.on && mag(body.x) > 1e-6) {
      g.save(); g.strokeStyle = cssVar(FORCE_COLOR.spring); g.globalAlpha = 0.35; g.lineWidth = dpr; g.setLineDash([3 * dpr, 3 * dpr]);
      g.beginPath(); g.moveTo(view.X(0), view.Y(0)); g.lineTo(view.X(body.x[0]), view.Y(body.x[1])); g.stroke(); g.restore();
      drawText(g, view, 'spring anchor', 0, 0, { color: cssVar('--muted'), size: 10, dx: 6, dy: 14 });
    }

    // a dotted preview of the next FORECAST_STEPS of this same step, from wherever the body
    // is right now: it redraws on every scene change, so it is always what happens next
    const preview = forecast(s, store.get().h, FORECAST_STEPS);
    drawPolyline(g, view, preview.map(p => p[0]), preview.map(p => p[1]),
      { color: cssVar('--muted'), width: 1.5, dash: [2, 3], alpha: 0.8 });

    for (const f of list) drawForceArrow(g, view, body.x, f.F, map, { color: FORCE_COLOR[f.type], label: f.label });
    drawForceArrow(g, view, body.x, sum, map, { color: SUM_COLOR, width: 4, head: 11 });
    drawForceArrow(g, view, body.x, a, map, { color: ACCEL_COLOR, width: 1.5, head: 6 });
    if (mag(body.v) > 1e-6) drawForceArrow(g, view, body.x, body.v, map, { color: '--stable', width: 1.5, head: 6, alpha: 0.8 });
    drawPoint(g, view, body.x[0], body.x[1], { r: BODY_R, fill: cssVar('--fg') });

    // a legend for the three arrows that share the body's tail (and, when m = 1, a tip)
    drawText(g, view, 'ΣF', view.xMin, view.yMax, { color: cssVar(SUM_COLOR), size: 11, dx: 8, dy: 16 });
    drawText(g, view, 'a = ΣF / m', view.xMin, view.yMax, { color: cssVar(ACCEL_COLOR), size: 11, dx: 8, dy: 30 });
    drawText(g, view, 'v', view.xMin, view.yMax, { color: cssVar('--stable'), size: 11, dx: 8, dy: 44 });
    drawText(g, view, `⋯ next ${FORECAST_STEPS} steps`, view.xMin, view.yMax, { color: cssVar('--muted'), size: 11, dx: 8, dy: 58 });

    // the clock and the state the equations do not already carry
    const hint = list.length === 0 ? 'every force is off' : 'arrow lengths are compressed (log) so all four fit; the equations are the truth';
    drawText(g, view, `x = (${fmt(body.x[0], 2)}, ${fmt(body.x[1], 2)})   v = (${fmt(body.v[0], 2)}, ${fmt(body.v[1], 2)})`,
      view.xMin, view.yMin, { color: cssVar('--fg'), size: 11, dx: 8, dy: -32 });
    drawText(g, view, `t = ${fmt(t, 3)} s: ${steps} step${steps === 1 ? '' : 's'} of h = ${fmt(store.get().h, 3)} s${running ? '   running' : ''}`,
      view.xMin, view.yMin, { color: cssVar('--muted'), size: 11, dx: 8, dy: -18 });
    drawText(g, view, hint, view.xMin, view.yMin, { color: cssVar('--muted'), size: 10, dx: 8, dy: -5 });
  });

  // ---- drags: the body, and every arrow tip long enough to grab ----
  const canvas = stage.canvas('plane');
  createDragHandles(canvas, {
    signal, hitRadius: 12,
    handles: () => {
      const s = scene.get();
      const map = mapNow();
      const hs = [{ id: 'body', x: s.body.x[0], y: s.body.x[1] }];
      for (const f of forceVectors(s).list) {
        const d = map.toPlot(f.F);
        if (mag(d) < 0.15) continue;   // too short to grab; the body wins the hit test
        hs.push({ id: f.i, x: s.body.x[0] + d[0], y: s.body.x[1] + d[1] });
      }
      return hs;
    },
    view: () => view ?? makeView({ w: 1, h: 1, dpr: 1, halfW: HALF_W }),
    onStart: () => { frozenMap = arrowMap(scene.get()); },
    onMove: (id, p) => {
      if (id === 'body') { scene.moveBody(Math.max(-HALF_W, Math.min(HALF_W, p.x)), Math.max(-HALF_H, Math.min(HALF_H, p.y))); return; }
      const s = scene.get();
      const f = s.forces[id];
      const F = forceVectors(s).list.find(v => v.i === id)?.F ?? [0, 0];
      const Fnext = (frozenMap ?? arrowMap(s)).toForce([p.x - s.body.x[0], p.y - s.body.x[1]]);
      const patch = scalePatch(f, F, Fnext);
      if (patch) scene.paramStore(id).set(patch);
    },
    onEnd: () => { frozenMap = null; stage.invalidate(); },
  });

  // ---- step time: one explicit Euler step in 2D, by hand or run continuously ----
  function step() {
    const s = scene.get();
    const h = store.get().h;
    const a = netForce(s).map(F => F / s.body.m);
    const { x, v } = s.body;
    scene.moveBody(x[0] + h * v[0], x[1] + h * v[1]);
    scene.setVelocity(v[0] + h * a[0], v[1] + h * a[1]);
    t += h; steps++;
    stage.invalidate();
  }
  function reset() {
    const body = defaultScene().body;   // the displaced, moving body: drag and spring are not zero vectors
    scene.setVelocity(body.v[0], body.v[1]);
    scene.moveBody(body.x[0], body.x[1]);
    t = 0; steps = 0;
    stage.invalidate();
  }
  function setRunning(v) {
    running = v; carry = 0;
    runBtn.setAttribute('aria-pressed', String(running));
    runBtn.textContent = running ? 'Pause' : 'Run';
    stage.invalidate();
  }
  const offFrame = loop.onFrame(dt => {
    if (!running) return;
    carry += dt;
    const h = store.get().h;
    let n = Math.min(Math.floor(carry / h), 200);
    carry -= n * h;
    while (n-- > 0) step();
  });
  runBtn.addEventListener('click', () => setRunning(!running), { signal });
  stepBtn.addEventListener('click', step, { signal });
  resetBtn.addEventListener('click', reset, { signal });

  // ---- live math: every scrub and every slot reads the one facade over the scene ----
  bindScrub(article, facade, { signal });
  bindMath(article, facade, () => {
    const s = scene.get();
    const { sum } = forceVectors(s);
    return {
      ...forceComponents(s),
      Sx: sum[0], Sy: sum[1],
      ax: sum[0] / s.body.m, ay: sum[1] / s.body.m,
    };
  }, { signal });

  const unsub = scene.subscribe(stage.invalidate, { immediate: false });
  const unsubTuple = store.subscribe((s, patch) => { if ('h' in patch) stage.invalidate(); }, { immediate: false });
  return {
    pause() { setRunning(false); },
    destroy() { offFrame(); unsub(); unsubTuple(); },
  };
}
