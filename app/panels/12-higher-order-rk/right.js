// Panel 12, right: explode order. The regions of RK1 through RK4 overlaid on one plane as
// Taylor-mode layers (order: 1..4) in one shader pass, a sweep strip highlighting one
// order's region, verdict, and polynomial and dimming the rest. The strip's index lives in
// aux.highlight so it survives a remount (0 = every order lit; the key is shared by every
// sweep, so it is clamped on read).

import { fmt, clamp } from 'shared/dom.js';
import { aux } from 'shared/aux.js';
import { createStage } from 'shared/gfx/stage.js';
import { createComplexPlane } from 'shared/gfx/cplane.js';
import { cssVar, drawText } from 'shared/gfx/plot2d.js';
import { controls } from 'shared/ui/controls.js';
import { sweepStrip } from 'shared/ui/sweep.js';
import { eigenvalues } from 'shared/math/system.js';
import { taylorAmplification } from 'shared/math/stability.js';
import { polynomialText } from 'shared/math/taylor.js';
import { cabs, cscale } from 'shared/math/complex.js';

const ORDERS = [1, 2, 3, 4];
const NAMES = { 0: 'all four', 1: 'RK1 (Euler)', 2: 'RK2', 3: 'RK3', 4: 'RK4' };
const CHOICES = [0, ...ORDERS];   // the strip's values: 0 lights every order
const highlightOf = h => clamp(h, 0, ORDERS.length);

export function mount(root, ctx) {
  const { store, signal } = ctx;
  const highlight = () => highlightOf(aux.get().highlight);   // 0: every order lit; 1..4: that order

  const stage = createStage(root, { layers: ['region', 'plane'], aspect: 'square', signal });
  createComplexPlane({
    stage, store, signal, labels: false,
    region: s => ({ layers: ORDERS.map(order => ({ order, h: s.h })), highlight: highlight() - 1 }),
    // the roots by the highlighted order's verdict, or the store's method when all are lit
    verdict: () => (highlight() ? { order: highlight() } : null),
    // the RK4 region reaches about 2.8/h along both axes
    halfRange: s => Math.max(3.2 / s.h, 1.3 * Math.max(...eigenvalues(s.m, s.c, s.k).flat().map(Math.abs))),
    // the highlighted order's own polynomial and |S(hλ)|, top-right; nothing to single out
    // when every order is lit (highlight() === 0)
    onDraw(g, view, s) {
      const hi = highlight();
      if (!hi) return;
      const ls = eigenvalues(s.m, s.c, s.k);
      const l = ls.reduce((a, b) => (b[1] > a[1] ? b : a));
      const f = cabs(taylorAmplification(cscale(l, s.h), hi));
      const corner = { align: 'right', dx: -8 };
      drawText(g, view, `RK${hi}: ${polynomialText(hi, '+')}`, view.xMax, view.yMax, { ...corner, color: cssVar('--fg'), size: 11, dy: 16 });
      drawText(g, view, `|S| = ${fmt(f, 4)}: ${f <= 1 ? 'inside' : 'outside'}`, view.xMax, view.yMax,
        { ...corner, color: cssVar(f <= 1 ? '--stable' : '--unstable'), size: 11, dy: 32 });
    },
  });

  const strip = sweepStrip({
    values: CHOICES, label: 'highlight an order', format: o => NAMES[o], initial: highlight(), signal,
    onSelect: i => aux.set({ highlight: i }),
  });
  root.append(controls(strip.el));
  const unsubscribe = store.subscribe(stage.invalidate, { immediate: false });
  const unsubscribeAux = aux.subscribe(() => { strip.select(highlight(), { notify: false }); stage.invalidate(); }, { immediate: false });

  return { destroy() { unsubscribe(); unsubscribeAux(); } };
}
