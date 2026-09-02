// Panel 9, left: one step multiplies the error by z; n steps multiply it by zⁿ. A slider for
// z (local to the pane) and a sequence you step forward, drawn as dots, with the number of
// steps and the time (at the store's h) the error takes to double or halve.

import { el, fmt } from 'shared/dom.js';
import { createStage } from 'shared/gfx/stage.js';
import { cssVar, makeView, drawGrid, drawPolyline, drawPoint, drawText } from 'shared/gfx/plot2d.js';
import { doublingTime, halvingTime } from 'shared/math/stability.js';
import { readout, controls, row } from 'shared/ui/controls.js';

const MAX_STEPS = 140;   // "a thousandfold after 140" at 1.05

export function mount(root, ctx) {
  const { store, signal } = ctx;
  let z = 1.05, n = 10;   // the ratio and how many steps have been taken

  const stage = createStage(root, { layers: ['plot'], aspect: 'wide', signal });
  const out = readout({ label: 'error in, error out' });
  const zInput = el('input', { type: 'range', min: 0.5, max: 1.5, step: 0.001, value: z });
  const zOut = el('output', {}, z.toFixed(3));

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
  });

  function update() {
    const h = store.get().h;
    const doubling = doublingTime(h, z), halving = halvingTime(h, z);
    const steps = z > 1 ? Math.LN2 / Math.log(z) : z < 1 ? Math.LN2 / -Math.log(z) : Infinity;
    const verdict = z > 1 ? el('span', { class: 'unstable' }, 'growing') : z < 1 ? el('span', { class: 'stable' }, 'shrinking') : 'steady';
    out.set([
      `one step: e₁ = z · e₀ = ${fmt(z, 3)} · 1 = ${fmt(z, 3)}   `, verdict, '\n',
      `after ${n} step${n === 1 ? '' : 's'}: e${sub(n)} = ${fmt(z, 3)}^${n} = ${fmt(z ** n, 4)}\n`,
      z === 1 ? 'the error never doubles or halves'
        : `${z > 1 ? 'doubles' : 'halves'} every ${fmt(steps, 1)} steps = ${fmt(z > 1 ? doubling : halving, 2)} s at the current h = ${fmt(h, 3)} s`,
    ]);
    stage.invalidate();
  }
  const sub = i => String(i).replace(/\d/g, d => '₀₁₂₃₄₅₆₇₈₉'[d]);

  zInput.addEventListener('input', () => { z = Number(zInput.value); zOut.textContent = z.toFixed(3); update(); }, { signal });
  const btn = (label, fn) => el('button', { class: 'btn', type: 'button', onclick: fn }, label);
  root.append(controls(
    el('label', { class: 'control' }, el('span', { class: 'control-label' }, el('span', {}, 'z, the ratio per step'), zOut), zInput),
    row(
      btn('Step', () => { n = Math.min(MAX_STEPS, n + 1); update(); }),
      btn('+10 steps', () => { n = Math.min(MAX_STEPS, n + 10); update(); }),
      btn('Reset', () => { n = 10; update(); }),
      btn('z = 1.05', () => { z = 1.05; zInput.value = z; zOut.textContent = z.toFixed(3); update(); }),
      btn('z = 0.95', () => { z = 0.95; zInput.value = z; zOut.textContent = z.toFixed(3); update(); }),
    ),
  ));
  root.append(out.el);

  const unsub = store.subscribe((s, patch) => { if ('h' in patch) update(); }, { immediate: false });
  update();
  return { destroy() { unsub(); } };
}
