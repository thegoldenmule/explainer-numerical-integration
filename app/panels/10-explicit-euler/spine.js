// Panel 10, spine: the first shaded region, |1 + hλ| ≤ 1, filling the plane, with the
// eigenvalues from panel 7 sitting on it in green or red and Rhodes' reading in the margins.
// The panel is about explicit Euler, so the region and the verdict are Euler's whatever
// integrator the store currently holds; the store's method is not written here.

import { el, fmt } from 'shared/dom.js';
import { createStage } from 'shared/gfx/stage.js';
import { createComplexPlane } from 'shared/gfx/cplane.js';
import { cssVar, drawPoint, drawText } from 'shared/gfx/plot2d.js';
import { bindMath } from 'shared/ui/livemath.js';
import { slider, controls, readout } from 'shared/ui/controls.js';
import { eigenvalues } from 'shared/math/system.js';
import { ampFactor, doublingTime, halvingTime } from 'shared/math/stability.js';
import { cscale } from 'shared/math/complex.js';

/** Euler's verdict for every root at the store's h: [{ lambda, factor, stable }] */
function eulerVerdicts(s) {
  return eigenvalues(s.m, s.c, s.k).map(lambda => {
    const factor = ampFactor('euler', cscale(lambda, s.h));
    return { lambda, factor, stable: factor <= 1 };
  });
}

export function mount(root, ctx) {
  const { store, signal } = ctx;

  const top = el('div', { class: 'viz-row' });
  root.append(top);
  const stage = createStage(top, { layers: ['region', 'plane'], aspect: 'half', signal });
  createComplexPlane({
    stage, store, signal, labels: false,
    region: s => ({ method: 'euler', h: s.h }),
    halfRange: s => Math.max(3, 1.3 * Math.max(...eigenvalues(s.m, s.c, s.k).flat().map(Math.abs))),
    onDraw(g, view, s) {
      // Rhodes' reading in the margins: real axis is growth or decay, imaginary is oscillation
      const c = cssVar('--muted');
      drawText(g, view, '← decay', view.xMin, 0, { color: c, size: 11, align: 'left', dx: 6, dy: 16 });
      drawText(g, view, 'growth →', view.xMax, 0, { color: c, size: 11, align: 'right', dx: -6, dy: 16 });
      drawText(g, view, 'oscillation ↑', 0, view.yMax, { color: c, size: 11, align: 'right', dx: -8, dy: 30 });
      drawText(g, view, 'oscillation ↓', 0, view.yMin, { color: c, size: 11, align: 'right', dx: -8, dy: -8 });
      // Euler's verdict on the roots, drawn over cplane's dots (which follow the store's method)
      for (const { lambda, factor, stable } of eulerVerdicts(s)) {
        const color = cssVar(stable ? '--stable' : '--unstable');
        drawPoint(g, view, lambda[0], lambda[1], { r: 6, fill: color });
        const X = view.X(lambda[0]), right = X < view.w - 110 * view.dpr;
        drawText(g, view, `|1 + hλ| = ${fmt(factor, 4)}`, lambda[0], lambda[1], {
          color, size: 11, align: right ? 'left' : 'right', dx: right ? 12 : -12, dy: 17,
        });
      }
    },
  });

  const out = readout({ label: 'explicit Euler' });
  top.append(controls(
    slider(store, 'h', { label: 'h (step)', min: 0.005, max: 0.25, format: v => v.toFixed(3), signal }),
    slider(store, 'm', { label: 'm (mass)', min: 0.1, max: 20, signal }),
    slider(store, 'c', { label: 'c (drag)', min: 0, max: 30, signal }),
    slider(store, 'k', { label: 'k (spring)', min: 0, max: 400, signal }),
    out.el,
  ));

  bindMath(root.closest('article') ?? root, store, s => {
    const [v] = eulerVerdicts(s);
    const verdict = el('span', { class: v.stable ? 'stable' : 'unstable' }, v.stable ? 'inside the disk: stable' : 'outside the disk: unstable');
    const time = v.stable
      ? `error halves every ${fmt(halvingTime(s.h, v.factor), 2)} s`
      : `error doubles every ${fmt(doublingTime(s.h, v.factor), 2)} s`;
    out.set([verdict, `\n|1 + hλ| = ${fmt(v.factor, 4)}: ${v.factor === 1 ? 'on the edge' : time}`]);
    return { 'abs-r': v.factor };
  }, { signal });

  return { destroy() {} };
}
