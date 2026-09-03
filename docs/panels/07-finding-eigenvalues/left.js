// Panel 7, left: one complex number as a point on the plane, with its real part, imaginary
// part and modulus drawn in — and the quadratic formula's two halves drawn on the same plane:
// the centre −c/2m, and the ±√(c² − 4mk)/2m that carries the roots away from it, along the
// real axis when the discriminant is positive and off it when it is not. Step down: one
// number, checkable by hand.
//
// There are no sliders: the numbers in the formula above are the control (bindScrub), and the
// root itself is draggable (cplane inverts λ back to c and k). Everything here reads and
// writes the tuple — this pane shows the reader's actual spring, no what-if.

import { fmt } from 'shared/dom.js';
import { createStage } from 'shared/gfx/stage.js';
import { createComplexPlane, handleIndex } from 'shared/gfx/cplane.js';
import { cssVar, drawText, drawPoint, drawPolyline } from 'shared/gfx/plot2d.js';
import { bindMath } from 'shared/ui/livemath.js';
import { bindScrub } from 'shared/ui/scrub.js';
import { discriminant, regime, eigenvalues } from 'shared/math/system.js';
import { cabs } from 'shared/math/complex.js';

/** The caption under the plane: what the ±√disc/2m offset does to the roots. */
function offsetCaption(m, c, k) {
  const d = discriminant(m, c, k);
  const off = Math.sqrt(Math.abs(d)) / (2 * m);
  if (regime(m, c, k) === 'critical') return 'c² − 4mk = 0 → the offset vanishes: one repeated root';
  if (d < 0) return `c² − 4mk = ${fmt(d, 1)} < 0 → ±${fmt(off, 2)}i: off the real axis`;
  return `c² − 4mk = ${fmt(d, 1)} > 0 → ±${fmt(off, 2)}: along the real axis`;
}

export function mount(root, ctx) {
  const { store, signal } = ctx;
  const article = root.closest('article') ?? root;

  const stage = createStage(root, { layers: ['plane'], aspect: 'square', signal, grab: true });
  const plane = createComplexPlane({
    stage, store, signal, drag: true, verdict: 'physical',
    halfRange: s => Math.max(3, 1.35 * Math.max(...eigenvalues(s.m, s.c, s.k).flat().map(Math.abs))),
    onDraw(g, view, s) {
      const ls = eigenvalues(s.m, s.c, s.k);
      const l = ls[handleIndex(ls)];
      const [a, b] = l;
      const muted = cssVar('--muted'), accent = cssVar('--accent'), edge = cssVar('--region-edge');
      // modulus: a radius from the origin
      drawPolyline(g, view, [0, a], [0, b], { color: accent, width: 1.5 });
      // real and imaginary parts: dashed drops to the axes
      drawPolyline(g, view, [a, a], [0, b], { color: muted, width: 1, dash: [4, 4] });
      drawPolyline(g, view, [0, a], [b, b], { color: muted, width: 1, dash: [4, 4] });

      // the two halves of the quadratic formula: the centre −c/2m, and the offset from it.
      // Underdamped, a = −c/2m exactly, so the dashed drop above *is* √(4mk − c²)/2m.
      const centre = -s.c / (2 * s.m);
      const caption = offsetCaption(s.m, s.c, s.k);
      if (Math.abs(a - centre) > 1e-12) drawPolyline(g, view, [centre, a], [0, 0], { color: edge, width: 3 });
      drawPoint(g, view, centre, 0, { r: 3.5, fill: edge, stroke: null });

      // labels sit on the side of the Im axis away from its tick labels (which hang to its right)
      const left = a < 0 || Math.abs(a) < 0.08 * (view.xMax - view.xMin);
      const side = { align: left ? 'right' : 'left', dx: left ? -10 : 12 };
      // a real root: everything sits on the axis, so spread the labels above and below it
      const flat = Math.abs(b) < 0.04 * (view.yMax - view.yMin);
      drawText(g, view, `a = ${fmt(a, 2)}`, a, 0, { color: muted, size: 11, align: 'center', dy: b >= 0 ? 16 : -8 });
      drawText(g, view, `b = ${fmt(b, 2)}`, 0, b, { color: muted, size: 11, ...(flat ? { align: 'left', dx: 12, dy: -8 } : { ...side, dy: 4 }) });
      drawText(g, view, `|λ| = ${fmt(cabs(l), 2)}`, a / 2, b / 2, { color: accent, size: 11, ...(flat ? { align: 'center', dy: -10 } : { ...side, dy: 4 }) });
      drawText(g, view, `−c/2m = ${fmt(centre, 2)}`, centre, 0, { color: edge, size: 11, align: 'center', dy: b >= 0 ? -10 : 18 });
      drawText(g, view, caption, view.xMin, view.yMin, { color: edge, size: 11, dx: 8, dy: -10 });
    },
  });

  bindScrub(article, store, { signal });
  bindMath(article, store, s => {
    const ls = eigenvalues(s.m, s.c, s.k);
    const l = ls[handleIndex(ls)];
    const r = regime(s.m, s.c, s.k);
    return {
      disc: discriminant(s.m, s.c, s.k),
      'lambda-re': l[0], 'lambda-im': Math.abs(l[1]), 'lambda-abs': cabs(l),
      centre: -s.c / (2 * s.m),
      'offset-says': r === 'critical' ? 'nowhere, because the discriminant is zero'
        : r === 'underdamped' ? 'off the real axis, because the discriminant is negative'
        : 'along the real axis, because the discriminant is positive',
    };
  }, { signal });

  return { destroy() { plane.destroy(); } };
}
