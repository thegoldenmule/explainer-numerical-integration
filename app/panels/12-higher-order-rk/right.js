// Panel 12, right: explode order. The regions of RK1 through RK4 overlaid on one plane as
// Taylor-mode layers (order: 1..4) in one shader pass, a slider highlighting one order's
// region and its polynomial and dimming the rest. The order is a local slider: no store key
// or aux store carries it yet.

import { el, fmt } from 'shared/dom.js';
import { createStage } from 'shared/gfx/stage.js';
import { createComplexPlane } from 'shared/gfx/cplane.js';
import { cssVar, drawPoint } from 'shared/gfx/plot2d.js';
import { controls, readout } from 'shared/ui/controls.js';
import { eigenvalues } from 'shared/math/system.js';
import { taylorAmplification } from 'shared/math/stability.js';
import { cabs, cscale } from 'shared/math/complex.js';
import { polynomialText } from './left.js';

const ORDERS = [1, 2, 3, 4];
const NAMES = { 1: 'RK1 (Euler)', 2: 'RK2', 3: 'RK3', 4: 'RK4' };

export function mount(root, ctx) {
  const { store, signal } = ctx;
  let highlight = 0;   // 0: every order lit; 1..4: that order

  const top = el('div', { class: 'viz-row' });
  root.append(top);
  const stage = createStage(top, { layers: ['region', 'plane'], aspect: 'half', signal });
  const plane = createComplexPlane({
    stage, store, signal, labels: false,
    region: s => ({ layers: ORDERS.map(order => ({ order, h: s.h })), highlight: highlight - 1 }),
    // the RK4 region reaches about 2.8/h along both axes
    halfRange: s => Math.max(3.2 / s.h, 1.3 * Math.max(...eigenvalues(s.m, s.c, s.k).flat().map(Math.abs))),
    onDraw(g, view, s) {
      // the roots by the highlighted order's verdict (or the store's method when all are lit)
      for (const l of eigenvalues(s.m, s.c, s.k)) {
        const stable = highlight ? cabs(taylorAmplification(cscale(l, s.h), highlight)) <= 1 : plane.report.stable;
        drawPoint(g, view, l[0], l[1], { r: 5.5, fill: cssVar(stable ? '--stable' : '--unstable') });
      }
    },
  });

  const input = el('input', { type: 'range', min: 0, max: 4, step: 1, value: highlight });
  const value = el('output');
  const out = readout({ label: '|Sₙ(hλ)| at the upper root' });
  function update() {
    const s = store.get();
    const ls = eigenvalues(s.m, s.c, s.k);
    const l = ls.reduce((a, b) => (b[1] > a[1] ? b : a));
    value.textContent = highlight ? NAMES[highlight] : 'all four';
    out.set(ORDERS.flatMap(n => {
      const f = cabs(taylorAmplification(cscale(l, s.h), n));
      // short lines: this readout lives in the narrow column beside the plane
      const line = [`RK${n}  ${polynomialText(n, '+')}\n`, `     |S| = ${fmt(f, 4)} `,
        el('span', { class: f <= 1 ? 'stable' : 'unstable' }, f <= 1 ? 'inside' : 'outside'), '\n'];
      return highlight === n ? [el('strong', {}, line)] : highlight ? [el('span', { class: 'muted' }, line)] : line;
    }));
    stage.invalidate();
  }
  input.addEventListener('input', () => { highlight = Number(input.value); update(); }, { signal });
  top.append(controls(
    el('label', { class: 'control' }, el('span', { class: 'control-label' }, el('span', {}, 'highlight an order'), value), input),
    out.el,
  ));
  const unsubscribe = store.subscribe(update);

  return { destroy() { unsubscribe(); } };
}
