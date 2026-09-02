// Panel 6, spine: the spring's 2×2 system matrix acting on a grid, a draggable vector drawn
// before and after, and the invariant directions that light up when the vector lands on
// one, with the eigenvalue as the scale factor.
//
// At the demo defaults A = [[0, 1], [−k/m, −c/m]] = [[0, 1], [−100, −c]]: a unit vector's
// image is a hundred units long and no single view holds both. So the grid is drawn in the
// spring's natural units, (x, v/ω) per 1/ω seconds, where the same matrix reads
// Â = [[0, 1], [−1, −2ζ]] with ζ = c / 2√(mk). Â is similar to A (a diagonal change of
// units), so its eigenvectors are A's in those units and its eigenvalues are λ/ω; the
// readout prints both.
//
// Per idea.md the panel wants an overdamped case to show real invariant directions, but the
// tuple's own c is the demo's lightly-damped 0.1 and this panel must never write the tuple
// (that write used to leak into every later panel — see the c slider on panels 7-13 landing
// on an overdamped spring after a reader passed through here). So damping here is entirely
// local to this pane: a `c` that defaults to an overdamped multiple of critical, recomputed
// only when the tuple's m or k change, and otherwise left alone — including while the reader
// drags it down through critical to watch the two directions converge and vanish.

import { el, fmt } from 'shared/dom.js';
import { createStage } from 'shared/gfx/stage.js';
import { createDragHandles } from 'shared/gfx/drag.js';
import { cssVar, makeView, drawGrid, drawTransformedGrid, drawArrow, drawPolyline, drawText, drawPoint } from 'shared/gfx/plot2d.js';
import { systemMatrix, regime, naturalFrequency, dampingRatio } from 'shared/math/system.js';
import { eigen, apply } from 'shared/math/matrix2.js';
import { readout, controls, row } from 'shared/ui/controls.js';

const HALF_W = 2.6;
const NEAR_DEG = 4;        // within this angle of an eigenvector, it lights up
const PRESET_FACTOR = 1.5; // this pane's own default: c = PRESET_FACTOR · 2√(mk), overdamped

const deg = rad => rad * 180 / Math.PI;
const angleBetweenLines = (u, v) => {
  const d = Math.abs(u[0] * v[0] + u[1] * v[1]) / (Math.hypot(u[0], u[1]) * Math.hypot(v[0], v[1]) || 1);
  return deg(Math.acos(Math.min(1, d)));
};
const fmtM = M => `[[${fmt(M[0][0], 2)}, ${fmt(M[0][1], 2)}], [${fmt(M[1][0], 2)}, ${fmt(M[1][1], 2)}]]`;

/** A local slider for a number that lives outside the tuple (this pane's own damping). */
function localSlider({ label, min, max, value, format = v => String(v), onInput, signal }) {
  const input = el('input', { type: 'range', min, max, step: 'any', value });
  const out = el('output', {}, format(value));
  input.addEventListener('input', () => { out.textContent = format(Number(input.value)); onInput(Number(input.value)); }, { signal });
  const node = el('label', { class: 'control' }, el('span', { class: 'control-label' }, el('span', {}, label), out), input);
  node.setValue = v => { input.value = v; out.textContent = format(v); };
  node.setMax = v => { input.max = v; };
  return node;
}

export function mount(root, ctx) {
  const { store, signal } = ctx;
  let vec = [1.2, 0.9];     // the dragged vector, in (x, v/ω) units
  let view = null;

  // This pane's own damping (never written to the tuple). Seeded from the tuple's current
  // m, k; recomputed only when either changes, otherwise preserved while the pane stays
  // mounted (dragging the slider below critical must not get overwritten on the next frame).
  const s0 = store.get();
  let mkKey = `${s0.m}/${s0.k}`;
  let localC = PRESET_FACTOR * 2 * Math.sqrt(s0.m * s0.k);
  let cCtl = null;

  function ensureLocalC(s) {
    const key = `${s.m}/${s.k}`;
    if (key === mkKey) return;
    mkKey = key;
    const critical = 2 * Math.sqrt(s.m * s.k);
    localC = PRESET_FACTOR * critical;
    cCtl?.setMax(Math.max(50, 3 * critical));
    cCtl?.setValue(localC);
  }

  /** The dimensionless matrix and its decomposition for the current tuple (m, k) and this
   *  pane's own local c. */
  function matrices(s) {
    ensureLocalC(s);
    const zeta = dampingRatio(s.m, localC, s.k);
    const omega = naturalFrequency(s.m, s.k);
    const Ahat = [[0, 1], [-1, -2 * zeta]];
    return { A: systemMatrix(s.m, localC, s.k), Ahat, zeta, omega, e: eigen(Ahat), regime: regime(s.m, localC, s.k) };
  }

  const stage = createStage(root, { layers: ['plane'], aspect: 'wide', signal });
  const out = readout({ label: 'Â v = λ v ?' });

  stage.onDraw(({ w, h, dpr }) => {
    const s = store.get();
    const { A, Ahat, zeta, omega, e, regime: r } = matrices(s);
    const g = stage.ctx('plane');
    view = makeView({ w, h, dpr, halfW: HALF_W });
    g.clearRect(0, 0, w, h);
    drawGrid(g, view, { xLabel: 'x', yLabel: 'v / ω', ticks: 6 });
    drawTransformedGrid(g, view, Ahat, { spacing: 1, extent: 8, color: cssVar('--accent'), alpha: 0.2, axes: false });

    // the invariant directions (real eigenvectors), lit when the dragged vector lands on one
    const L = 3 * HALF_W;
    let landed = -1;
    if (e.real && e.vectors) {
      e.vectors.forEach((u, i) => {
        const near = angleBetweenLines(u, vec) <= NEAR_DEG;
        if (near && landed < 0) landed = i;
        drawPolyline(g, view, [-L * u[0], L * u[0]], [-L * u[1], L * u[1]], {
          color: cssVar('--stable'), width: near ? 3 : 1.25, alpha: near ? 1 : 0.55, dash: near ? null : [6, 5],
        });
        const lx = u[0] * 0.55 * HALF_W, ly = u[1] * 0.55 * HALF_W;
        drawText(g, view, `λ̂ = ${fmt(e.values[i][0], 2)}`, lx, ly, { color: cssVar('--stable'), size: 11, dx: 6, dy: -6 });
      });
    }

    // the vector and its image
    const img = apply(Ahat, vec);
    drawArrow(g, view, 0, 0, vec[0], vec[1], { color: cssVar('--fg'), width: 2.5, head: 9 });
    drawArrow(g, view, 0, 0, img[0], img[1], { color: cssVar('--approx'), width: 2.5, head: 9 });
    drawText(g, view, 'v (drag)', vec[0], vec[1], { color: cssVar('--fg'), size: 11, dx: 8, dy: -6 });
    drawText(g, view, 'Â v', img[0], img[1], { color: cssVar('--approx'), size: 11, dx: 8, dy: 14 });
    drawPoint(g, view, vec[0], vec[1], { r: 5, fill: cssVar('--fg') });

    // readout
    const ratio = Math.hypot(img[0], img[1]) / (Math.hypot(vec[0], vec[1]) || 1);
    const turn = deg(Math.atan2(img[1], img[0]) - Math.atan2(vec[1], vec[0]));
    const turnNorm = ((turn + 540) % 360) - 180;
    const lines = [];
    if (landed >= 0) {
      const lam = e.values[landed][0];
      lines.push(el('span', { class: 'stable' }, `invariant direction: Â v = ${fmt(lam, 3)} v`), `  (drawn |Âv| / |v| = ${fmt(ratio, 3)}, turned ${fmt(Math.abs(turnNorm) < 90 ? turnNorm : turnNorm - Math.sign(turnNorm) * 180, 1)}°)\n`);
    } else if (e.real) {
      lines.push(`|Âv| / |v| = ${fmt(ratio, 3)}, turned ${fmt(turnNorm, 1)}°: not invariant; two directions are (dashed)\n`);
    } else {
      lines.push(el('span', { class: 'unstable' }, 'no real invariant direction'), `: every v turns (this one by ${fmt(turnNorm, 1)}°); λ̂ = ${fmt(e.values[0][0], 3)} ± ${fmt(Math.abs(e.values[0][1]), 3)}i has gone complex\n`);
    }
    const lam = e.values.map(v => (e.real ? fmt(v[0], 3) : `${fmt(v[0], 3)} ${v[1] >= 0 ? '+' : '−'} ${fmt(Math.abs(v[1]), 3)}i`));
    lines.push(`${r === 'critical' ? 'critically damped' : r}: ζ = ${fmt(zeta, 3)}, this pane’s own c = ${fmt(localC, 2)} vs 2√(mk) = ${fmt(2 * Math.sqrt(s.m * s.k), 2)} (the spring’s actual c = ${fmt(s.c, 2)}, untouched)   λ̂ = ${lam.join(', ')}  (λ = ω λ̂, ω = ${fmt(omega, 2)} /s)\n`);
    lines.push(el('span', { class: 'label' }, `drawn: Â = ${fmtM(Ahat)}, which is A = ${fmtM(A)} in units (x, v/ω) per 1/ω s; the damping above is this pane’s own, never written back to the spring’s c`));
    out.set(lines);
  });

  createDragHandles(stage.canvas('plane'), {
    signal, hitRadius: 14,
    handles: () => [{ id: 'v', x: vec[0], y: vec[1] }],
    view: () => view ?? makeView({ w: 1, h: 1, dpr: 1, halfW: HALF_W }),
    onMove: (id, p) => {
      const len = Math.hypot(p.x, p.y);
      if (len < 0.05) return;
      vec = [p.x, p.y];
      stage.invalidate();
    },
  });

  cCtl = localSlider({
    label: 'this pane’s own c (damping): lower it past 2√(mk)',
    min: 0, max: Math.max(50, 3 * 2 * Math.sqrt(s0.m * s0.k)), value: localC,
    format: v => fmt(v, 2),
    onInput: v => { localC = v; stage.invalidate(); },
    signal,
  });
  root.append(controls(row(cCtl)));
  root.append(out.el);

  const unsub = store.subscribe(stage.invalidate, { immediate: false });
  return { destroy() { unsub(); } };
}
