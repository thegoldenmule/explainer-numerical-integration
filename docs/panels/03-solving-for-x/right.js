// Panel 3, right: add a second independent variable. The point mass (an ODE: one number,
// x, over time) runs beside a vibrating string (a PDE: a whole shape u(x) over time),
// integrated locally with an explicit leapfrog scheme on a few dozen cells at a fixed
// internal step under the CFL bound. Poke the string to pluck it.

import { el, fmt } from 'shared/dom.js';
import { createStage } from 'shared/gfx/stage.js';
import { drawTrajectory } from 'shared/gfx/trajectory.js';
import { cssVar, makeView, drawGrid, drawPolyline, drawPoint, drawText } from 'shared/gfx/plot2d.js';
import { exactSolution } from 'shared/math/system.js';

const SPAN = 4;              // seconds of the mass's history shown
const CELLS = 64;            // string cells (interior unknowns per step)
const WAVE_SPEED = 1;        // in string lengths per second
const DT = 0.8 / (CELLS * WAVE_SPEED);   // CFL: c·dt/dx ≤ 1
const DAMPING = 0.02;        // per unit time, so a pluck settles
const PLUCK = 0.35;          // amplitude of a poke, in the plot's units
const TITLE = 15;            // graph titles: bigger and darker than drawGrid's own 11px labels,
                             // offset clear of the y-tick numbers at the strip's left edge

export function mount(root, ctx) {
  const { store, loop, signal } = ctx;

  // ---- the ODE: one number over time ----
  const massStage = createStage(root, { layers: ['plot'], aspect: 'strip', signal });
  let tau = 0;   // this pane's own clock (the store's t belongs to the players)
  let sol = null, solKey = '';
  const solution = state => {
    const key = `${state.m}/${state.c}/${state.k}/${state.x0}/${state.v0}`;
    if (key !== solKey) { solKey = key; sol = exactSolution(state); tau = 0; }
    return sol;
  };
  const N = 400;
  const T = new Float64Array(N + 1), X = new Float64Array(N + 1);
  massStage.onDraw(size => {
    const s = solution(store.get());
    const t0 = Math.max(0, tau - SPAN), t1 = Math.max(SPAN, tau);
    for (let i = 0; i <= N; i++) { T[i] = t0 + (t1 - t0) * i / N; X[i] = s.x(T[i]); }
    const g = massStage.ctx('plot');
    const view = drawTrajectory(g, size, { t: T, x: X }, { tMin: t0, tMax: t1, approx: cssVar('--exact'), yLabel: null });
    drawPoint(g, view, tau, s.x(tau), { r: 6, fill: cssVar('--exact') });
    drawText(g, view, 'ODE: one number, x(t)', view.xMin, view.yMax, { color: cssVar('--fg'), size: TITLE, align: 'left', dx: 34, dy: 19 });
    drawText(g, view, `x = ${fmt(s.x(tau), 3)}`, view.xMax, view.yMax, { color: cssVar('--exact'), size: 13, align: 'right', dx: -8, dy: 19 });
  });

  // ---- the PDE: a shape over time ----
  const stringStage = createStage(root, { layers: ['plot'], aspect: 'strip', signal, grab: true });
  let u = new Float64Array(CELLS + 1), uPrev = new Float64Array(CELLS + 1), uNext = new Float64Array(CELLS + 1);
  let carry = 0, energy = 0, stringView = null;
  const r2 = (WAVE_SPEED * DT * CELLS) ** 2;   // (c dt / dx)²

  function stepString() {
    const damp = DAMPING * DT;
    for (let i = 1; i < CELLS; i++) {
      uNext[i] = 2 * u[i] - uPrev[i] + r2 * (u[i + 1] - 2 * u[i] + u[i - 1]) - damp * (u[i] - uPrev[i]);
    }
    uNext[0] = uNext[CELLS] = 0;
    [uPrev, u, uNext] = [u, uNext, uPrev];
  }
  function pluck(at) {
    const center = Math.round(Math.min(1, Math.max(0, at)) * CELLS);
    for (let i = 1; i < CELLS; i++) {
      const d = (i - center) / (0.08 * CELLS);
      const bump = PLUCK * Math.exp(-d * d);
      u[i] += bump; uPrev[i] += bump;    // displace without adding velocity
    }
  }
  function resetString() { u.fill(0); uPrev.fill(0); }

  stringStage.onDraw(({ w, h, dpr }) => {
    const g = stringStage.ctx('plot');
    stringView = makeView({ w, h, dpr, xMin: 0, xMax: 1, yMin: -0.5, yMax: 0.5 });
    g.clearRect(0, 0, w, h);
    drawGrid(g, stringView, { xLabel: 'along the string', yLabel: null });
    const xs = new Float64Array(CELLS + 1);
    for (let i = 0; i <= CELLS; i++) xs[i] = i / CELLS;
    drawPolyline(g, stringView, xs, u, { color: cssVar('--approx'), width: 2 });
    drawText(g, stringView, 'PDE: a whole shape, u(x, t)', stringView.xMin, stringView.yMax, { color: cssVar('--fg'), size: TITLE, align: 'left', dx: 34, dy: 19 });
    energy = 0;
    for (let i = 0; i <= CELLS; i++) energy = Math.max(energy, Math.abs(u[i]));
    drawText(g, stringView, `${CELLS - 1} numbers, max |u| = ${fmt(energy, 3)}`, stringView.xMax, stringView.yMax, { color: cssVar('--approx'), size: 13, align: 'right', dx: -8, dy: 19 });
    if (energy < 1e-3) drawText(g, stringView, 'poke the string', 0.5, 0.15, { color: cssVar('--muted'), size: 13, align: 'center' });
  });

  const canvas = stringStage.canvas('plot');
  canvas.addEventListener('pointerdown', e => {
    if (!stringView || (e.button !== 0 && e.pointerType === 'mouse')) return;
    pluck(stringView.fromEvent(e, canvas).x);
    e.preventDefault();
  }, { signal });

  root.append(el('div', { class: 'controls-row' },
    el('button', { class: 'btn', type: 'button', onclick: () => { resetString(); stringStage.invalidate(); } }, 'Still the string'),
  ));

  // ---- one clock for both ----
  const offFrame = loop.onFrame(dt => {
    tau += dt;
    carry += dt;
    let n = Math.min(Math.floor(carry / DT), 200);   // bounded, never the frame's dt
    carry -= n * DT;
    while (n-- > 0) stepString();
    massStage.invalidate();
    stringStage.invalidate();
  });

  const unsub = store.subscribe(() => massStage.invalidate(), { immediate: false });
  return { destroy() { offFrame(); unsub(); } };
}
