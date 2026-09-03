// Panel 9, left: one step multiplies the error by z; n steps multiply it by zⁿ. A slider for
// z (local to the pane) and a sequence you step forward, drawn as dots, with the number of
// steps and the time (at the store's h) the error takes to double or halve.

import { el, fmt } from 'shared/dom.js';
import { createStage } from 'shared/gfx/stage.js';
import { cssVar, makeView, drawGrid, drawPolyline, drawPoint, drawText } from 'shared/gfx/plot2d.js';
import { doublingTime, halvingTime } from 'shared/math/stability.js';
import { controls, row } from 'shared/ui/controls.js';
import { bindScrub } from 'shared/ui/scrub.js';
import { bindMath } from 'shared/ui/livemath.js';

const MAX_STEPS = 140;   // "a thousandfold after 140" at 1.05
const Z_RANGE = [0.5, 1.5];
const sub = i => String(i).replace(/\d/g, d => '₀₁₂₃₄₅₆₇₈₉'[d]);

export function mount(root, ctx) {
  const { store, signal } = ctx;
  let z = 1.05, n = 10;   // the ratio and how many steps have been taken

  const stage = createStage(root, { layers: ['plot'], aspect: 'wide', signal });

  // z is dragged where it is written, in e(i+1) = z·e(i). Local to the pane: the ratio is a
  // property of a step, not an entry of the tuple.
  const zSubs = new Set();
  const zStore = {
    get: () => ({ z }),
    set(patch) {
      if (!Number.isFinite(patch.z)) return { z };
      const next = Math.min(Z_RANGE[1], Math.max(Z_RANGE[0], patch.z));
      if (next !== z) { z = next; for (const fn of zSubs) fn({ z }, { z }); stage.invalidate(); }
      return { z };
    },
    subscribe(fn, { immediate = true } = {}) {
      zSubs.add(fn);
      if (immediate) fn({ z }, { z });
      return () => zSubs.delete(fn);
    },
    limits: { z: Z_RANGE },
  };

  stage.onDraw(({ w, h, dpr }) => {
    const g = stage.ctx('plot');
    g.clearRect(0, 0, w, h);
    const e = [];
    for (let i = 0; i <= n; i++) e.push(z ** i);
    const peak = Math.max(...e, 1);
    const view = makeView({ w, h, dpr, xMin: -1, xMax: Math.max(n, 10) + 1, yMin: -0.05 * peak, yMax: peak * 1.12 });
    drawGrid(g, view, { xLabel: 'step i', yLabel: 'eᵢ = zⁱ · e₀' });
    drawPolyline(g, view, [-1, Math.max(n, 10) + 1], [1, 1], { color: cssVar('--axis'), width: 1, dash: [4, 4], alpha: 0.6 });
    drawText(g, view, 'e₀ = 1', 0, 1, { color: cssVar('--tick'), size: 11, dx: 8, dy: 14, align: 'left' });
    const color = cssVar(z > 1 ? '--unstable' : z < 1 ? '--stable' : '--axis');
    const xs = e.map((_, i) => i);
    drawPolyline(g, view, xs, e, { color, width: 1, alpha: 0.5 });
    if (n <= 60) e.forEach((v, i) => drawPoint(g, view, i, v, { r: 3.5, fill: color, stroke: null }));
    else drawPolyline(g, view, xs, e, { color, width: 2 });

    // the arithmetic, in whichever top corner the curve itself isn't occupying: z > 1 climbs
    // to the top-right, z < 1 starts near the top-left (e₀ = 1)
    const h_ = store.get().h;
    const doubling = doublingTime(h_, z), halving = halvingTime(h_, z);
    const steps = z > 1 ? Math.LN2 / Math.log(z) : z < 1 ? Math.LN2 / -Math.log(z) : Infinity;
    const corner = z > 1 ? { x: view.xMin, align: 'left', dx: 8 } : { x: view.xMax, align: 'right', dx: -8 };
    drawText(g, view, `e₁ = z · e₀ = ${fmt(z, 3)}`, corner.x, view.yMax, { align: corner.align, dx: corner.dx, color, size: 12, dy: 16 });
    drawText(g, view, `after ${n} step${n === 1 ? '' : 's'}: e${sub(n)} = ${fmt(z ** n, 4)}`, corner.x, view.yMax, { align: corner.align, dx: corner.dx, color, size: 12, dy: 32 });
    const time = z === 1 ? 'the error never doubles or halves'
      : `${z > 1 ? 'doubles' : 'halves'} every ${fmt(steps, 1)} steps = ${fmt(z > 1 ? doubling : halving, 2)} s at h = ${fmt(h_, 3)} s`;
    drawText(g, view, time, corner.x, view.yMax, { align: corner.align, dx: corner.dx, color, size: 12, dy: 48 });
  });

  const update = () => stage.invalidate();

  const btn = (label, fn) => el('button', { class: 'btn', type: 'button', onclick: fn }, label);
  root.append(controls(
    row(
      btn('Step', () => { n = Math.min(MAX_STEPS, n + 1); update(); }),
      btn('+10 steps', () => { n = Math.min(MAX_STEPS, n + 10); update(); }),
      btn('Reset', () => { n = 10; update(); }),
      btn('z = 1.05', () => zStore.set({ z: 1.05 })),
      btn('z = 0.95', () => zStore.set({ z: 0.95 })),
    ),
  ));

  const article = root.closest('article') ?? root;
  bindScrub(article, zStore, { signal });
  bindMath(article, zStore, () => ({}), { signal });

  const unsub = store.subscribe((s, patch) => { if ('h' in patch) update(); }, { immediate: false });
  return { destroy() { unsub(); } };
}
