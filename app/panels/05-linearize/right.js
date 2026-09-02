// Panel 5, right: Taylor expansion of 1/r² about the gravity force's operating distance r₀,
// with a term-count sweep (aux.highlight) drawn against the true curve; then the payoff:
// the nonlinear simulation (RK4 through `simulate` with a custom accel from netForce in real
// mode, along the vertical axis where the attractor sits) next to the run of the linearized
// models, and the verdict the linearized M, C, K predict. The linear model drops gravity's
// gradient 2Gm₂/r₀³; when that beats the spring's k, the prediction says stable and the mass
// falls into the attractor.

import { el, fmt } from 'shared/dom.js';
import { createStage } from 'shared/gfx/stage.js';
import { drawBundle } from 'shared/gfx/bundle.js';
import { cssVar, makeView, drawGrid, drawPolyline, drawText } from 'shared/gfx/plot2d.js';
import { inverseSquareExpansion } from 'shared/math/taylor.js';
import { simulate } from 'shared/math/integrators.js';
import { netForce, assemble } from 'shared/math/forces.js';
import { stabilityReport } from 'shared/math/stability.js';
import { sweep, sweepKey } from 'shared/math/sweep.js';
import { scene } from 'shared/scene.js';
import { aux } from 'shared/aux.js';
import { slider, readout, controls, row } from 'shared/ui/controls.js';
import { sweepStrip } from 'shared/ui/sweep.js';

const TERMS = [0, 1, 2, 3, 4, 5, 6];   // degrees kept; 0 is the constant m g keeps
const SPAN = 6;                        // seconds simulated
const CURVE = 240;

const highlightIndex = () => Math.min(TERMS.length - 1, Math.max(0, aux.get().highlight < 0 ? 1 : aux.get().highlight));

/** A local slider with a set() so it can follow a value that other panes also move. */
function localSlider({ label, min, max, value, format = v => String(v), onInput, signal }) {
  const input = el('input', { type: 'range', min, max, step: 'any', value });
  const out = el('output', {}, format(value));
  input.addEventListener('input', () => { out.textContent = format(Number(input.value)); onInput(Number(input.value)); }, { signal });
  const node = el('label', { class: 'control' }, el('span', { class: 'control-label' }, el('span', {}, label), out), input);
  return { el: node, set(v) { input.value = v; out.textContent = format(v); } };
}

export function mount(root, ctx) {
  const { store, signal } = ctx;
  const gi = scene.forceIndex('gravity'), si = scene.forceIndex('spring');

  // ---- the expansion beside its term-count strip ----
  const top = el('div', { class: 'viz-row' });
  root.append(top);
  const taylor = createStage(top, { layers: ['plot'], aspect: 'half', signal });
  const taylorOut = readout();
  taylor.onDraw(({ w, h, dpr }) => {
    const r0 = scene.get().forces[gi].r;
    const hi = highlightIndex();
    const g = taylor.ctx('plot');
    const yMax = 3.2 / (r0 * r0);
    const view = makeView({ w, h, dpr, xMin: 0.3 * r0, xMax: 2 * r0, yMin: -0.25 * yMax, yMax });
    g.clearRect(0, 0, w, h);
    drawGrid(g, view, { xLabel: 'r', yLabel: '1 / r²', ticks: 4 });
    const rs = [], truth = [];
    for (let i = 0; i <= CURVE; i++) { const r = view.xMin + (view.xMax - view.xMin) * i / CURVE; rs.push(r); truth.push(1 / (r * r)); }
    const series = sweep(TERMS, n => { const e = inverseSquareExpansion(r0, n); return rs.map(r => e.evaluate(r)); }, { key: sweepKey({ panel: '5-right', r0 }) })
      .map(({ result }) => ({ xs: rs, ys: result }));
    drawBundle(g, view, series, { highlight: hi, color: cssVar('--approx'), width: 2.25, dimWidth: 1, dimAlpha: 0.25 });
    drawPolyline(g, view, rs, truth, { color: cssVar('--exact'), width: 2 });
    drawPolyline(g, view, [r0, r0], [view.yMin, view.yMax], { color: cssVar('--muted'), width: 1, dash: [4, 4] });
    const dist = r0 + scene.get().body.x[1];
    drawPolyline(g, view, [dist, dist], [view.yMin, view.yMax], { color: cssVar('--fg'), width: 1.5, dash: [2, 3] });
    drawText(g, view, 'r₀', r0, view.yMax, { color: cssVar('--muted'), size: 11, dx: 4, dy: 14 });
    drawText(g, view, 'the mass', dist, view.yMax, { color: cssVar('--fg'), size: 11, dx: 4, dy: 28 });
    const e = inverseSquareExpansion(r0, TERMS[hi]);
    taylorOut.set([
      `${TERMS[hi] + 1} term${hi ? 's' : ''}, r₀ = ${fmt(r0, 1)}\nat the mass r = ${fmt(dist, 2)}:\n${fmt(e.evaluate(dist), 4)} vs true ${fmt(1 / (dist * dist), 4)}\n`,
      el('span', { class: 'label' }, hi === 0 ? 'a constant: m g' : hi === 1 ? 'linear in δ: all a linear model keeps' : 'past δ¹: what linearizing drops'),
    ]);
  });
  const strip = sweepStrip({
    values: TERMS, label: 'terms kept', format: n => `${n + 1} term${n ? 's' : ''}`, signal, initial: highlightIndex(),
    onSelect: i => aux.set({ highlight: i }),
  });
  top.append(el('div', { class: 'controls' }, strip.el, taylorOut.el));

  // ---- the payoff: the nonlinear run beside the linearized one and its verdict ----
  const run = createStage(root, { layers: ['plot'], aspect: 'strip', signal });
  const out = readout();
  const runs = () => {
    const s = scene.get();
    const { M, C, K } = assemble(s);
    const y0 = s.body.x[1], vy0 = s.body.v[1], h = store.get().h;
    const accel = linear => (y, vy) => netForce({ body: { m: s.body.m, x: [0, y], v: [0, vy] }, forces: s.forces }, { linear })[1] / s.body.m;
    const key = sweepKey({ panel: '5-right-run', forces: s.forces, m: s.body.m, y0, vy0, h });
    const [real, lin] = sweep([false, true], linear => simulate({ method: 'rk4', h, m: M, c: C, k: K, x0: y0, v0: vy0, accel: accel(linear) }, SPAN), { key }).map(r => r.result);
    return { s, M, C, K, y0, real, lin, report: stabilityReport('rk4', { m: M, c: C, k: K, h }) };
  };
  run.onDraw(({ w, h, dpr }) => {
    const { s, M, C, K, y0, real, lin, report } = runs();
    const r0 = s.forces[gi].r;
    const g = run.ctx('plot');
    let amp = Math.max(0.2, Math.abs(y0));
    for (let i = 0; i < lin.n; i++) if (Number.isFinite(lin.x[i])) amp = Math.max(amp, Math.abs(lin.x[i]));
    const yMax = 1.3 * amp;
    const view = makeView({ w, h, dpr, xMin: 0, xMax: SPAN, yMin: -Math.max(yMax, Math.min(r0 * 1.1, 4 * yMax)), yMax });
    g.clearRect(0, 0, w, h);
    drawGrid(g, view, { xLabel: 't', yLabel: 'y', ticks: 4 });
    if (r0 < -view.yMin) {
      drawPolyline(g, view, [0, SPAN], [-r0, -r0], { color: cssVar('--unstable'), width: 1, dash: [4, 4] });
      drawText(g, view, 'the attractor, y = −r₀', SPAN, -r0, { color: cssVar('--unstable'), size: 10, align: 'right', dx: -6, dy: -4 });
    }
    // the run's verdict: bounded, or through the attractor / off the chart; past the
    // attractor 1/dist² is a singularity, so the drawn run stops there
    let maxReal = 0, fell = -1, finite = true, n = real.n;
    for (let i = 0; i < real.n; i++) {
      const y = real.x[i];
      if (!Number.isFinite(y)) { finite = false; n = i; break; }
      maxReal = Math.max(maxReal, Math.abs(y));
      if (y <= -r0) { fell = real.t[i]; n = i + 1; break; }
    }
    drawPolyline(g, view, lin.t, lin.x, { color: cssVar('--exact'), width: 1.75, dash: [6, 4] });
    drawPolyline(g, view, real.t.subarray(0, n), real.x.subarray(0, n), { color: cssVar('--approx'), width: 2 });
    const grows = !finite || fell >= 0 || maxReal > 5 * amp;
    const lam = report.lambdas[0];
    const physical = report.lambdas.every(l => l[0] <= 0);
    const gradient = 2 * s.forces[gi].G * s.forces[gi].m2 / r0 ** 3;
    const k = s.forces[si].on ? s.forces[si].k : 0;
    out.set([
      `λ = ${fmt(lam[0], 3)}${lam[1] ? ` ± ${fmt(Math.abs(lam[1]), 2)}i` : `, ${fmt(report.lambdas[1][0], 3)}`} → `,
      el('span', { class: physical ? 'stable' : 'unstable' }, physical ? 'stable' : 'unstable'), `  (RK4 at h = ${fmt(store.get().h, 3)}: ρ = ${fmt(report.rho, 3)})\n`,
      `y₀ = ${fmt(y0, 2)}: `, grows ? el('span', { class: 'unstable' }, fell >= 0 ? `fell in at t = ${fmt(fell, 2)} s` : !finite ? 'blew up' : `grew to |y| = ${fmt(maxReal, 2)}`) : el('span', { class: 'stable' }, `bounded, |y| ≤ ${fmt(maxReal, 3)}`),
      grows && physical ? el('span', { class: 'unstable' }, ' ← predicted stable') : '', '\n',
      el('span', { class: 'label' }, `2Gm₂/r₀³ = ${fmt(gradient, 2)} (dropped) vs k = ${fmt(k, 1)}: ${gradient > k ? 'dropped term wins' : grows ? 'fine near r₀; y₀ is not near r₀' : 'harmless'}`),
    ]);
  });

  const y0Slider = localSlider({ label: 'y₀ (the mass)', min: -3, max: 1, value: scene.get().body.x[1], format: v => fmt(v, 2), signal,
    onInput: v => scene.moveBody(scene.get().body.x[0], v) });
  root.append(controls(row(
    slider(scene.paramStore(gi), 'r', { label: 'r₀', min: 0.5, max: 20, log: true, format: v => fmt(v, 2), signal }),
    slider(scene.paramStore(si), 'k', { label: 'k', min: 0.5, max: 200, log: true, format: v => fmt(v, 1), signal }),
    y0Slider.el,
  )));
  root.append(out.el);

  const invalidate = () => { taylor.invalidate(); run.invalidate(); };
  const unsub = scene.subscribe(s => { y0Slider.set(s.body.x[1]); invalidate(); }, { immediate: false });
  const unsubTuple = store.subscribe((t, patch) => { if ('h' in patch) run.invalidate(); }, { immediate: false });
  const unsubAux = aux.subscribe((s, patch) => { if ('highlight' in patch) { strip.select(highlightIndex(), { notify: false }); taylor.invalidate(); } }, { immediate: false });
  return { destroy() { unsub(); unsubTuple(); unsubAux(); } };
}
