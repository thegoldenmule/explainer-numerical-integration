// Panel 4, spine: the exact solution with an ε-tube around it and a handful of neighbors
// started nearby, all closed-form (no integrator exists yet). The perturbation size is
// aux.epsilon, so it survives a remount; c comes from the tuple. The neighbors start on a
// circle of radius ε in (x₀, v₀/ω), so each is exactly ε away at t = 0 and the tube is a
// fair test: with c > 0 they fall into it, with c = 0 they ride its edge forever. The
// linear spring with c ≥ 0 is never unstable, and the readout says so rather than faking it.

import { el, fmt } from 'shared/dom.js';
import { createStage } from 'shared/gfx/stage.js';
import { drawBundle } from 'shared/gfx/bundle.js';
import { cssVar, makeView, drawGrid, drawPolyline, drawBand } from 'shared/gfx/plot2d.js';
import { exactSolution, naturalFrequency } from 'shared/math/system.js';
import { aux } from 'shared/aux.js';
import { slider, readout, controls, row } from 'shared/ui/controls.js';

const SPAN = 6;         // seconds shown
const SAMPLES = 600;
const NEIGHBORS = 6;    // started at equal angles around the ε-circle

export function mount(root, ctx) {
  const { store, signal } = ctx;

  const stage = createStage(root, { layers: ['plot'], aspect: 'wide', signal });
  const out = readout({ label: 'verdict' });

  const ts = new Float64Array(SAMPLES + 1);
  for (let i = 0; i <= SAMPLES; i++) ts[i] = SPAN * i / SAMPLES;
  const sample = sol => { const xs = new Float64Array(SAMPLES + 1); for (let i = 0; i <= SAMPLES; i++) xs[i] = sol.x(ts[i]); return xs; };

  stage.onDraw(({ w, h, dpr }) => {
    const s = store.get();
    const eps = aux.get().epsilon;
    const omega = naturalFrequency(s.m, s.k);
    const exact = sample(exactSolution(s));
    const lo = new Float64Array(SAMPLES + 1), hi = new Float64Array(SAMPLES + 1);
    for (let i = 0; i <= SAMPLES; i++) { lo[i] = exact[i] - eps; hi[i] = exact[i] + eps; }

    // neighbors: (x₀ + ε cos φ, v₀ + ε ω sin φ); with k = 0 there is no ω, so perturb v by ε
    const series = [];
    let maxDist = 0, endDist = 0;
    for (let j = 0; j < NEIGHBORS; j++) {
      const phi = 2 * Math.PI * j / NEIGHBORS;
      const dx = eps * Math.cos(phi), dv = eps * (omega > 0 ? omega : 1) * Math.sin(phi);
      const xs = sample(exactSolution({ ...s, x0: s.x0 + dx, v0: s.v0 + dv }));
      for (let i = 0; i <= SAMPLES; i++) {
        const d = Math.abs(xs[i] - exact[i]);
        if (d > maxDist) maxDist = d;
        if (i === SAMPLES && d > endDist) endDist = d;
      }
      series.push({ xs: ts, ys: xs });
    }

    const g = stage.ctx('plot');
    let amp = 0;
    for (let i = 0; i <= SAMPLES; i++) amp = Math.max(amp, Math.abs(exact[i]));
    const yMax = 1.2 * Math.max(amp + eps, 0.5);
    const view = makeView({ w, h, dpr, xMin: 0, xMax: SPAN, yMin: -yMax, yMax });
    g.clearRect(0, 0, w, h);
    drawGrid(g, view, { xLabel: 't', yLabel: 'x' });
    drawBand(g, view, ts, lo, hi, { fill: cssVar('--exact'), alpha: 0.16 });
    drawBundle(g, view, series, { highlight: -1, color: cssVar('--approx'), dimAlpha: 0.65, dimWidth: 1.25 });
    drawPolyline(g, view, ts, exact, { color: cssVar('--exact'), width: 2 });

    const inside = endDist <= eps * 1.001;
    const verdict = s.c > 0
      ? [el('span', { class: 'stable' }, 'asymptotically stable'), `: the neighbors fall into the tube and keep converging`]
      : [el('span', { class: 'stable' }, 'stable'), `, but not asymptotically: with c = 0 nothing decays, so the neighbors ride the tube’s edge forever`];
    out.set([
      ...verdict, '\n',
      `ε = ${fmt(eps, 3)}   farthest any neighbor strays: ${fmt(maxDist, 4)}   at t = ${SPAN} s: ${fmt(endDist, 4)} (${inside ? 'inside' : 'outside'} the tube)\n`,
      el('span', { class: 'label' }, 'a linear spring with c ≥ 0 is never unstable; the slider stops at 0. Negative damping (an unstable case) is on the right pane.'),
    ]);
  });

  root.append(controls(row(
    slider(aux, 'epsilon', { label: 'ε (perturbation size)', log: true, format: v => fmt(v, 3), signal }),
    slider(store, 'c', { label: 'c (damping)', min: 0, max: 10, format: v => fmt(v, 2), signal }),
  )));
  root.append(out.el);

  const unsub = store.subscribe(stage.invalidate, { immediate: false });
  const unsubAux = aux.subscribe((s, patch) => { if ('epsilon' in patch) stage.invalidate(); }, { immediate: false });
  return { destroy() { unsub(); unsubAux(); } };
}
