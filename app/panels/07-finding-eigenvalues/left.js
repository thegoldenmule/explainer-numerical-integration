// Panel 7, left: the quadratic formula on the real line with the discriminant highlighted,
// then one complex number as a point on the plane with its real part, imaginary part, and
// modulus drawn in. Step down: one number, checkable by hand.

import { el, fmt } from 'shared/dom.js';
import { createStage } from 'shared/gfx/stage.js';
import { createComplexPlane, handleIndex } from 'shared/gfx/cplane.js';
import { cssVar, makeView, drawText, drawPolyline, drawPoint } from 'shared/gfx/plot2d.js';
import { bindMath } from 'shared/ui/livemath.js';
import { slider, controls } from 'shared/ui/controls.js';
import { discriminant, regime, eigenvalues } from 'shared/math/system.js';
import { cabs } from 'shared/math/complex.js';

// Panel 7 predates any integrator, so the roots are colored by the physical verdict
// (Re λ < 0) rather than cplane's numerical one for the store's method, which is what its
// built-in dots show. Drawn over them; a cplane `verdict` option would make this go away.
function drawPhysicalRoots(g, view, s) {
  for (const l of eigenvalues(s.m, s.c, s.k)) {
    drawPoint(g, view, l[0], l[1], { r: 6, fill: cssVar(l[0] < 0 ? '--stable' : '--unstable') });
  }
}

export function mount(root, ctx) {
  const { store, signal } = ctx;

  // ---- the real line: center −c/2m, offset ±√disc / 2m ----
  const line = createStage(root, { layers: ['line'], aspect: 'strip', signal });
  line.onDraw(({ w, h, dpr }) => {
    const s = store.get();
    const g = line.ctx('line');
    const d = discriminant(s.m, s.c, s.k), r = regime(s.m, s.c, s.k);
    const center = -s.c / (2 * s.m);
    const offset = Math.sqrt(Math.abs(d)) / (2 * s.m);
    const half = Math.max(2, 1.4 * (Math.abs(center) + offset));
    const view = makeView({ w, h, dpr, halfW: half, cy: 0, halfH: half * h / w });
    g.clearRect(0, 0, w, h);

    // the axis, with ticks
    const y0 = h * 0.62;
    g.save();
    g.strokeStyle = cssVar('--axis'); g.lineWidth = dpr;
    g.beginPath(); g.moveTo(0, y0); g.lineTo(w, y0); g.stroke();
    g.fillStyle = cssVar('--tick'); g.font = `${11 * dpr}px ${cssVar('--font')}`;
    g.textAlign = 'center';
    const step = half > 20 ? 10 : half > 8 ? 5 : half > 3 ? 2 : 1;
    for (let v = Math.ceil(-half / step) * step; v <= half; v += step) {
      const X = view.X(v);
      g.beginPath(); g.moveTo(X, y0 - 4 * dpr); g.lineTo(X, y0 + 4 * dpr); g.stroke();
      g.fillText(String(v).replace('-', '−'), X, y0 + 17 * dpr);
    }
    g.textAlign = 'right';
    g.fillStyle = cssVar('--axis');
    g.fillText('real line', w - 8 * dpr, y0 - 8 * dpr);
    g.restore();

    // the discriminant: a bracket of ±√|disc| / 2m around the center, drawn on the line when
    // it is real and lifted off it when it is not
    const accent = cssVar('--accent');
    const Xc = view.X(center), Xl = view.X(center - offset), Xr = view.X(center + offset);
    const dot = (X, r, fill) => {
      g.beginPath(); g.arc(X, y0, r * dpr, 0, Math.PI * 2);
      g.fillStyle = fill; g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 2 * dpr; g.stroke();
    };
    g.save();
    g.lineWidth = 2.5 * dpr;
    if (r === 'overdamped') {
      g.strokeStyle = accent;
      g.beginPath(); g.moveTo(Xl, y0); g.lineTo(Xr, y0); g.stroke();
      dot(Xl, 5.5, cssVar('--stable'));
      dot(Xr, 5.5, cssVar('--stable'));
    } else if (r === 'critical') {
      dot(Xc, 6.5, cssVar('--stable'));
    } else {
      // √(negative): the offset leaves the line. Dotted stubs up and down of length |offset|.
      const stub = Math.min(h * 0.4, offset * view.sx);
      g.strokeStyle = cssVar('--unstable');
      g.setLineDash([3 * dpr, 4 * dpr]);
      g.beginPath(); g.moveTo(Xc, y0 - stub); g.lineTo(Xc, y0 + stub); g.stroke();
      g.setLineDash([]);
      dot(Xc, 4.5, accent);
    }
    g.restore();

    // labels
    g.save();
    g.font = `${11.5 * dpr}px ${cssVar('--font')}`;
    g.fillStyle = accent; g.textAlign = 'center';
    g.fillText(`−c / 2m = ${fmt(center, 2)}`, Xc, y0 - 34 * dpr);
    g.fillStyle = r === 'underdamped' ? cssVar('--unstable') : accent;
    const label = r === 'underdamped'
      ? `√(${fmt(d, 1)}) / 2m is not a real number: ±${fmt(offset, 2)} i`
      : r === 'critical' ? '√0 / 2m = 0: one repeated root' : `±√(${fmt(d, 1)}) / 2m = ±${fmt(offset, 2)}`;
    g.fillText(label, w / 2, h - 10 * dpr);
    g.restore();
  });

  // ---- the plane: one root as a point with its parts drawn in ----
  const row = el('div', { class: 'viz-row' });
  root.append(row);
  const planeStage = createStage(row, { layers: ['plane'], aspect: 'half', signal, grab: true });
  const plane = createComplexPlane({
    stage: planeStage, store, signal, drag: true, labels: false,
    halfRange: s => Math.max(3, 1.35 * Math.max(...eigenvalues(s.m, s.c, s.k).flat().map(Math.abs))),
    onDraw(g, view, s) {
      drawPhysicalRoots(g, view, s);
      const ls = eigenvalues(s.m, s.c, s.k);
      const l = ls[handleIndex(ls)];
      const [a, b] = l;
      const muted = cssVar('--muted'), accent = cssVar('--accent');
      // modulus: a radius from the origin
      drawPolyline(g, view, [0, a], [0, b], { color: accent, width: 1.5 });
      // real and imaginary parts: dashed drops to the axes
      drawPolyline(g, view, [a, a], [0, b], { color: muted, width: 1, dash: [4, 4] });
      drawPolyline(g, view, [0, a], [b, b], { color: muted, width: 1, dash: [4, 4] });
      // labels sit on the side of the Im axis away from its tick labels (which hang to its right)
      const left = a < 0 || Math.abs(a) < 0.08 * (view.xMax - view.xMin);
      const side = { align: left ? 'right' : 'left', dx: left ? -10 : 12 };
      drawText(g, view, `a = ${fmt(a, 2)}`, a, 0, { color: muted, size: 11, align: 'center', dy: b >= 0 ? 16 : -8 });
      // a real root: everything sits on the axis, so spread the labels above and below it
      const flat = Math.abs(b) < 0.04 * (view.yMax - view.yMin);
      drawText(g, view, `b = ${fmt(b, 2)}`, 0, b, { color: muted, size: 11, ...(flat ? { align: 'left', dx: 12, dy: -8 } : { ...side, dy: 4 }) });
      drawText(g, view, `|λ| = ${fmt(cabs(l), 2)}`, a / 2, b / 2, { color: accent, size: 11, ...(flat ? { align: 'center', dy: -10 } : { ...side, dy: 4 }) });
    },
  });

  row.append(controls(
    slider(store, 'c', { label: 'c (drag)', min: 0, max: 30, signal }),
    slider(store, 'k', { label: 'k (spring)', min: 0, max: 400, signal }),
  ));
  line.invalidate();
  const unsubscribe = store.subscribe(line.invalidate, { immediate: false });

  bindMath(root.closest('article') ?? root, store, s => {
    const ls = eigenvalues(s.m, s.c, s.k);
    const l = ls[handleIndex(ls)];
    return {
      disc: discriminant(s.m, s.c, s.k),
      'lambda-re': l[0], 'lambda-im': Math.abs(l[1]), 'lambda-abs': cabs(l),
    };
  }, { signal });

  return { destroy() { unsubscribe(); plane.destroy(); } };
}
