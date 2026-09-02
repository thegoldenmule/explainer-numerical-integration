// Panel 1, left: a point mass. Placeholder that proves the side-pane path.

import { el, fmt } from 'shared/dom.js';
import { fitCanvas, makeView, drawGrid, drawPoint, cssVar, observeResize } from 'shared/gfx/plot2d.js';
import { readout } from 'shared/ui/controls.js';

export function mount(root, ctx) {
  const canvas = el('canvas');
  const stage = el('div', { class: 'stage' }, canvas);
  const out = readout({ label: 'state' });
  root.append(stage, out.el);
  const g = canvas.getContext('2d');
  const p = { x: 1, y: 0.5 };

  function draw() {
    const { w, h, dpr } = fitCanvas(canvas);
    const view = makeView({ w, h, dpr, halfW: 4 });
    g.clearRect(0, 0, w, h);
    drawGrid(g, view, { xLabel: 'x', yLabel: 'y' });
    drawPoint(g, view, p.x, p.y, { r: 7, fill: cssVar('--accent') });
    out.set(`x = ${fmt(p.x, 2)}\ny = ${fmt(p.y, 2)}\nm = ${ctx.store.get().m}`);
  }
  const stopResize = observeResize(stage, draw);
  const unsubscribe = ctx.store.subscribe(draw);
  return { destroy() { stopResize(); unsubscribe(); } };
}
