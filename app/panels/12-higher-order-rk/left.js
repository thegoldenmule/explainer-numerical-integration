// Panel 12, left: Taylor series, one term at a time. The partial sums S₀…Sₙ of e^x on the
// real axis against the exponential, the highest drawn bright and the rest dimmed, and the
// modulus of the degree-n sum at the current hλ next to the exact |e^{hλ}|. Euler is n = 1,
// RK4 is n = 4. The term count is the sweep strip's index, kept in aux.highlight so it
// survives a remount (the key is shared by every sweep, so it is clamped on read).

import { el, fmt, clamp } from 'shared/dom.js';
import { aux } from 'shared/aux.js';
import { sweepStrip } from 'shared/ui/sweep.js';
import { createStage } from 'shared/gfx/stage.js';
import { drawBundle } from 'shared/gfx/bundle.js';
import { cssVar, makeView, drawGrid, drawPolyline, drawText } from 'shared/gfx/plot2d.js';
import { bindMath } from 'shared/ui/livemath.js';
import { controls, readout } from 'shared/ui/controls.js';
import { expPartialSums, polynomialText } from 'shared/math/taylor.js';
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
    drawText(g, view, `S${n}(x): ${n + 1} term${n ? 's' : ''}`, X_MAX, Y_MAX,
      { color: cssVar('--approx'), size: 11, align: 'right', dx: -6, dy: 46 });
  });

  const strip = sweepStrip({
    values: NS, label: 'terms kept', initial: n, signal,
    format: d => `${d + 1} term${d === 0 ? '' : 's'}, degree ${d}`,
    onSelect: i => aux.set({ highlight: i }),
  });
  const out = readout();
  function update() {
    const s = store.get();
    const z = cscale(upper(s), s.h);
    const sum = cabs(taylorAmplification(z, n));
    const ex = Math.exp(z[0]);
    const name = n === 1 ? ' (Euler)' : n === 4 ? ' (RK4)' : '';
    out.set([
      `S${n}(z) = ${polynomialText(n)}${name}\n`,
      `|S${n}(hλ)| = ${fmt(sum, 4)}   exact |e^{hλ}| = ${fmt(ex, 4)}   `,
      el('span', { class: sum <= 1 ? 'stable' : 'unstable' }, sum <= 1 ? 'does not grow' : 'grows'),
    ]);
    stage.invalidate();
  }
  root.append(controls(strip.el, out.el));
  const unsubscribe = store.subscribe(update);
  const unsubscribeAux = aux.subscribe(a => {
    n = termsOf(a.highlight);
    strip.select(n, { notify: false });
    update();
  }, { immediate: false });

  bindMath(root.closest('article') ?? root, store, s => {
    const z = cscale(upper(s), s.h);
    return {
      'abs-exact': Math.exp(z[0]),
      'abs-taylor-1': cabs(taylorAmplification(z, 1)),
      'abs-taylor-4': cabs(taylorAmplification(z, 4)),
    };
  }, { signal, digits: 4 });

  return { destroy() { unsubscribe(); unsubscribeAux(); } };
}
