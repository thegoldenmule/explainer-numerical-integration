// Panel 12, left: Taylor series, one term at a time. The partial sums S₀…Sₙ of e^x on the
// real axis against the exponential, the highest drawn bright and the rest dimmed, and the
// modulus of the degree-n sum at the current hλ next to the exact |e^{hλ}|. Euler is n = 1,
// RK4 is n = 4. The term count is the sweep strip's index, kept in aux.highlight so it
// survives a remount (the key is shared by every sweep, so it is clamped on read).
//
// The expansion itself prints below the strip, one term per row of an mtable (same pattern
// as panel 5 right's series): growing the term count adds exactly one row each time instead
// of one long inline formula the browser wraps wherever it runs out of width.

import { el, clamp, fragment } from 'shared/dom.js';
import { aux } from 'shared/aux.js';
import { sweepStrip } from 'shared/ui/sweep.js';
import { createStage } from 'shared/gfx/stage.js';
import { drawBundle } from 'shared/gfx/bundle.js';
import { cssVar, makeView, drawGrid, drawPolyline, drawText } from 'shared/gfx/plot2d.js';
import { bindMath } from 'shared/ui/livemath.js';
import { controls } from 'shared/ui/controls.js';
import { expPartialSums } from 'shared/math/taylor.js';
import { taylorAmplification } from 'shared/math/stability.js';
import { eigenvalues } from 'shared/math/system.js';
import { handleIndex } from 'shared/gfx/cplane.js';
import { cabs, cscale } from 'shared/math/complex.js';

const MAX_N = 8;
const DEFAULT_N = 4;   // RK4's degree, before any sweep has been touched (aux.highlight = −1)
const NS = Array.from({ length: MAX_N + 1 }, (_, i) => i);
const termsOf = h => (h < 0 ? DEFAULT_N : clamp(h, 0, MAX_N));
const X_MIN = -5, X_MAX = 2, Y_MIN = -6, Y_MAX = 8;
const SAMPLES = 400;

/** eᶻ = 1 + z + z²/2 + … to degree n, one term per row: growing n adds a row, never a wrap. */
function seriesMathML(n) {
  const rows = ['<mtr><mtd><msup><mi>e</mi><mi>z</mi></msup><mo>=</mo></mtd><mtd><mn>1</mn></mtd></mtr>'];
  let f = 1;
  for (let i = 1; i <= n; i++) {
    f *= i;
    const term = i === 1 ? '<mi>z</mi>' : `<mfrac><msup><mi>z</mi><mn>${i}</mn></msup><mn>${f}</mn></mfrac>`;
    rows.push(`<mtr><mtd></mtd><mtd><mo>+</mo>${term}</mtd></mtr>`);
  }
  return `<math display="block"><mtable columnalign="right left" rowspacing="0.3em">${rows.join('')}</mtable></math>`;
}

export function mount(root, ctx) {
  const { store, signal } = ctx;
  let n = termsOf(aux.get().highlight);
  const upper = s => { const ls = eigenvalues(s.m, s.c, s.k); return ls[handleIndex(ls)]; };

  // the partial sums sampled once; each degree is one series of the bundle
  const xs = Float64Array.from({ length: SAMPLES }, (_, i) => X_MIN + (X_MAX - X_MIN) * i / (SAMPLES - 1));
  const sums = Array.from({ length: MAX_N + 1 }, () => ({ xs, ys: new Float64Array(SAMPLES) }));
  const exact = new Float64Array(SAMPLES);
  for (let i = 0; i < SAMPLES; i++) {
    exact[i] = Math.exp(xs[i]);
    expPartialSums(xs[i], MAX_N).forEach((v, d) => { sums[d].ys[i] = v; });
  }

  const stage = createStage(root, { layers: ['plot'], aspect: 'wide', signal });
  stage.onDraw(({ w, h, dpr }) => {
    const g = stage.ctx('plot');
    const view = makeView({ w, h, dpr, xMin: X_MIN, xMax: X_MAX, yMin: Y_MIN, yMax: Y_MAX });
    g.clearRect(0, 0, w, h);
    drawGrid(g, view, { xLabel: 'x', yLabel: 'eˣ and its partial sums' });
    drawPolyline(g, view, xs, exact, { color: cssVar('--exact'), width: 2, dash: [6, 4] });
    drawBundle(g, view, sums.slice(0, n + 1), { highlight: n, width: 2, dimWidth: 1.25, dimAlpha: 0.3 });
    const name = n === 1 ? ' (Euler)' : n === 4 ? ' (RK4)' : '';
    drawText(g, view, `S${n}(x): ${n + 1} term${n ? 's' : ''}${name}`, X_MAX, Y_MAX,
      { color: cssVar('--approx'), size: 11, align: 'right', dx: -6, dy: 46 });
  });

  const strip = sweepStrip({
    values: NS, label: 'terms kept', initial: n, signal,
    format: d => `${d + 1} term${d === 0 ? '' : 's'}, degree ${d}`,
    onSelect: i => aux.set({ highlight: i }),
  });
  root.append(controls(strip.el));

  // the expansion itself, under the strip: rebuilt (not just re-numbered) on every change,
  // since the number of terms — not just their values — is what the strip is choosing
  const seriesEl = el('div');
  root.append(seriesEl);
  const renderSeries = () => seriesEl.replaceChildren(fragment(seriesMathML(n)));
  renderSeries();

  const unsubscribeAux = aux.subscribe(a => {
    n = termsOf(a.highlight);
    strip.select(n, { notify: false });
    renderSeries();
    stage.invalidate();
  }, { immediate: false });

  // Whatever degree the strip is on, |Sₙ(hλ)| against the exact factor: bound to both stores
  // (the tuple for h/λ, aux for the strip's own n) so it stays live whichever one moves. n is
  // read fresh from aux here rather than the closure above, so this owes nothing to the order
  // the two subscriptions were registered in.
  function slots() {
    const s = store.get();
    const deg = termsOf(aux.get().highlight);
    const z = cscale(upper(s), s.h);
    const sum = cabs(taylorAmplification(z, deg));
    return {
      'abs-exact': Math.exp(z[0]),
      'abs-taylor-1': cabs(taylorAmplification(z, 1)),
      'abs-taylor-4': cabs(taylorAmplification(z, 4)),
      absN: sum,
      growVerdict: el('span', { class: sum <= 1 ? 'stable' : 'unstable' }, sum <= 1 ? 'does not grow' : 'grows'),
    };
  }
  const article = root.closest('article') ?? root;
  bindMath(article, store, slots, { signal, digits: 4 });
  bindMath(article, aux, slots, { signal, digits: 4 });

  return { destroy() { unsubscribeAux(); } };
}
