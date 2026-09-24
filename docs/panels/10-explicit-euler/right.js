// Panel 10, right: explode h. The Euler disk for a small range of step sizes at once, as
// region layers composited in one shader pass, with the analytic circles (center −1/h,
// radius 1/h) drawn over them and the eigenvalues fixed. The view is centered on the disks,
// not the origin: they all sit in the left half plane. A discrete slider walks the range by
// setting the store's h, so the highlighted disk is the spine's disk.

import { fmt } from 'shared/dom.js';
import { createStage } from 'shared/gfx/stage.js';
import { createComplexPlane } from 'shared/gfx/cplane.js';
import { cssVar, drawText } from 'shared/gfx/plot2d.js';
import { controls, slider } from 'shared/ui/controls.js';
import { eigenvalues } from 'shared/math/system.js';
import { ampFactor } from 'shared/math/stability.js';
import { cscale } from 'shared/math/complex.js';
import { sweepRange, nearestIndex } from 'shared/math/sweep.js';

// six frame rates, 10 to 60 fps, as steps h = 1/fps from the smallest up: 1/30 and 1/60 are
// the essay's two steps and both land exactly in the range
const HS = sweepRange(10, 60, 6).map(f => 1 / f).reverse();
const fracOf = h => `1/${Math.round(1 / h)}`;
// the largest disk spans [−2R, 0]; the frame shows that plus a margin, centered on −0.9R
const R = 1 / HS[0];
const X_MIN = -2.1 * R, X_MAX = 0.3 * R;

export function mount(root, ctx) {
  const { store, signal } = ctx;
  const current = s => nearestIndex(HS, s.h);

  const stage = createStage(root, { layers: ['region', 'plane'], signal });
  createComplexPlane({
    stage, store, signal, labels: false,
    region: s => ({ layers: HS.map(h => ({ method: 'euler', h })), highlight: current(s) }),
    circles: HS,
    cx: (X_MIN + X_MAX) / 2,
    halfRange: s => Math.max((X_MAX - X_MIN) / 2, 1.3 * Math.max(...eigenvalues(s.m, s.c, s.k).flat().map(Math.abs))),
    // Euler's verdict at the highlighted h of the range, not the store's exact h
    verdict: s => ({ method: 'euler', h: HS[current(s)] }),
    onDraw(g, view, s) {
      const h = HS[current(s)];
      // under the highlighted disk's center when that is in the frame, else along the bottom edge
      const below = -1 / h > view.yMin + 0.1 * (view.yMax - view.yMin);
      drawText(g, view, `h = ${fracOf(h)} s: center −${fmt(1 / h, 0)}, radius ${fmt(1 / h, 0)}`, -1 / h, below ? -1 / h : view.yMin,
        { color: cssVar('--region-edge'), size: 11, align: 'center', dy: below ? 15 : -8 });
      // the eigenvalue's own verdict at this h, top-right corner
      const ls = eigenvalues(s.m, s.c, s.k);
      const l = ls.reduce((a, b) => (b[1] > a[1] ? b : a));
      const f = ampFactor('euler', cscale(l, h));
      drawText(g, view, `|1 + hλ| = ${fmt(f, 4)}: ${f <= 1 ? 'inside' : 'outside'}`, view.xMax, view.yMax,
        { color: cssVar(f <= 1 ? '--stable' : '--unstable'), size: 11, align: 'right', dx: -8, dy: 16 });
    },
  });

  // the range as a discrete slider on the store's h: the shared slider() over a facade whose
  // one key is the index into HS, so the highlighted disk is always the store's (the spine's) h
  const rangeIndex = {
    get: () => ({ i: current(store.get()) }),
    set: patch => { if (Number.isFinite(patch.i)) store.set({ h: HS[Math.round(patch.i)] }); return rangeIndex.get(); },
    subscribe: (fn, opts) => store.subscribe(s => { const i = { i: current(s) }; fn(i, i); }, opts),
    limits: { i: [0, HS.length - 1] },
  };
  root.append(controls(slider(rangeIndex, 'i', { label: 'h along the range', step: 1, format: i => `${fracOf(HS[i])} s`, signal })));

  return { destroy() {} };
}
