// Panel 2, spine: F = ma on the scene's point mass. Every active force is an arrow from the
// body; the sum and a = ΣF / m are drawn on top. Toggle each force, drag an arrow's head to
// scale it (through the scene store, so the left pane sees the same arrows), drag the body
// itself, and step time by hand: one explicit Euler step of the tuple's h in 2D. The scene
// is 2D and createStepper is 1D, so the step is written here; time is a local clock.

import { el, fmt } from 'shared/dom.js';
import { createStage } from 'shared/gfx/stage.js';
import { createDragHandles } from 'shared/gfx/drag.js';
import { cssVar, makeView, drawGrid, drawPoint, drawText } from 'shared/gfx/plot2d.js';
import { netForce } from 'shared/math/forces.js';
import { scene } from 'shared/scene.js';
import { slider, toggleFn, readout, controls, row } from 'shared/ui/controls.js';
import { FORCE_COLOR, SUM_COLOR, ACCEL_COLOR, forceVectors, arrowScale, drawForceArrow, scalePatch, mag } from './arrows.js';

const HALF_W = 4;
const BODY_R = 9;

export function mount(root, ctx) {
  const { store, signal } = ctx;
  let t = 0, steps = 0;           // this pane's clock: the tuple's t belongs to the players
  let view = null, frozenScale = null;

  const stage = createStage(root, { layers: ['plane'], aspect: 'wide', signal });
  const out = readout({ label: 'ΣF = m a' });

  const scaleNow = () => {
    const { list, sum } = forceVectors(scene.get());
    return frozenScale ?? arrowScale(list, [sum]);
  };

  stage.onDraw(({ w, h, dpr }) => {
    const s = scene.get();
    const { body } = s;
    const { list, sum } = forceVectors(s);
    const scale = scaleNow();
    const a = [sum[0] / body.m, sum[1] / body.m];
    const g = stage.ctx('plane');
    view = makeView({ w, h, dpr, halfW: HALF_W });
    g.clearRect(0, 0, w, h);
    drawGrid(g, view, { xLabel: 'x', yLabel: 'y' });

    // the spring's anchor and the gravity attractor's direction are part of the picture
    const spring = s.forces.find(f => f.type === 'spring');
    if (spring?.on && mag(body.x) > 1e-6) {
      g.save(); g.strokeStyle = cssVar(FORCE_COLOR.spring); g.globalAlpha = 0.35; g.lineWidth = dpr; g.setLineDash([3 * dpr, 3 * dpr]);
      g.beginPath(); g.moveTo(view.X(0), view.Y(0)); g.lineTo(view.X(body.x[0]), view.Y(body.x[1])); g.stroke(); g.restore();
      drawText(g, view, 'spring anchor', 0, 0, { color: cssVar('--muted'), size: 10, dx: 6, dy: 14 });
    }

    for (const f of list) drawForceArrow(g, view, body.x, f.F, scale, { color: FORCE_COLOR[f.type], label: f.label });
    drawForceArrow(g, view, body.x, sum, scale, { color: SUM_COLOR, width: 4, head: 11 });
    drawForceArrow(g, view, body.x, a, scale, { color: ACCEL_COLOR, width: 1.5, head: 6 });
    if (mag(body.v) > 1e-6) drawForceArrow(g, view, body.x, body.v, scale, { color: '--stable', width: 1.5, head: 6, alpha: 0.8 });
    drawPoint(g, view, body.x[0], body.x[1], { r: BODY_R, fill: cssVar('--fg') });
    // a legend for the three arrows that share the body's tail (and, when m = 1, a tip)
    drawText(g, view, 'ΣF', view.xMin, view.yMax, { color: cssVar(SUM_COLOR), size: 11, dx: 8, dy: 30 });
    drawText(g, view, 'a = ΣF / m', view.xMin, view.yMax, { color: cssVar(ACCEL_COLOR), size: 11, dx: 8, dy: 44 });
    drawText(g, view, 'v', view.xMin, view.yMax, { color: cssVar('--stable'), size: 11, dx: 8, dy: 58 });

    const hint = list.length === 0 ? 'every force is off' : mag(body.x) < 1e-6 && mag(body.v) < 1e-6 ? 'drag the mass off the origin; step to give it a velocity' : '';
    out.set([
      `ΣF = (${fmt(sum[0], 2)}, ${fmt(sum[1], 2)})   a = ΣF / m = (${fmt(a[0], 2)}, ${fmt(a[1], 2)})\n`,
      `x = (${fmt(body.x[0], 2)}, ${fmt(body.x[1], 2)})   v = (${fmt(body.v[0], 2)}, ${fmt(body.v[1], 2)})\n`,
      `t = ${fmt(t, 3)} s: ${steps} step${steps === 1 ? '' : 's'} of h = ${fmt(store.get().h, 3)} s\n`,
      el('span', { class: 'label' }, hint || 'arrows are scaled to fit; the numbers are the truth'),
    ]);
  });

  // ---- drags: the body, and every arrow tip with a length to scale ----
  const canvas = stage.canvas('plane');
  createDragHandles(canvas, {
    signal, hitRadius: 12,
    handles: () => {
      const s = scene.get();
      const scale = scaleNow();
      const hs = [{ id: 'body', x: s.body.x[0], y: s.body.x[1] }];
      for (const f of forceVectors(s).list) {
        if (mag(f.F) * scale < 0.15) continue;   // too short to grab; the body wins the hit test
        hs.push({ id: f.i, x: s.body.x[0] + f.F[0] * scale, y: s.body.x[1] + f.F[1] * scale });
      }
      return hs;
    },
    view: () => view ?? makeView({ w: 1, h: 1, dpr: 1, halfW: HALF_W }),
    onStart: () => { frozenScale = scaleNow(); },
    onMove: (id, p) => {
      if (id === 'body') { scene.moveBody(Math.max(-HALF_W, Math.min(HALF_W, p.x)), Math.max(-2.2, Math.min(2.2, p.y))); return; }
      const s = scene.get();
      const f = s.forces[id];
      const F = forceVectors(s).list.find(v => v.i === id)?.F ?? [0, 0];
      const Fnext = [(p.x - s.body.x[0]) / frozenScale, (p.y - s.body.x[1]) / frozenScale];
      const patch = scalePatch(f, F, Fnext);
      if (patch) scene.paramStore(id).set(patch);
    },
    onEnd: () => { frozenScale = null; stage.invalidate(); },
  });

  // ---- step time by hand: one explicit Euler step in 2D ----
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
    scene.setVelocity(0, 0);
    scene.moveBody(1, 0.5);
    t = 0; steps = 0;
    stage.invalidate();
  }

  const toggles = scene.get().forces.map((f, i) => toggleFn({
    label: f.type === 'wind' ? 'Wind' : f.type === 'gravity' ? 'Gravity' : f.type === 'drag' ? 'Drag' : 'Spring',
    get: () => scene.get().forces[i].on, set: v => scene.toggleForce(i, v), subscribe: scene.subscribe, signal,
  }));
  const stepBtn = el('button', { class: 'btn', type: 'button', title: 'One explicit Euler step of the tuple’s h' }, 'Step once');
  stepBtn.addEventListener('click', step, { signal });
  const resetBtn = el('button', { class: 'btn', type: 'button' }, 'Reset');
  resetBtn.addEventListener('click', reset, { signal });

  root.append(controls(
    el('fieldset', { class: 'choice' }, el('legend', {}, 'Forces'), toggles),
    row(slider(scene.paramStore('body'), 'm', { label: 'm (mass)', min: 0.1, max: 10, format: v => fmt(v, 2), signal }),
      el('div', { class: 'transport' }, el('div', { class: 'transport-group' }, stepBtn, resetBtn))),
  ));
  root.append(out.el);

  const unsub = scene.subscribe(stage.invalidate, { immediate: false });
  const unsubTuple = store.subscribe((s, patch) => { if ('h' in patch) stage.invalidate(); }, { immediate: false });
  return { destroy() { unsub(); unsubTuple(); } };
}
