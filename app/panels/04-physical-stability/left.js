// Panel 4, left: exactly two curves, the exact solution φ and one neighbor ψ, and their
// distance d(t) = |ψ − φ| as a single line that flattens or climbs. Step down from the
// spine's bundle: one neighbor, one number over time. The neighbor's start is a handle on
// the top strip (drag it up or down); its starting velocity offset is a local slider. Both
// offsets are local to this pane; the spine's ε only seeds the first one.

import { el, fmt } from 'shared/dom.js';
import { createStage } from 'shared/gfx/stage.js';
import { createDragHandles } from 'shared/gfx/drag.js';
import { cssVar, makeView, drawGrid, drawPolyline, drawPoint, drawText } from 'shared/gfx/plot2d.js';
import { exactSolution } from 'shared/math/system.js';
import { aux } from 'shared/aux.js';
import { slider, readout, controls, row } from 'shared/ui/controls.js';

const SPAN = 6;
const SAMPLES = 600;
const MAX_OFFSET = 1;

/** A local slider for a number that is not in any store. */
function localSlider({ label, min, max, value, format = v => String(v), onInput, signal }) {
  const input = el('input', { type: 'range', min, max, step: 'any', value });
  const out = el('output', {}, format(value));
  input.addEventListener('input', () => { out.textContent = format(Number(input.value)); onInput(Number(input.value)); }, { signal });
  return el('label', { class: 'control' }, el('span', { class: 'control-label' }, el('span', {}, label), out), input);
}

export function mount(root, ctx) {
  const { store, signal } = ctx;
  let dx = aux.get().epsilon, dv = 0;   // the neighbor's offsets in x₀ and v₀

  const curves = createStage(root, { layers: ['plot'], aspect: 'strip', signal, grab: true });
  const dist = createStage(root, { layers: ['plot'], aspect: 'strip', signal });
  const out = readout({ label: 'distance' });

  const ts = new Float64Array(SAMPLES + 1);
  for (let i = 0; i <= SAMPLES; i++) ts[i] = SPAN * i / SAMPLES;
  const phi = new Float64Array(SAMPLES + 1), psi = new Float64Array(SAMPLES + 1), d = new Float64Array(SAMPLES + 1);
  let stats = null;
  function compute() {
    const s = store.get();
    const a = exactSolution(s), b = exactSolution({ ...s, x0: s.x0 + dx, v0: s.v0 + dv });
    let amp = 0, maxD = 0, firstHalf = 0, secondHalf = 0;
    for (let i = 0; i <= SAMPLES; i++) {
      phi[i] = a.x(ts[i]); psi[i] = b.x(ts[i]); d[i] = Math.abs(psi[i] - phi[i]);
      amp = Math.max(amp, Math.abs(phi[i]), Math.abs(psi[i]));
      maxD = Math.max(maxD, d[i]);
      if (i <= SAMPLES / 2) firstHalf = Math.max(firstHalf, d[i]); else secondHalf = Math.max(secondHalf, d[i]);
    }
    stats = { amp, maxD, firstHalf, secondHalf, d0: d[0], dEnd: d[SAMPLES], s };
  }

  let view = null, frozenY = null;   // the top strip's view; its range is frozen while dragging
  curves.onDraw(({ w, h, dpr }) => {
    compute();
    const g = curves.ctx('plot');
    const yMax = frozenY ?? 1.2 * Math.max(stats.amp, 0.5);
    view = makeView({ w, h, dpr, xMin: 0, xMax: SPAN, yMin: -yMax, yMax });
    g.clearRect(0, 0, w, h);
    drawGrid(g, view, { xLabel: 't', yLabel: 'x' });
    drawPolyline(g, view, ts, phi, { color: cssVar('--exact'), width: 2 });
    drawPolyline(g, view, ts, psi, { color: cssVar('--approx'), width: 1.75 });
    drawPoint(g, view, 0, stats.s.x0, { r: 4, fill: cssVar('--exact') });
    drawPoint(g, view, 0, stats.s.x0 + dx, { r: 6, fill: cssVar('--approx') });
    drawText(g, view, 'φ exact', SPAN, stats.s.x0, { color: cssVar('--exact'), size: 11, align: 'right', dx: -6, dy: -6 });
    const nearTop = stats.s.x0 + dx > 0.8 * yMax;
    drawText(g, view, 'ψ neighbor (drag its start)', 0, stats.s.x0 + dx, { color: cssVar('--approx'), size: 11, dx: 12, dy: nearTop ? 16 : -8 });
    dist.invalidate();
  });

  dist.onDraw(({ w, h, dpr }) => {
    if (!stats) compute();
    const g = dist.ctx('plot');
    const yMax = 1.25 * Math.max(stats.maxD, 1e-4);
    const v = makeView({ w, h, dpr, xMin: 0, xMax: SPAN, yMin: 0, yMax });
    g.clearRect(0, 0, w, h);
    drawGrid(g, v, { xLabel: 't', yLabel: 'd(t) = |ψ − φ|' });
    drawPolyline(g, v, [0, SPAN], [stats.d0, stats.d0], { color: cssVar('--muted'), width: 1, dash: [4, 4], alpha: 0.7 });
    drawPolyline(g, v, ts, d, { color: cssVar('--accent'), width: 2 });
    drawText(g, v, `d(0) = ${fmt(stats.d0, 3)}`, SPAN, stats.d0, { color: cssVar('--muted'), size: 11, align: 'right', dx: -6, dy: -5 });

    const { s } = stats;
    const climbs = stats.secondHalf > stats.firstHalf * 1.001;
    const flat = !climbs && stats.secondHalf > 0.9 * stats.firstHalf;
    const word = climbs ? el('span', { class: 'unstable' }, 'climbs') : flat ? el('span', { class: 'stable' }, 'stays flat') : el('span', { class: 'stable' }, 'flattens');
    out.set([
      `d(0) = ${fmt(stats.d0, 4)}   max d = ${fmt(stats.maxD, 4)}   d(${SPAN}) = ${fmt(stats.dEnd, 4)}   the line `, word, '\n',
      el('span', { class: 'label' }, s.c > 0
        ? `c = ${fmt(s.c, 2)} > 0: the difference of two solutions is itself a solution, and it decays like e^(−ct/2m)`
        : 'c = 0: the difference oscillates with constant amplitude; close stays close, but never closer'),
    ]);
  });

  // ---- drag the neighbor's start ----
  const canvas = curves.canvas('plot');
  createDragHandles(canvas, {
    signal, hitRadius: 16,
    handles: () => [{ id: 'start', x: 0, y: store.get().x0 + dx }],
    view: () => view ?? makeView({ w: 1, h: 1, dpr: 1, xMin: 0, xMax: SPAN, yMin: -1, yMax: 1 }),
    onStart: () => { frozenY = view.yMax; },
    onMove: (id, p) => { dx = Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, p.y - store.get().x0)); curves.invalidate(); },
    onEnd: () => { frozenY = null; curves.invalidate(); },
  });

  root.append(controls(row(
    localSlider({ label: 'neighbor’s v₀ offset', min: -2, max: 2, value: dv, format: v => fmt(v, 2), onInput: v => { dv = v; curves.invalidate(); }, signal }),
    slider(store, 'c', { label: 'c (damping)', min: 0, max: 10, format: v => fmt(v, 2), signal }),
  )));
  root.append(out.el);

  const unsub = store.subscribe(curves.invalidate, { immediate: false });
  return { destroy() { unsub(); } };
}
