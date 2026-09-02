// Panel 2, right: the rotational half, on the rigid body from panel 1's drill-down. The
// scene's forces are applied at one point of the body a lever arm d from its center; each
// makes a torque r × F, the torques sum to T = I θ″ with I = m (w² + h²) / 12 the moment of
// inertia of the rectangle, and θ is integrated locally (there is no rigid-body store; the
// scene holds a point mass). The translational sum does not depend on where the forces
// act; the torque does, which is the whole point of the lever-arm slider.

import { el, fmt } from 'shared/dom.js';
import { createStage } from 'shared/gfx/stage.js';
import { cssVar, makeView, drawGrid, drawText } from 'shared/gfx/plot2d.js';
import { scene } from 'shared/scene.js';
import { readout, controls, row } from 'shared/ui/controls.js';
import { FORCE_COLOR, SUM_COLOR, forceVectors, arrowScale, drawForceArrow, mag } from './arrows.js';

const BODY = { w: 1.6, h: 1 };
const HALF_W = 4;

function localSlider({ label, min, max, value, format = v => String(v), onInput, signal }) {
  const input = el('input', { type: 'range', min, max, step: 'any', value });
  const out = el('output', {}, format(value));
  input.addEventListener('input', () => { out.textContent = format(Number(input.value)); onInput(Number(input.value)); }, { signal });
  return el('label', { class: 'control' }, el('span', { class: 'control-label' }, el('span', {}, label), out), input);
}

export function mount(root, ctx) {
  const { store, loop, signal } = ctx;
  let theta = 0, omega = 0, t = 0;   // the body's rotation state, local to this pane
  let lever = 0.5;                   // where the forces act: d along the body's own axis
  let running = false, carry = 0;

  const stage = createStage(root, { layers: ['plane'], aspect: 'wide', signal });
  const out = readout({ label: 'ΣT = I θ″' });

  /** The rotational sum at the current θ. */
  function torque() {
    const s = scene.get();
    const { list, sum } = forceVectors(s);
    const r = [lever * Math.cos(theta), lever * Math.sin(theta)];
    const I = s.body.m * (BODY.w ** 2 + BODY.h ** 2) / 12;
    const T = r[0] * sum[1] - r[1] * sum[0];
    return { list, sum, r, I, T, alpha: T / I, s };
  }

  stage.onDraw(({ w, h, dpr }) => {
    const { list, sum, r, I, T, alpha, s } = torque();
    const { body } = s;
    const scale = arrowScale(list, [sum]);
    const g = stage.ctx('plane');
    const view = makeView({ w, h, dpr, halfW: HALF_W });
    g.clearRect(0, 0, w, h);
    drawGrid(g, view, { xLabel: 'x', yLabel: 'y' });

    // the body, rotated by θ about its center of mass
    g.save();
    g.translate(view.X(body.x[0]), view.Y(body.x[1]));
    g.rotate(-theta);
    const pw = BODY.w * view.sx, ph = BODY.h * view.sy;
    g.fillStyle = cssVar('--accent-soft'); g.strokeStyle = cssVar('--accent'); g.lineWidth = 2 * dpr;
    g.beginPath(); g.rect(-pw / 2, -ph / 2, pw, ph); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(0, 0); g.lineTo(pw / 2, 0); g.stroke();
    g.fillStyle = cssVar('--accent');
    g.beginPath(); g.arc(0, 0, 3 * dpr, 0, Math.PI * 2); g.fill();
    g.restore();

    // the lever arm and the point of application
    const at = [body.x[0] + r[0], body.x[1] + r[1]];
    g.save();
    g.strokeStyle = cssVar('--fg'); g.lineWidth = 2.5 * dpr;
    g.beginPath(); g.moveTo(view.X(body.x[0]), view.Y(body.x[1])); g.lineTo(view.X(at[0]), view.Y(at[1])); g.stroke();
    g.fillStyle = cssVar('--fg');
    g.beginPath(); g.arc(view.X(at[0]), view.Y(at[1]), 5 * dpr, 0, Math.PI * 2); g.fill();
    g.restore();
    drawText(g, view, `r, d = ${fmt(lever, 2)}`, (body.x[0] + at[0]) / 2, (body.x[1] + at[1]) / 2, { color: cssVar('--fg'), size: 10, dx: 6, dy: -6 });

    for (const f of list) drawForceArrow(g, view, at, f.F, scale, { color: FORCE_COLOR[f.type], label: f.label });
    drawForceArrow(g, view, at, sum, scale, { color: SUM_COLOR, width: 4, head: 11, label: 'ΣF' });

    // the torque as an arc at the center: counter-clockwise for T > 0
    if (Math.abs(T) > 1e-6) {
      const R = 0.55 * view.sx, cx = view.X(body.x[0]), cy = view.Y(body.x[1]);
      const sweep = Math.min(Math.PI * 1.5, 0.4 + Math.abs(alpha) * 0.15);
      g.save();
      g.strokeStyle = g.fillStyle = cssVar('--unstable'); g.lineWidth = 2.5 * dpr;
      g.beginPath(); g.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + (T > 0 ? -sweep : sweep), T > 0); g.stroke();
      const end = -Math.PI / 2 + (T > 0 ? -sweep : sweep);
      const ex = cx + R * Math.cos(end), ey = cy + R * Math.sin(end);
      const tangent = end + (T > 0 ? -Math.PI / 2 : Math.PI / 2);
      const hd = 8 * dpr;
      g.beginPath(); g.moveTo(ex, ey);
      g.lineTo(ex - hd * Math.cos(tangent - 0.4), ey - hd * Math.sin(tangent - 0.4));
      g.lineTo(ex - hd * Math.cos(tangent + 0.4), ey - hd * Math.sin(tangent + 0.4));
      g.closePath(); g.fill();
      g.restore();
      drawText(g, view, 'T', body.x[0], body.x[1] + 0.55, { color: cssVar('--unstable'), size: 12, align: 'center', dx: T > 0 ? -14 : 14, dy: -6 });
    }

    out.set([
      `ΣT = r × ΣF = ${fmt(T, 3)}   I = m(w²+h²)/12 = ${fmt(I, 3)}   θ″ = ${fmt(alpha, 3)} rad/s²\n`,
      `θ = ${fmt(theta, 3)} rad   θ′ = ${fmt(omega, 3)} rad/s   t = ${fmt(t, 2)} s${running ? '   running' : ''}\n`,
      el('span', { class: 'label' }, `ΣF = (${fmt(sum[0], 2)}, ${fmt(sum[1], 2)}) no matter where the forces act; ΣT flips when the lever arm crosses zero`),
    ]);
  });

  // ---- integrate θ: one explicit Euler step of the tuple's h ----
  function step() {
    const h = store.get().h;
    const { alpha } = torque();
    theta += h * omega;
    omega += h * alpha;
    t += h;
  }
  const offFrame = loop.onFrame(dt => {
    if (!running) return;
    carry += dt;
    const h = store.get().h;
    let n = Math.min(Math.floor(carry / h), 200);
    carry -= n * h;
    while (n-- > 0) step();
    stage.invalidate();
  });

  const runBtn = el('button', { class: 'btn', type: 'button', 'aria-pressed': 'false' }, 'Run');
  runBtn.addEventListener('click', () => { running = !running; carry = 0; runBtn.setAttribute('aria-pressed', String(running)); runBtn.textContent = running ? 'Pause' : 'Run'; stage.invalidate(); }, { signal });
  const stepBtn = el('button', { class: 'btn', type: 'button' }, 'Step');
  stepBtn.addEventListener('click', () => { step(); stage.invalidate(); }, { signal });
  const resetBtn = el('button', { class: 'btn', type: 'button' }, 'Reset');
  resetBtn.addEventListener('click', () => { theta = 0; omega = 0; t = 0; stage.invalidate(); }, { signal });

  root.append(controls(row(
    localSlider({ label: 'lever arm d', min: -0.8, max: 0.8, value: lever, format: v => fmt(v, 2), onInput: v => { lever = v; stage.invalidate(); }, signal }),
    el('div', { class: 'transport' }, el('div', { class: 'transport-group' }, runBtn, stepBtn, resetBtn)),
  )));
  root.append(out.el);

  const unsub = scene.subscribe(stage.invalidate, { immediate: false });
  return {
    pause() { running = false; runBtn.setAttribute('aria-pressed', 'false'); runBtn.textContent = 'Run'; },
    destroy() { offFrame(); unsub(); },
  };
}
