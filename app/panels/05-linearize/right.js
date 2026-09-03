// Panel 5, right: the Taylor expansion of 1/r² about the gravity force's operating distance
// r₀, every term count in the sweep drawn at once against the true curve, with the term-count
// strip under the graph selecting which one is highlighted (aux.highlight, so the choice
// survives a remount). r₀ and the mass's distance come from the scene the spine sets up.
//
// Under the strip, the series itself: the same expansion the prose writes symbolically,
// spelled out with r₀'s actual coefficients to exactly as many terms as the strip has
// selected — the strip picks the highlighted curve above and how far this equation runs.

import { el, fmt, fragment } from 'shared/dom.js';
import { createStage } from 'shared/gfx/stage.js';
import { drawBundle } from 'shared/gfx/bundle.js';
import { cssVar, makeView, drawGrid, drawPolyline, drawText } from 'shared/gfx/plot2d.js';
import { inverseSquareExpansion } from 'shared/math/taylor.js';
import { sweep, sweepKey } from 'shared/math/sweep.js';
import { scene } from 'shared/scene.js';
import { aux } from 'shared/aux.js';
import { sweepStrip } from 'shared/ui/sweep.js';

const TERMS = [0, 1, 2, 3, 4, 5, 6];   // degrees kept; 0 is the constant m g keeps
const CURVE = 240;

const highlightIndex = () => Math.min(TERMS.length - 1, Math.max(0, aux.get().highlight < 0 ? 1 : aux.get().highlight));

/** What keeping this many terms buys, in one line under the curve. */
const verdict = hi => (hi === 0 ? 'a constant: m g' : hi === 1 ? 'linear in δ: all a linear model keeps' : 'past δ¹: what linearizing drops');

/**
 * 1/r² ≈ [coefficients[0]] − [|coefficients[1]|]δ + … to degree n, r₀'s actual numbers, one
 * term per row of an mtable: as more terms are kept this grows by exactly one row each, down
 * the page, instead of the browser wrapping one long inline formula wherever it happens to
 * run out of width. Column 1 (right-aligned) carries the "1/r² ≈" head on the first row and
 * is blank after; column 2 (left-aligned) is the term, so every term's own start lines up.
 */
function seriesMathML(r0, n) {
  const { coefficients } = inverseSquareExpansion(r0, n);
  const head = '<mfrac><mn>1</mn><msup><mi>r</mi><mn>2</mn></msup></mfrac><mo>≈</mo>';
  const rows = coefficients.map((c, i) => {
    const mag = `<mn>${fmt(Math.abs(c), 3)}</mn>`;
    const delta = i === 0 ? '' : i === 1 ? '<mi>δ</mi>' : `<msup><mi>δ</mi><mn>${i}</mn></msup>`;
    const term = i === 0 ? mag : `<mo>${c < 0 ? '−' : '+'}</mo>${mag}${delta}`;
    return `<mtr><mtd>${i === 0 ? head : ''}</mtd><mtd>${term}</mtd></mtr>`;
  }).join('');
  return `<math display="block"><mtable columnalign="right left" rowspacing="0.3em">${rows}</mtable></math>`;
}

export function mount(root, ctx) {
  const { signal } = ctx;
  const gi = scene.forceIndex('gravity');

  const taylor = createStage(root, { layers: ['plot'], aspect: 'square', signal });
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
    drawText(g, view, verdict(hi), view.xMin, view.yMin, { color: cssVar('--muted'), size: 11, dx: 8, dy: -10 });
  });

  const strip = sweepStrip({
    values: TERMS, label: 'terms kept', format: n => `${n + 1} term${n ? 's' : ''}`, signal, initial: highlightIndex(),
    onSelect: i => aux.set({ highlight: i }),
  });
  root.append(el('div', { class: 'controls' }, strip.el));

  // the series itself, under the strip: rebuilt (not just re-numbered) on every change,
  // since the number of terms — not just their values — is what the strip is choosing
  const seriesEl = el('div');
  root.append(seriesEl);
  function renderSeries() {
    seriesEl.replaceChildren(fragment(seriesMathML(scene.get().forces[gi].r, highlightIndex())));
  }
  renderSeries();

  const unsub = scene.subscribe(() => { renderSeries(); taylor.invalidate(); }, { immediate: false });
  const unsubAux = aux.subscribe((s, patch) => {
    if (!('highlight' in patch)) return;
    strip.select(highlightIndex(), { notify: false });
    renderSeries();
    taylor.invalidate();
  }, { immediate: false });
  return { destroy() { unsub(); unsubAux(); } };
}
