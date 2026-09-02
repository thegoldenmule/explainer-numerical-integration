// Panel 10, right: explode h. The Euler disk for a small range of step sizes at once, as
// region layers composited in one shader pass, with the analytic circles (center −1/h,
// radius 1/h) drawn over them and the eigenvalues fixed. A discrete slider walks the range
// by setting the store's h, so the highlighted disk is the spine's disk.

import { el, fmt } from 'shared/dom.js';
import { createStage } from 'shared/gfx/stage.js';
import { createComplexPlane } from 'shared/gfx/cplane.js';
import { cssVar, drawPoint, drawText } from 'shared/gfx/plot2d.js';
import { controls, readout } from 'shared/ui/controls.js';
import { eigenvalues } from 'shared/math/system.js';
import { ampFactor } from 'shared/math/stability.js';
import { cscale } from 'shared/math/complex.js';
import { sweepRange, nearestIndex } from 'shared/math/sweep.js';

// six frame rates, 10 to 60 fps, as steps h = 1/fps from the smallest up: 1/30 and 1/60 are
// the essay's two steps and both land exactly in the range
const HS = sweepRange(10, 60, 6).map(f => 1 / f).reverse();
const fracOf = h => `1/${Math.round(1 / h)}`;

export function mount(root, ctx) {
  const { store, signal } = ctx;
  const current = s => nearestIndex(HS, s.h);

  const stage = createStage(root, { layers: ['region', 'plane'], aspect: 'wide', signal });
  createComplexPlane({
    stage, store, signal, labels: false,
    region: s => ({ layers: HS.map(h => ({ method: 'euler', h })), highlight: current(s) }),
    circles: HS,
    halfRange: s => Math.max(1.08 * 2 / HS[0], 1.3 * Math.max(...eigenvalues(s.m, s.c, s.k).flat().map(Math.abs))),
    onDraw(g, view, s) {
      const h = HS[current(s)];
      // under the highlighted disk, clear of the axis ticks
      drawText(g, view, `h = ${fracOf(h)} s: center −${fmt(1 / h, 0)}, radius ${fmt(1 / h, 0)}`, -1 / h, -1 / h,
        { color: cssVar('--region-edge'), size: 11, align: 'center', dy: 15 });
      // Euler's verdict at the highlighted h, over cplane's dots (which follow the store's method)
      for (const l of eigenvalues(s.m, s.c, s.k)) {
        const factor = ampFactor('euler', cscale(l, h));
        drawPoint(g, view, l[0], l[1], { r: 6, fill: cssVar(factor <= 1 ? '--stable' : '--unstable') });
      }
    },
  });

  // the range as a discrete slider on the store's h (no aux store yet; the store carries it)
  const input = el('input', { type: 'range', min: 0, max: HS.length - 1, step: 1, value: current(store.get()) });
  const value = el('output');
  input.addEventListener('input', () => store.set({ h: HS[Number(input.value)] }), { signal });
  const out = readout({ label: 'step, disk radius 1/h, |1 + hλ| at the upper root' });

  const unsubscribe = store.subscribe(s => {
    const i = current(s);
    if (Number(input.value) !== i) input.value = i;
    value.textContent = `${fracOf(HS[i])} s`;
    const ls = eigenvalues(s.m, s.c, s.k);
    const l = ls.reduce((a, b) => (b[1] > a[1] ? b : a));
    out.set(HS.flatMap((h, j) => {
      const f = ampFactor('euler', cscale(l, h));
      const line = `h = ${fracOf(h).padEnd(4)}  r = ${fmt(1 / h, 0).padStart(2)}  |R| = ${fmt(f, 4)}  ${f <= 1 ? 'inside' : 'outside'}`;
      return [j === i ? el('strong', {}, line) : line, '\n'];
    }));
  });

  root.append(controls(
    el('label', { class: 'control' }, el('span', { class: 'control-label' }, el('span', {}, 'h along the range'), value), input),
    out.el,
  ));

  return { destroy() { unsubscribe(); } };
}
