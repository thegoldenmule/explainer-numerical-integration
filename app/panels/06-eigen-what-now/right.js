// Panel 6, right: explode the eigenvector. One transformation is swept across a range and
// the eigenvectors of every value are drawn at once as a bundle of directions; the sweep
// strip highlights one (aux.highlight) and dims the rest. The rotation sweep is
// M(θ) = R(θ) · S(3, 1), the case matrix2's test pins: its two real directions lean toward
// each other and vanish at cos θ* = 2√(ab) / (a + b), which is 30°, where the eigenvalues go
// complex. The scale sweep, M(s) = S(s, 0.5), is the dull one: the directions never move.

import { el, fmt } from 'shared/dom.js';
import { createStage } from 'shared/gfx/stage.js';
import { drawBundle } from 'shared/gfx/bundle.js';
import { cssVar, makeView, drawGrid, drawTransformedGrid, drawArrow, drawText } from 'shared/gfx/plot2d.js';
import { rotation, scale, mmul, eigen, apply } from 'shared/math/matrix2.js';
import { sweep, sweepRange, sweepKey } from 'shared/math/sweep.js';
import { aux } from 'shared/aux.js';
import { readout, controls } from 'shared/ui/controls.js';
import { sweepStrip } from 'shared/ui/sweep.js';

const HALF_W = 2.4;
const COUNT = 12;   // one per tick; drawBundle draws at most 12 series per call
const A = 3, B = 1; // the anisotropic stretch under the rotation sweep
const CRITICAL = Math.acos(2 * Math.sqrt(A * B) / (A + B));   // where the rotation sweep goes complex

const SWEEPS = {
  rotation: {
    label: 'rotation angle θ of M(θ) = R(θ) · S(3, 1)',
    values: sweepRange(0, 44, COUNT),              // degrees; 30° falls between two ticks
    matrix: th => mmul(rotation(th * Math.PI / 180), scale(A, B)),
    format: v => `θ = ${fmt(v, 0)}°`,
  },
  scale: {
    label: 'scale s of M(s) = S(s, 0.5)',
    values: sweepRange(0.25, 3, COUNT),
    matrix: s => scale(s, 0.5),
    format: v => `s = ${fmt(v, 2)}`,
  },
};

const highlightIndex = () => Math.min(COUNT - 1, Math.max(0, aux.get().highlight < 0 ? 0 : aux.get().highlight));
const fmtLam = ([re, im]) => (Math.abs(im) < 1e-12 ? fmt(re, 3) : `${fmt(re, 3)} ${im >= 0 ? '+' : '−'} ${fmt(Math.abs(im), 3)}i`);

export function mount(root, ctx) {
  const { signal } = ctx;
  let kind = 'rotation';

  const stage = createStage(root, { layers: ['plane'], aspect: 'wide', signal });
  const out = readout({ label: 'highlighted value' });

  const results = () => {
    const sw = SWEEPS[kind];
    return sweep(sw.values, v => { const M = sw.matrix(v); return { M, e: eigen(M) }; }, { key: sweepKey({ panel: '6-right', kind }) });
  };

  stage.onDraw(({ w, h, dpr }) => {
    const sw = SWEEPS[kind];
    const rs = results();
    const hi = highlightIndex();
    const g = stage.ctx('plane');
    const view = makeView({ w, h, dpr, halfW: HALF_W });
    g.clearRect(0, 0, w, h);
    drawGrid(g, view, { xLabel: 'x', yLabel: 'y' });
    drawTransformedGrid(g, view, rs[hi].result.M, { spacing: 0.5, extent: 10, color: cssVar('--accent'), alpha: 0.22, axes: false });

    // one bundle per eigenvector: a line through the origin per sweep value (empty once complex)
    const L = 1.5 * HALF_W;
    const series = [0, 1].map(j => rs.map(({ result }) => {
      const u = result.e.vectors?.[j];
      return u ? { xs: [-L * u[0], L * u[0]], ys: [-L * u[1], L * u[1]] } : { xs: [], ys: [] };
    }));
    drawBundle(g, view, series[0], { highlight: hi, color: cssVar('--exact'), width: 2.5, dimWidth: 1, dimAlpha: 0.3 });
    drawBundle(g, view, series[1], { highlight: hi, color: cssVar('--approx'), width: 2.5, dimWidth: 1, dimAlpha: 0.3 });

    // the highlighted value's eigenvectors as arrows scaled by their eigenvalues
    const { M, e } = rs[hi].result;
    if (e.vectors) {
      e.vectors.forEach((u, j) => {
        const img = apply(M, u);
        drawArrow(g, view, 0, 0, img[0], img[1], { color: cssVar(j === 0 ? '--exact' : '--approx'), width: 2.5, head: 8 });
        drawText(g, view, `λ${j + 1} = ${fmt(e.values[j][0], 2)}`, img[0], img[1], { color: cssVar(j === 0 ? '--exact' : '--approx'), size: 11, dx: 6, dy: j === 0 ? -6 : 14 });
      });
    } else {
      drawText(g, view, 'no real eigenvector: every direction turns', 0, -0.8 * HALF_W * h / w, { color: cssVar('--unstable'), size: 12, align: 'center' });
    }

    const v = rs[hi].value;
    const lines = [`${sw.format(v)}:  M = [[${fmt(M[0][0], 2)}, ${fmt(M[0][1], 2)}], [${fmt(M[1][0], 2)}, ${fmt(M[1][1], 2)}]]   λ = ${e.values.map(fmtLam).join(', ')}`];
    if (e.vectors) {
      const dot = Math.abs(e.vectors[0][0] * e.vectors[1][0] + e.vectors[0][1] * e.vectors[1][1]);
      lines.push(`\nreal: two invariant directions, ${fmt(Math.acos(Math.min(1, dot)) * 180 / Math.PI, 1)}° apart`);
    } else {
      lines.push('\n', el('span', { class: 'unstable' }, 'complex'), ': the directions met and vanished; |λ| is still a scale, arg λ a turn per application');
    }
    lines.push('\n', el('span', { class: 'label' }, kind === 'rotation'
      ? `the real eigenvectors converge and vanish at θ* = arccos(2√(ab) / (a + b)) = ${fmt(CRITICAL * 180 / Math.PI, 1)}° for a = ${A}, b = ${B}`
      : 'along a scale sweep the directions stay put on the axes; only λ₁ = s changes'));
    out.set(lines);
  });

  // ---- the strip (rebuilt when the sweep changes) and the kind switch ----
  const box = el('div');
  let strip = null;
  function buildStrip() {
    const sw = SWEEPS[kind];
    const next = sweepStrip({ values: sw.values, label: sw.label, format: sw.format, signal, initial: highlightIndex(), onSelect: i => aux.set({ highlight: i }) });
    strip ? strip.el.replaceWith(next.el) : box.append(next.el);
    strip = next;
  }
  buildStrip();
  const buttons = Object.keys(SWEEPS).map(k => el('button', { class: 'btn', type: 'button', 'aria-pressed': String(k === kind) }, `${k} sweep`));
  buttons.forEach((btn, i) => btn.addEventListener('click', () => {
    kind = Object.keys(SWEEPS)[i];
    buttons.forEach((b, j) => b.setAttribute('aria-pressed', String(j === i)));
    buildStrip();
    stage.invalidate();
  }, { signal }));

  root.append(controls(el('div', { class: 'controls-row' }, ...buttons), box));
  root.append(out.el);

  const unsubAux = aux.subscribe((s, patch) => {
    if ('highlight' in patch) { strip.select(highlightIndex(), { notify: false }); stage.invalidate(); }
  }, { immediate: false });
  return { destroy() { unsubAux(); } };
}
