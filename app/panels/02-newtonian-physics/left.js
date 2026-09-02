// Panel 2, left: vectors alone. The wind and gravity arrows from the scene, tails at the
// origin, their sum, and the parallelogram that closes on it. Drag either tip (through the
// scene store, so the spine sees the change) and the components and magnitudes update.
// Step down from the spine: the same arrows, minus the mass.

import { el, fmt } from 'shared/dom.js';
import { createStage } from 'shared/gfx/stage.js';
import { createDragHandles } from 'shared/gfx/drag.js';
import { cssVar, makeView, drawGrid, drawPolyline, drawText } from 'shared/gfx/plot2d.js';
import { forceOf } from 'shared/math/forces.js';
import { scene } from 'shared/scene.js';
import { readout } from 'shared/ui/controls.js';
import { FORCE_COLOR, SUM_COLOR, drawForceArrow, scalePatch, mag } from './arrows.js';

const PAIR = ['wind', 'gravity'];

export function mount(root, ctx) {
  const { signal } = ctx;
  let view = null, frozenHalf = null;

  const stage = createStage(root, { layers: ['plane'], aspect: 'wide', signal });
  const out = readout({ label: 'components and magnitudes' });

  const vectors = () => {
    const s = scene.get();
    return PAIR.map(type => {
      const i = s.forces.findIndex(f => f.type === type);
      const f = s.forces[i];
      return { i, f, type, F: forceOf(f, s.body), label: type === 'wind' ? 'a: wind' : 'b: gravity' };
    });
  };
  const halfNow = (vs, sum) => frozenHalf ?? Math.max(2.5, 1.4 * Math.max(mag(vs[0].F), mag(vs[1].F), mag(sum)));

  stage.onDraw(({ w, h, dpr }) => {
    const vs = vectors();
    const [a, b] = vs.map(v => v.F);
    const sum = [a[0] + b[0], a[1] + b[1]];
    const g = stage.ctx('plane');
    view = makeView({ w, h, dpr, halfW: halfNow(vs, sum) });
    g.clearRect(0, 0, w, h);
    drawGrid(g, view, { xLabel: 'x', yLabel: 'y' });

    // the parallelogram: each arrow copied to the other's tip, dashed
    const dim = cssVar('--tick');
    drawPolyline(g, view, [a[0], sum[0]], [a[1], sum[1]], { color: dim, width: 1, dash: [4, 4] });
    drawPolyline(g, view, [b[0], sum[0]], [b[1], sum[1]], { color: dim, width: 1, dash: [4, 4] });
    // components of the sum, dropped to the axes
    drawPolyline(g, view, [sum[0], sum[0]], [0, sum[1]], { color: cssVar(SUM_COLOR), width: 1, dash: [2, 3], alpha: 0.6 });
    drawPolyline(g, view, [0, sum[0]], [sum[1], sum[1]], { color: cssVar(SUM_COLOR), width: 1, dash: [2, 3], alpha: 0.6 });

    for (const v of vs) drawForceArrow(g, view, [0, 0], v.F, 1, { color: FORCE_COLOR[v.type], width: 2.5, label: v.label + (v.f.on ? '' : ' (off on the spine)') });
    drawForceArrow(g, view, [0, 0], sum, 1, { color: SUM_COLOR, width: 3.5, head: 10, label: 'a + b' });
    drawText(g, view, `${fmt(sum[0], 2)}`, sum[0], 0, { color: cssVar(SUM_COLOR), size: 11, align: 'center', dy: sum[1] >= 0 ? 16 : -8 });
    drawText(g, view, `${fmt(sum[1], 2)}`, 0, sum[1], { color: cssVar(SUM_COLOR), size: 11, align: sum[0] >= 0 ? 'right' : 'left', dx: sum[0] >= 0 ? -6 : 6, dy: 4 });

    out.set([
      `a (wind)    = (${fmt(a[0], 2)}, ${fmt(a[1], 2)})   |a| = ${fmt(mag(a), 2)}\n`,
      `b (gravity) = (${fmt(b[0], 2)}, ${fmt(b[1], 2)})   |b| = ${fmt(mag(b), 2)}\n`,
      `a + b = (${fmt(a[0], 2)} + ${fmt(b[0], 2)}, ${fmt(a[1], 2)} + ${fmt(b[1], 2)}) = (${fmt(sum[0], 2)}, ${fmt(sum[1], 2)})\n`,
      `|a + b| = ${fmt(mag(sum), 2)} ≤ |a| + |b| = ${fmt(mag(a) + mag(b), 2)}`,
      el('span', { class: 'label' }, ': equal only when they point the same way'),
    ]);
  });

  const canvas = stage.canvas('plane');
  createDragHandles(canvas, {
    signal, hitRadius: 14,
    handles: () => vectors().map(v => ({ id: v.type, x: v.F[0], y: v.F[1] })),
    view: () => view ?? makeView({ w: 1, h: 1, dpr: 1, halfW: 2.5 }),
    onStart: () => { frozenHalf = view.xMax; },
    onMove: (id, p) => {
      const v = vectors().find(v => v.type === id);
      const patch = scalePatch(v.f, v.F, [p.x, p.y]);
      if (patch) scene.paramStore(v.i).set(patch);
    },
    onEnd: () => { frozenHalf = null; stage.invalidate(); },
  });

  root.append(out.el);
  const unsub = scene.subscribe(stage.invalidate, { immediate: false });
  return { destroy() { unsub(); } };
}
